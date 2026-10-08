// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";
import {PlinkoModule} from "../../src/modules/plinko/PlinkoModule.sol";
import {SicBoModule} from "../../src/modules/sicbo/SicBoModule.sol";
import {SlotsModule} from "../../src/modules/slots/SlotsModule.sol";
import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";

/// The COMPLETE decoded parameter domain of every certified casino module: every value of each parameter's ABI
/// type, enumerated the way GameHub.placeBet admits a bet (`validate`, then `maxPayout`). Roulette's raw-bitmask
/// kind has 2^37 masks and its module code depends on the mask only through its popcount, so one mask per popcount
/// (plus masks with bits above 36) is the complete equivalence-class enumeration. Tests inherit this contract and
/// receive every admitted (module, params) pair through `_onAdmitted`; `_onRejected` sees the rest.
abstract contract CasinoParameterDomain is Test {
    uint256 internal constant FLOOR_STAKE = 99; // the certified minimum bet (raw units per round)
    string[8] internal MODULE_NAMES =
        [string("Dice"), "CoinToss", "Roulette", "Keno", "Plinko", "SicBo", "Slots", "Baccarat"];
    IGameModule[8] internal modules;

    function _deployModules() internal {
        modules[0] = IGameModule(address(new DiceModule()));
        modules[1] = IGameModule(address(new CoinTossModule()));
        modules[2] = IGameModule(address(new RouletteModule()));
        modules[3] = IGameModule(address(new KenoModule()));
        modules[4] = IGameModule(address(new PlinkoModule()));
        modules[5] = IGameModule(address(new SicBoModule()));
        modules[6] = IGameModule(address(new SlotsModule()));
        modules[7] = IGameModule(address(new BaccaratModule()));
    }

    function _floorSpec() internal pure returns (SSOTTypes.StakeSpec memory) {
        return SSOTTypes.StakeSpec(FLOOR_STAKE, 1, type(uint256).max, type(uint256).max);
    }

    /// GameHub order: validate, then maxPayout; GameHub rejects reserved == 0.
    function _admit(IGameModule m, bytes memory params, SSOTTypes.StakeSpec memory s)
        internal
        view
        returns (bool admitted, uint256 reserved)
    {
        try m.validate(params, s) {}
        catch {
            return (false, 0);
        }
        try m.maxPayout(params, s) returns (uint256 r) {
            if (r == 0) return (false, 0);
            return (true, r);
        } catch {
            return (false, 0);
        }
    }

    function _onAdmitted(uint256 module, bytes memory params, uint256 reservedAtFloor) internal virtual;
    function _onRejected(uint256, bytes memory) internal virtual {}

    /// Tens of thousands of visits would otherwise grow this frame's memory without bound (Solidity never frees
    /// memory, and expansion is quadratic). Nothing from one visit is used by the next, so the free memory pointer
    /// is rewound after each visit; results live in storage.
    function _mark() internal pure returns (uint256 fmp) {
        assembly ("memory-safe") {
            fmp := mload(0x40)
        }
    }

    function _release(uint256 fmp) internal pure {
        assembly ("memory-safe") {
            mstore(0x40, fmp)
        }
    }

    function _visit(uint256 module, bytes memory params) internal {
        uint256 fmp = _mark();
        (bool ok, uint256 reserved) = _admit(modules[module], params, _floorSpec());
        if (ok) _onAdmitted(module, params, reserved);
        else _onRejected(module, params);
        _release(fmp);
    }

    function _visit1(uint256 module, uint256 a) internal {
        uint256 fmp = _mark();
        if (module == 1) _visit(1, abi.encode(a == 1));
        else if (module == 3) _visit(3, abi.encode(uint40(a)));
        else _visit(module, abi.encode(uint8(a)));
        _release(fmp);
    }

    function _visit2(uint256 module, uint256 a, uint256 b) internal {
        uint256 fmp = _mark();
        if (module == 0) _visit(0, abi.encode(a == 1, uint8(b)));
        else if (module == 2) _visit(2, abi.encode(uint8(a), uint40(b)));
        else _visit(5, abi.encode(uint8(a), uint8(b)));
        _release(fmp);
    }

    /// Visits the complete parameter domain of one module.
    function _enumerate(uint256 module) internal {
        if (module == 0) {
            for (uint256 t; t < 256; ++t) {
                _visit2(0, 0, t);
                _visit2(0, 1, t);
            }
        } else if (module == 1) {
            _visit1(1, 0);
            _visit1(1, 1);
        } else if (module == 2) {
            // Kind 0 (raw bitmask): one representative per popcount 1..37, plus masks using bits 37..39.
            for (uint256 pc = 1; pc <= 37; ++pc) {
                _visit2(2, 0, (uint256(1) << pc) - 1);
                _visit2(2, 0, ((uint256(1) << pc) - 1) << (37 - pc));
            }
            _visit2(2, 0, uint256(1) << 37);
            _visit2(2, 0, uint256(1) << 39);
            // Typed kinds 1..13: every payload any kind can interpret (Split packs two 6-bit numbers), plus a
            // payload with high bits set; kinds 14..255 must revert in the enum conversion.
            for (uint256 kind = 1; kind < 256; ++kind) {
                for (uint256 payload; payload < 4096; ++payload) {
                    _visit2(2, kind, payload);
                    if (kind >= 14) break;
                }
                _visit2(2, kind, uint256(1) << 39);
            }
        } else if (module == 3) {
            for (uint256 mask; mask < (1 << 15); ++mask) {
                _visit1(3, mask);
            }
            for (uint256 bit = 15; bit < 40; ++bit) {
                _visit1(3, uint256(1) << bit);
            }
        } else if (module == 4 || module == 6 || module == 7) {
            for (uint256 v; v < 256; ++v) {
                _visit1(module, v);
            }
        } else if (module == 5) {
            for (uint256 kind; kind < 256; ++kind) {
                for (uint256 value; value < 256; ++value) {
                    _visit2(5, kind, value);
                }
            }
        }
    }

    /// Expected admitted counts per module (a change here means the parameter domain changed).
    function _expectedAdmitted(uint256 module) internal pure returns (uint256) {
        if (module == 0) return 198;
        if (module == 1) return 2;
        if (module == 2) return 26_074;
        if (module == 3) return 4_943;
        if (module == 4) return 3;
        if (module == 5) return 35;
        if (module == 6) return 1;
        return 3;
    }
}
