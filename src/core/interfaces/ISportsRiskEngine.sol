// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice Sportsbook risk surface for pre-match fixed-odds singles.
///         This interface keeps cap enforcement testable outside the UI.
interface ISportsRiskEngine {
    struct RiskInput {
        SSOTTypes.SportsMarket market;
        SSOTTypes.SportsOddsSnapshot odds;
        uint256 stake;
        uint256 marketReserved;
        uint256 outcomeReserved;
        uint256 eventReserved;
    }

    struct RiskDecision {
        uint256 payout;
        uint256 reserved;
        bytes32 riskHash;
    }

    function checkTicket(RiskInput calldata input) external view returns (RiskDecision memory decision);

    error MarketNotOpen(uint64 marketId, SSOTTypes.SportsMarketState state);
    error MarketSuspended(uint64 marketId);
    error MarketLocked(uint64 marketId, uint256 nowTs, uint256 lockTime);
    error OddsExpired(uint64 marketId, uint64 expiresAt, uint256 nowTs);
    error BadOddsSnapshot(uint64 marketId, uint32 outcomeId);
    error StakeTooLarge(uint64 marketId, uint256 stake, uint256 maxStake);
    error PayoutTooLarge(uint64 marketId, uint256 payout, uint256 maxPayout);
    error MarketExposureExceeded(uint64 marketId, uint256 nextReserved);
    error OutcomeExposureExceeded(uint64 marketId, uint32 outcomeId, uint256 nextReserved);
    error EventExposureExceeded(uint64 eventId, uint256 nextReserved);
}
