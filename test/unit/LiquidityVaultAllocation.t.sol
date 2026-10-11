// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {VaultPrefixReference} from "../utils/VaultPrefixReference.sol";
import {ITreeView, PrefixPath} from "../utils/PrefixPath.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {BankNFTRouterHarness} from "../unit/BankNFTAccounting.t.sol";
import {BankTestBase} from "../utils/BankTestBase.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";

/// Production Bank/Vault custody: with one result-independent allocation domain per position, a sliced prefix
/// can no longer keep a position's profit while moving its loss onto later deposits.
contract LiquidityVaultAllocationTest is Test {
    Bank private bank;
    LiquidityVault private vault;
    BlacklistToken private token;
    BankNFTRouterHarness private router;
    address private constant A = address(0xA);
    address private constant B = address(0xB);
    uint48 private leafA;
    uint48 private leafB;

    function setUp() public {
        token = new BlacklistToken();
        router = new BankNFTRouterHarness();
        bank = new Bank(address(token), address(this), 6_000, 6, 10_000);
        vault = LiquidityVault(bank.vault());
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(router));
        leafA = _deposit(A, 1_000e6);
        vm.warp(block.timestamp + 1 days);
        token.mint(address(this), 100e6);
        token.approve(address(bank), 100e6);
        router.open(bank, 1, address(0xBEEF), 100e6, 200e6, address(this)); // cutoff = leafA, max LP loss 100
        leafB = _deposit(B, 1_000e6);
    }

    function _deposit(address owner, uint256 amount) private returns (uint48 id) {
        token.mint(owner, amount);
        vm.startPrank(owner);
        token.approve(address(vault), amount);
        id = vault.addDeposit(amount);
        vm.stopPrank();
    }

    function _settle(bool playerWins) private {
        if (playerWins) router.finish(bank, 1, 200e6, 200e6, 0, 0, new SSOTTypes.XPAward[](0));
        else router.finish(bank, 1, 0, 0, 0, 0, new SSOTTypes.XPAward[](0));
        assertTrue(bank.getSSOT().accountingValid);
    }

    /// percent = 0: A keeps the whole prefix. Otherwise A withdraws `percent` of its leaf before settlement.
    function _wealth(uint40 percent, bool playerWins) private returns (uint256 a, uint256 b) {
        uint256 snap = vm.snapshotState();
        uint256 cashA;
        if (percent != 0) {
            vm.prank(A);
            cashA = vault.withdrawDeposit(leafA, percent);
        }
        _settle(playerWins);
        a = cashA + vault.nodeWithdrawView(leafA);
        b = vault.nodeWithdrawView(leafB);
        assertTrue(vm.revertToState(snap));
    }

    function test_controlUnchanged_prefixCoversMaxLoss() public {
        (uint256 aWin, uint256 bWin) = _wealth(0, true);
        (uint256 aLose, uint256 bLose) = _wealth(0, false);
        assertEq(aWin, 900e6);
        assertEq(aLose, 1_100e6);
        assertEq(bWin, 1_000e6, "the cutoff still protects B");
        assertEq(bLose, 1_000e6);
    }

    function test_slicedPrefixNowSharesBothSidesWithB() public {
        (uint256 aWin, uint256 bWin) = _wealth(1e12 - 1, true);
        (uint256 aLose, uint256 bLose) = _wealth(1e12 - 1, false);
        emit log_named_uint("sliver, player wins:  A", aWin);
        emit log_named_uint("sliver, player wins:  B", bWin);
        emit log_named_uint("sliver, player loses: A", aLose);
        emit log_named_uint("sliver, player loses: B", bLose);
        // A kept 1 unit in a 1,000,000,001-unit tree: its exposure is now one part in 1,000,000,001 of the position.
        assertApproxEqAbs(aWin, 1_000e6, 1e3);
        assertApproxEqAbs(aLose, 1_000e6, 1e3);
        // B now carries both sides of the position, not only its loss.
        assertApproxEqAbs(bWin, 900e6, 1e3);
        assertApproxEqAbs(bLose, 1_100e6, 1e3);
    }

    function test_boundary_prefixEqualToMaxLossStaysInPrefix() public {
        // Leave exactly 100 USDC (the position's maximum LP loss) in A's leaf.
        (uint256 aWin, uint256 bWin) = _wealth(9e11, true);
        (uint256 aLose, uint256 bLose) = _wealth(9e11, false);
        assertEq(bWin, 1_000e6, "prefix == max loss keeps the prefix domain");
        assertEq(bLose, 1_000e6);
        assertEq(aWin, 900e6);
        assertEq(aLose, 1_100e6);
    }

    function test_boundary_oneUnitBelowMaxLossUsesWholeTreeForBothSides() public {
        // 900_000_001_000 / 1e12 withdraws 900.000001 and leaves 99.999999 USDC, one unit below the maximum loss.
        (, uint256 bWin) = _wealth(900_000_001_000, true);
        (, uint256 bLose) = _wealth(900_000_001_000, false);
        assertLt(bWin, 1_000e6);
        assertGt(bLose, 1_000e6);
        assertApproxEqAbs(1_000e6 - bWin, bLose - 1_000e6, 2, "B's exposure is symmetric");
    }

    function test_burnedCutoffStillSettlesBothOutcomes() public {
        (uint256 aWin, uint256 bWin) = _wealth(1e12, true);
        (uint256 aLose, uint256 bLose) = _wealth(1e12, false);
        assertEq(aWin, 1_000e6);
        assertEq(aLose, 1_000e6);
        assertEq(bWin, 900e6);
        assertEq(bLose, 1_100e6);
    }
}

