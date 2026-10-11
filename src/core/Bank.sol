// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IBank} from "./interfaces/IBank.sol";
import {ISettlementRouter} from "./interfaces/ISettlementRouter.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {LiquidityVault} from "./LiquidityVault.sol";
import {AccountingLib} from "../libs/AccountingLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Governable} from "../access/Governable.sol";
import {Sentinel} from "../access/Sentinel.sol";
import {Errors} from "../libs/Errors.sol";

/// @notice Player principal and fixed debts stay here; one immutable Vault holds NFT capital.
///         Router alone creates/terminalizes holds. A pause blocks only new positions and new LP deposits; it
///         never blocks settlement, refunds, player-debt payment, XP unlocks or claims, protocol-fee claims or
///         LP withdrawals (ADR-0037 §4).
contract Bank is IBank, Sentinel, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    address public override settlementRouter;
    address public immutable override asset;
    address public immutable override vault;
    uint8 public immutable override assetDecimals;
    IERC20 private immutable _assetToken;
    LiquidityVault private immutable _vault;
    uint256 public override pendingStakeTotal;
    uint256 public override protocolFeesPayable;
    uint256 public override totalReserved;
    uint256 public constant override MAX_OPEN_HOLDS = 128;
    uint256 public constant override MAX_OPEN_HOLDS_PER_PLAYER = 2;
    // Lifetime performance counters. These are single-asset counters scoped to this Bank.
    // totalRefunded spans settle-path partial refunds and refundBet full refunds; totalBetsRefunded
    // counts only refundBet calls, so the two values are intentionally not directly reconcilable.
    uint256 public override totalTurnover;
    uint256 public override totalPayoutGross;
    uint256 public override totalPayoutNet;
    uint256 public override totalRefunded;
    uint256 public override totalProtocolFeeAccrued;
    uint256 public override totalBetsHeld;
    uint256 public override totalBetsSettled;
    uint256 public override totalBetsRefunded;
    uint256 public override totalBetsVoided;
    uint256 public override totalVoided;

    // XP buckets (external payables; E-class)
    uint256 public override xpAccruedTotal;
    uint256 public override xpLockedTotal;
    uint256 public override xpHoldbackTotal;

    mapping(address => uint256) internal _xpAccrued;
    mapping(address => uint256) internal _xpLocked;
    mapping(address => uint256) internal _xpHoldback;
    mapping(address => mapping(address => uint256)) internal _xpLockedBySource;

    // aggregate non-extending linear vesting schedule for holdback (per payee)
    struct HoldbackSchedule {
        uint64 lastSync;
        uint64 vestingEnd;
    }

    mapping(address => HoldbackSchedule) internal _holdbackSchedules;

    /// @dev One slot per player (ADR-0037 §5): settled turnover, which gates locked XP, and open holds. The slot
    ///      is non-zero while the player holds a position, so a first settlement rewrites it instead of creating it.
    struct PlayerAccount {
        uint248 turnover;
        uint8 openHolds;
    }

    mapping(address => PlayerAccount) internal _players;

    uint256 public override holdbackVestingSeconds;
    uint256 public override minPlayerTurnoverForUnlock;

    uint256 public override riskReserveBps; // [0..10000], gates new risk-in.
    /// @notice Minimum amount for one casino round, in asset units.
    uint256 public override minBetAmount;
    event MinBetAmountSet(uint256 minBetAmount);
    event SettlementRouterSet(address indexed router);
    event HoldbackVestingSecondsSet(uint256 secondsValue);
    event MinPlayerTurnoverForUnlockSet(uint256 turnover);
    uint256 public override withdrawalBufferBps; // [0..10000], gates optional outflows.
    address public override guardian;
    uint256 public constant MAX_MIN_TURNOVER_UNITS = 10_000_000;

    struct Hold {
        address player;
        uint256 stake;
        uint256 reserved;
        uint48 cutoff;
        bool open;
    }
    mapping(uint256 => Hold) public holds;
    uint256 public override playerPayableTotal;
    mapping(address => uint256) public override playerPayable;

    constructor(
        address asset_,
        address gov_,
        uint256 initialRiskReserveBps_,
        uint8 assetDecimals_,
        uint256 minBetAmount_
    ) Governable(gov_) {
        if (asset_ == address(0)) revert Errors.ZeroAddress();
        if (asset_.code.length == 0 || assetDecimals_ > 77) revert Errors.InvalidConfig();
        if (assetDecimals_ != IERC20Metadata(asset_).decimals()) revert Errors.InvalidConfig();
        if (initialRiskReserveBps_ > 10_000) revert Errors.InvalidBps(initialRiskReserveBps_);
        if (minBetAmount_ == 0) revert Errors.InvalidConfig();
        asset = asset_;
        assetDecimals = assetDecimals_;
        _assetToken = IERC20(asset_);
        LiquidityVault created = new LiquidityVault(asset_, address(this));
        _vault = created;
        vault = address(created);
        _assetToken.forceApprove(address(created), type(uint256).max);
        minBetAmount = minBetAmount_;
        riskReserveBps = initialRiskReserveBps_;
        withdrawalBufferBps = initialRiskReserveBps_;
        holdbackVestingSeconds = 30 days;
    }

    // -------- governance controls --------
    function setMinBetAmount(uint256 value) external onlyGov {
        if (value == 0) revert Errors.InvalidConfig();
        minBetAmount = value;
        emit MinBetAmountSet(value);
    }

    /// @notice Stop new positions and new LP deposits. Every outflow stays live: settlement, refunds, player
    ///         payables, XP and protocol-fee claims and LP withdrawals.
    /// @dev Asymmetric by design: governance, the sentinel or the guardian may
    ///      pause, only governance may unpause. Pausing declines new risk and is
    ///      safe to make fast; unpausing re-admits risk and waits for the
    ///      timelock, where the guardian can cancel it.
    function setRiskInPaused(bool paused_) external {
        // One branch per direction, so the authority check and the state change
        // for that direction cannot drift apart.
        if (paused_) {
            if (msg.sender != governance && msg.sender != sentinel && msg.sender != guardian) {
                revert Errors.Unauthorized();
            }
            if (!paused()) _pause();
        } else {
            if (msg.sender != governance) revert Errors.Unauthorized();
            if (paused()) _unpause();
        }
        emit RiskInPausedSet(paused_, msg.sender);
    }

    /// @notice One-time wiring: set SettlementRouter address. Allowed only when unset.
    function setSettlementRouterOnce(address router_) external override onlyGov {
        if (settlementRouter != address(0)) revert Errors.InvalidConfig();
        if (router_ == address(0)) revert Errors.ZeroAddress();
        if (router_.code.length == 0) revert Errors.InvalidConfig();
        settlementRouter = router_;
        emit SettlementRouterSet(router_);
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
        emit HoldbackVestingSecondsSet(seconds_);
    }

    function setMinPlayerTurnoverForUnlock(uint256 turnover_) external onlyGov {
        // Compare the exact asset-unit ceiling when it fits uint256. If it
        // exceeds uint256, every representable threshold is already below it.
        uint256 unit = 10 ** uint256(assetDecimals);
        if (unit <= type(uint256).max / MAX_MIN_TURNOVER_UNITS && turnover_ > MAX_MIN_TURNOVER_UNITS * unit) {
            revert Errors.InvalidConfig();
        }
        minPlayerTurnoverForUnlock = turnover_;
        emit MinPlayerTurnoverForUnlockSet(turnover_);
    }

    /// @notice Set the address allowed to pause (zero disables the role).
    /// @dev The guardian cannot unpause, cannot move funds, and cannot change
    ///      any other parameter. Its only power is to decline new positions and
    ///      deposits, so a rogue guardian freezes no LP, player or referrer funds.
    function setGuardian(address guardian_) external onlyGov {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    /// @notice Governance authorizes the immutable Router binding; the Router stores the sole truth.
    function setRandomnessConsumerOnce(address consumer) external override onlyGov nonReentrant {
        if (settlementRouter == address(0) || consumer.code.length == 0) revert Errors.InvalidConfig();
        ISettlementRouter(settlementRouter).bindRandomnessConsumer(consumer);
        emit RandomnessConsumerSet(consumer);
    }

    /// @notice Only unrelated ERC20 tokens are rescuable. Pool-asset surplus remains unallocated.
    function rescueToken(address token, address to, uint256 amount) external onlyGov nonReentrant {
        if (token == asset) revert Errors.InvalidConfig();
        if (to == address(0)) revert Errors.ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // -------- protocol fee optional outflow --------

    /// @notice Claim accumulated protocol fees. Governance only and A4-domain-checked; a pause does not block it.
    /// @param amount Amount of protocol fees to claim (in asset units).
    /// @param receiver Address to receive the claimed fees.
    /// @return claimed The amount actually claimed.
    function claimProtocolFees(uint256 amount, address receiver)
        external
        onlyGov
        nonReentrant
        returns (uint256 claimed)
    {
        if (receiver == address(0)) revert Errors.ZeroAddress();

        uint256 bal = protocolFeesPayable;
        if (amount == 0 || bal == 0) return 0;
        if (amount > bal) revert Errors.InsufficientBalance();

        // Optional outflow: assetsOut = amount, PF decreases by amount, XP unchanged.
        _checkOptionalOutflowDomain();

        protocolFeesPayable = bal - amount;
        _pushExact(receiver, amount);

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
        return _players[player].turnover;
    }

    function openHoldsOf(address player) external view override returns (uint256) {
        return _players[player].openHolds;
    }

    function holdbackReleasable(address payee) external view override returns (uint256) {
        return _holdbackReleasable(payee, uint64(block.timestamp));
    }

    function riskAssets() public view override returns (uint256) {
        return uint256(_vault.getReserve()) + pendingStakeTotal;
    }

    function openHolds() public view override returns (uint256) {
        return totalBetsHeld - totalBetsSettled - totalBetsRefunded - totalBetsVoided;
    }

    /// @dev Called by the Vault while its own guard is held: do not ask it to admit its own entry.
    function lpAccounting() external view override returns (uint256 pending, uint256 reserved, LPStatus status) {
        pending = pendingStakeTotal;
        reserved = totalReserved;
        if (_reentrancyGuardEntered()) return (pending, reserved, LPStatus.Busy);
        try _assetToken.balanceOf(address(this)) returns (uint256 cash) {
            if (cash < pending + protocolFeesPayable + externalPayablesTotal() + playerPayableTotal) {
                return (pending, reserved, LPStatus.InvalidAccounting);
            }
        } catch {
            return (pending, reserved, LPStatus.Unavailable);
        }
        ISettlementRouter router = ISettlementRouter(settlementRouter);
        // Router rejects an unbound consumer; failed reads must still close LP cash operations.
        try router.unbookedResultCount(address(this)) returns (uint256 count) {
            return (pending, reserved, count == 0 ? LPStatus.Ready : LPStatus.UnbookedResult);
        } catch {
            return (pending, reserved, LPStatus.Unavailable);
        }
    }

    function getSSOT() external view override returns (SSOTTypes.SSOT memory s) {
        s.bankCash = _assetToken.balanceOf(address(this));
        s.vaultCash = _assetToken.balanceOf(vault);
        s.L = _vault.getReserve();
        s.P = pendingStakeTotal;
        s.R = totalReserved;
        s.K = _vault.lockedLiquidity();
        s.G = s.L + s.P;
        s.PF = protocolFeesPayable;
        s.XP = externalPayablesTotal();
        s.PP = playerPayableTotal;
        uint256 bankOwed = s.P + s.PF + s.XP + s.PP;
        s.accountingValid = s.bankCash >= bankOwed && s.vaultCash >= s.L && s.R >= s.P && s.R - s.P == s.K && s.K <= s.L
            && s.G <= _vault.MAX_TREE_CAPITAL();
        if (s.bankCash >= bankOwed) s.bankSurplus = s.bankCash - bankOwed;
        if (s.vaultCash >= s.L) s.vaultSurplus = s.vaultCash - s.L;
        s.riskReserveBps = riskReserveBps;
        s.riskReserve = AccountingLib.buffer(s.G, riskReserveBps);
        if (s.G >= s.R && s.G - s.R >= s.riskReserve) s.riskFree = s.G - s.R - s.riskReserve;
        s.withdrawalBufferBps = withdrawalBufferBps;
        s.withdrawalBuffer = AccountingLib.buffer(s.G, withdrawalBufferBps);
        if (s.L >= s.K) s.lpFreeCapital = s.L - s.K;
        s.riskInPaused = paused();
        s.xpAccruedTotal = xpAccruedTotal;
        s.xpLockedTotal = xpLockedTotal;
        s.xpHoldbackTotal = xpHoldbackTotal;
        s.holdbackVestingSeconds = holdbackVestingSeconds;
        s.minPlayerTurnoverForUnlock = minPlayerTurnoverForUnlock;
    }

    /// @notice Cumulative payout fee, derived from the two authoritative payout totals.
    function totalFeeOnPayout() public view override returns (uint256) {
        return totalPayoutGross - totalPayoutNet;
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
            uint256 betsRefunded,
            uint256 betsVoided,
            uint256 voided
        )
    {
        return (
            totalTurnover,
            totalPayoutGross,
            totalPayoutNet,
            totalRefunded,
            totalFeeOnPayout(),
            totalProtocolFeeAccrued,
            totalBetsHeld,
            totalBetsSettled,
            totalBetsRefunded,
            totalBetsVoided,
            totalVoided
        );
    }

    function claimXPAccrued(uint256 amount, address receiver) external override nonReentrant returns (uint256 claimed) {
        if (receiver == address(0)) revert Errors.ZeroAddress();

        uint256 bal = _xpAccrued[msg.sender];
        if (amount == 0 || bal == 0) return 0;
        if (amount > bal) revert Errors.InsufficientBalance();

        // Optional outflow: assetsOut reduces B, and XP decreases by the same amount.
        _checkOptionalOutflowDomain();

        _xpAccrued[msg.sender] = bal - amount;
        xpAccruedTotal -= amount;

        _pushExact(receiver, amount);
        emit XPAccruedClaimed(msg.sender, receiver, amount);
        return amount;
    }

    function unlockXPLocked(address payee, address sourcePlayer) external override returns (uint256 unlocked) {
        // permissionless; no pause gate; no transfers
        if (payee == address(0) || sourcePlayer == address(0)) return 0;
        if (_players[sourcePlayer].turnover < minPlayerTurnoverForUnlock) return 0;

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

        uint64 last = _holdbackSchedules[payee].lastSync;
        uint64 endTs = _holdbackSchedules[payee].vestingEnd;
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
            if (_holdbackSchedules[payee].lastSync == 0) {
                _holdbackSchedules[payee].lastSync = nowTs;
                _holdbackSchedules[payee].vestingEnd = nowTs;
            }
            return 0;
        }

        released = _holdbackReleasable(payee, nowTs);
        if (released == 0) {
            _holdbackSchedules[payee].lastSync = nowTs;
            return 0;
        }

        _xpHoldback[payee] = bal - released;
        xpHoldbackTotal -= released;

        _xpAccrued[payee] += released;
        xpAccruedTotal += released;

        _holdbackSchedules[payee].lastSync = nowTs;
        if (nowTs >= _holdbackSchedules[payee].vestingEnd) {
            _holdbackSchedules[payee].vestingEnd = nowTs;
        }

        emit XPHoldbackReleased(payee, released);
        return released;
    }

    /// @dev PF/XP claims pay their own liabilities from Bank, so G is unchanged even after payment.
    ///      The retained optional-outflow policy uses the pre-call G buffer, never LP withdrawal cash.
    function _checkOptionalOutflowDomain() internal view {
        _requireAccounting();
        uint256 gross = riskAssets();
        uint256 buffer = AccountingLib.buffer(gross, withdrawalBufferBps);
        if (gross < totalReserved || gross - totalReserved < buffer) revert OptionalOutflowDomainViolation();
    }

    function _requireAccounting() internal view {
        uint256 root = _vault.getReserve();
        uint256 locked = _vault.lockedLiquidity();
        if (
            _assetToken.balanceOf(address(this))
                    < pendingStakeTotal + protocolFeesPayable + externalPayablesTotal() + playerPayableTotal
                || _assetToken.balanceOf(vault) < root || totalReserved < pendingStakeTotal
                || totalReserved - pendingStakeTotal != locked || locked > root
                || root + pendingStakeTotal > _vault.MAX_TREE_CAPITAL()
        ) revert AccountingFault();
    }

    modifier onlySettlementRouter() {
        if (settlementRouter == address(0) || msg.sender != settlementRouter) revert NotSettlementRouter();
        _;
    }

    function holdBet(
        uint256 betId,
        address player,
        uint256 stake,
        uint256 reserved,
        bytes32 snapshotHash,
        address fundingHub
    ) external override onlySettlementRouter nonReentrant {
        if (paused()) revert RiskInPaused();
        if (openHolds() >= MAX_OPEN_HOLDS) revert OpenHoldLimit();
        // Bank-level, so a direct Router caller and every hub share one count per player (audit F-05).
        if (_players[player].openHolds >= MAX_OPEN_HOLDS_PER_PLAYER) revert PlayerOpenHoldLimit(player);
        // A hold has no round count; GameHub enforces the same minimum per amountPerRoll before funding.
        if (stake < minBetAmount) revert BetAmountBelowMinimum(stake, minBetAmount);
        if (player == address(0) || fundingHub == address(0)) revert Errors.ZeroAddress();
        if (player == address(this) || player == vault) revert Errors.InvalidConfig();
        if (reserved < stake) revert ReservedTooSmall(betId, reserved, stake);
        if (holds[betId].player != address(0)) revert BetAlreadyExists(betId);
        _requireAccounting();
        uint256 root = _vault.getReserve();
        if (root == 0) revert SolvencyViolation();
        uint256 gross = root + pendingStakeTotal + stake;
        if (gross > _vault.MAX_TREE_CAPITAL()) revert CapitalLimit();
        uint256 reservedAfter = totalReserved + reserved;
        uint256 buffer = AccountingLib.buffer(gross, riskReserveBps);
        if (gross < reservedAfter || gross - reservedAfter < buffer) revert SolvencyViolation();
        uint48 cutoff = _vault.getLastDepositId();
        uint256 beforeCash = _assetToken.balanceOf(address(this));
        _assetToken.safeTransferFrom(fundingHub, address(this), stake);
        if (_assetToken.balanceOf(address(this)) != beforeCash + stake) revert Errors.TransferFailed();
        pendingStakeTotal += stake;
        totalReserved = reservedAfter;
        totalBetsHeld += 1;
        _players[player].openHolds += 1;
        holds[betId] = Hold(player, stake, reserved, cutoff, true);
        _vault.lockLiquidity((reserved - stake).toUint128());
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
        _applyHold(h, betId, cost);

        // Player MUST-PAY
        uint256 playerOwed = payoutNet + refundAmount;
        if (playerOwed > 0) _payPlayer(betId, h.player, playerOwed);

        // Update turnover (for permissionless locked unlock gating and Bank-level provider analytics).
        uint256 usedTurnover = stake - refundAmount;
        uint256 feeOnPayout = payoutGross - payoutNet;
        _players[h.player].turnover += usedTurnover.toUint248();
        totalTurnover += usedTurnover;
        totalPayoutGross += payoutGross;
        totalPayoutNet += payoutNet;
        totalRefunded += refundAmount;
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
                if (existingHoldback == 0 || _holdbackSchedules[a.payee].vestingEnd <= nowTs) {
                    _holdbackSchedules[a.payee].lastSync = nowTs;
                    _holdbackSchedules[a.payee].vestingEnd = nowTs + uint64(holdbackVestingSeconds);
                }
            }

            emit XPAwarded(betId, a.payee, a.sourcePlayer, accrued, locked, holdback, a.reason);
        }

        _requireAccounting();
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
        _applyHold(h, betId, refundAmount);

        if (refundAmount > 0) _payPlayer(betId, h.player, refundAmount);

        totalRefunded += refundAmount;
        totalBetsRefunded += 1;

        _requireAccounting();
        emit BetRefunded(betId, h.player, refundAmount);
    }

    /// @dev ADR-0037 §7.4: cost == stake, so the Vault only releases the locked reserve and books nothing; the
    ///      stake moves from pending principal to the player's payable, so Bank cash is unchanged.
    function voidBet(uint256 betId) external override onlySettlementRouter nonReentrant {
        Hold storage h = holds[betId];
        if (!h.open) revert BetNotOpen(betId);
        uint256 stake = h.stake;
        address player = h.player;
        _applyHold(h, betId, stake);
        playerPayable[player] += stake;
        playerPayableTotal += stake;
        emit PlayerPayableCreated(betId, player, stake);
        totalBetsVoided += 1;
        totalVoided += stake;
        _requireAccounting();
        emit BetVoided(betId, player, stake);
    }

    function _applyHold(Hold storage h, uint256 betId, uint256 cost) internal {
        // No LP admission gate: settlement must be able to clear a received result during pause/busy state.
        uint128 capital =
            _vault.applySettlement(h.cutoff, (h.reserved - h.stake).toUint128(), h.stake.toUint128(), cost.toUint128());
        h.open = false;
        _players[h.player].openHolds -= 1;
        pendingStakeTotal -= h.stake;
        totalReserved -= h.reserved;
        if (capital != 0) {
            protocolFeesPayable += capital;
            emit ProtocolCapitalAccrued(betId, capital);
        }
        emit BetReserveReleased(betId, h.player, h.reserved);
    }

    /// @notice Pay `player` its payable. Anyone may call it, also while paused and regardless of any buffer, and it
    ///         always pays the player's own address; a failed transfer reverts and keeps the debt.
    function claimPlayerPayable(address player) external override nonReentrant returns (uint256 amount) {
        amount = playerPayable[player];
        if (amount == 0) return 0;
        playerPayable[player] = 0;
        playerPayableTotal -= amount;
        _pushExact(player, amount);
        emit PlayerPayablePaid(player, msg.sender, amount);
    }

    /// @dev A failed transfer, including an internal token OOG, preserves the full amount as a player payable.
    ///      Remaining gas cannot reliably identify the failure cause across token proxies. If this transaction
    ///      cannot finish recording the debt and terminal state, it reverts atomically and can be retried.
    ///      Admitted tokens must leave balances unchanged when trySafeTransfer returns false.
    function _payPlayer(uint256 betId, address player, uint256 amount) internal {
        uint256 beforeCash = _assetToken.balanceOf(address(this));
        uint256 beforePlayer = _assetToken.balanceOf(player);
        bool paid = _assetToken.trySafeTransfer(player, amount);
        uint256 afterCash = _assetToken.balanceOf(address(this));
        uint256 afterPlayer = _assetToken.balanceOf(player);
        if (paid) {
            if (
                afterCash > beforeCash || beforeCash - afterCash != amount || afterPlayer < beforePlayer
                    || afterPlayer - beforePlayer != amount
            ) revert Errors.TransferFailed();
            return;
        }
        if (afterCash != beforeCash || afterPlayer != beforePlayer) revert Errors.TransferFailed();
        playerPayable[player] += amount;
        playerPayableTotal += amount;
        emit PlayerPayableCreated(betId, player, amount);
    }

    /// @dev Self-payment retires PF/XP into explicitly unallocated Bank surplus; it never grows LP equity.
    function _pushExact(address receiver, uint256 amount) internal {
        uint256 beforeCash = _assetToken.balanceOf(address(this));
        uint256 beforeReceiver = _assetToken.balanceOf(receiver);
        _assetToken.safeTransfer(receiver, amount);
        uint256 afterCash = _assetToken.balanceOf(address(this));
        uint256 afterReceiver = _assetToken.balanceOf(receiver);
        if (receiver == address(this)) {
            if (afterCash != beforeCash) revert Errors.TransferFailed();
        } else if (
            afterCash > beforeCash || beforeCash - afterCash != amount || afterReceiver < beforeReceiver
                || afterReceiver - beforeReceiver != amount
        ) {
            revert Errors.TransferFailed();
        }
    }

    function riskInPaused() external view override returns (bool) {
        return paused();
    }
}
