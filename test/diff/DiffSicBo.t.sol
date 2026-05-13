// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {SicBoModule} from "../../src/modules/sicbo/SicBoModule.sol";
import {SicBoParams} from "../../src/modules/sicbo/SicBoParams.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {StopLogic} from "../../src/libs/StopLogic.sol";

/// @notice Reference-model diff tests (ADR-0009).
///         Compares sic bo module.resolve(...) against an independent reference model.
contract DiffSicBo is Test {
    SicBoModule internal mod;

    bytes internal constant DOMAIN = "SSOT_RNG_V1";
    uint256 internal constant FACTOR_PRECISION = 10_000;
    uint256 internal constant TOTAL_OUTCOMES = 216;

    function setUp() external {
        mod = new SicBoModule();
    }

    function testFuzz_diff_sicbo(
        uint8 rawKind,
        uint8 rawValue,
        uint256 amountPerRoll,
        uint32 betCount,
        uint256 stopGain,
        uint256 stopLoss,
        uint256 betId,
        uint256 seed
    ) external view {
        uint8 kind = uint8(bound(uint256(rawKind), 0, 6));
        uint8 value = _validValue(kind, rawValue);
        amountPerRoll = bound(amountPerRoll, 1e12, 10 ether);
        betCount = uint32(bound(uint256(betCount), 1, 50));

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: amountPerRoll, betCount: betCount, stopGain: 0, stopLoss: 0});

        uint256 stake = amountPerRoll * uint256(betCount);
        stopGain = bound(stopGain, 0, stake * 220);
        stopLoss = bound(stopLoss, 0, stake * 4);
        spec.stopGain = stopGain;
        spec.stopLoss = stopLoss;

        bytes memory params = SicBoParams.encode(kind, value);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;

        (uint256 gotPayout, uint256 gotRefund) = mod.resolve(params, spec, betId, rw);
        (uint256 expPayout, uint256 expRefund) = _refResolve(kind, value, spec, betId, seed);

        assertEq(gotPayout, expPayout, "payout mismatch");
        assertEq(gotRefund, expRefund, "refund mismatch");
    }

    function test_factorTablesAreFairFloors() external pure {
        _assertFixedEventFair(105, 20_571, 45);
        _assertFixedEventFair(6, 360_000, 0);
        _assertFixedEventFair(1, 2_160_000, 0);
        _assertFixedEventFair(16, 135_000, 0);

        uint256 singleFaceWeighted = 75 * 20_000 + 15 * 40_000 + 1 * 60_000;
        assertEq(singleFaceWeighted, TOTAL_OUTCOMES * FACTOR_PRECISION);

        for (uint8 total = 4; total <= 17; total++) {
            uint256 count = _totalCount(total);
            uint256 factor = _totalFactor(total);
            assertEq(factor, (TOTAL_OUTCOMES * FACTOR_PRECISION) / count);
            assertLe(count * factor, TOTAL_OUTCOMES * FACTOR_PRECISION);
        }
    }

    function _refResolve(uint8 kind, uint8 value, SSOTTypes.StakeSpec memory spec, uint256 betId, uint256 seed)
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

            (uint8 a, uint8 b, uint8 c) = _refDice(betId, uint256(i), seed);
            uint256 factor = _refRollFactor(kind, value, a, b, c);
            payout += (amount * factor) / FACTOR_PRECISION;

            if (StopLogic.shouldStop(spec.stopGain, spec.stopLoss, used, payout)) {
                break;
            }
        }

        payoutGross = payout;
        refundAmount = stake - used;
    }

    function _validValue(uint8 kind, uint8 rawValue) internal pure returns (uint8) {
        if (kind == SicBoParams.KIND_SMALL || kind == SicBoParams.KIND_BIG || kind == SicBoParams.KIND_ANY_TRIPLE) {
            return 0;
        }
        if (kind == SicBoParams.KIND_TOTAL) {
            return uint8(bound(uint256(rawValue), 4, 17));
        }
        return uint8(bound(uint256(rawValue), 1, 6));
    }

    function _refDice(uint256 betId, uint256 rollIndex, uint256 seed)
        internal
        pure
        returns (uint8 a, uint8 b, uint8 c)
    {
        a = _refDie(betId, rollIndex, 0, seed);
        b = _refDie(betId, rollIndex, 1, seed);
        c = _refDie(betId, rollIndex, 2, seed);
    }

    function _refDie(uint256 betId, uint256 rollIndex, uint256 dieIndex, uint256 seed) internal pure returns (uint8) {
        return uint8(uint256(keccak256(abi.encodePacked(DOMAIN, betId, rollIndex, dieIndex, seed))) % 6) + 1;
    }

    function _refRollFactor(uint8 kind, uint8 value, uint8 a, uint8 b, uint8 c) internal pure returns (uint256) {
        uint8 total = a + b + c;
        bool triple = a == b && b == c;

        if (kind == SicBoParams.KIND_SMALL) return !triple && total >= 4 && total <= 10 ? 20_571 : 0;
        if (kind == SicBoParams.KIND_BIG) return !triple && total >= 11 && total <= 17 ? 20_571 : 0;
        if (kind == SicBoParams.KIND_ANY_TRIPLE) return triple ? 360_000 : 0;
        if (kind == SicBoParams.KIND_SPECIFIC_TRIPLE) return triple && a == value ? 2_160_000 : 0;
        if (kind == SicBoParams.KIND_TOTAL) return total == value ? _totalFactor(value) : 0;
        if (kind == SicBoParams.KIND_SPECIFIC_DOUBLE) return _faceCount(value, a, b, c) >= 2 ? 135_000 : 0;
        if (kind == SicBoParams.KIND_SINGLE_FACE) return 20_000 * _faceCount(value, a, b, c);
        revert("kind");
    }

    function _faceCount(uint8 face, uint8 a, uint8 b, uint8 c) internal pure returns (uint8 count) {
        if (a == face) count++;
        if (b == face) count++;
        if (c == face) count++;
    }

    function _assertFixedEventFair(uint256 count, uint256 factor, uint256 expectedShortfall) internal pure {
        uint256 target = TOTAL_OUTCOMES * FACTOR_PRECISION;
        assertLe(count * factor, target);
        assertEq(target - count * factor, expectedShortfall);
    }

    function _totalFactor(uint8 total) internal pure returns (uint256) {
        return (TOTAL_OUTCOMES * FACTOR_PRECISION) / _totalCount(total);
    }

    function _totalCount(uint8 total) internal pure returns (uint256) {
        if (total == 4 || total == 17) return 3;
        if (total == 5 || total == 16) return 6;
        if (total == 6 || total == 15) return 10;
        if (total == 7 || total == 14) return 15;
        if (total == 8 || total == 13) return 21;
        if (total == 9 || total == 12) return 25;
        if (total == 10 || total == 11) return 27;
        revert("total");
    }
}