/// The domain threshold is the position's maximum LP loss, not the realized result: a prefix that could absorb this
/// profit-sized result but not the position's worst loss must not keep the profit while shedding the loss.
contract LiquidityVaultMaximumLossThresholdTest is Test {
    Bank private bank;
    LiquidityVault private vault;
    BlacklistToken private token;
    BankNFTRouterHarness private router;
    address private constant A = address(0xA);
    address private constant B = address(0xB);
    uint48 private leafA;
    uint48 private leafB;

    function setUp() public {
        token = new BlacklistToken();
        router = new BankNFTRouterHarness();
        bank = new Bank(address(token), address(this), 6_000, 6, 10_000);
        vault = LiquidityVault(bank.vault());
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(router));
        leafA = _deposit(A, 1_000e6);
        vm.warp(block.timestamp + 1 days);
        token.mint(address(this), 100e6);
        token.approve(address(bank), 100e6);
        router.open(bank, 1, address(0xBEEF), 100e6, 300e6, address(this)); // LP profit 100 or LP loss up to 200
        leafB = _deposit(B, 1_000e6);
        vm.prank(A);
        vault.withdrawDeposit(leafA, 85e10); // leaves 150: above the 100 profit, below the 200 maximum loss
    }

    function _deposit(address owner, uint256 amount) private returns (uint48 id) {
        token.mint(owner, amount);
        vm.startPrank(owner);
        token.approve(address(vault), amount);
        id = vault.addDeposit(amount);
        vm.stopPrank();
    }

    function _b(bool playerWins) private returns (uint256 b) {
        uint256 snap = vm.snapshotState();
        if (playerWins) router.finish(bank, 1, 300e6, 300e6, 0, 0, new SSOTTypes.XPAward[](0));
        else router.finish(bank, 1, 0, 0, 0, 0, new SSOTTypes.XPAward[](0));
        assertTrue(bank.getSSOT().accountingValid);
        b = vault.nodeWithdrawView(leafB);
        assertTrue(vm.revertToState(snap));
    }

    function test_prefixBetweenProfitAndMaxLossUsesWholeTreeForBoth() public {
        assertEq(vault.nodeWithdrawView(leafA), 150e6);
        uint256 bLoss = 1_000e6 - _b(true); // LP loss 200
        uint256 bProfit = _b(false) - 1_000e6; // LP profit 100
        // Both sides use one 1,150-unit domain: B carries 1000/1150 of each, so its loss is twice its profit.
        assertApproxEqAbs(bLoss, 173_913_043, 2);
        assertApproxEqAbs(bProfit, 86_956_521, 2);
    }
}

