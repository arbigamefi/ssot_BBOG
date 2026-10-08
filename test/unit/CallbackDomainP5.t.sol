// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {CasinoParameterDomain, IGameModule, SSOTTypes} from "../utils/CasinoParameterDomain.sol";

/// P5, the first-callback certificate's domain lemma (docs/audit/first-callback-gas-certificate-2026-10-07.md):
/// at the certified minimum bet of 99 raw units per round every admitted casino position has
/// k = reserved - stake > 0, so the uncertified k = 0 allocation path stays outside the callback domain.
/// Every value of each module's complete decoded parameter domain goes through `validate` and `maxPayout`
/// exactly as GameHub.placeBet does (test/utils/CasinoParameterDomain.sol). Adopted from the independent landing
/// review of 2026-10-07.
contract CallbackDomainP5Test is CasinoParameterDomain {
    uint256 internal admitted;
    uint256 internal minK;
    bytes internal tightest;

    function setUp() public {
        _deployModules();
    }

    function _reset() internal {
        admitted = 0;
        minK = type(uint256).max;
        delete tightest;
    }

    function _onAdmitted(uint256, bytes memory params, uint256 reserved) internal override {
        ++admitted;
        uint256 k = reserved - FLOOR_STAKE; // reserved >= stake is checked by Bank.holdBet; here it must hold too
        if (k < minK) {
            minK = k;
            tightest = params;
        }
    }

    /// Smallest per-round amount (1 round) at which the tightest admitted parameter has k > 0.
    function _floor(IGameModule m, bytes memory params) internal view returns (uint256 s) {
        for (s = 1; s < 1000; ++s) {
            (bool ok, uint256 reserved) =
                _admit(m, params, SSOTTypes.StakeSpec(s, 1, type(uint256).max, type(uint256).max));
            if (ok && reserved > s) return s;
        }
    }

    function _report(uint256 module) internal {
        emit log_named_string("module", MODULE_NAMES[module]);
        emit log_named_uint("  admitted parameter values (complete domain)", admitted);
        emit log_named_uint("  minimum k at stake 99", minK);
        emit log_named_bytes("  tightest params", tightest);
        emit log_named_uint("  smallest stake with k > 0 for the tightest params", _floor(modules[module], tightest));
        assertEq(admitted, _expectedAdmitted(module), "parameter domain changed");
        assertGt(minK, 0, "P5 fails at the certified floor");
    }

    function _run(uint256 module) internal {
        _reset();
        _enumerate(module);
        _report(module);
    }

    function test_dice() public {
        _run(0);
        assertEq(_floor(modules[0], tightest), 99, "Dice is the binding module");
    }

    function test_coinToss() public {
        _run(1);
    }

    function test_roulette() public {
        _run(2);
    }

    function test_keno() public {
        _run(3);
    }

    function test_plinko() public {
        _run(4);
    }

    function test_sicBo() public {
        _run(5);
    }

    function test_slots() public {
        _run(6);
    }

    function test_baccarat() public {
        _run(7);
    }

    /// Multi-round stakes: k = floor(s*N/D) - s = floor(s*(N-D)/D) is non-decreasing in s, so round counts only
    /// help. Spot-check the binding Dice parameter at every round count 1..25.
    function test_diceRoundsAtFloor() public view {
        for (uint32 n = 1; n <= 25; ++n) {
            (bool ok, uint256 reserved) = _admit(
                modules[0],
                abi.encode(false, uint8(99)),
                SSOTTypes.StakeSpec(99, n, type(uint256).max, type(uint256).max)
            );
            assertTrue(ok);
            assertEq(reserved - uint256(99) * n, uint256(99) * n / 99, "k = floor(stake / 99)");
        }
    }
}
