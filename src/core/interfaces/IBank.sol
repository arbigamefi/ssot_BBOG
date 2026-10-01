// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice ERC-4626 vault with synchronous deposits and ERC-7540 asynchronous redemptions (ADR-0035).
/// @dev The Bank is its own share token, so ERC-7575 `share()` returns the Bank and `vault(asset)` points back to it.
///      The claim functions `withdraw` and `redeem` take a `controller`, the owner of the redemption Request.
///      ERC-165 IDs: 0xe3bc4e65 (ERC-7540 operators), 0x620ee8e4 (ERC-7540 asynchronous redemption),
///      0x2f0a18c5 (ERC-7575 vault) and 0xf815c03d (ERC-7575 share).
interface IBankVault {
    // -------- ERC-4626 --------
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);

    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);

    function maxDeposit(address receiver) external view returns (uint256);
    function previewDeposit(uint256 assets) external view returns (uint256 shares);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    function maxMint(address receiver) external view returns (uint256);
    function previewMint(uint256 shares) external view returns (uint256 assets);
    function mint(uint256 shares, address receiver) external returns (uint256 assets);

    /// @notice Assets `controller` can claim now. Zero while LP claims are paused; excludes pending requests.
    function maxWithdraw(address controller) external view returns (uint256);
    /// @dev Reverts: redemptions are asynchronous.
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);
    /// @notice Claim exactly `assets` of `controller`'s priced redemptions.
    function withdraw(uint256 assets, address receiver, address controller) external returns (uint256 shares);

    /// @notice Shares `controller` can claim now. Zero while LP claims are paused; excludes pending requests.
    function maxRedeem(address controller) external view returns (uint256);
    /// @dev Reverts: redemptions are asynchronous.
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
    /// @notice Claim `shares` of `controller`'s priced redemptions.
    function redeem(uint256 shares, address receiver, address controller) external returns (uint256 assets);

    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    // -------- ERC-7540 asynchronous redemption --------
    /// @notice Escrow `owner`'s shares in a redemption Request controlled by `controller`. Returns request ID 0:
    ///         requests aggregate per controller.
    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId);
    function pendingRedeemRequest(uint256 requestId, address controller) external view returns (uint256 shares);
    function claimableRedeemRequest(uint256 requestId, address controller) external view returns (uint256 shares);

    function isOperator(address controller, address operator) external view returns (bool);
    function setOperator(address operator, bool approved) external returns (bool);

    event RedeemRequest(
        address indexed controller, address indexed owner, uint256 indexed requestId, address sender, uint256 shares
    );
    event OperatorSet(address indexed controller, address indexed operator, bool approved);

    // -------- ERC-7575 and ERC-165 --------
    function share() external view returns (address);
    function vault(address asset) external view returns (address);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @notice Bank = funds + accounting SSOT.
///         - totalAssets() is active NAV, excluding payables and historical recovery backing
///         - bet funds interface callable ONLY by SettlementRouter
///         - riskInPaused freezes Risk-In + Optional Outflow, but never blocks settle/refund or player payables
///         - LP exits receive liquid cash and keep historical recovery rights (ADR-0035)
interface IBank is IBankVault {
    function minStake() external view returns (uint256);
    error StakeBelowMinimum(uint256 stake, uint256 minimum);

    /// @notice One queued batch per current epoch. Activation fixes liquid assets and burns shares once.
    struct RedeemBatch {
        uint64 cutoff; // first multiple of batchPeriod strictly after the batch's first request
        bool priced;
        uint256 shares; // queued shares; burned at activation, then retained as claim units
        uint256 assets; // assets the batch was priced at
        uint256 assignedShares; // shares whose entitlement has been assigned to their controllers
        uint256 assignedAssets; // assets assigned to controllers so far
        uint64 activatedAt;
        bool fullExit; // freezes ownership of liquid allocation dust, even after new deposits
    }

    /// @notice One sealed reserve pocket. Costs and recovery claims touch only their own epoch.
    struct RecoveryEpoch {
        uint256 snapshotNav;
        uint256 snapshotSupply;
        uint256 initialReserve;
        uint256 remainingReserve;
        uint256 remainingHolds;
        uint256 settledCost;
        uint256 recoveredAssets;
        uint256 protocolAssets; // virtual recovery plus final allocation dust; excludes gameplay fees
        uint256 backingAssets;
        uint256 finalizedShares;
        uint256 finalizedAssets;
        bool dustReleased;
    }

    struct RecoveryPosition {
        uint256 shares; // activated controller-request weight only
        uint256 claimableAssets;
        uint256 claimedAssets;
        uint256 pendingAssets; // maximum additional recovery if every remaining hold has zero cost
        bool finalSynced;
    }

    // -------- wiring --------
    function settlementRouter() external view returns (address);

    // -------- pause --------
    function riskInPaused() external view returns (bool);
    event RiskInPausedSet(bool paused);

    /// @notice Address allowed to pause Risk-In but not to unpause it.
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
    /// @notice Lifetime gameplay protocol fee accrual; excludes virtual capital and rounding residues.
    function totalProtocolFeeAccrued() external view returns (uint256);
    /// @notice Lifetime bets accepted into Bank hold accounting.
    function totalBetsHeld() external view returns (uint256);
    /// @notice Lifetime bets settled through settleBet.
    function totalBetsSettled() external view returns (uint256);
    /// @notice Lifetime full-refund terminal calls through refundBet.
    /// @dev This is a count of refundBet calls only; settle-path partial refunds are reflected in totalRefunded
    ///      and netted out of totalTurnover.
    function totalBetsRefunded() external view returns (uint256);

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
            uint256 betsRefunded
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

