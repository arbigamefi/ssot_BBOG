// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice First-touch referral registry.
///
/// v1.0 requirements:
/// - referrerOf(player) is immutable once set
/// - anti-self and anti-cycle
/// - The authorized game hub MAY bind on behalf of the player (best-effort) via bindFor()
interface IReferralRegistry {
    function referrerOf(address player) external view returns (address);

    /// @notice Bind `player -> referrer` (only callable by the player).
    function bind(address player, address referrer) external;

    /// @notice Bind `player -> referrer` on behalf of the player (only the authorized binder).
    function bindFor(address player, address referrer) external;

    /// @notice One-time binder wiring (immutable v1.0 pattern).
    function binder() external view returns (address);
}
