// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice GameModule = pure semantic module (composition, not inheritance).
///
/// v1.1 rules:
/// - validate/quote/resolve are deterministic given (params, stakeSpec, RNG seed) + immutable module config.
/// - maxPayout MUST upper-bound the player's total owed: payoutGross + refundAmount.
/// - modules MUST follow canonical RNG expansion (see SSOT.v1.1 constitution).
interface IGameModule {
    /// @dev MUST revert if params or stakeSpec invalid.
    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external view;

    /// @dev MUST return worst-case upper bound for player's total owed (payoutGross + refund).
    function maxPayout(bytes calldata params, SSOTTypes.StakeSpec calldata stakeSpec) external view returns (uint256 reserved);

    /// @dev Determine payout (gross) and refund amount.
    ///      - payoutGross: sum of gross payouts across executed rolls (includes stake return).
    ///      - refundAmount: stake - usedTurnover (unused escrow).
    /// Fee/referral economics do not belong here.
    function resolve(
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        uint256 betId,
        uint256[] calldata randomWords
    ) external view returns (uint256 payoutGross, uint256 refundAmount);
}