    // -------- XP optional outflow (claim) --------
    /// @notice Claim accrued XP (optional outflow; may be blocked by riskInPaused or A4 safety domain)
    function claimXPAccrued(uint256 amount, address receiver) external returns (uint256 claimed);

    // -------- Protocol fee optional outflow --------
    /// @notice Claim accumulated protocol fees (optional outflow; governance only, A4-domain-checked).
    function claimProtocolFees(uint256 amount, address receiver) external returns (uint256 claimed);

    // -------- XP bucket moves (permissionless; NOT optional outflow) --------
    function unlockXPLocked(address payee, address sourcePlayer) external returns (uint256 unlocked);
    function syncXPHoldback(address payee) external returns (uint256 released);

    // -------- asynchronous redemptions and historical recovery (ADR-0035) --------
    function MIN_BATCH_PERIOD() external view returns (uint256);
    function MAX_BATCH_PERIOD() external view returns (uint256);
    /// @notice Spacing of redemption cutoffs in Unix time. A change applies to batches opened after it.
    function batchPeriod() external view returns (uint256);
    /// @notice ID of the current risk epoch and its sole queued redemption batch. Starts at 1.
    function currentEpoch() external view returns (uint256);
    function activeOpenHolds() external view returns (uint256);
    function MAX_ACTIVE_HOLDS() external view returns (uint256);
    error ActiveHoldLimit();
    function redeemBatch(uint256 batchId) external view returns (RedeemBatch memory);
    /// @notice Positions not yet settled or refunded: totalBetsHeld - totalBetsSettled - totalBetsRefunded.
    function openHolds() external view returns (uint256);
    /// @notice Reserve units in open holds still charged to active capital.
    function activeReserved() external view returns (uint256);
    /// @notice Total cash backing all historical reserve pockets, excluded from active NAV.
    function recoveryBacking() external view returns (uint256);
    function recoveryEpoch(uint256 epochId) external view returns (RecoveryEpoch memory);
    /// @notice Zero for an unsealed/unknown epoch. Available amounts ignore the independent pause gate.
    function getRecovery(uint256 epochId, address controller) external view returns (RecoveryPosition memory);
    /// @notice Priced LP exits not yet claimed, a liability outside NAV.
    function exitPayable() external view returns (uint256);
    /// @notice `controller`'s effective redemption state, as if `syncRedeem(controller)` had just run.
    function redeemRequestOf(address controller)
        external
        view
        returns (uint256 pendingShares, uint256 claimableShares, uint256 claimableAssets);
    /// @notice The controller's sole queued request, or 0/0 if none. Reading never assigns an entitlement.
    function pendingRedeemBatch(address controller) external view returns (uint256 batchId, uint256 shares);
    /// @notice Current-block estimate for queued shares only: immediate liquid allocation and maximum recovery.
    ///         Actual amounts are fixed at activation. Recovery excludes this controller's nonqueued wallet shares.
    function quoteQueuedRedeem(address controller) external view returns (uint256 liquidAssets, uint256 recoveryAssets);

    function setBatchPeriod(uint256 period) external;
    /// @notice Return every share `controller` has in the unactivated batch, even after its cutoff.
    function cancelRedeemRequest(address controller) external returns (uint256 shares);
    /// @notice Assign `controller`'s priced batch entitlements to its claimable totals. Permissionless; moves nothing.
    function syncRedeem(address controller) external;
    /// @notice Seal current reserves, price liquid assets and burn queued shares. Older holds never gate activation.
    ///         Starts the next epoch immediately. Permissionless, except while paused.
    function activateBatch() external returns (uint256 batchId);
    /// @notice Permissionless final entitlement accounting. No-op until all this epoch's holds have ended.
    function syncRecovery(uint256 epochId, address controller) external;
    /// @notice Controller/operator claims all currently available recovery, preserving future rights.
    function claimRecovery(uint256 epochId, address receiver, address controller) external returns (uint256 assets);

    event BatchPeriodSet(uint256 period);
    event RedeemBatchOpened(uint256 indexed batchId, uint64 cutoff);
    event RedeemBatchRetired(uint256 indexed batchId);
    event RedeemBatchActivated(
        uint256 indexed batchId,
        uint256 shares,
        uint256 snapshotNav,
        uint256 snapshotSupply,
        uint256 reserve,
        uint256 openHolds
    );
    event RedeemBatchPriced(uint256 indexed batchId, uint256 shares, uint256 assets);
    event RedeemRequestCancelled(
        address indexed controller, address indexed sender, uint256 indexed batchId, uint256 shares
    );
    event RedeemClaimable(address indexed controller, uint256 indexed batchId, uint256 shares, uint256 assets);
    event RedeemRemainderReleased(uint256 indexed batchId, uint256 assets, bool toProtocol);
    event BetRiskSettled(
        uint256 indexed betId, uint256 activeUnits, uint256 exitingUnits, uint256 cost, uint256 historicalRecovery
    );
    event RecoverySynced(uint256 indexed epochId, address indexed controller, uint256 shares, uint256 assets);
    event RecoveryClaimed(
        uint256 indexed epochId, address indexed controller, address indexed receiver, address caller, uint256 assets
    );
    /// @notice Non-gameplay PF: 0 full-exit virtual liquid, 1 virtual recovery, 2 recovery dust, 3 full-exit liquid dust.
    event ProtocolCapitalAccrued(uint256 indexed epochId, uint256 assets, uint8 reason);

    // -------- player payables (ADR-0035) --------
    /// @notice Payouts and refunds whose transfer failed, a liability outside NAV.
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
    error AsyncRedemption();
    error NothingToCancel();
    error NoBatchDue();
    error ExceedsClaimable();
    error ClaimWouldStrandAssets();
}
