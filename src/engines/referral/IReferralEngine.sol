// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";

/// @notice Deterministic house-edge allocation engine (pure math), SSOT v1.6.
///
/// The engine DOES NOT transfer funds. It computes how one settled bet's turnover edge is allocated and the
/// Bank XP awards (liability accruals) that pay the referral part. The game hub passes them to the
/// SettlementRouter, which independently caps protocol fees plus XP at the operator share.
interface IReferralEngine {
    /// @dev Everything except the Bank's turnover state comes from the bet's acceptance snapshot.
    struct AllocationInput {
        uint256 usedTurnover; // U = stake - refund
        uint16 baseEdgeBps; // h_b
        uint16 effectiveEdgeBps; // h_e = h_b + markup
        address player;
        address l1; // referrer bound at acceptance; zero if none
        address l2; // L1's referrer at acceptance; zero if none
        uint16 l0Bps; // player rakeback, bps of the base edge
        uint16 l1Bps;
        uint16 l2Bps;
        uint16 holdbackBps; // share of L1, L2 and markup awards that vests linearly
        uint256 minTurnover; // Bank unlock threshold
        uint256 playerTurnover; // player's Bank turnover including this bet
    }

    /// @dev lpRetained = edge - operatorShare; operatorShare = r0 + r1 + r2 + markup + protocolFee.
    struct Allocation {
        uint256 edge; // E = floor(U * h_e / 10000)
        uint256 operatorShare; // O = floor(E * (10000 - LP_SHARE_BPS) / 10000)
        uint256 r0;
        uint256 r1;
        uint256 r2;
        uint256 markup;
        uint256 protocolFee;
    }

    /// @notice SSOT v1.6 section 2. L0 and L1 are paid only when `l1` is set, L2 only when `l2` is also set,
    ///         and nothing beyond L2. The markup's operator share is split over the skyline in proportion to
    ///         its increments. Every share is rounded down; missing payees and remainders are protocol fees.
    ///         Skyline bytes are packed as 22-byte segments: address(20) || uint16 incBps(2), k <= 6.
    function allocate(AllocationInput calldata input, bytes calldata skyline)
        external
        view
        returns (Allocation memory alloc, SSOTTypes.XPAward[] memory awards);
}
