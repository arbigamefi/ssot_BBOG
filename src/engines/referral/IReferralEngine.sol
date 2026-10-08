// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";

/// @notice Deterministic house-edge allocation engine (pure math), SSOT v1.6.
///
/// The engine DOES NOT transfer funds. It computes how one settled bet's turnover edge is allocated and the
/// Bank XP awards (liability accruals) that pay the referral part. The game hub passes them to the
/// SettlementRouter, which independently caps protocol fees plus XP at the operator share.
interface IReferralEngine {
    /// @dev Rates and payees are snapshotted; eligibility uses current Bank turnover and threshold.
    struct AllocationInput {
        uint256 usedTurnover; // U = stake - refund
        uint16 houseEdgeBps;
        address player;
        address l1; // referrer bound at acceptance; zero if none
        address l2; // L1's referrer at acceptance; zero if none
        uint16 l0Bps; // player rakeback, bps of the turnover edge
        uint16 l1Bps;
        uint16 l2Bps;
        uint16 holdbackBps; // share of L1 and L2 awards that vests linearly
        uint256 minTurnover; // Bank unlock threshold
        uint256 playerTurnover; // player's Bank turnover including this bet
    }

    /// @dev lpRetained = edge - operatorShare; operatorShare = r0 + r1 + r2 + protocolFee.
    struct Allocation {
        uint256 edge; // E = floor(U * houseEdgeBps / 10000)
        uint256 operatorShare; // O = floor(E * (10000 - LP_SHARE_BPS) / 10000)
        uint256 r0;
        uint256 r1;
        uint256 r2;
        uint256 protocolFee;
    }

    /// @notice SSOT v1.6 section 2. L0 and L1 are paid only when `l1` is set, L2 only when `l2` is also set,
    ///         and nothing beyond L2. Every share is rounded down; missing payees and remainders are protocol fees.
    function allocate(AllocationInput calldata input)
        external
        view
        returns (Allocation memory alloc, SSOTTypes.XPAward[] memory awards);
}
