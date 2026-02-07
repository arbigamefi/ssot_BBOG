// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {CoinTossParams} from "./CoinTossParams.sol";
import {RNG} from "../../libs/RNG.sol";
import {StopLogic} from "../../libs/StopLogic.sol";

/// @notice Pure Coin Toss module (multi-roll).
///         - params = abi.encode(bool isTails)
///         - per-roll outcome = RNG.roll(betId,i,seed) % 2 (0=heads, 1=tails)
///         - per-roll payoutGross = 2 * amountPerRoll on win, else 0
contract CoinTossModule is IGameModule {
    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        // decode validates encoding
        CoinTossParams.decode(params);
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        CoinTossParams.decode(params);
        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        reserved = 2 * stake;
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        bool isTails = CoinTossParams.decode(params);
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

            uint256 r = RNG.roll(betId, uint256(i), seed);
            bool rolledTails = (r % 2) == 1;
            if (rolledTails == isTails) {
                cumPayout += 2 * amount;
            }

            if (StopLogic.shouldStop(stakeSpec.stopGain, stakeSpec.stopLoss, usedTurnover, cumPayout)) {
                break;
            }
        }

        payoutGross = cumPayout;
        refundAmount = stake - usedTurnover;
    }
}