/// Compares the preserved full-prefix reference with the production predicate and tree primitives.
contract VaultPrefixHarness is VaultPrefixReference {
    constructor(address asset_) VaultPrefixReference(asset_, msg.sender) {}

    function deposit(uint128 a) external returns (uint48) {
        return _nodeAddLiquidity(a);
    }

    function withdraw(uint48 leaf, uint40 p) external returns (uint128) {
        return _nodeWithdrawPercent(leaf, p);
    }

    function addLimit(uint128 a, uint48 leaf) external {
        _addLimit(a, leaf);
    }

    function removeLimit(uint128 a, uint48 leaf) external {
        _removeLimit(a, leaf);
    }

    function prefixCapital(uint48 cutoff) external view returns (uint256) {
        return _prefixCapital(cutoff);
    }

    function prefixCovers(uint48 cutoff, uint256 threshold) external view returns (bool) {
        return _prefixCovers(cutoff, threshold);
    }

    /// Oracle: the tree's own push to `cutoff`, then the canonical-cover range sum.
    function pushedPrefixSum(uint48 cutoff) external returns (uint128) {
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, cutoff, ++updateId);
        return _getLeavesAmount(LIQUIDITYNODES, cutoff);
    }

    /// The domain applySettlement selects: the prefix when it covers k, otherwise every used leaf.
    function domainLeaf(uint48 cutoff, uint128 maxLoss) public view returns (uint48) {
        uint48 last = nextNode - 1;
        return maxLoss == 0 || cutoff == last || _prefixCovers(cutoff, maxLoss) ? cutoff : last;
    }

    /// Oracle: the pinned limit operation, preview included, on the same domain.
    function vendorAllocate(uint48 cutoff, uint128 maxLoss, uint128 amount, bool isSub) external {
        uint48 leaf = domainLeaf(cutoff, maxLoss);
        if (isSub) _removeLimit(amount, leaf);
        else _addLimit(amount, leaf);
    }

    /// The pinned sufficiency preview where the limit operation evaluates it: right after its push.
    function previewAfterPush(uint48 leaf, uint128 amount, bool isSub) external returns (bool) {
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        return _isNeedUpdateWholeLeaves(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, isSub);
    }
}

