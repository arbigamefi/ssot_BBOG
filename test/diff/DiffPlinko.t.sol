// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {PlinkoModule} from "../../src/modules/plinko/PlinkoModule.sol";
import {PlinkoParams} from "../../src/modules/plinko/PlinkoParams.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {StopLogic} from "../../src/libs/StopLogic.sol";

/// @notice Reference-model diff tests (ADR-0009).
///         Compares plinko module.resolve(...) against an independent reference model.
contract DiffPlinko is Test {
    PlinkoModule internal mod;

    bytes internal constant DOMAIN = "SSOT_RNG_V1";
    uint256 internal constant FACTOR_PRECISION = 10_000;
    uint256 internal constant TOTAL_WEIGHT = 256;

    function setUp() external {
        mod = new PlinkoModule();
    }

    function testFuzz_diff_plinko(
        uint8 rawRisk,
        uint256 amountPerRoll,
        uint32 betCount,
        uint256 stopGain,
        uint256 stopLoss,
        uint256 betId,
        uint256 seed
    ) external view {
        uint8 risk = uint8(bound(uint256(rawRisk), 0, 2));
        amountPerRoll = bound(amountPerRoll, 1e12, 10 ether);
        betCount = uint32(bound(uint256(betCount), 1, 50));

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: amountPerRoll, betCount: betCount, stopGain: 0, stopLoss: 0});

        uint256 stake = amountPerRoll * uint256(betCount);
        stopGain = bound(stopGain, 0, stake * 30);
        stopLoss = bound(stopLoss, 0, stake * 4);
        spec.stopGain = stopGain;
        spec.stopLoss = stopLoss;

        bytes memory params = PlinkoParams.encode(risk);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;

        (uint256 gotPayout, uint256 gotRefund) = mod.resolve(params, spec, betId, rw);
        (uint256 expPayout, uint256 expRefund) = _refResolve(risk, spec, betId, seed);

        assertEq(gotPayout, expPayout, "payout mismatch");
        assertEq(gotRefund, expRefund, "refund mismatch");
    }

    function test_paytablesAreNearFairFloors() external pure {
        _assertNearFair(PlinkoParams.RISK_LOW, 148);
        _assertNearFair(PlinkoParams.RISK_MEDIUM, 202);
        _assertNearFair(PlinkoParams.RISK_HIGH, 158);
    }

    function _refResolve(uint8 risk, SSOTTypes.StakeSpec memory spec, uint256 betId, uint256 seed)
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

            uint8 bucket = _refBucket(betId, uint256(i), seed);
            uint256 factor = _refFactor(risk, bucket);
            payout += (amount * factor) / FACTOR_PRECISION;

            if (StopLogic.shouldStop(spec.stopGain, spec.stopLoss, used, payout)) {
                break;
            }
        }

        payoutGross = payout;
        refundAmount = stake - used;
    }

    function _refBucket(uint256 betId, uint256 i, uint256 seed) internal pure returns (uint8 bucket) {
        for (uint8 row = 0; row < 8; row++) {
            bucket += uint8(uint256(keccak256(abi.encodePacked(DOMAIN, betId, i, uint256(row), seed))) & 1);
        }
    }

    function _assertNearFair(uint8 risk, uint256 expectedShortfall) internal pure {
        uint256 weighted = 0;
        for (uint8 bucket = 0; bucket < 9; bucket++) {
            weighted += _binomialWeight(bucket) * _refFactor(risk, bucket);
        }

        uint256 target = TOTAL_WEIGHT * FACTOR_PRECISION;
        assertLe(weighted, target);
        assertEq(target - weighted, expectedShortfall);
    }

    function _binomialWeight(uint8 bucket) internal pure returns (uint256) {
        if (bucket == 0 || bucket == 8) return 1;
        if (bucket == 1 || bucket == 7) return 8;
        if (bucket == 2 || bucket == 6) return 28;
        if (bucket == 3 || bucket == 5) return 56;
        return 70;
    }

    function _refFactor(uint8 risk, uint8 bucket) internal pure returns (uint256) {
        if (risk == PlinkoParams.RISK_LOW) return _lowFactor(bucket);
        if (risk == PlinkoParams.RISK_MEDIUM) return _mediumFactor(bucket);
        if (risk == PlinkoParams.RISK_HIGH) return _highFactor(bucket);
        revert("risk");
    }

    function _lowFactor(uint8 bucket) internal pure returns (uint256) {
        if (bucket == 0 || bucket == 8) return 15_264;
        if (bucket == 1 || bucket == 7) return 13_083;
        if (bucket == 2 || bucket == 6) return 10_902;
        if (bucket == 3 || bucket == 5) return 9_812;
        if (bucket == 4) return 8_722;
        revert("bucket");
    }

    function _mediumFactor(uint8 bucket) internal pure returns (uint256) {
        if (bucket == 0 || bucket == 8) return 82_714;
        if (bucket == 1 || bucket == 7) return 34_464;
        if (bucket == 2 || bucket == 6) return 16_542;
        if (bucket == 3 || bucket == 5) return 6_892;
        if (bucket == 4) return 2_067;
        revert("bucket");
    }

    function _highFactor(uint8 bucket) internal pure returns (uint256) {
        if (bucket == 0 || bucket == 8) return 246_153;
        if (bucket == 1 || bucket == 7) return 61_538;
        if (bucket == 2 || bucket == 6) return 13_186;
        if (bucket == 3 || bucket == 5) return 3_076;
        if (bucket == 4) return 0;
        revert("bucket");
    }
}
