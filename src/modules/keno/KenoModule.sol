// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {KenoParams} from "./KenoParams.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {RNG} from "../../libs/RNG.sol";
import {StopLogic} from "../../libs/StopLogic.sol";

/// @notice Pure Keno module (multi-roll) using the current product rules.
///
/// Rules (defaults):
/// - Pool size N = 15 (numbers encoded as bits 0..14)
/// - Draw size M = 5 numbers without replacement
/// - Player selects `played` numbers where 1 <= played <= 5
///
/// Params:
/// - `abi.encode(uint40 numbersBitmask)` where bit i set => number i selected.
///   numbers != 0 and numbers < 2^15 - 1 (cannot select all numbers).
///
/// Payout model (gross, before hub fee-on-payout):
/// - Let P(k) be hypergeometric probability of matching k given `played`.
/// - gainFactor(played,k) = floor( 10000 / (P(k) * (played+1)) )
/// - payoutGross = amountPerRoll * gainFactor / 10000
///
/// This construction is (nearly) fair in expectation (integer truncation introduces tiny bias).
contract KenoModule is IGameModule {
    uint256 internal constant FACTOR_PRECISION = 10_000;

    // Popcount constants (same trick as refactored RouletteV2 / KenoV2)
    uint256 internal constant POPCNT_MULT =
        0x0000000000002000000000100000000008000000000400000000020000000001;
    uint256 internal constant POPCNT_MASK =
        0x0001041041041041041041041041041041041041041041041041041041041041;
    uint256 internal constant POPCNT_MODULO = 0x3F;

    /// @dev Precomputed gain factors for (played, matchCount) under N=15, M=5.
    ///      Solidity doesn't allow array constants (except byte arrays), so we encode the table as a pure function.
    ///      Values are in FACTOR_PRECISION units.
    ///
    ///      NOTE: Only matchCount <= played is meaningful; other combinations return 0.
    function _gain(uint256 played, uint256 matchCount) internal pure returns (uint256) {
        unchecked {
            if (played == 1) {
                if (matchCount == 0) return 7500;
                if (matchCount == 1) return 15000;
                return 0;
            }
            if (played == 2) {
                if (matchCount == 0) return 7777;
                if (matchCount == 1) return 7000;
                if (matchCount == 2) return 35000;
                return 0;
            }
            if (played == 3) {
                if (matchCount == 0) return 9479;
                if (matchCount == 1) return 5055;
                if (matchCount == 2) return 11375;
                if (matchCount == 3) return 113750;
                return 0;
            }
            if (played == 4) {
                if (matchCount == 0) return 13000;
                if (matchCount == 1) return 4550;
                if (matchCount == 2) return 6066;
                if (matchCount == 3) return 27300;
                if (matchCount == 4) return 546000;
                return 0;
            }
            if (played == 5) {
                if (matchCount == 0) return 19861;
                if (matchCount == 1) return 4766;
                if (matchCount == 2) return 4170;
                if (matchCount == 3) return 11122;
                if (matchCount == 4) return 100100;
                if (matchCount == 5) return 5005000;
                return 0;
            }
        }
        return 0;
    }

    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        uint40 numbers = KenoParams.decode(params);
        require(numbers != 0, "numbers=0");
        require(uint256(numbers) < ((uint256(1) << KenoParams.BIGGEST_NUMBER) - 1), "numbers=all");

        uint256 played = _popcount(numbers);
        require(played > 0, "played=0");
        require(played <= KenoParams.MAX_NUMBERS_PLAYED, "played>max");

        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        uint40 numbers = KenoParams.decode(params);
        require(numbers != 0, "numbers=0");
        require(uint256(numbers) < ((uint256(1) << KenoParams.BIGGEST_NUMBER) - 1), "numbers=all");

        uint256 played = _popcount(numbers);
        require(played > 0 && played <= KenoParams.MAX_NUMBERS_PLAYED, "played");

        uint256 maxFactor = _gain(played, played);
        require(maxFactor > 0, "maxFactor=0");

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        // reserved must cover total owed (payoutGross + refund). Using stake * maxMultiplier is sufficient.
        reserved = Math.mulDiv(stake, maxFactor, FACTOR_PRECISION);
        require(reserved > 0, "reserved=0");
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        uint40 numbers = KenoParams.decode(params);
        require(numbers != 0, "numbers=0");
        require(uint256(numbers) < ((uint256(1) << KenoParams.BIGGEST_NUMBER) - 1), "numbers=all");
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        uint32 n = stakeSpec.betCount;
        require(n > 0, "betCount=0");
        require(randomWords.length > 0, "rng");

        uint256 played = _popcount(numbers);
        require(played > 0 && played <= KenoParams.MAX_NUMBERS_PLAYED, "played");

        uint256 amount = stakeSpec.amountPerRoll;
        uint256 stake = amount * uint256(n);
        uint256 seed = randomWords[0];

        uint256 usedTurnover = 0;
        uint256 cumPayout = 0;

        for (uint32 i = 0; i < n; i++) {
            usedTurnover += amount;

            uint40 rolled = _draw(betId, uint256(i), seed);
            uint256 matchCount = _popcount(numbers & rolled);
            // matchCount <= played ensured by bitwise AND
            uint256 factor = _gain(played, matchCount);
            // factor must exist (0 only for invalid matchCount)
            require(factor > 0, "factor=0");

            cumPayout += Math.mulDiv(amount, factor, FACTOR_PRECISION);

            if (StopLogic.shouldStop(stakeSpec.stopGain, stakeSpec.stopLoss, usedTurnover, cumPayout)) {
                break;
            }
        }

        payoutGross = cumPayout;
        refundAmount = stake - usedTurnover;
    }

    /// @dev Draw M=5 unique numbers from N=15 using partial Fisher-Yates shuffle.
    function _draw(uint256 betId, uint256 rollIndex, uint256 seed) internal pure returns (uint40 rolled) {
        uint8[15] memory available;
        for (uint8 i = 0; i < KenoParams.BIGGEST_NUMBER; ) {
            available[i] = i;
            unchecked { ++i; }
        }

        uint256 result = 0;
        uint256 remaining = KenoParams.BIGGEST_NUMBER;

        for (uint8 i = 0; i < KenoParams.DRAW_COUNT; ) {
            // In refactored: randomIndex = (keccak(seed, i) % remaining) + i
            uint256 r = RNG.roll2(betId, rollIndex, uint256(i), seed);
            uint256 randomIndex = (r % remaining) + uint256(i);
            uint8 selectedIndex = available[randomIndex];
            result |= (uint256(1) << selectedIndex);

            if (randomIndex != i) {
                available[randomIndex] = available[i];
            }

            unchecked {
                --remaining;
                ++i;
            }
        }

        return uint40(result);
    }

    function _popcount(uint40 numbers) internal pure returns (uint256) {
        return ((uint256(numbers) * POPCNT_MULT) & POPCNT_MASK) % POPCNT_MODULO;
    }
}
