// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IBank} from "./interfaces/IBank.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {AccountingLib} from "../libs/AccountingLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";

/// @notice Single-asset vault + SSOT accounting + bet funds interface. Deposits are synchronous (ERC-4626);
///         redemptions are asynchronous Requests (ERC-7540). Activation pays the liquid portion and preserves
///         all snapshot LPs' recovery rights in a reserve pocket. Old holds never gate later exits (ADR-0035).
///         - totalAssets() is active NAV, excluding payables and historical recovery backing.
///         - hold/settle/refund callable ONLY by immutable SettlementRouter.
///         - riskInPaused freezes Risk-In + Optional Outflow, but never blocks settle/refund or player payables.
contract Bank is IBank, Governable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Checkpoints for Checkpoints.Trace256;

    address public override settlementRouter;
    address public immutable override asset;
    IERC20 private immutable _assetToken;

    uint256 public override protocolFeesPayable; // PF
    uint256 public override totalReserved; // R

    // Lifetime performance counters. These are single-asset counters scoped to this Bank.
    // totalRefunded spans settle-path partial refunds and refundBet full refunds; totalBetsRefunded
    // counts only refundBet calls, so the two values are intentionally not directly reconcilable.
    uint256 public override totalTurnover;
    uint256 public override totalPayoutGross;
    uint256 public override totalPayoutNet;
    uint256 public override totalRefunded;
    uint256 public override totalFeeOnPayout;
    uint256 public override totalProtocolFeeAccrued;
    uint256 public override totalBetsHeld;
    uint256 public override totalBetsSettled;
    uint256 public override totalBetsRefunded;

    /// @dev Virtual assets and shares of one thousandth of a token (one base unit below three decimals). They
    ///      keep the initial share price 1:1, and a first-depositor donation must be about a thousand times the
    ///      deposit it attacks and is almost all captured by the virtual position. That position is kept this
    ///      small because exits and recoveries release its share of value to protocol capital (ADR-0035).
    uint256 private immutable _virtualOffset;

    // XP buckets (external payables; E-class)
    uint256 public override xpAccruedTotal;
    uint256 public override xpLockedTotal;
    uint256 public override xpHoldbackTotal;

    mapping(address => uint256) internal _xpAccrued;
    mapping(address => uint256) internal _xpLocked;
    mapping(address => uint256) internal _xpHoldback;
    mapping(address => mapping(address => uint256)) internal _xpLockedBySource;

    // aggregate non-extending linear vesting schedule for holdback (per payee)
    mapping(address => uint64) internal _holdbackLastSync;
    mapping(address => uint64) internal _holdbackVestingEnd;

    // player turnover gating for locked XP
    mapping(address => uint256) internal _playerTurnover;

    uint256 public override holdbackVestingSeconds;
    uint256 public override minPlayerTurnoverForUnlock;

    uint256 public override riskReserveBps; // [0..10000], gates new risk-in.
    uint256 public override withdrawalBufferBps; // [0..10000], gates optional outflows.
    // pause state comes from OZ Pausable (maps to SSOT "riskInPaused")

    /// @notice Address allowed to pause Risk-In, but never to unpause it.
    /// @dev Exists so pausing does not require assembling a multisig quorum.
    ///      Pausing is the safe direction -- its worst case is declining new
    ///      bets, and Debt-Out (settle/refund) is unaffected -- while unpausing
    ///      re-opens risk and stays governance-only. Zero disables the role.
    address public override guardian;

    /// @dev Ceiling on `minPlayerTurnoverForUnlock`, in whole asset units.
    ///      Without it governance can set the threshold to `type(uint256).max`
    ///      and gate `unlockXPLocked` forever for every payee (audit AGF-07),
    ///      which is a stronger unilateral power than the bound on
    ///      `holdbackVestingSeconds` implies. It also rejects the
    ///      decimals-mismatch class of mistake on chain: `20e18` on a 6-decimal
    ///      asset means 20 trillion units and is refused here, rather than
    ///      silently locking every referral award as it did on mainnet USDC.
    uint256 public constant MAX_MIN_TURNOVER_UNITS = 10_000_000;

    // ERC4626-like shares (ERC20)
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // bets
    struct Hold {
        address player;
        uint256 stake;
        uint256 reserved;
        bytes32 snapshotHash;
        bool open;
        uint256 epoch;
    }
    mapping(uint256 => Hold) public holds;

    // -------- asynchronous redemptions and historical recovery (ADR-0035) --------

    uint256 public constant override MIN_BATCH_PERIOD = 1 hours;
    uint256 public constant override MAX_BATCH_PERIOD = 7 days;
    uint256 public override batchPeriod;

    /// @dev Priced batch assets not yet claimed. Until every share of a batch is assigned, this includes the
    ///      entitlements of controllers not yet synchronized; after that, only what they have not claimed.
    uint256 public override exitPayable;

    /// @dev Batch IDs equal risk epochs. Cancellation can empty the current queue without advancing its epoch.
    mapping(uint256 => RedeemBatch) internal _batches;
    uint256 public override currentEpoch = 1;
    uint256 public override currentOpenHolds;
    uint256 public override activeReserved;
    uint256 public override recoveryBacking;
    mapping(uint256 => RecoveryEpoch) internal _recoveryEpochs;
    mapping(address => Checkpoints.Trace256) internal _walletHistory;
    // Mutable only in the current epoch; preserved forever after activation, including after liquid claims.
    mapping(uint256 => mapping(address => uint256)) internal _requestShares;
    mapping(uint256 => mapping(address => uint256)) internal _recoveryClaimed;
    mapping(uint256 => mapping(address => bool)) internal _recoverySynced;

    /// @dev A controller synchronizes its previous priced batch before joining a new queue. No history scan.
    struct RedeemAccount {
        uint256 batchId;
        uint256 claimableShares;
        uint256 claimableAssets;
    }

    mapping(address => RedeemAccount) internal _redeemAccounts;
    mapping(address => mapping(address => bool)) public override isOperator;

    // -------- player payables (ADR-0035) --------

    uint256 public override playerPayableTotal;
    mapping(address => uint256) public override playerPayable;

    // ERC20 events
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(
        address asset_,
        address gov_,
        uint256 initialBufferBps_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) Governable(gov_) {
        if (asset_ == address(0)) revert Errors.ZeroAddress();
        if (decimals_ > 77) revert Errors.InvalidConfig();
        if (decimals_ != IERC20Metadata(asset_).decimals()) revert Errors.InvalidConfig();
        if (initialBufferBps_ > 10_000) revert Errors.InvalidBps(initialBufferBps_);
        asset = asset_;
        _assetToken = IERC20(asset_);
        riskReserveBps = initialBufferBps_;
        withdrawalBufferBps = initialBufferBps_;
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        _virtualOffset = decimals_ > 3 ? 10 ** uint256(decimals_ - 3) : 1;

        // referral/xp defaults (governance can update)
        holdbackVestingSeconds = 30 days;
        minPlayerTurnoverForUnlock = 0;

        batchPeriod = 1 days;
    }

    // -------- governance controls --------

    /// @notice Freeze Risk-In + Optional outflows, while keeping Debt-Out (settle/refund) live.
    /// @dev Asymmetric by design: governance or the guardian may pause, only
    ///      governance may unpause. Pausing declines new risk and is safe to
    ///      make fast; unpausing re-admits risk and must stay behind the full
    ///      governance quorum.
    function setRiskInPaused(bool paused_) external {
        // One branch per direction, so the authority check and the state change
        // for that direction cannot drift apart.
        if (paused_) {
            if (msg.sender != governance && msg.sender != guardian) revert Errors.Unauthorized();
            if (!paused()) _pause();
        } else {
            if (msg.sender != governance) revert Errors.Unauthorized();
            if (paused()) _unpause();
        }
        emit RiskInPausedSet(paused_);
    }

    /// @notice One-time wiring: set SettlementRouter address. Allowed only when unset.
    function setSettlementRouterOnce(address router_) external onlyGov {
        if (settlementRouter != address(0)) revert Errors.InvalidConfig();
        if (router_ == address(0)) revert Errors.ZeroAddress();
        settlementRouter = router_;
    }

    function setRiskReserveBps(uint256 bps) external onlyGov {
        _setRiskReserveBps(bps);
    }

    function setWithdrawalBufferBps(uint256 bps) external onlyGov {
        if (bps > 10_000) revert Errors.InvalidBps(bps);
        withdrawalBufferBps = bps;
        emit WithdrawalBufferBpsSet(bps);
    }

    function _setRiskReserveBps(uint256 bps) internal {
        if (bps > 10_000) revert Errors.InvalidBps(bps);
        riskReserveBps = bps;
        emit RiskReserveBpsSet(bps);
    }

    function setHoldbackVestingSeconds(uint256 seconds_) external onlyGov {
        // bound to keep arithmetic safe and semantics reasonable
        if (seconds_ == 0 || seconds_ > 365 days) revert Errors.InvalidConfig();
        holdbackVestingSeconds = seconds_;
    }

    function setMinPlayerTurnoverForUnlock(uint256 turnover_) external onlyGov {
        // Compare the exact asset-unit ceiling when it fits uint256. If it
        // exceeds uint256, every representable threshold is already below it.
        uint256 unit = 10 ** uint256(decimals);
        if (unit <= type(uint256).max / MAX_MIN_TURNOVER_UNITS && turnover_ > MAX_MIN_TURNOVER_UNITS * unit) {
            revert Errors.InvalidConfig();
        }
        minPlayerTurnoverForUnlock = turnover_;
    }

    /// @notice Set the address allowed to pause Risk-In (zero disables the role).
    /// @dev The guardian cannot unpause, cannot move funds, and cannot change
    ///      any other parameter. Its only power is to decline new risk.
    function setGuardian(address guardian_) external onlyGov {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    /// @notice Set the spacing of redemption cutoffs. Batches already open keep their cutoff.
    function setBatchPeriod(uint256 period) external override onlyGov {
        if (period < MIN_BATCH_PERIOD || period > MAX_BATCH_PERIOD) revert Errors.InvalidConfig();
        batchPeriod = period;
        emit BatchPeriodSet(period);
    }

    /// @notice Rescue foreign tokens only: neither the asset nor the Bank's own shares, which include every
    ///         share escrowed in a redemption Request.
    function rescueToken(address token, address to, uint256 amount) external onlyGov nonReentrant {
        if (token == asset || token == address(this)) revert Errors.InvalidConfig();
        IERC20(token).safeTransfer(to, amount);
    }

    // -------- protocol fee optional outflow --------

    /// @notice Claim accumulated protocol fees. Governance only, pause-gated, A4-domain-checked.
    /// @param amount Amount of protocol fees to claim (in asset units).
    /// @param receiver Address to receive the claimed fees.
    /// @return claimed The amount actually claimed.
    function claimProtocolFees(uint256 amount, address receiver)
        external
        onlyGov
        nonReentrant
        returns (uint256 claimed)
    {
        if (paused()) revert RiskInPaused();
        if (receiver == address(0)) revert Errors.ZeroAddress();

        uint256 bal = protocolFeesPayable;
        if (amount == 0 || bal == 0) return 0;
        if (amount > bal) revert Errors.InsufficientBalance();

        // Optional outflow: assetsOut = amount, PF decreases by amount, XP unchanged.
        _checkOptionalOutflowDomain(amount, amount, 0);

        protocolFeesPayable = bal - amount;
        _assetToken.safeTransfer(receiver, amount);

        emit ProtocolFeesClaimed(receiver, amount);
        return amount;
    }

    // -------- SSOT views --------

    function externalPayablesTotal() public view override returns (uint256) {
        return xpAccruedTotal + xpLockedTotal + xpHoldbackTotal;
    }

    function xpAccruedOf(address payee) external view override returns (uint256) {
        return _xpAccrued[payee];
    }

    function xpLockedOf(address payee) external view override returns (uint256) {
        return _xpLocked[payee];
    }

    function xpHoldbackOf(address payee) external view override returns (uint256) {
        return _xpHoldback[payee];
    }

    function xpLockedBySource(address payee, address sourcePlayer) external view override returns (uint256) {
        return _xpLockedBySource[payee][sourcePlayer];
    }

    function playerTurnover(address player) external view override returns (uint256) {
        return _playerTurnover[player];
    }

    function holdbackReleasable(address payee) external view override returns (uint256) {
        return _holdbackReleasable(payee, uint64(block.timestamp));
    }

    function totalAssets() public view override returns (uint256) {
        return _nav(_assetToken.balanceOf(address(this)), protocolFeesPayable, externalPayablesTotal());
    }

    /// @dev The active NAV formula excludes all payables and historical reserve pockets. The share price, getSSOT, the
    ///      risk-in check, the optional-outflow check and batch pricing all use it.
    function _nav(uint256 B, uint256 PF, uint256 XP) internal view returns (uint256) {
        return AccountingLib.nav(B, PF, XP + exitPayable + playerPayableTotal + recoveryBacking);
    }

    /// @notice Active capital snapshot. R includes only current-epoch positions.
    function getSSOT() external view override returns (SSOTTypes.SSOT memory s) {
        uint256 B = _assetToken.balanceOf(address(this));
        uint256 PF = protocolFeesPayable;
        uint256 XP = externalPayablesTotal();
        uint256 NAV = _nav(B, PF, XP);
        uint256 R = activeReserved;
        uint256 rr = AccountingLib.buffer(NAV, riskReserveBps);
        uint256 rf = (NAV >= R + rr) ? (NAV - R - rr) : 0;
        uint256 wb = AccountingLib.buffer(NAV, withdrawalBufferBps);
        uint256 wo = (NAV >= R + wb) ? (NAV - R - wb) : 0;
        s.B = B;
        s.PF = PF;
        s.XP = XP;
        s.NAV = NAV;
        s.R = R;
        s.riskReserveBps = riskReserveBps;
        s.riskReserve = rr;
        s.riskFree = rf;
        s.withdrawalBufferBps = withdrawalBufferBps;
        s.withdrawalBuffer = wb;
        s.withdrawable = wo;
        s.riskInPaused = paused();
        s.xpAccruedTotal = xpAccruedTotal;
        s.xpLockedTotal = xpLockedTotal;
        s.xpHoldbackTotal = xpHoldbackTotal;
        s.holdbackVestingSeconds = holdbackVestingSeconds;
        s.minPlayerTurnoverForUnlock = minPlayerTurnoverForUnlock;
    }

    function getPerformance()
        external
        view
        override
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
        )
    {
        return (
            totalTurnover,
            totalPayoutGross,
            totalPayoutNet,
            totalRefunded,
            totalFeeOnPayout,
            totalProtocolFeeAccrued,
            totalBetsHeld,
            totalBetsSettled,
            totalBetsRefunded
        );
    }

    // -------- ERC20 shares --------

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _checkShareReceiver(to);
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        _checkShareReceiver(to);
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert Errors.InsufficientAllowance();
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert Errors.ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < amount) revert Errors.InsufficientBalance();
        balanceOf[from] = bal - amount;
        balanceOf[to] += amount;
        _checkpoint(from);
        _checkpoint(to);
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        _checkShareReceiver(to);
        totalSupply += amount;
        balanceOf[to] += amount;
        _checkpoint(to);
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 bal = balanceOf[from];
        if (bal < amount) revert Errors.InsufficientBalance();
        balanceOf[from] = bal - amount;
        totalSupply -= amount;
        _checkpoint(from);
        emit Transfer(from, address(0), amount);
    }

    function _checkShareReceiver(address to) internal view {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (to == address(this)) revert Errors.InvalidConfig();
    }

    /// @dev Writes coalesce within an internally numbered epoch. Advance the epoch before burning at seal, so
    ///      same-block later transfers cannot alter frozen wallet rights. Escrow is owned by request controllers.
    function _checkpoint(address account) internal {
        if (account != address(this)) _walletHistory[account].push(currentEpoch, balanceOf[account]);
    }

    // -------- ERC4626-like --------

    function convertToShares(uint256 assets_) public view override returns (uint256) {
        return _convertToShares(assets_, Math.Rounding.Floor);
    }

    function convertToAssets(uint256 shares_) public view override returns (uint256) {
        return _convertToAssets(shares_, Math.Rounding.Floor);
    }

    function _convertToShares(uint256 assets_, Math.Rounding rounding) internal view returns (uint256) {
        return Math.mulDiv(assets_, totalSupply + _virtualOffset, totalAssets() + _virtualOffset, rounding);
    }

    function _convertToAssets(uint256 shares_, Math.Rounding rounding) internal view returns (uint256) {
        return Math.mulDiv(shares_, totalAssets() + _virtualOffset, totalSupply + _virtualOffset, rounding);
    }

    function maxDeposit(address receiver) external view override returns (uint256) {
        return paused() || receiver == address(0) || receiver == address(this) ? 0 : type(uint256).max;
    }

    function maxMint(address receiver) external view override returns (uint256) {
        return paused() || receiver == address(0) || receiver == address(this) ? 0 : type(uint256).max;
    }

    function previewDeposit(uint256 assets_) external view override returns (uint256) {
        return _convertToShares(assets_, Math.Rounding.Floor);
    }

    function previewMint(uint256 shares_) external view override returns (uint256) {
        return _convertToAssets(shares_, Math.Rounding.Ceil);
    }

    function deposit(uint256 assets_, address receiver) external override nonReentrant returns (uint256 shares) {
        if (paused()) revert RiskInPaused();
        if (assets_ == 0) revert Errors.InsufficientBalance();
        shares = _convertToShares(assets_, Math.Rounding.Floor);
        if (shares == 0) revert Errors.InsufficientBalance();
        _assetToken.safeTransferFrom(msg.sender, address(this), assets_);
        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets_, shares);
    }

    function mint(uint256 shares_, address receiver) external override nonReentrant returns (uint256 assets_) {
        if (paused()) revert RiskInPaused();
        if (shares_ == 0) revert Errors.InsufficientBalance();
        assets_ = _convertToAssets(shares_, Math.Rounding.Ceil);
        _assetToken.safeTransferFrom(msg.sender, address(this), assets_);
        _mint(receiver, shares_);
        emit Deposit(msg.sender, receiver, assets_, shares_);
    }

    // -------- asynchronous redemptions: ERC-7540 redeem side (ADR-0035) --------

    function previewWithdraw(uint256) external pure override returns (uint256) {
        revert AsyncRedemption();
    }

    function previewRedeem(uint256) external pure override returns (uint256) {
        revert AsyncRedemption();
    }

    function maxWithdraw(address controller) external view override returns (uint256 assets_) {
        if (paused()) return 0;
        (,, assets_) = _redeemView(controller);
    }

    function maxRedeem(address controller) external view override returns (uint256 shares_) {
        if (paused()) return 0;
        (, shares_,) = _redeemView(controller);
    }

    function pendingRedeemRequest(uint256 requestId, address controller)
        external
        view
        override
        returns (uint256 shares_)
    {
        if (requestId == 0) (shares_,,) = _redeemView(controller);
    }

    function claimableRedeemRequest(uint256 requestId, address controller)
        external
        view
        override
        returns (uint256 shares_)
    {
        if (requestId == 0) (, shares_,) = _redeemView(controller);
    }

    function redeemRequestOf(address controller)
        external
        view
        override
        returns (uint256 pendingShares, uint256 claimableShares, uint256 claimableAssets)
    {
        return _redeemView(controller);
    }

    function redeemBatch(uint256 batchId) external view override returns (RedeemBatch memory) {
        return _batches[batchId];
    }

    function pendingRedeemBatch(address controller) external view override returns (uint256 batchId, uint256 shares_) {
        shares_ = _requestShares[currentEpoch][controller];
        if (shares_ != 0) batchId = currentEpoch;
    }

    function openHolds() public view override returns (uint256) {
        return totalBetsHeld - totalBetsSettled - totalBetsRefunded;
    }

    function recoveryEpoch(uint256 epochId) external view override returns (RecoveryEpoch memory) {
        return _recoveryEpochs[epochId];
    }

    /// @dev Whole real-supply entitlement. The real-equity ceiling also covers loss states below virtual price.
    function _realEquity(uint256 supply, uint256 nav_) internal view returns (uint256) {
        return Math.min(Math.mulDiv(supply, nav_ + _virtualOffset, supply + _virtualOffset), nav_);
    }

    function quoteQueuedRedeem(address controller)
        external
        view
        override
        returns (uint256 liquidAssets, uint256 recoveryAssets)
    {
        uint256 q = _requestShares[currentEpoch][controller];
        if (q == 0) return (0, 0);
        uint256 supply = totalSupply;
        uint256 nav_ = totalAssets();
        uint256 base = _realEquity(supply, nav_ - activeReserved);
        uint256 queued = _batches[currentEpoch].shares;
        liquidAssets = Math.mulDiv(q, Math.mulDiv(queued, base, supply), queued);
        recoveryAssets = Math.mulDiv(q, _realEquity(supply, nav_) - base, supply);
    }

    function getRecovery(uint256 epochId, address controller)
        public
        view
        override
        returns (RecoveryPosition memory position)
    {
        RecoveryEpoch storage e = _recoveryEpochs[epochId];
        if (e.snapshotSupply == 0 || controller == address(0) || controller == address(this)) return position;
        position.shares = _walletHistory[controller].upperLookup(epochId) + _requestShares[epochId][controller];
        position.claimedAssets = _recoveryClaimed[epochId][controller];
        uint256 entitlement = Math.mulDiv(position.shares, e.recoveredAssets, e.snapshotSupply);
        position.claimableAssets = entitlement - position.claimedAssets;
        uint256 maximum = _realEquity(e.snapshotSupply, e.snapshotNav - e.settledCost)
            - _realEquity(e.snapshotSupply, e.snapshotNav - e.initialReserve);
        position.pendingAssets = Math.mulDiv(position.shares, maximum, e.snapshotSupply) - entitlement;
        position.finalSynced = _recoverySynced[epochId][controller];
    }

    function syncRecovery(uint256 epochId, address controller) external override nonReentrant {
        _syncRecovery(epochId, controller, getRecovery(epochId, controller));
    }

    function claimRecovery(uint256 epochId, address receiver, address controller)
        external
        override
        nonReentrant
        returns (uint256 assets_)
    {
        if (paused()) revert RiskInPaused();
        if (receiver == address(0)) revert Errors.ZeroAddress();
        _checkController(controller);
        RecoveryPosition memory position = getRecovery(epochId, controller);
        _syncRecovery(epochId, controller, position);
        assets_ = position.claimableAssets;
        if (assets_ == 0) return 0;
        _recoveryClaimed[epochId][controller] = position.claimedAssets + assets_;
        _recoveryEpochs[epochId].backingAssets -= assets_;
        recoveryBacking -= assets_;
        _assetToken.safeTransfer(receiver, assets_);
        emit RecoveryClaimed(epochId, controller, receiver, msg.sender, assets_);
    }

    /// @dev Final assignment progress is independent of claims. Unclaimed assigned amounts stay in the pocket;
    ///      only the exact sum-of-floors remainder can be released after all S snapshot units are accounted for.
    function _syncRecovery(uint256 epochId, address controller, RecoveryPosition memory position) internal {
        RecoveryEpoch storage e = _recoveryEpochs[epochId];
        if (e.remainingHolds != 0 || position.shares == 0 || position.finalSynced) return;
        _recoverySynced[epochId][controller] = true;
        uint256 entitlement = position.claimableAssets + position.claimedAssets;
        e.finalizedShares += position.shares;
        e.finalizedAssets += entitlement;
        emit RecoverySynced(epochId, controller, position.shares, entitlement);
        if (e.finalizedShares == e.snapshotSupply) {
            e.dustReleased = true;
            uint256 dust = e.recoveredAssets - e.finalizedAssets;
            e.backingAssets -= dust;
            recoveryBacking -= dust;
            e.protocolAssets += dust;
            _accrueProtocolCapital(epochId, dust, 2);
        }
    }

    function _accrueProtocolCapital(uint256 epochId, uint256 assets_, uint8 reason) internal {
        if (assets_ == 0) return;
        protocolFeesPayable += assets_;
        emit ProtocolCapitalAccrued(epochId, assets_, reason);
    }

    function setOperator(address operator, bool approved) external override returns (bool) {
        isOperator[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
        return true;
    }

    /// @notice Escrow `shares_` of `owner` in the open batch, under `controller`. Allowed while paused: it moves
    ///         only shares. The shares keep bearing active results until their batch is activated.
    function requestRedeem(uint256 shares_, address controller, address owner)
        external
        override
        nonReentrant
        returns (uint256 requestId)
    {
        if (shares_ == 0) revert Errors.InsufficientBalance();
        _checkShareReceiver(controller);
        // ERC-6909 semantics, as ERC-7540 requires: operators spend no allowance, and an infinite one is kept.
        if (msg.sender != owner && !isOperator[owner][msg.sender]) {
            uint256 allowed = allowance[owner][msg.sender];
            if (allowed != type(uint256).max) {
                if (allowed < shares_) revert Errors.InsufficientAllowance();
                allowance[owner][msg.sender] = allowed - shares_;
            }
        }
        _transfer(owner, address(this), shares_);

        uint256 id = _batchForRequest();
        _syncRedeem(controller);
        _redeemAccounts[controller].batchId = id;
        _requestShares[id][controller] += shares_;
        _batches[id].shares += shares_;

        emit RedeemRequest(controller, owner, 0, msg.sender, shares_);
        return 0;
    }

    /// @notice Return all queued shares to their controller. Eligibility does not end cancellation rights.
    function cancelRedeemRequest(address controller) external override nonReentrant returns (uint256 shares_) {
        _checkController(controller);
        _syncRedeem(controller);
        uint256 id = currentEpoch;
        shares_ = _requestShares[id][controller];
        if (shares_ == 0) revert NothingToCancel();
        delete _requestShares[id][controller];
        _redeemAccounts[controller].batchId = 0;
        uint256 remaining = _batches[id].shares - shares_;
        if (remaining == 0) {
            delete _batches[id];
            emit RedeemBatchRetired(id);
        } else {
            _batches[id].shares = remaining;
        }
        _transfer(address(this), controller, shares_);
        emit RedeemRequestCancelled(controller, msg.sender, id, shares_);
    }

    function syncRedeem(address controller) external override nonReentrant {
        _syncRedeem(controller);
    }

    function activateBatch() external override nonReentrant returns (uint256 batchId) {
        if (paused()) revert RiskInPaused();
        batchId = currentEpoch;
        RedeemBatch storage b = _batches[batchId];
        if (b.shares == 0 || b.cutoff > block.timestamp) revert NoBatchDue();
        uint256 nav_ = totalAssets();
        uint256 reserve = activeReserved;
        if (nav_ < reserve) revert SolvencyViolation();
        uint256 supply = totalSupply;
        uint256 base = _realEquity(supply, nav_ - reserve);
        uint256 assets_ = Math.mulDiv(b.shares, base, supply);
        RecoveryEpoch storage e = _recoveryEpochs[batchId];
        e.snapshotNav = nav_;
        e.snapshotSupply = supply;
        e.initialReserve = reserve;
        e.remainingReserve = reserve;
        e.remainingHolds = currentOpenHolds;
        e.backingAssets = reserve;
        recoveryBacking += reserve;
        b.activatedAt = uint64(block.timestamp);
        b.priced = true;
        b.assets = assets_;
        b.fullExit = b.shares == supply;
        exitPayable += assets_;
        emit RedeemBatchActivated(batchId, b.shares, nav_, supply, reserve, currentOpenHolds);
        // The new key is installed before any post-seal balance change. Old wallet checkpoints are immutable.
        currentEpoch = batchId + 1;
        activeReserved = 0;
        currentOpenHolds = 0;
        _burn(address(this), b.shares);
        if (b.fullExit) _accrueProtocolCapital(batchId, nav_ - reserve - base, 0);
        emit RedeemBatchPriced(batchId, b.shares, assets_);
    }

    /// @notice Claim exactly `assets_` of `controller`'s priced redemptions for `receiver`.
    /// @dev Consumes `ceil(assets_ * claimableShares / claimableAssets)` shares and refuses to consume every share
    ///      while leaving assets, so partial claims cannot change what the controller receives in total.
    function withdraw(uint256 assets_, address receiver, address controller)
        external
        override
        nonReentrant
        returns (uint256 shares_)
    {
        RedeemAccount storage a = _authorizeClaim(receiver, controller);
        if (assets_ == 0) revert Errors.InsufficientBalance();
        uint256 claimableShares = a.claimableShares;
        uint256 claimableAssets = a.claimableAssets;
        if (assets_ > claimableAssets) revert ExceedsClaimable();
        shares_ = Math.mulDiv(assets_, claimableShares, claimableAssets, Math.Rounding.Ceil);
        if (shares_ == claimableShares && assets_ != claimableAssets) revert ClaimWouldStrandAssets();
        _payClaim(a, receiver, controller, assets_, shares_);
    }

    /// @notice Claim `shares_` of `controller`'s priced redemptions for `receiver`, at `floor(shares_ *
    ///         claimableAssets / claimableShares)`. Redeeming every claimable share pays every claimable asset.
    function redeem(uint256 shares_, address receiver, address controller)
        external
        override
        nonReentrant
        returns (uint256 assets_)
    {
        RedeemAccount storage a = _authorizeClaim(receiver, controller);
        if (shares_ == 0) revert Errors.InsufficientBalance();
        uint256 claimableShares = a.claimableShares;
        if (shares_ > claimableShares) revert ExceedsClaimable();
        assets_ = Math.mulDiv(shares_, a.claimableAssets, claimableShares);
        _payClaim(a, receiver, controller, assets_, shares_);
    }

    function share() external view override returns (address) {
        return address(this);
    }

    function vault(address asset_) external view override returns (address) {
        return asset_ == asset ? address(this) : address(0);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0xe3bc4e65 // ERC-7540 operator methods
            || interfaceId == 0x620ee8e4 // ERC-7540 asynchronous redemption
            || interfaceId == 0x2f0a18c5 // ERC-7575 vault
            || interfaceId == 0xf815c03d; // ERC-7575 share: vault(address)
    }

    /// @dev Requests always join the current epoch. An empty/cancelled queue opens at the next Unix boundary.
    function _batchForRequest() internal returns (uint256 id) {
        id = currentEpoch;
        if (_batches[id].shares != 0) return id;
        uint256 period = batchPeriod;
        uint64 cutoff = uint64((block.timestamp / period + 1) * period);
        _batches[id].cutoff = cutoff;
        emit RedeemBatchOpened(id, cutoff);
    }

    /// @dev Assign a controller's one unsynchronized priced batch. Its historical recovery weight is preserved.
    function _syncRedeem(address controller) internal {
        RedeemAccount storage a = _redeemAccounts[controller];
        uint256 id = a.batchId;
        if (id == 0 || id == currentEpoch) return;
        RedeemBatch storage b = _batches[id];
        uint256 s = _requestShares[id][controller];
        uint256 assets_ = Math.mulDiv(s, b.assets, b.shares);
        a.batchId = 0;
        a.claimableShares += s;
        a.claimableAssets += assets_;
        b.assignedShares += s;
        b.assignedAssets += assets_;
        emit RedeemClaimable(controller, id, s, assets_);
        if (b.assignedShares == b.shares) {
            uint256 dust = b.assets - b.assignedAssets;
            exitPayable -= dust;
            if (b.fullExit) _accrueProtocolCapital(id, dust, 3);
            if (dust != 0) emit RedeemRemainderReleased(id, dust, b.fullExit);
        }
    }

    /// @dev At most one priced batch plus aggregate cash claims; never traverses historical pockets.
    function _redeemView(address controller)
        internal
        view
        returns (uint256 pending, uint256 claimableShares, uint256 claimableAssets)
    {
        RedeemAccount storage a = _redeemAccounts[controller];
        claimableShares = a.claimableShares;
        claimableAssets = a.claimableAssets;
        uint256 id = a.batchId;
        if (id == 0) return (0, claimableShares, claimableAssets);
        uint256 s = _requestShares[id][controller];
        if (id == currentEpoch) {
            pending = s;
        } else {
            RedeemBatch storage b = _batches[id];
            claimableShares += s;
            claimableAssets += Math.mulDiv(s, b.assets, b.shares);
        }
    }

    function _checkController(address controller) internal view {
        if (msg.sender != controller && !isOperator[controller][msg.sender]) revert Errors.Unauthorized();
    }

    /// @dev LP claims are an optional outflow, so pause stops them. They draw only on `exitPayable`, so the
    ///      withdrawal buffer does not apply.
    function _authorizeClaim(address receiver, address controller) internal returns (RedeemAccount storage a) {
        if (paused()) revert RiskInPaused();
        if (receiver == address(0)) revert Errors.ZeroAddress();
        _checkController(controller);
        _syncRedeem(controller);
        return _redeemAccounts[controller];
    }

    /// @dev A claim to the Bank itself is a donation: `exitPayable` falls while the cash stays, so NAV rises.
    function _payClaim(RedeemAccount storage a, address receiver, address controller, uint256 assets_, uint256 shares_)
        internal
    {
        a.claimableShares -= shares_;
        a.claimableAssets -= assets_;
        exitPayable -= assets_;
        if (assets_ > 0) _assetToken.safeTransfer(receiver, assets_);
        emit Withdraw(msg.sender, receiver, controller, assets_, shares_);
    }

    // -------- XP optional outflow + permissionless bucket moves --------

    function claimXPAccrued(uint256 amount, address receiver) external override nonReentrant returns (uint256 claimed) {
        if (paused()) revert RiskInPaused();
        if (receiver == address(0)) revert Errors.ZeroAddress();

        uint256 bal = _xpAccrued[msg.sender];
        if (amount == 0 || bal == 0) return 0;
        if (amount > bal) revert Errors.InsufficientBalance();

        // Optional outflow: assetsOut reduces B, and XP decreases by the same amount.
        _checkOptionalOutflowDomain(amount, 0, amount);

        _xpAccrued[msg.sender] = bal - amount;
        xpAccruedTotal -= amount;

        _assetToken.safeTransfer(receiver, amount);
        emit XPAccruedClaimed(msg.sender, receiver, amount);
        return amount;
    }

    function unlockXPLocked(address payee, address sourcePlayer) external override returns (uint256 unlocked) {
        // permissionless; no pause gate; no transfers
        if (payee == address(0) || sourcePlayer == address(0)) return 0;
        if (_playerTurnover[sourcePlayer] < minPlayerTurnoverForUnlock) return 0;

        uint256 amt = _xpLockedBySource[payee][sourcePlayer];
        if (amt == 0) return 0;

        _xpLockedBySource[payee][sourcePlayer] = 0;
        _xpLocked[payee] -= amt;
        xpLockedTotal -= amt;

        _xpAccrued[payee] += amt;
        xpAccruedTotal += amt;

        emit XPLockedUnlocked(payee, sourcePlayer, amt);
        return amt;
    }

    function syncXPHoldback(address payee) external override returns (uint256 released) {
        // permissionless; no pause gate; no transfers
        return _syncHoldback(payee, uint64(block.timestamp));
    }

    function _holdbackReleasable(address payee, uint64 nowTs) internal view returns (uint256) {
        uint256 bal = _xpHoldback[payee];
        if (bal == 0) return 0;

        uint64 last = _holdbackLastSync[payee];
        uint64 endTs = _holdbackVestingEnd[payee];
        if (endTs == 0 || last == 0) return 0;
        if (nowTs <= last) return 0;

        if (nowTs >= endTs) return bal;

        uint64 dt = nowTs - last;
        return (bal * dt) / (endTs - last);
    }

    function _syncHoldback(address payee, uint64 nowTs) internal returns (uint256 released) {
        uint256 bal = _xpHoldback[payee];
        if (bal == 0) {
            // initialize schedule if unset
            if (_holdbackLastSync[payee] == 0) {
                _holdbackLastSync[payee] = nowTs;
                _holdbackVestingEnd[payee] = nowTs;
            }
            return 0;
        }

        released = _holdbackReleasable(payee, nowTs);
        if (released == 0) {
            _holdbackLastSync[payee] = nowTs;
            return 0;
        }

        _xpHoldback[payee] = bal - released;
        xpHoldbackTotal -= released;

        _xpAccrued[payee] += released;
        xpAccruedTotal += released;

        _holdbackLastSync[payee] = nowTs;
        if (nowTs >= _holdbackVestingEnd[payee]) {
            _holdbackVestingEnd[payee] = nowTs;
        }

        emit XPHoldbackReleased(payee, released);
        return released;
    }
    // -------- Optional outflow domain (A4) --------

    function _checkOptionalOutflowDomain(uint256 assetsOut, uint256 pfDecrease, uint256 xpDecrease) internal view {
        uint256 B = _assetToken.balanceOf(address(this));
        if (B < assetsOut) revert Errors.InsufficientBalance();

        uint256 PF = protocolFeesPayable;
        uint256 XP = externalPayablesTotal();
        if (pfDecrease > PF || xpDecrease > XP) revert OptionalOutflowDomainViolation();

        uint256 NAVBefore = _nav(B, PF, XP);
        uint256 buffer = AccountingLib.buffer(NAVBefore, withdrawalBufferBps);
        uint256 Bafter = B - assetsOut;
        uint256 PFafter = PF - pfDecrease;
        uint256 XPafter = XP - xpDecrease;

        uint256 NAV = _nav(Bafter, PFafter, XPafter);
        uint256 R = activeReserved;
        if (NAV < R || NAV - R < buffer) revert OptionalOutflowDomainViolation();
    }

    // -------- bet funds interface (only SettlementRouter) --------

    modifier onlySettlementRouter() {
        if (settlementRouter == address(0) || msg.sender != settlementRouter) revert NotSettlementRouter();
        _;
    }

    function holdBet(uint256 betId, address player, uint256 stake, uint256 reserved, bytes32 snapshotHash)
        external
        override
        onlySettlementRouter
        nonReentrant
    {
        if (paused()) revert RiskInPaused();
        if (player == address(0) || stake == 0 || reserved == 0) revert Errors.InsufficientBalance();
        if (reserved < stake) revert ReservedTooSmall(betId, reserved, stake);
        Hold storage h = holds[betId];
        if (h.open || h.player != address(0)) revert BetAlreadyExists(betId);

        _assetToken.safeTransferFrom(player, address(this), stake);

        uint256 NAV = totalAssets();
        uint256 Rafter = activeReserved + reserved;
        uint256 ml = AccountingLib.buffer(NAV, riskReserveBps);
        if (NAV < Rafter || NAV - Rafter < ml) revert SolvencyViolation();

        totalReserved += reserved;
        activeReserved += reserved;
        currentOpenHolds += 1;
        totalBetsHeld += 1;

        holds[betId] = Hold({
            player: player,
            stake: stake,
            reserved: reserved,
            snapshotHash: snapshotHash,
            open: true,
            epoch: currentEpoch
        });

        emit BetHeld(betId, player, stake, reserved, snapshotHash);
    }

    function settleBet(
        uint256 betId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 refundAmount,
        uint256 protocolFeeAccrual,
        SSOTTypes.XPAward[] calldata xpAwards
    ) external override onlySettlementRouter nonReentrant {
        Hold storage h = holds[betId];
        if (!h.open) revert BetNotOpen(betId);

        uint256 reserved = h.reserved;
        uint256 stake = h.stake;

        if (payoutNet > payoutGross) revert Errors.InvalidConfig();
        if (payoutGross + refundAmount > reserved) {
            revert ReservedTooSmall(betId, reserved, payoutGross + refundAmount);
        }
        if (refundAmount > stake) revert RefundTooLarge(betId, refundAmount, stake);

        uint256 cost = payoutNet + refundAmount + protocolFeeAccrual;
        uint256 n = xpAwards.length;
        if (n > 32) revert XPTooManyAwards(n);
        for (uint256 i; i < n; ++i) {
            SSOTTypes.XPAward calldata a = xpAwards[i];
            cost += a.accrued + a.locked + a.holdback;
        }
        if (cost > reserved) revert ReservedTooSmall(betId, reserved, cost);
        _chargeEpochHold(h, cost);

        // Release reserve first (B3 + avoid transient insolvency window)
        h.open = false;
        totalReserved -= reserved;
        emit BetReserveReleased(betId, h.player, reserved);

        // Player MUST-PAY
        uint256 playerOwed = payoutNet + refundAmount;
        if (playerOwed > 0) _payPlayer(betId, h.player, playerOwed);

        // Update turnover (for permissionless locked unlock gating and Bank-level provider analytics).
        uint256 usedTurnover = stake - refundAmount;
        uint256 feeOnPayout = payoutGross - payoutNet;
        _playerTurnover[h.player] += usedTurnover;
        totalTurnover += usedTurnover;
        totalPayoutGross += payoutGross;
        totalPayoutNet += payoutNet;
        totalRefunded += refundAmount;
        totalFeeOnPayout += feeOnPayout;
        totalProtocolFeeAccrued += protocolFeeAccrual;
        totalBetsSettled += 1;

        // B-class accruals (no transfers)
        if (protocolFeeAccrual > 0) protocolFeesPayable += protocolFeeAccrual;

        uint256 totalAccrued;
        uint256 totalLocked;
        uint256 totalHoldback;

        for (uint256 i = 0; i < n; i++) {
            SSOTTypes.XPAward calldata a = xpAwards[i];
            if (a.payee == address(0)) revert XPInvalidAward(a.payee);

            uint256 accrued = a.accrued;
            uint256 locked = a.locked;
            uint256 holdback = a.holdback;

            if (accrued > 0) {
                _xpAccrued[a.payee] += accrued;
                xpAccruedTotal += accrued;
                totalAccrued += accrued;
            }
            if (locked > 0) {
                // lock attribution must specify a sourcePlayer
                address sp = a.sourcePlayer;
                if (sp == address(0)) revert XPInvalidAward(a.payee);
                _xpLockedBySource[a.payee][sp] += locked;
                _xpLocked[a.payee] += locked;
                xpLockedTotal += locked;
                totalLocked += locked;
            }
            if (holdback > 0) {
                _syncHoldback(a.payee, uint64(block.timestamp));
                uint256 existingHoldback = _xpHoldback[a.payee];
                _xpHoldback[a.payee] += holdback;
                xpHoldbackTotal += holdback;
                totalHoldback += holdback;

                // Do not extend an active schedule. A new award can accelerate its own
                // release into the existing aggregate schedule, but it cannot delay
                // holdback that was already vesting.
                uint64 nowTs = uint64(block.timestamp);
                if (existingHoldback == 0 || _holdbackVestingEnd[a.payee] <= nowTs) {
                    _holdbackLastSync[a.payee] = nowTs;
                    _holdbackVestingEnd[a.payee] = nowTs + uint64(holdbackVestingSeconds);
                }
            }

            emit XPAwarded(betId, a.payee, a.sourcePlayer, accrued, locked, holdback, a.reason);
        }

        emit BetSettled(
            betId,
            h.player,
            payoutGross,
            payoutNet,
            refundAmount,
            feeOnPayout,
            protocolFeeAccrual,
            totalAccrued,
            totalLocked,
            totalHoldback
        );
    }

    function refundBet(uint256 betId, uint256 refundAmount) external override onlySettlementRouter nonReentrant {
        Hold storage h = holds[betId];
        if (!h.open) revert BetNotOpen(betId);

        uint256 reserved = h.reserved;
        uint256 stake = h.stake;

        if (refundAmount > stake) revert RefundTooLarge(betId, refundAmount, stake);
        if (refundAmount > reserved) revert ReservedTooSmall(betId, reserved, refundAmount);
        _chargeEpochHold(h, refundAmount);

        h.open = false;
        totalReserved -= reserved;
        emit BetReserveReleased(betId, h.player, reserved);

        if (refundAmount > 0) _payPlayer(betId, h.player, refundAmount);

        totalRefunded += refundAmount;
        totalBetsRefunded += 1;

        emit BetRefunded(betId, h.player, refundAmount);
    }

    /// @dev A terminal cost is charged once, including player/PF/XP payables. Old holds update only their pocket;
    ///      later cash claims reduce the payable and cash equally and never charge this cost again.
    function _chargeEpochHold(Hold storage h, uint256 cost) internal {
        if (h.epoch == currentEpoch) {
            activeReserved -= h.reserved;
            currentOpenHolds -= 1;
            return;
        }
        RecoveryEpoch storage e = _recoveryEpochs[h.epoch];
        e.settledCost += cost;
        e.remainingReserve -= h.reserved;
        e.remainingHolds -= 1;
        uint256 released = e.initialReserve - e.settledCost - e.remainingReserve;
        uint256 liquid = e.snapshotNav - e.initialReserve;
        uint256 recovered = _realEquity(e.snapshotSupply, liquid + released) - _realEquity(e.snapshotSupply, liquid);
        uint256 protocolDelta = released - recovered - e.protocolAssets;
        e.recoveredAssets = recovered;
        e.protocolAssets += protocolDelta;
        e.backingAssets -= cost + protocolDelta;
        recoveryBacking -= cost + protocolDelta;
        _accrueProtocolCapital(h.epoch, protocolDelta, 1);
        emit RecoveryUpdated(h.epoch, e.remainingReserve, e.remainingHolds, e.settledCost, recovered, e.backingAssets);
    }

    /// @notice Pay `player` its payable. Anyone may call it, also while paused and regardless of any buffer, and it
    ///         always pays the player's own address; a failed transfer reverts and keeps the debt.
    function claimPlayerPayable(address player) external override nonReentrant returns (uint256 amount) {
        amount = playerPayable[player];
        if (amount == 0) return 0;
        playerPayable[player] = 0;
        playerPayableTotal -= amount;
        _assetToken.safeTransfer(player, amount);
        emit PlayerPayablePaid(player, msg.sender, amount);
    }

    /// @dev A failed transfer, including an internal token OOG, preserves the full amount as a player payable.
    ///      Remaining gas cannot reliably identify the failure cause across token proxies. If this transaction
    ///      cannot finish recording the debt and terminal state, it reverts atomically and can be retried.
    ///      Admitted tokens must leave balances unchanged when trySafeTransfer returns false.
    function _payPlayer(uint256 betId, address player, uint256 amount) internal {
        if (_assetToken.trySafeTransfer(player, amount)) return;
        playerPayable[player] += amount;
        playerPayableTotal += amount;
        emit PlayerPayableCreated(betId, player, amount);
    }

    function riskInPaused() external view override returns (bool) {
        return paused();
    }
}
