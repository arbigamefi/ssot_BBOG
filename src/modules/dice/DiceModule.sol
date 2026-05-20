// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {DiceParams} from "./DiceParams.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {RNG} from "../../libs/RNG.sol";
import {StopLogic} from "../../libs/StopLogic.sol";

/// @notice 100-sided dice (1..100) where player chooses target in [1..99].
///         - Roll Over wins if rolled > target.
///         - Roll Under wins if rolled <= target.
///
/// Per-roll payout (gross): amountPerRoll * 100 / winCount
/// Max multiplier: 100x
contract DiceModule is IGameModule {
    using Math for uint256;

    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        (, uint8 target) = DiceParams.decode(params);
        require(target >= 1 && target <= 99, "target");
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        (bool isOver, uint8 target) = DiceParams.decode(params);
        require(target >= 1 && target <= 99, "target");

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        uint256 denom = isOver ? uint256(100 - target) : uint256(target);

        // reserved must cover total owed (payoutGross + refund). Using stake * multiplier is sufficient.
        reserved = Math.mulDiv(stake, 100, denom);
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        (bool isOver, uint8 target) = DiceParams.decode(params);
        require(target >= 1 && target <= 99, "target");
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        uint32 n = stakeSpec.betCount;
        require(n > 0, "betCount=0");
        require(randomWords.length > 0, "rng");

        uint256 amount = stakeSpec.amountPerRoll;
        uint256 stake = amount * uint256(n);
        uint256 seed = randomWords[0];
        uint256 denom = isOver ? uint256(100 - target) : uint256(target);

        uint256 usedTurnover = 0;
        uint256 cumPayout = 0;

        for (uint32 i = 0; i < n; i++) {
            usedTurnover += amount;

            uint256 r = RNG.roll(betId, uint256(i), seed);
            uint256 rolled = (r % 100) + 1; // 1..100
            bool won = isOver ? rolled > target : rolled <= target;
            if (won) {
                cumPayout += Math.mulDiv(amount, 100, denom);
            }

            if (StopLogic.shouldStop(stakeSpec.stopGain, stakeSpec.stopLoss, usedTurnover, cumPayout)) {
                break;
            }
        }

        payoutGross = cumPayout;
        refundAmount = stake - usedTurnover;
    }
}
