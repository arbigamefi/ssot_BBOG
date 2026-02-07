// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Deterministic referral engine (pure math).
///
/// The engine DOES NOT transfer funds. It outputs a plan that the Hub converts into
/// Bank XP awards (liability accruals).
interface IReferralEngine {
    struct Plan {
        uint256 playerKick; // optional: kickback to the player (treated as XP accrued to player)

        address[] payees;   // payees for upline / skyline segments
        uint256[] immediate; // claimable now (XP accrued)
        uint256[] locked;    // locked until sourcePlayer turnover threshold met
        uint256[] holdback;  // holdback (linear vesting)

        uint256 sink;        // unallocated budget returned to protocol fees
    }

    struct BaseInput {
        uint256 baseBudget;
        uint16[6] levelBps; // L0..L5
        uint8 levels;       // number of active levels (includes L0)
        address[] uplines;  // length <= levels-1

        uint16 holdbackBps;
        uint256 minTurnover;
        uint256 playerTurnover;
    }

    struct DeltaPolicy {
        uint256 deltaBudget;
        uint16 holdbackBps;
        uint256 minTurnover;
        uint256 playerTurnover;
    }

    function splitBase(BaseInput calldata input) external view returns (Plan memory plan);

    /// @notice Skyline bytes are packed as 22-byte segments: address(20) || uint16 incBps(2).
    ///         Total length must be 22 * k, with k <= 6.
    function splitDelta(bytes calldata skyline, DeltaPolicy calldata policy) external view returns (Plan memory plan);
}
