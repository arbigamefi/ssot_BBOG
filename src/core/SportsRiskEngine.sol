// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";
import {ISportsRiskEngine} from "./interfaces/ISportsRiskEngine.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Configurable risk checks for pre-match fixed-odds singles.
contract SportsRiskEngine is ISportsRiskEngine, Governable {
    uint256 internal constant WAD = 1e18;
    bytes32 internal constant RISK_LIMITS_HASH_DOMAIN = keccak256("ARBI_SPORTS_RISK_LIMITS_V1");

    struct RiskLimits {
        uint256 maxStake;
        uint256 maxPayout;
        uint256 maxMarketReserved;
        uint256 maxOutcomeReserved;
        uint256 maxEventReserved;
    }

    RiskLimits internal _limits;

    event RiskLimitsSet(
        uint256 maxStake,
        uint256 maxPayout,
        uint256 maxMarketReserved,
        uint256 maxOutcomeReserved,
        uint256 maxEventReserved,
        bytes32 riskHash
    );

    constructor(
        address gov_,
        uint256 maxStake_,
        uint256 maxPayout_,
        uint256 maxMarketReserved_,
        uint256 maxOutcomeReserved_,
        uint256 maxEventReserved_
    ) Governable(gov_) {
        _setLimits(maxStake_, maxPayout_, maxMarketReserved_, maxOutcomeReserved_, maxEventReserved_);
    }

    function setLimits(
        uint256 maxStake_,
        uint256 maxPayout_,
        uint256 maxMarketReserved_,
        uint256 maxOutcomeReserved_,
        uint256 maxEventReserved_
    ) external onlyGov {
        _setLimits(maxStake_, maxPayout_, maxMarketReserved_, maxOutcomeReserved_, maxEventReserved_);
    }

    function limits() external view returns (RiskLimits memory) {
        return _limits;
    }

    function currentRiskHash() public view returns (bytes32) {
        RiskLimits memory l = _limits;
        return keccak256(
            abi.encode(
                RISK_LIMITS_HASH_DOMAIN,
                address(this),
                block.chainid,
                l.maxStake,
                l.maxPayout,
                l.maxMarketReserved,
                l.maxOutcomeReserved,
                l.maxEventReserved
            )
        );
    }

    function checkTicket(RiskInput calldata input) external view override returns (RiskDecision memory decision) {
        SSOTTypes.SportsMarket calldata market = input.market;
        SSOTTypes.SportsOddsSnapshot calldata odds = input.odds;

        if (market.state == SSOTTypes.SportsMarketState.Suspended) revert MarketSuspended(market.marketId);
        if (market.state != SSOTTypes.SportsMarketState.Open) revert MarketNotOpen(market.marketId, market.state);
        if (block.timestamp >= market.lockTime || block.timestamp >= market.startsAt) {
            revert MarketLocked(market.marketId, block.timestamp, market.lockTime);
        }
        if (odds.expiresAt <= block.timestamp) revert OddsExpired(market.marketId, odds.expiresAt, block.timestamp);
        if (
            odds.marketId != market.marketId || odds.outcomeId >= market.outcomeCount
                || odds.marketVersion != market.version || odds.oddsWad == 0 || odds.maxStake == 0
                || odds.maxPayout == 0
        ) {
            revert BadOddsSnapshot(market.marketId, odds.outcomeId);
        }

        RiskLimits memory l = _limits;
        uint256 stake = input.stake;
        if (stake == 0 || stake > odds.maxStake || stake > l.maxStake) {
            revert StakeTooLarge(market.marketId, stake, Math.min(odds.maxStake, l.maxStake));
        }

        uint256 payout = Math.mulDiv(stake, odds.oddsWad, WAD);
        if (payout == 0 || payout > odds.maxPayout || payout > l.maxPayout) {
            revert PayoutTooLarge(market.marketId, payout, Math.min(odds.maxPayout, l.maxPayout));
        }

        uint256 reserved = payout;
        uint256 nextMarketReserved = input.marketReserved + reserved;
        if (nextMarketReserved > l.maxMarketReserved) {
            revert MarketExposureExceeded(market.marketId, nextMarketReserved);
        }

        uint256 nextOutcomeReserved = input.outcomeReserved + reserved;
        if (nextOutcomeReserved > l.maxOutcomeReserved) {
            revert OutcomeExposureExceeded(market.marketId, odds.outcomeId, nextOutcomeReserved);
        }

        uint256 nextEventReserved = input.eventReserved + reserved;
        if (nextEventReserved > l.maxEventReserved) {
            revert EventExposureExceeded(market.eventId, nextEventReserved);
        }

        decision = RiskDecision({payout: payout, reserved: reserved, riskHash: currentRiskHash()});
    }

    function _setLimits(
        uint256 maxStake_,
        uint256 maxPayout_,
        uint256 maxMarketReserved_,
        uint256 maxOutcomeReserved_,
        uint256 maxEventReserved_
    ) internal {
        if (
            maxStake_ == 0 || maxPayout_ == 0 || maxMarketReserved_ == 0 || maxOutcomeReserved_ == 0
                || maxEventReserved_ == 0
        ) {
            revert Errors.InvalidConfig();
        }
        if (
            maxPayout_ > maxOutcomeReserved_ || maxOutcomeReserved_ > maxMarketReserved_
                || maxMarketReserved_ > maxEventReserved_
        ) {
            revert Errors.InvalidConfig();
        }

        _limits = RiskLimits({
            maxStake: maxStake_,
            maxPayout: maxPayout_,
            maxMarketReserved: maxMarketReserved_,
            maxOutcomeReserved: maxOutcomeReserved_,
            maxEventReserved: maxEventReserved_
        });

        emit RiskLimitsSet(
            maxStake_, maxPayout_, maxMarketReserved_, maxOutcomeReserved_, maxEventReserved_, currentRiskHash()
        );
    }
}
