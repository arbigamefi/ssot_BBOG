// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {SSOTTypes} from "./SSOTTypes.sol";
import {ILiquidityVaultBank} from "./ILiquidityVaultBank.sol";

/// @notice Player-principal/debt custodian and accounting authority for one immutable NFT LiquidityVault.
interface IBank is ILiquidityVaultBank {
    function asset() external view returns (address);
    function assetDecimals() external view returns (uint8);
    function vault() external view returns (address);
    /// @notice Minimum asset amount per casino round.
    function minBetAmount() external view returns (uint256);
    function pendingStakeTotal() external view returns (uint256);
    function riskAssets() external view returns (uint256);
    function openHolds() external view returns (uint256);
    function MAX_OPEN_HOLDS() external view returns (uint256);
    /// @notice Open holds one player may have in this Bank, whichever hub or caller opened them.
    function MAX_OPEN_HOLDS_PER_PLAYER() external view returns (uint256);
    function openHoldsOf(address player) external view returns (uint256);
    function setSettlementRouterOnce(address router) external;
    function setRandomnessConsumerOnce(address consumer) external;

    error BetAmountBelowMinimum(uint256 amount, uint256 minimum);
    error OpenHoldLimit();
    error PlayerOpenHoldLimit(address player);
    error CapitalLimit();
    error AccountingFault();

    event ProtocolCapitalAccrued(uint256 indexed betId, uint256 assets);
    event RandomnessConsumerSet(address indexed consumer);
    // -------- wiring --------
    function settlementRouter() external view returns (address);

    // -------- pause --------
    // riskInPaused() is declared in ILiquidityVaultBank, which the Vault reads before a deposit.
    event RiskInPausedSet(bool paused, address indexed caller);

    /// @notice Address allowed to pause new positions and deposits but not to unpause them.
    /// @dev Zero means the role is disabled and only governance can pause.
    function guardian() external view returns (address);
    event GuardianSet(address indexed guardian);

    // -------- SSOT accounting views --------
    function getSSOT() external view returns (SSOTTypes.SSOT memory);
    function totalReserved() external view returns (uint256);
    function protocolFeesPayable() external view returns (uint256);
    function externalPayablesTotal() external view returns (uint256);
    function riskReserveBps() external view returns (uint256);
    function withdrawalBufferBps() external view returns (uint256);

    event RiskReserveBpsSet(uint256 bps);
    event WithdrawalBufferBpsSet(uint256 bps);

    // Bank performance counters: lifetime, single-asset, chain-verifiable.
    /// @notice Lifetime accepted stake after settle-path partial refunds.
    /// @dev On settlement, this increases by `stake - refundAmount`; full refundBet calls do not add turnover.
    function totalTurnover() external view returns (uint256);
    /// @notice Lifetime gross winning payout before fee-on-payout is retained.
    function totalPayoutGross() external view returns (uint256);
    /// @notice Lifetime player payout owed at settlement after fee-on-payout, including unpaid player payables.
    function totalPayoutNet() external view returns (uint256);
    /// @notice Lifetime refunded stake across both terminal paths.
    /// @dev Includes settle-path partial refunds and refundBet full refunds. Do not reconcile directly against
    ///      totalBetsRefunded, which counts only refundBet calls.
    function totalRefunded() external view returns (uint256);
    /// @notice Lifetime fee retained from gross winning payouts before net player payout.
    function totalFeeOnPayout() external view returns (uint256);
    /// @notice Lifetime gameplay protocol fee accrual; excludes empty-tree protocol capital.
    function totalProtocolFeeAccrued() external view returns (uint256);
    /// @notice Lifetime bets accepted into Bank hold accounting.
    function totalBetsHeld() external view returns (uint256);
    /// @notice Lifetime bets settled through settleBet.
    function totalBetsSettled() external view returns (uint256);
    /// @notice Lifetime full-refund terminal calls through refundBet.
    /// @dev This is a count of refundBet calls only; settle-path partial refunds are reflected in totalRefunded
    ///      and netted out of totalTurnover.
    function totalBetsRefunded() external view returns (uint256);
    function totalBetsVoided() external view returns (uint256);
    /// @notice Stakes refunded as player payables by voids (ADR-0037 §7.4).
    function totalVoided() external view returns (uint256);

    /// @notice Return lifetime, single-asset Bank performance counters.
    /// @dev Canonical gross GGR is `turnover - payoutGross + feeOnPayout`.
    ///      Do not use `turnover - payoutNet` for GGR because payoutNet already excludes fee-on-payout.
    function getPerformance()
        external
        view
        returns (
            uint256 turnover,
            uint256 payoutGross,
            uint256 payoutNet,
            uint256 refunded,
            uint256 feeOnPayout,
            uint256 protocolFeeAccrued,
            uint256 betsHeld,
            uint256 betsSettled,
            uint256 betsRefunded,
            uint256 betsVoided,
            uint256 voided
        );

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
    /// @notice Router supplies the authenticated calling hub as fundingHub; player is the beneficiary.
    function holdBet(
        uint256 betId,
        address player,
        uint256 stake,
        uint256 reserved,
        bytes32 snapshotHash,
        address fundingHub
    ) external;

    /// @dev accrue XP awards (E-class) in the same call; must NOT transfer to payees during settlement.
    /// @dev payoutNet is owed to the player (excludes fee-on-payout); failed transfers become player payables.
    function settleBet(
        uint256 betId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 refundAmount,
        uint256 protocolFeeAccrual,
        SSOTTypes.XPAward[] calldata xpAwards
    ) external;

    function refundBet(uint256 betId, uint256 refundAmount) external;
    /// @notice Router only: a result that can never be booked refunds the stake as a player payable, with no
    ///         transfer and no pause check; the tree, turnover, house edge, XP and protocol fees stay unchanged.
    function voidBet(uint256 betId) external;

    // -------- XP optional outflow (claim) --------
    /// @notice Claim accrued XP (optional outflow; held back only by the A4 safety domain, also while paused)
    function claimXPAccrued(uint256 amount, address receiver) external returns (uint256 claimed);

    // -------- Protocol fee optional outflow --------
    /// @notice Claim accumulated protocol fees (optional outflow; governance only, A4-domain-checked, also while
    ///         paused).
    function claimProtocolFees(uint256 amount, address receiver) external returns (uint256 claimed);

    // -------- XP bucket moves (permissionless; NOT optional outflow) --------
    function unlockXPLocked(address payee, address sourcePlayer) external returns (uint256 unlocked);
    function syncXPHoldback(address payee) external returns (uint256 released);

    // -------- player payables --------
    /// @notice Payouts and refunds whose transfer failed, held as Bank debt outside NFT capital.
    function playerPayableTotal() external view returns (uint256);
    function playerPayable(address player) external view returns (uint256);
    /// @notice Pay `player` what it is owed. Anyone may call it, also while paused; it pays only the player.
    function claimPlayerPayable(address player) external returns (uint256 amount);

    event PlayerPayableCreated(uint256 indexed betId, address indexed player, uint256 amount);
    event PlayerPayablePaid(address indexed player, address indexed caller, uint256 amount);

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
    event BetVoided(uint256 indexed betId, address indexed player, uint256 stake);

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
