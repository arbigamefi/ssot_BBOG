// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {DiceParams} from "./DiceParams.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {RNG} from "../../libs/RNG.sol";

/// @notice 100-sided dice (1..100) where player chooses cap in [1..99] and wins if rolled > cap.
///
/// Per-roll payout (gross): amountPerRoll * 100 / (100 - cap)
/// Win probability: (100 - cap) / 100
/// Max multiplier (cap=99): 100x
contract DiceModule is IGameModule {
    using Math for uint256;

    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        uint8 cap = DiceParams.decode(params);
        require(cap >= 1 && cap <= 99, "cap");
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        uint8 cap = DiceParams.decode(params);
        require(cap >= 1 && cap <= 99, "cap");

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        uint256 denom = uint256(100 - cap);

        // reserved must cover total owed (payoutGross + refund). Using stake * multiplier is sufficient.
        reserved = Math.mulDiv(stake, 100, denom);
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        uint8 cap = DiceParams.decode(params);
        require(cap >= 1 && cap <= 99, "cap");
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        uint32 n = stakeSpec.betCount;
        require(n > 0, "betCount=0");
        require(randomWords.length > 0, "rng");

        uint256 amount = stakeSpec.amountPerRoll;
        uint256 stake = amount * uint256(n);
        uint256 seed = randomWords[0];
        uint256 denom = uint256(100 - cap);

        uint256 usedTurnover = 0;
        uint256 cumPayout = 0;

        for (uint32 i = 0; i < n; i++) {
            usedTurnover += amount;

            uint256 r = RNG.roll(betId, uint256(i), seed);
            uint256 rolled = (r % 100) + 1; // 1..100
            if (rolled > cap) {
                cumPayout += Math.mulDiv(amount, 100, denom);
            }

            if (_shouldStop(stakeSpec.stopGain, stakeSpec.stopLoss, usedTurnover, cumPayout)) {
                break;
            }
        }

        payoutGross = cumPayout;
        refundAmount = stake - usedTurnover;
    }

    function _shouldStop(
        uint256 stopGain,
        uint256 stopLoss,
        uint256 usedTurnover,
        uint256 payoutGrossSoFar
    ) internal pure returns (bool) {
        // stopGain: profitSoFar >= stopGain
        if (stopGain > 0) {
            if (payoutGrossSoFar >= usedTurnover) {
                if (payoutGrossSoFar - usedTurnover >= stopGain) return true;
            }
        }
        // stopLoss: profitSoFar <= -stopLoss  <=> usedTurnover - payoutGrossSoFar >= stopLoss
        if (stopLoss > 0) {
            if (usedTurnover >= payoutGrossSoFar) {
                if (usedTurnover - payoutGrossSoFar >= stopLoss) return true;
            }
        }
        return false;
    }
}
