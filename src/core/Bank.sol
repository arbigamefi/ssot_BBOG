// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IBank} from "./interfaces/IBank.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {AccountingLib} from "../libs/AccountingLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";

/// @notice Single-asset vault with ERC4626-like semantics + SSOT accounting + bet funds interface.
///         - totalAssets() == NAV == B - PF - XP
///         - hold/settle/refund callable ONLY by immutable SettlementRouter.
///         - riskInPaused freezes Risk-In + Optional Outflow, but never blocks settle/refund.
contract Bank is IBank, Governable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    /// @dev Virtual reserves keep the initial share price 1:1 while making direct
    ///      asset donations economically captured by the vault instead of letting
    ///      a dust first-depositor dilute later LPs to zero shares.
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
    }
    mapping(uint256 => Hold) public holds;

    // ERC20 events
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(
        address asset_,
        address gov_,
        uint256 minLiquidityBps_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) Governable(gov_) {
        if (asset_ == address(0)) revert Errors.ZeroAddress();
        if (decimals_ > 77) revert Errors.InvalidConfig();
        if (decimals_ != IERC20Metadata(asset_).decimals()) revert Errors.InvalidConfig();
        if (minLiquidityBps_ > 10_000) revert Errors.InvalidBps(minLiquidityBps_);
        asset = asset_;
        _assetToken = IERC20(asset_);
        riskReserveBps = minLiquidityBps_;
        withdrawalBufferBps = minLiquidityBps_;
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        _virtualOffset = 10 ** uint256(decimals_);

        // referral/xp defaults (governance can update)
        holdbackVestingSeconds = 30 days;
        minPlayerTurnoverForUnlock = 0;
    }

    // -------- governance controls --------

    /// @notice Freeze Risk-In + Optional outflows, while keeping Debt-Out (settle/refund) live.
    /// @dev Asymmetric by design: governance or the guardian may pause, only
    ///      governance may unpause. Pausing declines new risk and is safe to
    ///      make fast; unpausing re-admits risk and must stay behind the full
    ///      governance quorum. The previous `settlementRouter` allowance is
    ///      gone -- the deployed router never had a call path for it, so it was
    ///      an authority granted and never exercised (audit AGF-08).
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

    /// @notice Legacy setter alias for the new-risk reserve buffer.
    /// @dev Deprecated alias for setRiskReserveBps. It does not update withdrawalBufferBps after the
    ///      V14 risk-reserve / withdrawal-buffer split.
    function setMinLiquidityBps(uint256 bps) external onlyGov {
        _setRiskReserveBps(bps);
    }

    function setRiskReserveBps(uint256 bps) external onlyGov {
        _setRiskReserveBps(bps);
    }

    function setWithdrawalBufferBps(uint256 bps) external onlyGov {
        if (bps > 10_000) revert Errors.InvalidBps(bps);
        withdrawalBufferBps = bps;
        emit WithdrawalBufferBpsSet(bps);
    }

    function minLiquidityBps() external view override returns (uint256) {
        return riskReserveBps;
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
        if (
            _virtualOffset <= type(uint256).max / MAX_MIN_TURNOVER_UNITS
                && turnover_ > MAX_MIN_TURNOVER_UNITS * _virtualOffset
        ) revert Errors.InvalidConfig();
        minPlayerTurnoverForUnlock = turnover_;
    }

    /// @notice Set the address allowed to pause Risk-In (zero disables the role).
    /// @dev The guardian cannot unpause, cannot move funds, and cannot change
    ///      any other parameter. Its only power is to decline new risk.
    function setGuardian(address guardian_) external onlyGov {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    /// @notice Rescue non-asset tokens only (no ASSET backdoor).
    function rescueToken(address token, address to, uint256 amount) external onlyGov nonReentrant {
        if (token == asset) revert Errors.InvalidConfig();
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
        uint256 B = _assetToken.balanceOf(address(this));
        return AccountingLib.nav(B, protocolFeesPayable, externalPayablesTotal());
    }

    function getSSOT() external view override returns (SSOTTypes.SSOT memory s) {
        uint256 B = _assetToken.balanceOf(address(this));
        uint256 PF = protocolFeesPayable;
        uint256 XP = externalPayablesTotal();
        uint256 NAV = AccountingLib.nav(B, PF, XP);
        uint256 R = totalReserved;
        uint256 rr = AccountingLib.minLiq(NAV, riskReserveBps);
        uint256 rf = (NAV >= R + rr) ? (NAV - R - rr) : 0;
        uint256 wb = AccountingLib.minLiq(NAV, withdrawalBufferBps);
        uint256 wo = (NAV >= R + wb) ? (NAV - R - wb) : 0;
        s = SSOTTypes.SSOT({
            B: B,
            PF: PF,
            XP: XP,
            NAV: NAV,
            R: R,
            minLiquidityBps: riskReserveBps,
            minLiq: rr,
            free: rf,
            riskReserveBps: riskReserveBps,
            riskReserve: rr,
            riskFree: rf,
            withdrawalBufferBps: withdrawalBufferBps,
            withdrawalBuffer: wb,
            withdrawable: wo,
            riskInPaused: paused(),
            xpAccruedTotal: xpAccruedTotal,
            xpLockedTotal: xpLockedTotal,
            xpHoldbackTotal: xpHoldbackTotal,
            holdbackVestingSeconds: holdbackVestingSeconds,
            minPlayerTurnoverForUnlock: minPlayerTurnoverForUnlock
        });
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
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
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
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) revert Errors.ZeroAddress();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        uint256 bal = balanceOf[from];
        if (bal < amount) revert Errors.InsufficientBalance();
        balanceOf[from] = bal - amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
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

    function maxWithdraw(address owner) external view override returns (uint256) {
        if (paused()) return 0;
        uint256 capAssets = _optionalOutflowCap();
        uint256 ownerAssets = _convertToAssets(balanceOf[owner], Math.Rounding.Floor);
        return capAssets < ownerAssets ? capAssets : ownerAssets;
    }

    function maxRedeem(address owner) external view override returns (uint256) {
        if (paused()) return 0;
        uint256 capAssets = _optionalOutflowCap();
        uint256 capShares = _convertToShares(capAssets, Math.Rounding.Floor);
        uint256 bal = balanceOf[owner];
        return capShares < bal ? capShares : bal;
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

    function withdraw(uint256 assets_, address receiver, address owner)
        external
        override
        nonReentrant
        returns (uint256 shares)
    {
        if (paused()) revert RiskInPaused();
        if (assets_ == 0) revert Errors.InsufficientBalance();
        shares = _convertToShares(assets_, Math.Rounding.Ceil);
        _spendAllowanceIfNeeded(owner, shares);
        _checkOptionalOutflowDomain(assets_, 0, 0);
        _burn(owner, shares);
        _assetToken.safeTransfer(receiver, assets_);
        emit Withdraw(msg.sender, receiver, owner, assets_, shares);
    }

    function redeem(uint256 shares_, address receiver, address owner)
        external
        override
        nonReentrant
        returns (uint256 assets_)
    {
        if (paused()) revert RiskInPaused();
        if (shares_ == 0) revert Errors.InsufficientBalance();
        _spendAllowanceIfNeeded(owner, shares_);
        assets_ = _convertToAssets(shares_, Math.Rounding.Floor);
        _checkOptionalOutflowDomain(assets_, 0, 0);
        _burn(owner, shares_);
        _assetToken.safeTransfer(receiver, assets_);
        emit Withdraw(msg.sender, receiver, owner, assets_, shares_);
    }

    function _spendAllowanceIfNeeded(address owner, uint256 shares) internal {
        if (msg.sender == owner) return;
        uint256 allowed = allowance[owner][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < shares) revert Errors.InsufficientAllowance();
            allowance[owner][msg.sender] = allowed - shares;
        }
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

    function _optionalOutflowCap() internal view returns (uint256 capAssets) {
        uint256 B = _assetToken.balanceOf(address(this));
        uint256 NAV = AccountingLib.nav(B, protocolFeesPayable, externalPayablesTotal());
        uint256 R = totalReserved;
        uint256 buffer = AccountingLib.minLiq(NAV, withdrawalBufferBps);
        if (NAV <= R + buffer) return 0;
        return NAV - R - buffer;
    }

    function _checkOptionalOutflowDomain(uint256 assetsOut, uint256 pfDecrease, uint256 xpDecrease) internal view {
        uint256 B = _assetToken.balanceOf(address(this));
        if (B < assetsOut) revert Errors.InsufficientBalance();

        uint256 PF = protocolFeesPayable;
        uint256 XP = externalPayablesTotal();
        if (pfDecrease > PF || xpDecrease > XP) revert OptionalOutflowDomainViolation();

        uint256 NAVBefore = AccountingLib.nav(B, PF, XP);
        uint256 buffer = AccountingLib.minLiq(NAVBefore, withdrawalBufferBps);
        uint256 Bafter = B - assetsOut;
        uint256 PFafter = PF - pfDecrease;
        uint256 XPafter = XP - xpDecrease;

        uint256 NAV = AccountingLib.nav(Bafter, PFafter, XPafter);
        uint256 R = totalReserved;
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
        Hold storage h = holds[betId];
        if (h.open || h.player != address(0)) revert BetAlreadyExists(betId);

        _assetToken.safeTransferFrom(player, address(this), stake);

        uint256 B = _assetToken.balanceOf(address(this));
        uint256 NAV = AccountingLib.nav(B, protocolFeesPayable, externalPayablesTotal());
        uint256 Rafter = totalReserved + reserved;
        uint256 ml = AccountingLib.minLiq(NAV, riskReserveBps);
        if (NAV < Rafter || NAV - Rafter < ml) revert SolvencyViolation();

        totalReserved = Rafter;
        totalBetsHeld += 1;

        holds[betId] = Hold({player: player, stake: stake, reserved: reserved, snapshotHash: snapshotHash, open: true});

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

        // Release reserve first (B3 + avoid transient insolvency window)
        h.open = false;
        totalReserved -= reserved;
        emit BetReserveReleased(betId, h.player, reserved);

        // Player MUST-PAY
        uint256 playerOwed = payoutNet + refundAmount;
        if (playerOwed > 0) {
            _assetToken.safeTransfer(h.player, playerOwed);
        }

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

        uint256 n = xpAwards.length;
        if (n > 32) revert XPTooManyAwards(n);

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

        h.open = false;
        totalReserved -= reserved;
        emit BetReserveReleased(betId, h.player, reserved);

        if (refundAmount > 0) {
            _assetToken.safeTransfer(h.player, refundAmount);
        }

        totalRefunded += refundAmount;
        totalBetsRefunded += 1;

        emit BetRefunded(betId, h.player, refundAmount);
    }

    function riskInPaused() external view override returns (bool) {
        return paused();
    }
}
