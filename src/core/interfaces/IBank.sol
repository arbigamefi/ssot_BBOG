// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

interface IERC4626Minimal {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);

    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);

    function maxWithdraw(address owner) external view returns (uint256);
    function maxRedeem(address owner) external view returns (uint256);

    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function mint(uint256 shares, address receiver) external returns (uint256 assets);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
}

/// @notice Bank = funds + accounting SSOT.
///         - totalAssets() == NAV == B - PF - XP
///         - bet funds interface callable ONLY by SettlementRouter
///         - riskInPaused freezes Risk-In + Optional Outflow, but never blocks settle/refund
interface IBank is IERC4626Minimal {
    // -------- wiring --------
    function settlementRouter() external view returns (address);

    // -------- pause --------
    function riskInPaused() external view returns (bool);
    event RiskInPausedSet(bool paused);

    // -------- SSOT accounting views --------
    function getSSOT() external view returns (SSOTTypes.SSOT memory);
    function totalReserved() external view returns (uint256);
    function protocolFeesPayable() external view returns (uint256);
    function externalPayablesTotal() external view returns (uint256);
    function minLiquidityBps() external view returns (uint256);

    // XP bucket breakdown
    function xpAccruedTotal() external view returns (uint256);
    function xpLockedTotal() external view returns (uint256);
    function xpHoldbackTotal() external view returns (uint256);

    // per-payee balances
    function xpAccruedOf(address payee) external view returns (uint256);
    function xpLockedOf(address payee) external view returns (uint256);
    function xpHoldbackOf(address payee) external view returns (uint256);
    function xpLockedBySource(address payee, address sourcePlayer) external view returns (uint256);

    // unlock/release rules + state
    function holdbackVestingSeconds() external view returns (uint256);
    function minPlayerTurnoverForUnlock() external view returns (uint256);
    function playerTurnover(address player) external view returns (uint256);
    function holdbackReleasable(address payee) external view returns (uint256);

    // -------- bet funds interface (only SettlementRouter) --------
    function holdBet(uint256 betId, address player, uint256 stake, uint256 reserved, bytes32 snapshotHash) external;

    /// @dev accrue XP awards (E-class) in the same call; must NOT transfer to payees during settlement.
    /// @dev payoutNet is the amount actually paid to the player (excludes fee-on-payout).
    function settleBet(
        uint256 betId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 refundAmount,
        uint256 protocolFeeAccrual,
        SSOTTypes.XPAward[] calldata xpAwards
    ) external;

    function refundBet(uint256 betId, uint256 refundAmount) external;

    // -------- XP optional outflow (claim) --------
    /// @notice Claim accrued XP (optional outflow; may be blocked by riskInPaused or A4 safety domain)
    function claimXPAccrued(uint256 amount, address receiver) external returns (uint256 claimed);

    // -------- Protocol fee optional outflow --------
    /// @notice Claim accumulated protocol fees (optional outflow; governance only, A4-domain-checked).
    function claimProtocolFees(uint256 amount, address receiver) external returns (uint256 claimed);

    // -------- XP bucket moves (permissionless; NOT optional outflow) --------
    function unlockXPLocked(address payee, address sourcePlayer) external returns (uint256 unlocked);
    function syncXPHoldback(address payee) external returns (uint256 released);

    // -------- events (audit surface) --------
    event BetHeld(uint256 indexed betId, address indexed player, uint256 stake, uint256 reserved, bytes32 snapshotHash);
    event BetReserveReleased(uint256 indexed betId, address indexed player, uint256 reserved);

    event BetSettled(
        uint256 indexed betId,
        address indexed player,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 refundAmount,
        uint256 feeOnPayout,
        uint256 protocolFeeAccrual,
        uint256 xpAccrued,
        uint256 xpLocked,
        uint256 xpHoldback
    );

    event BetRefunded(uint256 indexed betId, address indexed player, uint256 refundAmount);

    event XPAwarded(
        uint256 indexed betId,
        address indexed payee,
        address indexed sourcePlayer,
        uint256 accrued,
        uint256 locked,
        uint256 holdback,
        bytes32 reason
    );

    event XPLockedUnlocked(address indexed payee, address indexed sourcePlayer, uint256 amount);
    event XPHoldbackReleased(address indexed payee, uint256 amount);
    event XPAccruedClaimed(address indexed payee, address indexed receiver, uint256 amount);
    event ProtocolFeesClaimed(address indexed receiver, uint256 amount);

    // -------- errors --------
    error NotSettlementRouter();
    error RiskInPaused();
    error BetAlreadyExists(uint256 betId);
    error BetNotOpen(uint256 betId);
    error ReservedTooSmall(uint256 betId, uint256 reserved, uint256 need);
    error RefundTooLarge(uint256 betId, uint256 refundAmount, uint256 stake);
    error SolvencyViolation();
    error OptionalOutflowDomainViolation();
    error XPInvalidAward(address payee);
    error XPTooManyAwards(uint256 n);
}