/// The read-only prefix replay must equal both the pushed range sum and the sum of every prefix leaf's balance,
/// including lazy states and histories whose leaf numbers jump across the upper levels of the tree.
contract LiquidityVaultPrefixCapitalTest is Test {
    uint48 internal constant FIRST = 1_099_511_627_776;
    uint48 internal constant LAST = FIRST * 2 - 1;
    VaultPrefixHarness internal h;
    BlacklistToken internal tok;
    uint48[] internal used;

    function _rand(uint256 seed, uint256 i, string memory tag) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, i, tag)));
    }

    function _jump(uint256 forward) internal {
        // Slot 0 packs (nextNode:uint48, updateId:uint64); only nextNode moves, as in NftTreeGasBounds.
        uint256 packed = uint256(vm.load(address(h), bytes32(0)));
        uint256 next = uint48(packed);
        uint256 room = uint256(LAST) - next;
        if (room < 2) return;
        next += forward % (room / 2);
        vm.store(address(h), bytes32(0), bytes32((packed >> 48 << 48) | next));
        assertEq(h.nextNode(), next);
    }

    function _check(uint48 cutoff) internal {
        uint256 view_ = h.prefixCapital(cutoff);
        assertTrue(h.prefixCovers(cutoff, view_));
        if (view_ != 0) assertTrue(h.prefixCovers(cutoff, view_ - 1));
        assertFalse(h.prefixCovers(cutoff, view_ + 1));
        uint256 leaves;
        for (uint256 j; j < used.length && used[j] <= cutoff; ++j) {
            leaves += h.nodeWithdrawView(used[j]);
        }
        uint256 snap = vm.snapshotState();
        uint256 pushed = h.pushedPrefixSum(cutoff);
        assertTrue(vm.revertToState(snap)); // keep the lazy state for later steps
        assertEq(view_, pushed, "replay differs from the pushed range sum");
        assertEq(view_, leaves, "replay differs from the prefix leaf balances");
        // The fork qualification's walk over the public tree view is the same rule as the verbatim helper.
        assertEq(PrefixPath.prefixCapital(ITreeView(address(h)), FIRST, cutoff), view_, "PrefixPath differs");
    }

    function _newHarness() internal {
        tok = new BlacklistToken();
        h = new VaultPrefixHarness(address(tok));
        delete used;
    }

    /// One random primitive history step: deposits (sometimes after a leaf-number jump), thin or partial
    /// withdrawals, and lazy profits/losses over random prefixes. `admitted` skips a profit on an empty root:
    /// the Vault books that as protocol capital, so a root without funded leaves is not a reachable state.
    function _step(uint256 seed, uint256 i, bool admitted) internal {
        uint256 op = used.length == 0 ? 0 : _rand(seed, i, "op") % 6;
        uint128 amount = uint128(1 + _rand(seed, i, "amt") % (_rand(seed, i, "big") % 3 == 0 ? 1e6 : 1e18));
        uint48 leaf = used.length == 0 ? FIRST : used[_rand(seed, i, "leaf") % used.length];
        if (op == 0) {
            if (_rand(seed, i, "jmp") % 4 == 0) _jump(_rand(seed, i, "fwd"));
            used.push(h.deposit(amount));
        } else if (op == 1) {
            // Heavy withdrawals leave thin or empty prefixes.
            uint40 pct = _rand(seed, i, "thin") % 2 == 0
                ? uint40(1e12 - _rand(seed, i, "p") % 3)
                : uint40(1 + _rand(seed, i, "p") % 1e12);
            try h.withdraw(leaf, pct) {} catch {}
        } else if (op == 2 || op == 3) {
            if (admitted && h.getReserve() == 0) return;
            try h.addLimit(amount, leaf) {} catch {}
        } else {
            uint128 r = h.getReserve();
            if (r != 0) try h.removeLimit(uint128(1 + _rand(seed, i, "loss") % r), leaf) {} catch {}
        }
    }

    function testFuzz_prefixReplayIsExact(uint256 seed) public {
        _newHarness();
        for (uint256 i; i < 48; ++i) {
            _step(seed, i, false);
            uint48 last = h.nextNode() - 1;
            _check(used[_rand(seed, i, "cut") % used.length]);
            _check(uint48(FIRST + _rand(seed, i, "any") % (uint256(last) - FIRST + 1)));
            _check(last);
        }
    }

    /// Every node a terminal result can write lies on a root-to-used-leaf path; hash them with both counters.
    function _treeDigest() internal view returns (bytes32 digest) {
        digest = keccak256(abi.encode(h.nextNode(), h.updateId()));
        for (uint256 j; j < used.length; ++j) {
            for (uint48 node = used[j]; node != 0; node /= 2) {
                (uint64 id, uint128 amount) = h.treeNode(node);
                digest = keccak256(abi.encode(digest, node, id, amount));
            }
        }
    }

    /// Admitted settlement on the current history: k <= root is locked, cash covers the root, a loss is at most k.
    /// The whole trial is reverted afterwards, so the history continues unchanged.
    function _settleTrial(uint256 seed, uint256 i) internal {
        uint128 root = h.getReserve();
        if (root == 0) return;
        uint256 leaves;
        for (uint256 j; j < used.length; ++j) {
            leaves += h.nodeWithdrawView(used[j]);
        }
        assertEq(leaves, root, "an admitted history keeps every root unit on a used leaf");
        uint256 outer = vm.snapshotState();
        uint48 cutoff = used[_rand(seed, i, "cut") % used.length];
        // Half of the k > 0 trials stay within the cutoff prefix so both domains are exercised.
        uint256 prefix = h.prefixCapital(cutoff);
        uint128 k = _rand(seed, i, "k0") % 8 == 0
            ? 0
            : uint128(1 + _rand(seed, i, "k") % (_rand(seed, i, "dom") % 2 == 0 && prefix != 0 ? prefix : root));
        bool isSub = k != 0 && _rand(seed, i, "sign") % 2 == 0;
        uint128 amount = isSub ? uint128(1 + _rand(seed, i, "loss") % k) : uint128(1 + _rand(seed, i, "gain") % 1e18);
        uint256 cash = tok.balanceOf(address(h));
        if (cash < root) tok.mint(address(h), root - cash);
        if (k != 0) h.lockLiquidity(k);
        if (!isSub) {
            tok.mint(address(this), amount);
            tok.approve(address(h), amount);
        }
        uint48 leaf = h.domainLeaf(cutoff, k);
        uint256 snap = vm.snapshotState();
        // Production: loss as cost = stake + loss, profit as stake = profit with zero cost.
        if (isSub) h.applySettlement(cutoff, k, 1, 1 + amount);
        else h.applySettlement(cutoff, k, amount, 0);
        bytes32 produced = _treeDigest();
        assertTrue(vm.revertToState(snap));
        snap = vm.snapshotState();
        h.vendorAllocate(cutoff, k, amount, isSub);
        assertEq(_treeDigest(), produced, "skipping the preview changed the tree");
        assertTrue(vm.revertToState(snap));
        if (k != 0) {
            snap = vm.snapshotState();
            assertFalse(h.previewAfterPush(leaf, amount, isSub), "k > 0 preview asked for a fallback");
            assertTrue(vm.revertToState(snap));
        }
        assertTrue(vm.revertToState(outer));
    }

    /// The production allocation runs one push and one lazy update. It must leave exactly the tree the pinned
    /// limit operation leaves on the same domain, whose preview answers "no fallback" for every admitted k > 0.
    function testFuzz_settlementMatchesPinnedLimitOperation(uint256 seed) public {
        _newHarness();
        for (uint256 i; i < 40; ++i) {
            _step(seed, i, true);
            if (i % 3 == 2) _settleTrial(seed, i);
        }
    }

    /// A loss needs k > 0: cost <= stake + released rejects it at k == 0 before any tree write, so the k == 0
    /// branch of `_allocate` only ever receives a profit.
    function test_lossWithZeroReleasedCapitalIsRejected() public {
        _newHarness();
        uint48 leaf = h.deposit(1_000);
        tok.mint(address(h), 1_000);
        vm.expectRevert(LiquidityVault.InvalidTerminalCost.selector);
        h.applySettlement(leaf, 0, 10, 11);
        h.lockLiquidity(400); // another position's lock does not let this one release capital
        vm.expectRevert(LiquidityVault.InvalidTerminalCost.selector);
        h.applySettlement(leaf, 0, 10, 11);
        tok.mint(address(this), 1);
        tok.approve(address(h), 1);
        h.applySettlement(leaf, 0, 11, 10); // k == 0 profit still settles through the pinned operation
        assertEq(h.getReserve(), 1_001);
        assertEq(h.nodeWithdrawView(leaf), 1_001);
    }

    function test_prefixReplayAtAdmittedCapitalLimit() public {
        _newHarness();
        uint128 cap = uint128(h.MAX_TREE_CAPITAL());
        used.push(h.deposit(cap / 3));
        used.push(h.deposit(cap / 3));
        used.push(h.deposit(cap - 2 * (cap / 3)));
        h.removeLimit(cap / 2, used[2]);
        _check(used[0]);
        _check(used[1]);
        h.addLimit(cap / 2, used[1]);
        _check(used[0]);
        _check(used[1]);
        _check(used[2]);
    }
}

