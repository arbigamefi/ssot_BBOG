// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {RNG} from "../../libs/RNG.sol";
import {SlotsParams} from "./SlotsParams.sol";
import {StopLogic} from "../../libs/StopLogic.sol";

/// @notice Pure Slots module (multi-roll).
///
/// Classic profile:
/// - 3 reels, each yielding one of 8 symbols (0..7).
/// - Exactly one pair pays 2x.
/// - Three matching non-jackpot symbols pay 16x.
/// - Three jackpot symbols (7,7,7) pay 64x.
///
/// The table is fair before GameHub fee-on-payout:
/// `(168 * 2 + 7 * 16 + 1 * 64) / 512 = 1`.
contract SlotsModule is IGameModule {
    uint8 internal constant SYMBOL_COUNT = 8;
    uint8 internal constant JACKPOT_SYMBOL = 7;
    uint256 internal constant PAIR_MULTIPLIER = 2;
    uint256 internal constant TRIPLE_MULTIPLIER = 16;
    uint256 internal constant JACKPOT_MULTIPLIER = 64;

    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        _validateProfile(SlotsParams.decode(params));
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        _validateProfile(SlotsParams.decode(params));
        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        reserved = stake * JACKPOT_MULTIPLIER;
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        _validateProfile(SlotsParams.decode(params));
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

            uint8 a = _symbol(betId, uint256(i), 0, seed);
            uint8 b = _symbol(betId, uint256(i), 1, seed);
            uint8 c = _symbol(betId, uint256(i), 2, seed);
            uint256 multiplier = _multiplier(a, b, c);

            if (multiplier > 0) {
                cumPayout += amount * multiplier;
            }

            if (StopLogic.shouldStop(stakeSpec.stopGain, stakeSpec.stopLoss, usedTurnover, cumPayout)) {
                break;
            }
        }

        payoutGross = cumPayout;
        refundAmount = stake - usedTurnover;
    }

    function _validateProfile(uint8 profile) internal pure {
        require(profile == SlotsParams.PROFILE_CLASSIC, "profile");
    }

    function _symbol(uint256 betId, uint256 rollIndex, uint256 reelIndex, uint256 seed) internal pure returns (uint8) {
        return uint8(RNG.roll2(betId, rollIndex, reelIndex, seed) % SYMBOL_COUNT);
    }

    function _multiplier(uint8 a, uint8 b, uint8 c) internal pure returns (uint256) {
        if (a == b && b == c) {
            return a == JACKPOT_SYMBOL ? JACKPOT_MULTIPLIER : TRIPLE_MULTIPLIER;
        }
        if (a == b || a == c || b == c) {
            return PAIR_MULTIPLIER;
        }
        return 0;
    }
}
