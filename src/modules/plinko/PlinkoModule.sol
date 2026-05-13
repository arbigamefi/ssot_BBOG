// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameModule} from "../../core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {PlinkoParams} from "./PlinkoParams.sol";
import {RNG} from "../../libs/RNG.sol";
import {StopLogic} from "../../libs/StopLogic.sol";

/// @notice Pure Plinko module (multi-roll).
///
/// Rules:
/// - 8 rows, producing 9 buckets indexed by number of right moves.
/// - Each row is a fair left/right branch from canonical RNG expansion.
/// - Risk profile chooses a deterministic symmetric paytable.
///
/// The paytables are normalized to approximately fair gross EV before GameHub
/// fee-on-payout. Integer flooring leaves a tiny house-favorable remainder.
contract PlinkoModule is IGameModule {
    uint8 internal constant ROWS = 8;
    uint8 internal constant BUCKETS = ROWS + 1;
    uint256 internal constant FACTOR_PRECISION = 10_000;

    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external pure override {
        _validateRisk(PlinkoParams.decode(params));
        require(stakeSpec.amountPerRoll > 0, "amount=0");
        require(stakeSpec.betCount > 0, "betCount=0");
    }

    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec)
        external
        pure
        override
        returns (uint256 reserved)
    {
        uint8 risk = PlinkoParams.decode(params);
        _validateRisk(risk);

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        reserved = Math.mulDiv(stake, _maxFactor(risk), FACTOR_PRECISION);
        require(reserved > 0, "reserved=0");
    }

    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external pure override returns (uint256 payoutGross, uint256 refundAmount) {
        uint8 risk = PlinkoParams.decode(params);
        _validateRisk(risk);
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

            uint8 bucket = _bucket(betId, uint256(i), seed);
            uint256 factor = _factor(risk, bucket);
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

    function _validateRisk(uint8 risk) internal pure {
        require(risk <= PlinkoParams.RISK_HIGH, "risk");
    }

    function _bucket(uint256 betId, uint256 rollIndex, uint256 seed) internal pure returns (uint8 bucket) {
        for (uint8 row = 0; row < ROWS; row++) {
            bucket += uint8(RNG.roll2(betId, rollIndex, uint256(row), seed) & 1);
        }
    }

    function _maxFactor(uint8 risk) internal pure returns (uint256) {
        if (risk == PlinkoParams.RISK_LOW) return 15_264;
        if (risk == PlinkoParams.RISK_MEDIUM) return 82_714;
        return 246_153;
    }

    function _factor(uint8 risk, uint8 bucket) internal pure returns (uint256) {
        require(bucket < BUCKETS, "bucket");
        if (risk == PlinkoParams.RISK_LOW) return _lowFactor(bucket);
        if (risk == PlinkoParams.RISK_MEDIUM) return _mediumFactor(bucket);
        return _highFactor(bucket);
    }

    function _lowFactor(uint8 bucket) internal pure returns (uint256) {
        if (bucket == 0 || bucket == 8) return 15_264;
        if (bucket == 1 || bucket == 7) return 13_083;
        if (bucket == 2 || bucket == 6) return 10_902;
        if (bucket == 3 || bucket == 5) return 9_812;
        return 8_722;
    }

    function _mediumFactor(uint8 bucket) internal pure returns (uint256) {
        if (bucket == 0 || bucket == 8) return 82_714;
        if (bucket == 1 || bucket == 7) return 34_464;
        if (bucket == 2 || bucket == 6) return 16_542;
        if (bucket == 3 || bucket == 5) return 6_892;
        return 2_067;
    }

    function _highFactor(uint8 bucket) internal pure returns (uint256) {
        if (bucket == 0 || bucket == 8) return 246_153;
        if (bucket == 1 || bucket == 7) return 61_538;
        if (bucket == 2 || bucket == 6) return 13_186;
        if (bucket == 3 || bucket == 5) return 3_076;
        return 0;
    }
}
