// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice House-edge allocation constants and arithmetic (SSOT v1.6, ADR-0032).
///
/// The casino hub computes each position's allocation and the SettlementRouter caps it. Both MUST use
/// these functions, so the cap the Router enforces is exactly the operator share the hub allocates.
library HouseEdgeLib {
    uint256 internal constant BPS = 10_000;

    /// @notice Share of the turnover edge that LPs retain. A constant of the release unit.
    uint16 internal constant LP_SHARE_BPS = 5_000;

    /// @notice Upper bound on L0 + L1 + L2 referral rates, in bps of the base turnover edge.
    uint16 internal constant MAX_REFERRAL_BPS = 3_500;

    /// @notice Upper bound on any house edge a position can be opened with.
    uint16 internal constant MAX_HOUSE_EDGE_BPS = 500;

    /// @notice Minimum time between queueing and activating a base-edge change or a markup-cap increase.
    uint256 internal constant EDGE_CHANGE_DELAY = 7 days;

    /// @notice Turnover edge: floor(usedTurnover * edgeBps / 10000).
    function turnoverEdge(uint256 usedTurnover, uint256 edgeBps) internal pure returns (uint256) {
        return Math.mulDiv(usedTurnover, edgeBps, BPS);
    }

    /// @notice Operator share of an edge amount: floor(edge * (10000 - LP_SHARE_BPS) / 10000).
    ///         This is the most a position may accrue as protocol fees plus referral liabilities.
    function operatorShare(uint256 edge) internal pure returns (uint256) {
        return Math.mulDiv(edge, BPS - LP_SHARE_BPS, BPS);
    }
}
