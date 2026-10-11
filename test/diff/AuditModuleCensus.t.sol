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

/// @notice Independent M4/P5 check: for any params of 0..64 bytes that pass `validate` (as GameHub admits them),
///         `resolve` never reverts, payout + refund <= maxPayout, refund <= stake, and maxPayout > stake once
///         amountPerRoll >= 99. Params are random bytes biased towards small words, not a structured domain, so
///         this also probes malformed encodings and trailing data that `validate` accepts.
contract AuditModuleCensusTest is Test {
    IGameModule[8] internal m;
    uint256 internal rng;

    function setUp() public {
        m[0] = new DiceModule();
        m[1] = new CoinTossModule();
        m[2] = new RouletteModule();
        m[3] = new KenoModule();
        m[4] = new PlinkoModule();
        m[5] = new SicBoModule();
        m[6] = new SlotsModule();
        m[7] = new BaccaratModule();
    }

    function _r() internal returns (uint256) {
        rng = uint256(keccak256(abi.encode(rng)));
        return rng;
    }

    function _word() internal returns (uint256) {
        uint256 c = _r() % 6;
        if (c == 0) return _r() % 8;
        if (c == 1) return _r() % 64;
        if (c == 2) return _r() % 256;
        if (c == 3) return _r() % (uint256(1) << 40);
        if (c == 4) return (uint256(1) << 37) - 1 - (_r() % 3);
        return _r();
    }

    /// Well-formed params for module `gi` (half of all draws), so every module gets dense admitted coverage.
    function _structured(uint256 gi) internal returns (bytes memory) {
        if (gi == 0) return abi.encode(_r() % 2 == 0, uint8(_r() % 101));
        if (gi == 1) return abi.encode(_r() % 2 == 0);
        if (gi == 2) return abi.encode(uint8(_r() % 15), uint40(_r() % 3 == 0 ? _r() % 40 : _r() % (uint256(1) << 37)));
        if (gi == 3) return abi.encode(uint40(_r() % (uint256(1) << 15)));
        if (gi == 4) return abi.encode(uint8(_r() % 4));
        if (gi == 5) return abi.encode(uint8(_r() % 8), uint8(_r() % 19));
        if (gi == 6) return abi.encode(uint8(_r() % 2));
        return abi.encode(uint8(_r() % 4));
    }

    function _params() internal returns (bytes memory p) {
        uint256 len = [uint256(0), 31, 32, 33, 63, 64, 64, 64, 32, 32][_r() % 10];
        bytes memory full = abi.encode(_word(), _word());
        p = new bytes(len);
        for (uint256 i; i < len; ++i) p[i] = full[i];
    }

    function _spec() internal returns (SSOTTypes.StakeSpec memory s) {
        uint256 c = _r() % 4;
        s.amountPerRoll = c == 0 ? 99 : c == 1 ? 99 + _r() % 10_000 : c == 2 ? 10_000 + _r() % 1e12 : 99 + _r() % 1e30;
        s.betCount = uint32(1 + _r() % 25);
        uint256 g = _r() % 3;
        s.stopGain = g == 0 ? 0 : g == 1 ? _r() % (s.amountPerRoll * 4 + 1) : _r();
        g = _r() % 3;
        s.stopLoss = g == 0 ? 0 : g == 1 ? _r() % (s.amountPerRoll * 4 + 1) : _r();
    }

    function _one(uint256 gi) internal returns (bool admitted) {
        bytes memory p = _r() % 2 == 0 ? _structured(gi) : _params();
        SSOTTypes.StakeSpec memory s = _spec();
        try m[gi].validate(p, s) {}
        catch {
            return false;
        }
        uint256 reserved = m[gi].maxPayout(p, s); // GameHub calls this unguarded after validate
        uint256 stake = s.amountPerRoll * s.betCount;
        assertGt(reserved, stake, "P5: k must be positive at amountPerRoll >= 99");
        uint256[] memory w = new uint256[](1);
        w[0] = _r();
        uint256 betId = 1 + _r() % 1e9;
        try m[gi].resolve(p, s, betId, w) returns (uint256 gross, uint256 refund) {
            assertLe(refund, stake, "refund > stake");
            assertLe(gross, reserved, "gross > reserved");
            assertLe(refund, reserved - gross, "gross + refund > reserved");
        } catch {
            revert("M4 violated: resolve reverted for an admitted bet");
        }
        return true;
    }

    function testFuzz_auditM4P5(uint256 seed) public {
        rng = seed;
        for (uint256 gi; gi < 8; ++gi) {
            for (uint256 i; i < 40; ++i) _one(gi);
        }
    }

    function test_auditM4P5Sweep() public {
        rng = uint256(keccak256("audit-m4-sweep"));
        uint256 admittedTotal;
        for (uint256 gi; gi < 8; ++gi) {
            uint256 admitted;
            for (uint256 i; i < 1500; ++i) {
                if (_one(gi)) ++admitted;
            }
            emit log_named_uint(string.concat("admitted cases, module ", vm.toString(gi)), admitted);
            assertGt(admitted, 0, "generator never admitted a bet");
            admittedTotal += admitted;
        }
        emit log_named_uint("admitted cases total", admittedTotal);
    }
}
