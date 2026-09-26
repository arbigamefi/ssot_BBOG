// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Deterministic referral engine (pure math), SSOT v1.6.
///
/// The engine DOES NOT transfer funds. It outputs a plan that the game hub converts into
/// Bank XP awards (liability accruals). The hub accrues whatever the plan does not pay out of the
/// operator share as protocol fees, so the engine never reports unallocated amounts.
interface IReferralEngine {
    struct Plan {
        uint256 playerRakeback; // base plan only: L0, accrued to the player as immediately claimable XP

        address[] payees; // base plan: [L1, L2], zero when missing; delta plan: skyline payees
        uint256[] immediate; // claimable now (XP accrued)
        uint256[] locked; // locked until sourcePlayer turnover threshold met
        uint256[] holdback; // holdback (linear vesting)
    }

    struct BaseInput {
        uint256 baseEdge; // E_b = floor(usedTurnover * baseHouseEdgeBps / 10000)
        uint16 l0Bps; // player rakeback, bps of baseEdge
        uint16 l1Bps; // direct referrer, bps of baseEdge
        uint16 l2Bps; // referrer's referrer, bps of baseEdge
        address l1; // snapshotted at acceptance; zero if the player had no referrer
        address l2; // snapshotted at acceptance; zero if L1 had no referrer
        uint16 holdbackBps;
        uint256 minTurnover;
        uint256 playerTurnover;
    }

    struct DeltaPolicy {
        uint256 markupBudget; // operator share of the markup edge
        uint16 holdbackBps;
        uint256 minTurnover;
        uint256 playerTurnover;
    }

    /// @notice L0/L1/L2 amounts from the base edge. L0 and L1 are paid only when `l1` is set, L2 only when
    ///         `l2` is also set. Each amount is rounded down. Returned payees are exactly [l1, l2].
    function splitBase(BaseInput calldata input) external view returns (Plan memory plan);

    /// @notice Split `markupBudget` over skyline segments in proportion to their increments, each share rounded
    ///         down. Skyline bytes are packed as 22-byte segments: address(20) || uint16 incBps(2), k <= 6.
    function splitDelta(bytes calldata skyline, DeltaPolicy calldata policy) external view returns (Plan memory plan);
}
