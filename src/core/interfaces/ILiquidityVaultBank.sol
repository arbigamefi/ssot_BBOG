// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @notice Bank's authoritative admission snapshot for its immutable LP Vault.
interface ILiquidityVaultBank {
    enum LPStatus {
        Ready,
        Paused,
        Busy,
        UnbookedResult,
        InvalidAccounting,
        Unavailable,
        CoolingDown,
        NoLiquidity
    }

    /// @dev Bank checks its cash/debts, pause, own mutation guard and canonical result authority.
    ///      It must not reject merely because the calling Vault has entered its own mutation guard.
    function lpAccounting() external view returns (uint256 pendingStake, uint256 grossReserved, LPStatus status);
}
