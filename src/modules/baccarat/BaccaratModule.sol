// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {BaccaratParams} from "./BaccaratParams.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {RNG} from "../../libs/RNG.sol";
import {StopLogic} from "../../libs/StopLogic.sol";

/// @notice Pure Baccarat module (multi-roll).
///
/// Rules:
/// - Standard Player/Banker third-card table.
/// - Stateless RNG model: each hand draws independent ranks from a 13-rank deck distribution.
/// - No Banker commission is baked into the module; GameHub applies house edge via fee-on-payout.
///
/// Fair gross factors are precomputed from the exact 13^6 outcome space:
/// - Player win count: 2,153,464 => factor floor(13^6 * 10000 / count) = 22414
/// - Banker win count: 2,212,744 => factor floor(13^6 * 10000 / count) = 21813
/// - Tie count:        460,601 => factor floor(13^6 * 10000 / count) = 104793
contract BaccaratModule is IGameModule {
    uint256 internal constant FACTOR_PRECISION = 10_000;
    uint256 internal constant PLAYER_FACTOR = 22_414;
    uint256 internal constant BANKER_FACTOR = 21_813;
    uint256 internal constant TIE_FACTOR = 104_793;

    uint8 internal constant OUTCOME_PLAYER = 0;
    uint8 internal constant OUTCOME_BANKER = 1;
    uint8 internal constant OUTCOME_TIE = 2;

    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        _factor(BaccaratParams.decode(params));
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        uint256 factor = _factor(BaccaratParams.decode(params));
        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        reserved = Math.mulDiv(stake, factor, FACTOR_PRECISION);
        require(reserved > 0, "reserved=0");
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        uint8 side = BaccaratParams.decode(params);
        uint256 factor = _factor(side);
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

            if (_outcome(betId, uint256(i), seed) == side) {
                cumPayout += Math.mulDiv(amount, factor, FACTOR_PRECISION);
            }

            if (StopLogic.shouldStop(stakeSpec.stopGain, stakeSpec.stopLoss, usedTurnover, cumPayout)) {
                break;
            }
        }

        payoutGross = cumPayout;
        refundAmount = stake - usedTurnover;
    }

    function _factor(uint8 side) internal pure returns (uint256) {
        if (side == BaccaratParams.SIDE_PLAYER) return PLAYER_FACTOR;
        if (side == BaccaratParams.SIDE_BANKER) return BANKER_FACTOR;
        if (side == BaccaratParams.SIDE_TIE) return TIE_FACTOR;
        revert("side");
    }

    function _outcome(uint256 betId, uint256 rollIndex, uint256 seed) internal pure returns (uint8) {
        uint8 playerTotal = (_cardValue(betId, rollIndex, 0, seed) + _cardValue(betId, rollIndex, 2, seed)) % 10;
        uint8 bankerTotal = (_cardValue(betId, rollIndex, 1, seed) + _cardValue(betId, rollIndex, 3, seed)) % 10;

        if (playerTotal < 8 && bankerTotal < 8) {
            bool playerDraws = playerTotal <= 5;
            uint8 playerThird = 0;

            if (playerDraws) {
                playerThird = _cardValue(betId, rollIndex, 4, seed);
                playerTotal = (playerTotal + playerThird) % 10;
            }

            if (_bankerDraws(bankerTotal, playerDraws, playerThird)) {
                bankerTotal = (bankerTotal + _cardValue(betId, rollIndex, 5, seed)) % 10;
            }
        }

        if (playerTotal > bankerTotal) return OUTCOME_PLAYER;
        if (bankerTotal > playerTotal) return OUTCOME_BANKER;
        return OUTCOME_TIE;
    }

    function _bankerDraws(uint8 bankerTotal, bool playerDraws, uint8 playerThird) internal pure returns (bool) {
        if (!playerDraws) return bankerTotal <= 5;
        if (bankerTotal <= 2) return true;
        if (bankerTotal == 3) return playerThird != 8;
        if (bankerTotal == 4) return playerThird >= 2 && playerThird <= 7;
        if (bankerTotal == 5) return playerThird >= 4 && playerThird <= 7;
        if (bankerTotal == 6) return playerThird == 6 || playerThird == 7;
        return false;
    }

    function _cardValue(uint256 betId, uint256 rollIndex, uint256 cardIndex, uint256 seed)
        internal
        pure
        returns (uint8)
    {
        uint8 rank = uint8(RNG.roll2(betId, rollIndex, cardIndex, seed) % 13);
        if (rank <= 8) return rank + 1;
        return 0;
    }
}
