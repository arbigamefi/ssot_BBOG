// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {RNG} from "../../libs/RNG.sol";
import {SicBoParams} from "./SicBoParams.sol";
import {StopLogic} from "../../libs/StopLogic.sol";

/// @notice Pure Sic Bo module (multi-roll).
///
/// Rules:
/// - Each roll throws three independent dice, values 1..6.
/// - Supported bets: Small, Big, Any Triple, Specific Triple, Exact Total,
///   Specific Double, and Single Face.
/// - Payout factors are fair gross floors before GameHub fee-on-payout.
contract SicBoModule is IGameModule {
    uint256 internal constant FACTOR_PRECISION = 10_000;

    uint256 internal constant SMALL_BIG_FACTOR = 20_571;
    uint256 internal constant ANY_TRIPLE_FACTOR = 360_000;
    uint256 internal constant SPECIFIC_TRIPLE_FACTOR = 2_160_000;
    uint256 internal constant SPECIFIC_DOUBLE_FACTOR = 135_000;
    uint256 internal constant SINGLE_FACE_UNIT_FACTOR = 20_000;

    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        (uint8 kind, uint8 value) = SicBoParams.decode(params);
        _validateBet(kind, value);
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        (uint8 kind, uint8 value) = SicBoParams.decode(params);
        _validateBet(kind, value);

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        reserved = Math.mulDiv(stake, _maxFactor(kind, value), FACTOR_PRECISION);
        require(reserved > 0, "reserved=0");
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        (uint8 kind, uint8 value) = SicBoParams.decode(params);
        _validateBet(kind, value);
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        uint32 n = stakeSpec.betCount;
        require(n > 0, "betCount=0");
        require(randomWords.length > 0, "rng");

        uint256 amount = stakeSpec.amountPerRoll;
        uint256 stake = amount * uint256(n);
        uint256 seed = randomWords[0];

        uint256 usedTurnover = 0;
        uint256 cumPayout = 0;

        for (uint32 i = 0; i < n; i++) {
            usedTurnover += amount;

            (uint8 a, uint8 b, uint8 c) = _dice(betId, uint256(i), seed);
            uint256 factor = _rollFactor(kind, value, a, b, c);
            if (factor > 0) {
                cumPayout += Math.mulDiv(amount, factor, FACTOR_PRECISION);
            }

            if (StopLogic.shouldStop(stakeSpec.stopGain, stakeSpec.stopLoss, usedTurnover, cumPayout)) {
                break;
            }
        }

        payoutGross = cumPayout;
        refundAmount = stake - usedTurnover;
    }

    function _validateBet(uint8 kind, uint8 value) internal pure {
        if (kind == SicBoParams.KIND_SMALL || kind == SicBoParams.KIND_BIG || kind == SicBoParams.KIND_ANY_TRIPLE) {
            require(value == 0, "value");
            return;
        }
        if (kind == SicBoParams.KIND_SPECIFIC_TRIPLE || kind == SicBoParams.KIND_SPECIFIC_DOUBLE) {
            require(value >= 1 && value <= 6, "face");
            return;
        }
        if (kind == SicBoParams.KIND_TOTAL) {
            require(value >= 4 && value <= 17, "total");
            return;
        }
        if (kind == SicBoParams.KIND_SINGLE_FACE) {
            require(value >= 1 && value <= 6, "face");
            return;
        }
        revert("kind");
    }

    function _maxFactor(uint8 kind, uint8 value) internal pure returns (uint256) {
        if (kind == SicBoParams.KIND_SMALL || kind == SicBoParams.KIND_BIG) return SMALL_BIG_FACTOR;
        if (kind == SicBoParams.KIND_ANY_TRIPLE) return ANY_TRIPLE_FACTOR;
        if (kind == SicBoParams.KIND_SPECIFIC_TRIPLE) return SPECIFIC_TRIPLE_FACTOR;
        if (kind == SicBoParams.KIND_TOTAL) return _totalFactor(value);
        if (kind == SicBoParams.KIND_SPECIFIC_DOUBLE) return SPECIFIC_DOUBLE_FACTOR;
        return SINGLE_FACE_UNIT_FACTOR * 3;
    }

    function _dice(uint256 betId, uint256 rollIndex, uint256 seed) internal pure returns (uint8 a, uint8 b, uint8 c) {
        a = _die(betId, rollIndex, 0, seed);
        b = _die(betId, rollIndex, 1, seed);
        c = _die(betId, rollIndex, 2, seed);
    }

    function _die(uint256 betId, uint256 rollIndex, uint256 dieIndex, uint256 seed) internal pure returns (uint8) {
        return uint8(RNG.roll2(betId, rollIndex, dieIndex, seed) % 6) + 1;
    }

    function _rollFactor(uint8 kind, uint8 value, uint8 a, uint8 b, uint8 c) internal pure returns (uint256) {
        uint8 total = a + b + c;
        bool triple = a == b && b == c;

        if (kind == SicBoParams.KIND_SMALL) {
            return !triple && total >= 4 && total <= 10 ? SMALL_BIG_FACTOR : 0;
        }
        if (kind == SicBoParams.KIND_BIG) {
            return !triple && total >= 11 && total <= 17 ? SMALL_BIG_FACTOR : 0;
        }
        if (kind == SicBoParams.KIND_ANY_TRIPLE) {
            return triple ? ANY_TRIPLE_FACTOR : 0;
        }
        if (kind == SicBoParams.KIND_SPECIFIC_TRIPLE) {
            return triple && a == value ? SPECIFIC_TRIPLE_FACTOR : 0;
        }
        if (kind == SicBoParams.KIND_TOTAL) {
            return total == value ? _totalFactor(value) : 0;
        }
        if (kind == SicBoParams.KIND_SPECIFIC_DOUBLE) {
            return _faceCount(value, a, b, c) >= 2 ? SPECIFIC_DOUBLE_FACTOR : 0;
        }

        return SINGLE_FACE_UNIT_FACTOR * _faceCount(value, a, b, c);
    }

    function _faceCount(uint8 face, uint8 a, uint8 b, uint8 c) internal pure returns (uint8 count) {
        if (a == face) count++;
        if (b == face) count++;
        if (c == face) count++;
    }

    function _totalFactor(uint8 total) internal pure returns (uint256) {
        return Math.mulDiv(216, FACTOR_PRECISION, _totalCount(total));
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
