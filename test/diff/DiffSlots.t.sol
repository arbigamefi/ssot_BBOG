// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {SlotsModule} from "../../src/modules/slots/SlotsModule.sol";
import {SlotsParams} from "../../src/modules/slots/SlotsParams.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {StopLogic} from "../../src/libs/StopLogic.sol";

/// @notice Reference-model diff tests (ADR-0009).
///         Compares slots module.resolve(...) against an independent reference model.
contract DiffSlots is Test {
    SlotsModule internal mod;

    bytes internal constant DOMAIN = "SSOT_RNG_V1";

    function setUp() external {
        mod = new SlotsModule();
    }

    function testFuzz_diff_slots_classic(
        uint256 amountPerRoll,
        uint32 betCount,
        uint256 stopGain,
        uint256 stopLoss,
        uint256 betId,
        uint256 seed
    ) external view {
        amountPerRoll = bound(amountPerRoll, 1e12, 10 ether);
        betCount = uint32(bound(uint256(betCount), 1, 50));

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: amountPerRoll, betCount: betCount, stopGain: 0, stopLoss: 0});

        uint256 stake = amountPerRoll * uint256(betCount);
        stopGain = bound(stopGain, 0, stake * 64);
        stopLoss = bound(stopLoss, 0, stake * 4);
        spec.stopGain = stopGain;
        spec.stopLoss = stopLoss;

        bytes memory params = SlotsParams.encode(SlotsParams.PROFILE_CLASSIC);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;

        (uint256 gotPayout, uint256 gotRefund) = mod.resolve(params, spec, betId, rw);
        (uint256 expPayout, uint256 expRefund) = _refResolve(spec, betId, seed);

        assertEq(gotPayout, expPayout, "payout mismatch");
        assertEq(gotRefund, expRefund, "refund mismatch");
    }

    function test_classicPaytableExpectedGrossIsFair() external pure {
        uint256 exactlyOnePairOutcomes = 8 * 3 * 7;
        uint256 nonJackpotTripleOutcomes = 7;
        uint256 jackpotTripleOutcomes = 1;

        uint256 weightedGross = exactlyOnePairOutcomes * 2 + nonJackpotTripleOutcomes * 16 + jackpotTripleOutcomes * 64;

        assertEq(weightedGross, 8 * 8 * 8);
    }

    function _refResolve(SSOTTypes.StakeSpec memory spec, uint256 betId, uint256 seed)
        internal
        pure
        returns (uint256 payoutGross, uint256 refundAmount)
    {
        uint256 amount = spec.amountPerRoll;
        uint32 n = spec.betCount;
        uint256 stake = amount * uint256(n);

        uint256 used = 0;
        uint256 payout = 0;

        for (uint32 i = 0; i < n; i++) {
            used += amount;

            uint8 a = _refSymbol(betId, uint256(i), 0, seed);
            uint8 b = _refSymbol(betId, uint256(i), 1, seed);
            uint8 c = _refSymbol(betId, uint256(i), 2, seed);

            payout += amount * _refMultiplier(a, b, c);

            if (StopLogic.shouldStop(spec.stopGain, spec.stopLoss, used, payout)) {
                break;
            }
        }

        payoutGross = payout;
        refundAmount = stake - used;
    }

    function _refSymbol(uint256 betId, uint256 i, uint256 j, uint256 seed) internal pure returns (uint8) {
        return uint8(uint256(keccak256(abi.encodePacked(DOMAIN, betId, i, j, seed))) % 8);
    }

    function _refMultiplier(uint8 a, uint8 b, uint8 c) internal pure returns (uint256) {
        if (a == b && b == c) {
            return a == 7 ? 64 : 16;
        }
        if (a == b || a == c || b == c) {
            return 2;
        }
        return 0;
    }
}
