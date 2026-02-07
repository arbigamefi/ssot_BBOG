// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {RouletteParams} from "./RouletteParams.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {RNG} from "../../libs/RNG.sol";

/// @notice Pure Roulette module (multi-roll, European 0..36).
///         - params supports either:
///           (a) Legacy raw bitmask: abi.encode(uint40 numbersBitmask)
///           (b) Typed bet: abi.encode(uint8 kind, uint40 payload) (see RouletteParams, ADR-0016)
///         - Decodes to a numbers bitmask where:
///           * bit i set => number i selected
///           * numbers != 0 and numbers < 2^37 - 1 (cannot select all numbers)
///         - per-roll rolled = RNG.roll(betId,i,seed) % 37
///         - per-roll payoutGross = amountPerRoll * 37 / popcount(numbers) if hit, else 0
contract RouletteModule is IGameModule {
    uint8 internal constant MODULO = 37;

    // Popcount constants (same trick as the refactored RouletteV2)
    uint256 internal constant POPCNT_MULT =
        0x0000000000002000000000100000000008000000000400000000020000000001;
    uint256 internal constant POPCNT_MASK =
        0x0001041041041041041041041041041041041041041041041041041041041041;
    uint256 internal constant POPCNT_MODULO = 0x3F;

    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        uint40 numbers = RouletteParams.decode(params);
        require(numbers != 0, "numbers=0");
        require(numbers < (uint40(1) << MODULO) - 1, "numbers=all");
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        uint40 numbers = RouletteParams.decode(params);
        require(numbers != 0, "numbers=0");
        require(numbers < (uint40(1) << MODULO) - 1, "numbers=all");

        uint256 pc = _popcount(numbers);
        require(pc > 0, "pc=0");

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        // reserved must cover total owed (payoutGross + refund). Using stake * multiplier is sufficient.
        reserved = Math.mulDiv(stake, MODULO, pc);
        require(reserved > 0, "reserved=0");
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        uint40 numbers = RouletteParams.decode(params);
        require(numbers != 0, "numbers=0");
        require(numbers < (uint40(1) << MODULO) - 1, "numbers=all");
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        uint32 n = stakeSpec.betCount;
        require(n > 0, "betCount=0");
        require(randomWords.length > 0, "rng");

        uint256 pc = _popcount(numbers);
        require(pc > 0, "pc=0");

        uint256 amount = stakeSpec.amountPerRoll;
        uint256 stake = amount * uint256(n);
        uint256 seed = randomWords[0];

        uint256 usedTurnover = 0;
        uint256 cumPayout = 0;

        for (uint32 i = 0; i < n; i++) {
            usedTurnover += amount;

            uint256 r = RNG.roll(betId, uint256(i), seed);
            uint256 rolled = r % MODULO;
            if (((uint256(1) << rolled) & uint256(numbers)) != 0) {
                cumPayout += Math.mulDiv(amount, MODULO, pc);
            }

            if (_shouldStop(stakeSpec.stopGain, stakeSpec.stopLoss, usedTurnover, cumPayout)) {
                break;
            }
        }

        payoutGross = cumPayout;
        refundAmount = stake - usedTurnover;
    }

    function _popcount(uint40 numbers) internal pure returns (uint256) {
        // ((x * m) & mask) % mod
        return ((uint256(numbers) * POPCNT_MULT) & POPCNT_MASK) % POPCNT_MODULO;
    }

    function _shouldStop(
        uint256 stopGain,
        uint256 stopLoss,
        uint256 usedTurnover,
        uint256 payoutGrossSoFar
    ) internal pure returns (bool) {
        if (stopGain > 0) {
            if (payoutGrossSoFar >= usedTurnover) {
                if (payoutGrossSoFar - usedTurnover >= stopGain) return true;
            }
        }
        if (stopLoss > 0) {
            if (usedTurnover >= payoutGrossSoFar) {
                if (usedTurnover - payoutGrossSoFar >= stopLoss) return true;
            }
        }
        return false;
    }
}
