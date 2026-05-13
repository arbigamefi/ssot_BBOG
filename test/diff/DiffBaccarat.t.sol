// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";
import {BaccaratParams} from "../../src/modules/baccarat/BaccaratParams.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {StopLogic} from "../../src/libs/StopLogic.sol";

/// @notice Reference-model diff tests (ADR-0009).
///         Compares baccarat module.resolve(...) against an independent reference model.
contract DiffBaccarat is Test {
    BaccaratModule internal mod;

    bytes internal constant DOMAIN = "SSOT_RNG_V1";
    uint256 internal constant TOTAL_OUTCOMES = 13 ** 6;

    function setUp() external {
        mod = new BaccaratModule();
    }

    function testFuzz_diff_baccarat(
        uint8 rawSide,
        uint256 amountPerRoll,
        uint32 betCount,
        uint256 stopGain,
        uint256 stopLoss,
        uint256 betId,
        uint256 seed
    ) external view {
        uint8 side = uint8(bound(uint256(rawSide), 0, 2));
        amountPerRoll = bound(amountPerRoll, 1e12, 10 ether);
        betCount = uint32(bound(uint256(betCount), 1, 50));

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: amountPerRoll, betCount: betCount, stopGain: 0, stopLoss: 0});

        uint256 stake = amountPerRoll * uint256(betCount);
        stopGain = bound(stopGain, 0, stake * 12);
        stopLoss = bound(stopLoss, 0, stake * 4);
        spec.stopGain = stopGain;
        spec.stopLoss = stopLoss;

        bytes memory params = BaccaratParams.encode(side);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;

        (uint256 gotPayout, uint256 gotRefund) = mod.resolve(params, spec, betId, rw);
        (uint256 expPayout, uint256 expRefund) = _refResolve(side, spec, betId, seed);

        assertEq(gotPayout, expPayout, "payout mismatch");
        assertEq(gotRefund, expRefund, "refund mismatch");
    }

    function test_exactFactorsArePlayerFavorableFloors() external pure {
        _assertFloorFactor(2_153_464, 22_414);
        _assertFloorFactor(2_212_744, 21_813);
        _assertFloorFactor(460_601, 104_793);
    }

    function _refResolve(uint8 side, SSOTTypes.StakeSpec memory spec, uint256 betId, uint256 seed)
        internal
        pure
        returns (uint256 payoutGross, uint256 refundAmount)
    {
        uint256 amount = spec.amountPerRoll;
        uint32 n = spec.betCount;
        uint256 stake = amount * uint256(n);
        uint256 factor = _refFactor(side);

        uint256 used = 0;
        uint256 payout = 0;

        for (uint32 i = 0; i < n; i++) {
            used += amount;

            if (_refOutcome(betId, uint256(i), seed) == side) {
                payout += (amount * factor) / 10_000;
            }

            if (StopLogic.shouldStop(spec.stopGain, spec.stopLoss, used, payout)) {
                break;
            }
        }

        payoutGross = payout;
        refundAmount = stake - used;
    }

    function _refFactor(uint8 side) internal pure returns (uint256) {
        if (side == BaccaratParams.SIDE_PLAYER) return 22_414;
        if (side == BaccaratParams.SIDE_BANKER) return 21_813;
        if (side == BaccaratParams.SIDE_TIE) return 104_793;
        revert("side");
    }

    function _refOutcome(uint256 betId, uint256 rollIndex, uint256 seed) internal pure returns (uint8) {
        uint8 playerTotal = (_refCardValue(betId, rollIndex, 0, seed) + _refCardValue(betId, rollIndex, 2, seed)) % 10;
        uint8 bankerTotal = (_refCardValue(betId, rollIndex, 1, seed) + _refCardValue(betId, rollIndex, 3, seed)) % 10;

        if (playerTotal < 8 && bankerTotal < 8) {
            bool playerDraws = playerTotal <= 5;
            uint8 playerThird = 0;

            if (playerDraws) {
                playerThird = _refCardValue(betId, rollIndex, 4, seed);
                playerTotal = (playerTotal + playerThird) % 10;
            }

            if (_refBankerDraws(bankerTotal, playerDraws, playerThird)) {
                bankerTotal = (bankerTotal + _refCardValue(betId, rollIndex, 5, seed)) % 10;
            }
        }

        if (playerTotal > bankerTotal) return BaccaratParams.SIDE_PLAYER;
        if (bankerTotal > playerTotal) return BaccaratParams.SIDE_BANKER;
        return BaccaratParams.SIDE_TIE;
    }

    function _refBankerDraws(uint8 bankerTotal, bool playerDraws, uint8 playerThird) internal pure returns (bool) {
        if (!playerDraws) return bankerTotal <= 5;
        if (bankerTotal <= 2) return true;
        if (bankerTotal == 3) return playerThird != 8;
        if (bankerTotal == 4) return playerThird >= 2 && playerThird <= 7;
        if (bankerTotal == 5) return playerThird >= 4 && playerThird <= 7;
        if (bankerTotal == 6) return playerThird == 6 || playerThird == 7;
        return false;
    }

    function _refCardValue(uint256 betId, uint256 i, uint256 j, uint256 seed) internal pure returns (uint8) {
        uint8 rank = uint8(uint256(keccak256(abi.encodePacked(DOMAIN, betId, i, j, seed))) % 13);
        if (rank <= 8) return rank + 1;
        return 0;
    }

    function _assertFloorFactor(uint256 wins, uint256 factor) internal pure {
        assertEq((TOTAL_OUTCOMES * 10_000) / wins, factor);
        assertLe(wins * factor, TOTAL_OUTCOMES * 10_000);
        assertGt(wins * (factor + 1), TOTAL_OUTCOMES * 10_000);
    }
}