/// Real Router admission/fee caps, production Bank/Vault; only randomness delivery is substituted.
contract LiquidityVaultAllocationRouterTest is BankTestBase {
    Bank private bank;
    LiquidityVault private vault;
    SettlementRouter private router;
    BlacklistToken private token;
    address private constant A = address(0xA);
    address private constant B = address(0xB);
    address private constant C = address(0xC);
    address private constant HUB = address(0xBEEF);
    address private constant PLAYER = address(0x1234);
    uint48 private leafA;

    function setUp() public {
        token = new BlacklistToken();
        bank = new Bank(address(token), address(this), 6000, 6, 10000);
        vault = LiquidityVault(bank.vault());
        PoolRegistry registry = new PoolRegistry(address(this));
        router = new SettlementRouter(address(registry));
        registry.registerPool(1, address(token), address(bank), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(HUB, true);
        registry.setHubAllowedForPool(1, HUB, true);
        bank.setSettlementRouterOnce(address(router));
        _bindTestConsumer(bank);
        token.mint(HUB, 1000e6);
        vm.prank(HUB);
        token.approve(address(bank), type(uint256).max);
        leafA = _deposit(A);
        vm.warp(block.timestamp + 1 days);
    }

    function _deposit(address owner) private returns (uint48 leaf) {
        token.mint(owner, 1000e6);
        vm.startPrank(owner);
        token.approve(address(vault), 1000e6);
        leaf = vault.addDeposit(1000e6);
        vm.stopPrank();
    }

    function _open(uint256 reserve) private returns (uint256 id) {
        vm.prank(HUB);
        id = router.openPosition(1, PLAYER, 100e6, reserve, bytes32(0), 400);
    }

    function _finish(uint256 id, uint256 payout) private {
        vm.prank(HUB);
        router.settlePosition(id, payout, payout, 0, 0, new SSOTTypes.XPAward[](0));
        assertTrue(bank.getSSOT().accountingValid);
        assertEq(token.balanceOf(address(vault)), vault.getReserve());
    }

    function test_partialRefundAndAllRewardBucketsUseOriginalMaximumLoss() public {
        uint256 id = _open(300e6);
        uint48 leafB = _deposit(B);
        vm.prank(A);
        vault.withdrawDeposit(leafA, 85e10); // prefix 150 < k 200; covers both actual deltas
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](1);
        awards[0] = SSOTTypes.XPAward({
            payee: C, sourcePlayer: PLAYER, accrued: 490000, locked: 250000, holdback: 240000, reason: bytes32(0)
        });
        uint256 snapshot = vm.snapshotState();
        vm.prank(HUB);
        router.settlePosition(id, 101e6, 96960000, 1e6, 1e6, awards);
        // Gross > stake, but cost 99.94 < stake. Later B shares the 0.06 profit.
        assertApproxEqAbs(vault.nodeWithdrawView(leafB) - 1000e6, uint256(60000) * 1000 / 1150, 2);
        assertEq(vault.getReserve(), 1150060000);
        assertEq(token.balanceOf(address(bank)), 1980000);
        assertEq(bank.totalReserved(), 0);
        assertEq(bank.pendingStakeTotal(), 0);
        assertEq(vault.lockedLiquidity(), 0);
        assertTrue(bank.getSSOT().accountingValid);
        assertTrue(vm.revertToState(snapshot));
        vm.prank(HUB);
        router.settlePosition(id, 160e6, 153600000, 1e6, 1e6, awards);
        // Actual loss 56.58 < prefix 150 < original k 200: still the whole tree.
        assertApproxEqAbs(1000e6 - vault.nodeWithdrawView(leafB), uint256(56580000) * 1000 / 1150, 2);
        assertEq(vault.getReserve(), 1093420000);
        assertEq(token.balanceOf(address(bank)), 1980000);
        assertTrue(bank.getSSOT().accountingValid);
    }

    function testFuzz_sharedAndDifferentCutoffsReevaluateAfterEachSettlement(bool differentCutoffs, bool lossFirst)
        public
    {
        uint256 first = _open(200e6);
        uint256 second;
        uint48 leafB;
        if (differentCutoffs) {
            leafB = _deposit(B);
            second = _open(200e6);
        } else {
            second = _open(200e6);
            leafB = _deposit(B);
        }
        uint48 leafC;
        if (differentCutoffs) leafC = _deposit(C);
        vm.prank(A);
        vault.withdrawDeposit(leafA, 85e10);
        if (lossFirst) {
            _finish(first, 200e6);
            assertEq(vault.nodeWithdrawView(leafA), 50e6);
            assertEq(vault.lockedLiquidity(), 100e6);
            assertEq(bank.pendingStakeTotal(), 100e6);
            assertEq(bank.totalReserved(), 200e6);
            _finish(second, 0);
            assertApproxEqAbs(vault.nodeWithdrawView(leafA), 50e6 + uint256(100e6) * 50 / 1050, 2);
            assertApproxEqAbs(vault.nodeWithdrawView(leafB), 1000e6 + uint256(100e6) * 1000 / 1050, 2);
        } else {
            _finish(second, 0);
            _finish(first, 200e6);
            uint256 aExpected = differentCutoffs ? 50e6 + uint256(100e6) * 150 / 1150 : 150e6;
            assertApproxEqAbs(vault.nodeWithdrawView(leafA), aExpected, 2);
            assertApproxEqAbs(vault.nodeWithdrawView(leafB), 1150e6 - aExpected, 2);
        }
        if (differentCutoffs) assertEq(vault.nodeWithdrawView(leafC), 1000e6);
        assertEq(vault.getReserve(), differentCutoffs ? 2150e6 : 1150e6);
        assertEq(vault.lockedLiquidity(), 0);
        assertEq(bank.pendingStakeTotal(), 0);
        assertEq(bank.totalReserved(), 0);
    }
}
