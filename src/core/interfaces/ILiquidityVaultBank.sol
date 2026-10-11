// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @notice Bank's authoritative admission snapshot for its immutable LP Vault.
interface ILiquidityVaultBank {
    enum LPStatus {
        Ready,
        Busy,
        UnbookedResult,
        InvalidAccounting,
        Unavailable,
        CoolingDown,
        NoLiquidity
    }

    /// @dev Bank checks its cash/debts, own mutation guard and canonical result authority. A pause is not part
    ///      of the status: it closes new deposits only (`riskInPaused`), never withdrawals.
    ///      It must not reject merely because the calling Vault has entered its own mutation guard.
    function lpAccounting() external view returns (uint256 pendingStake, uint256 grossReserved, LPStatus status);

    /// @notice True while the Bank is paused: no new positions and no new LP deposits.
    function riskInPaused() external view returns (bool);
}
