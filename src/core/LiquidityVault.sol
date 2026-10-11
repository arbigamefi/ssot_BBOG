// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {LiquidityTree} from "../vendor/azuro-v3/utils/LiquidityTree.sol";
import {ILiquidityVaultBank} from "./interfaces/ILiquidityVaultBank.sol";

/// @notice Per-deposit NFTs and the pinned Azuro tree; Bank holds player stakes and fixed debts.
/// @dev Bank deploys this contract in its constructor. There is no initializer, admin or upgrade path.
contract LiquidityVault is LiquidityTree, ERC721Enumerable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    uint40 public constant ONE = 1e12;
    uint64 public constant WITHDRAW_COOLDOWN = 24 hours;
    uint256 public constant MAX_TREE_CAPITAL = (uint256(1) << 108) - 1;

    address public immutable asset;
    address public immutable bank;
    uint128 public lockedLiquidity;
    mapping(uint48 => uint64) public withdrawAfter;

    struct DepositState {
        address owner;
        uint128 assets;
        uint64 withdrawAfter;
        uint40 maxPercent;
        uint128 maxAssets;
        ILiquidityVaultBank.LPStatus status;
    }

    error InvalidBinding();
    error OnlyBank();
    error InvalidDepositOwner();
    error NotDepositOwner();
    error LPUnavailable(ILiquidityVaultBank.LPStatus status);
    error CapitalLimit();
    error InexactTransfer();
    error CashDeficit();
    error InsufficientFreeCapital();
    error InsufficientLockedCapital();
    error ZeroWithdrawal();
    error InvalidTerminalCost();

    event DepositAdded(
        address indexed payer, address indexed owner, uint48 indexed depositId, uint128 assets, uint64 withdrawAfter
    );
    event DepositWithdrawn(
        address indexed owner, uint48 indexed depositId, uint40 percent, uint128 assets, uint64 withdrawAfter
    );
    event LiquidityLocked(uint128 amount, uint128 totalLocked);
    event PositionApplied(
        uint48 indexed cutoff, uint128 released, uint128 stake, uint128 cost, uint128 protocolCapital
    );

    constructor(address asset_, address bank_) ERC721("ArbiGameFi Liquidity Deposit", "AGF-LP") {
        if (asset_.code.length == 0 || bank_ == address(0) || bank_ != msg.sender) revert InvalidBinding();
        asset = asset_;
        bank = bank_;
        // The Bank's code is not deployed yet: do not call it during construction.
        __liquidityTree_init();
    }

    modifier onlyBank() {
        if (msg.sender != bank) revert OnlyBank();
        _;
    }

    function getReserve() public view returns (uint128) {
        return treeNode[1].amount;
    }

    function getLastDepositId() external view returns (uint48) {
        return nextNode - 1;
    }

    function addDeposit(uint256 amount) external nonReentrant returns (uint48) {
        return _addDeposit(msg.sender, amount);
    }

    function addDepositFor(address owner, uint256 amount) external nonReentrant returns (uint48) {
        return _addDeposit(owner, amount);
    }

    function _addDeposit(address owner, uint256 amount) private returns (uint48 id) {
        if (owner == address(0) || owner == bank || owner == address(this)) revert InvalidDepositOwner();
        if (amount == 0) revert IncorrectAmount();
        (uint256 pending, ILiquidityVaultBank.LPStatus status) = _lpState();
        if (status != ILiquidityVaultBank.LPStatus.Ready) revert LPUnavailable(status);
        if (amount > MAX_TREE_CAPITAL - getReserve() - pending) revert CapitalLimit();
        uint128 assets = uint128(amount); // bounded by MAX_TREE_CAPITAL, strictly below uint128
        _pullExact(msg.sender, assets);
        id = _nodeAddLiquidity(assets);
        uint64 deadline = (block.timestamp + WITHDRAW_COOLDOWN).toUint64();
        withdrawAfter[id] = deadline;
        // Every accounting field is complete before the receiver callback. Standard NFT transfer is allowed.
        _safeMint(owner, id);
        emit DepositAdded(msg.sender, owner, id, assets, deadline);
    }

    function withdrawDeposit(uint48 id, uint40 percent) external nonReentrant returns (uint128 assets) {
        address owner = ownerOf(id);
        if (owner != msg.sender) revert NotDepositOwner();
        if (percent == 0 || percent > ONE) revert IncorrectPercent();
        (, ILiquidityVaultBank.LPStatus status) = _lpState();
        if (status != ILiquidityVaultBank.LPStatus.Ready) revert LPUnavailable(status);
        if (block.timestamp < withdrawAfter[id]) revert LPUnavailable(ILiquidityVaultBank.LPStatus.CoolingDown);
        uint128 free = getReserve() - lockedLiquidity;
        assets = _nodeWithdrawPercent(id, percent);
        if (assets == 0 && percent != ONE) revert ZeroWithdrawal();
        if (assets > free) revert InsufficientFreeCapital();
        uint64 deadline;
        if (percent == ONE) {
            delete withdrawAfter[id];
            _burn(id);
        } else {
            deadline = (block.timestamp + WITHDRAW_COOLDOWN).toUint64();
            withdrawAfter[id] = deadline;
        }
        if (assets != 0) _pushExact(owner, assets);
        emit DepositWithdrawn(owner, id, percent, assets, deadline);
    }

    /// @notice Custom status, not a fungible-share quote. Missing NFTs revert rather than look like zero balances.
    function depositState(uint48 id) external view returns (DepositState memory state) {
        state.owner = ownerOf(id);
        state.assets = nodeWithdrawView(id);
        state.withdrawAfter = withdrawAfter[id];
        (, state.status) = _lpState();
        if (_reentrancyGuardEntered()) state.status = ILiquidityVaultBank.LPStatus.Busy;
        if (state.status != ILiquidityVaultBank.LPStatus.Ready) return state;
        if (block.timestamp < state.withdrawAfter) {
            state.status = ILiquidityVaultBank.LPStatus.CoolingDown;
            return state;
        }
        uint256 free = getReserve() - lockedLiquidity;
        if (free >= state.assets) {
            state.maxPercent = ONE; // includes mature zero-value NFT closure
            state.maxAssets = state.assets;
            return state;
        }
        uint256 percent = ((free + 1) * ONE - 1) / state.assets;
        uint256 assets = uint256(state.assets) * percent / ONE;
        if (assets == 0) {
            state.status = ILiquidityVaultBank.LPStatus.NoLiquidity;
            return state;
        }
        state.maxPercent = uint40(percent); // free < assets implies percent < ONE
        state.maxAssets = uint128(assets);
    }

    /// @notice Bank uses this only as part of an atomic, authenticated position opening.
    function lockLiquidity(uint128 amount) external onlyBank nonReentrant {
        _requireCovered();
        uint256 locked = uint256(lockedLiquidity) + amount;
        if (getReserve() == 0 || locked > getReserve()) revert InsufficientFreeCapital();
        lockedLiquidity = uint128(locked);
        emit LiquidityLocked(amount, lockedLiquidity);
    }

    /// @notice Releases one position's lock, allocates its net result and moves exact cash atomically.
    /// @return protocolCapital Profit for Bank to book as separate protocol capital when the pre-root is zero.
    /// @dev No LP gate here: a busy Bank, pause or saved seed must not block its legitimate terminalization.
    ///      Bank grants its immutable Vault an asset allowance for positive-result funding.
    function applySettlement(uint48 cutoff, uint128 released, uint128 stake, uint128 cost)
        external
        onlyBank
        nonReentrant
        returns (uint128 protocolCapital)
    {
        _requireCovered();
        if (cutoff < LIQUIDITYNODES || cutoff >= nextNode) revert IncorrectLeaf();
        if (released > lockedLiquidity) revert InsufficientLockedCapital();
        if (uint256(cost) > uint256(stake) + released) revert InvalidTerminalCost();
        uint128 beforeRoot = getReserve();
        lockedLiquidity -= released;
        if (cost > stake) {
            uint128 loss = cost - stake;
            _allocate(cutoff, released, loss, true);
            _pushExact(bank, loss);
        } else if (stake > cost) {
            uint128 profit = stake - cost;
            if (beforeRoot == 0) {
                protocolCapital = profit;
            } else {
                if (uint256(beforeRoot) + profit > MAX_TREE_CAPITAL) revert CapitalLimit();
                _pullExact(bank, profit);
                _allocate(cutoff, released, profit, false);
            }
        }
        if (getReserve() < lockedLiquidity) revert InsufficientFreeCapital();
        emit PositionApplied(cutoff, released, stake, cost, protocolCapital);
    }

    /// @dev Applies one result to its position's domain. With k > 0 the domain holds at least k (the prefix covers
    ///      k, or the whole-pool domain holds the root, where L >= K >= k) and a loss never exceeds k. Under tree
    ///      invariant I (a positive internal node has a positive child, so every root unit is held by a used leaf)
    ///      the pinned limit operation's sufficiency preview can then only answer "no fallback", so the same push
    ///      and lazy update run without that O(depth^2) preview (ADR-0034, amendment 2026-10-07). I holds because a
    ///      profit on an empty root is booked as protocol capital, never into the tree. Any new path that books value
    ///      into an empty root, writes tree storage directly or writes a node after the last used leaf voids this
    ///      and the vendor UNUSED_SUFFIX patch, and must be re-argued. A loss (isSub) needs k > 0 because
    ///      cost <= stake + k, so k == 0 admits only profit and keeps the pinned operation with its preview fallback.
    function _allocate(uint48 cutoff, uint128 maxLoss, uint128 amount, bool isSub) private {
        if (maxLoss == 0) {
            _addLimit(amount, cutoff);
            return;
        }
        uint48 leaf = _allocationLeaf(cutoff, maxLoss);
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        _pushLazy(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, isSub, ++updateId);
    }

    /// @dev One allocation domain per position, selected without using the realized result: the position's
    ///      prefix when it can absorb the position's maximum LP loss, otherwise every used leaf. Profit and loss
    ///      therefore share one domain, so shrinking a prefix cannot keep a position's upside while moving its
    ///      downside onto later deposits. `_allocate` is the only caller and handles maxLoss == 0 itself.
    function _allocationLeaf(uint48 cutoff, uint128 maxLoss) private view returns (uint48) {
        uint48 last = nextNode - 1;
        if (cutoff == last) return cutoff;
        return _prefixCovers(cutoff, maxLoss) ? cutoff : last;
    }

    /// @dev The unresolved prefix stays between `capital` and `capital + amount`.
    ///      Replay the tree's integer split; stop only when that
    ///      interval decides the maximum-loss threshold. No tree writes or PnL input.
    function _prefixCovers(uint48 cutoff, uint256 maxLoss) internal view returns (bool) {
        uint48 node = 1;
        uint48 start = LIQUIDITYNODES;
        uint48 end = LIQUIDITYLASTNODE;
        uint256 amount = treeNode[1].amount;
        uint256 capital;
        while (end != cutoff) {
            if (capital >= maxLoss) return true;
            if (capital + amount < maxLoss) return false;
            uint48 mid = (start + end) / 2;
            uint256 l = treeNode[node * 2].amount;
            uint256 r = treeNode[node * 2 + 1].amount;
            uint256 left = l == 0 ? 0 : amount * l / (l + r);
            if (cutoff <= mid) {
                (node, end, amount) = (node * 2, mid, left);
            } else {
                capital += left;
                (node, start, amount) = (node * 2 + 1, mid + 1, r == 0 ? 0 : amount - left);
            }
        }
        return capital + amount >= maxLoss;
    }

    function _lpState() private view returns (uint256 pending, ILiquidityVaultBank.LPStatus status) {
        uint256 reserved;
        try ILiquidityVaultBank(bank).lpAccounting() returns (uint256 p, uint256 r, ILiquidityVaultBank.LPStatus s) {
            pending = p;
            reserved = r;
            status = s;
        } catch {
            return (0, ILiquidityVaultBank.LPStatus.Unavailable);
        }
        uint256 root = getReserve();
        if (
            root > MAX_TREE_CAPITAL || pending > MAX_TREE_CAPITAL - root || reserved < pending
                || reserved - pending != lockedLiquidity || lockedLiquidity > root
        ) return (pending, ILiquidityVaultBank.LPStatus.InvalidAccounting);
        try IERC20(asset).balanceOf(address(this)) returns (uint256 cash) {
            if (cash < root) return (pending, ILiquidityVaultBank.LPStatus.InvalidAccounting);
        } catch {
            return (pending, ILiquidityVaultBank.LPStatus.Unavailable);
        }
    }

    function _requireCovered() private view {
        if (IERC20(asset).balanceOf(address(this)) < getReserve()) revert CashDeficit();
    }

    function _pullExact(address from, uint128 amount) private {
        IERC20 token = IERC20(asset);
        uint256 beforeCash = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        uint256 afterCash = token.balanceOf(address(this));
        if (afterCash < beforeCash || afterCash - beforeCash != amount) revert InexactTransfer();
    }

    function _pushExact(address to, uint128 amount) private {
        IERC20 token = IERC20(asset);
        uint256 beforeCash = token.balanceOf(address(this));
        uint256 beforeReceiver = token.balanceOf(to);
        token.safeTransfer(to, amount);
        uint256 afterCash = token.balanceOf(address(this));
        uint256 afterReceiver = token.balanceOf(to);
        if (
            afterCash > beforeCash || beforeCash - afterCash != amount || afterReceiver < beforeReceiver
                || afterReceiver - beforeReceiver != amount
        ) revert InexactTransfer();
    }
}
