// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.37;

import "forge-std/Test.sol";

import {VaultPrefixReference} from "../utils/VaultPrefixReference.sol";

import {LiquidityVault} from "../../src/core/LiquidityVault.sol";

import {Bank} from "../../src/core/Bank.sol";

import {MockERC20} from "../../src/mocks/MockERC20.sol";

import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";

import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

contract IndependentThresholdHarness is VaultPrefixReference {
    constructor(address token) VaultPrefixReference(token, msg.sender) {}

    function covers(uint48 x, uint256 k) external view returns (bool) {
        return _prefixCovers(x, k);
    }

    function full(uint48 x) external view returns (uint256) {
        return _prefixCapital(x);
    }

    /// Raw nodes for read-only predicate and query fixtures only. A test that injects value after `nextNode - 1`
    /// never reaches `_pushLazy`, so such states lie outside UNUSED_SUFFIX's premise P3'.
    function inject(uint48 n, uint128 a, uint64 u) external {
        treeNode[n] = Node(u, a);
    }

    function deposit(uint128 a) external returns (uint48) {
        return _nodeAddLiquidity(a);
    }

    function withdraw(uint48 id, uint40 p) external {
        _nodeWithdrawPercent(id, p);
    }

    function profit(uint128 a, uint48 id) external {
        _addLimit(a, id);
    }

    function loss(uint128 a, uint48 id) external {
        _removeLimit(a, id);
    }

    /// Moves `nextNode` forward only, which keeps UNUSED_SUFFIX's premise P3'.
    function jump(uint48 id) external {
        nextNode = id;
    }

    function forceOldDomain(uint48 id, uint128 delta, bool isProfit) external {
        if (isProfit) _addLimit(delta, id);
        else _removeLimit(delta, id);
    }

    function actualPushPrefix(uint48 id) external returns (uint256) {
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, id, ++updateId);

        return _getLeavesAmount(LIQUIDITYNODES, id);
    }
}

contract VaultPrefixAllocationRegressionTest is Test {
    uint48 constant FIRST = uint48(1) << 40;

    uint48 constant LAST = FIRST * 2 - 1;

    uint48 constant MID = FIRST + FIRST / 2 - 1;

    uint40 constant ONE = 1e12;

    MockERC20 token;

    IndependentThresholdHarness h;

    uint48[] used;

    function setUp() public {
        token = new MockERC20("Independent", "IR", 6);

        h = new IndependentThresholdHarness(address(token));

        token.approve(address(h), type(uint256).max);
    }

    // Review-only Bank accounting for the subclass's public LP operations.
    function lpAccounting() external view returns (uint256, uint256, ILiquidityVaultBank.LPStatus) {
        return (0, LiquidityVault(msg.sender).lockedLiquidity(), ILiquidityVaultBank.LPStatus.Ready);
    }

    function bindRandomnessConsumer(address) external {}

    function unbookedResultCount(address) external pure returns (uint256) {
        return 0;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }

    function rnd(uint256 seed, uint256 index, uint256 salt) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, index, salt)));
    }

    function check(uint48 cutoff) internal {
        uint256 p = h.full(cutoff);

        uint256[6] memory thresholds = [
            uint256(0), p == 0 ? 0 : p - 1, p, p + 1, uint256(type(uint128).max), type(uint256).max
        ];

        for (uint256 i; i < thresholds.length; i++) {
            vm.record();
            bool got = h.covers(cutoff, thresholds[i]);

            (, bytes32[] memory writes) = vm.accesses(address(h));

            assertEq(writes.length, 0, "predicate wrote storage");

            assertEq(got, p >= thresholds[i], "predicate changed original threshold decision");
        }
    }

    function oracleDiff(uint48 cutoff, uint128 k, uint128 delta, bool profit) internal {
        uint128 root = h.getReserve();

        if (root == 0 || k > root || (!profit && delta > k) || (profit && uint256(root) + delta > h.MAX_TREE_CAPITAL()))
        return;

        token.mint(address(h), root);
        token.mint(address(this), delta);

        uint256 snap = vm.snapshotState();

        uint256 exact = h.full(cutoff);

        uint256 pushed = h.actualPushPrefix(cutoff);

        assertEq(exact, pushed, "old exact prefix differs from actual push query in primitive history");

        vm.revertToState(snap);

        uint48 selected = k == 0 || cutoff == h.nextNode() - 1 || exact >= k ? cutoff : h.nextNode() - 1;

        h.forceOldDomain(selected, delta, profit);

        uint256[] memory expected = new uint256[](used.length);

        for (uint256 i; i < used.length; i++) {
            expected[i] = h.nodeWithdrawView(used[i]);
        }

        uint256 expectedRoot = h.getReserve();

        vm.revertToState(snap);

        h.lockLiquidity(k);

        h.applySettlement(cutoff, k, profit ? delta : 0, profit ? 0 : delta);

        assertEq(h.getReserve(), expectedRoot);

        for (uint256 i; i < used.length; i++) {
            assertEq(h.nodeWithdrawView(used[i]), expected[i], "production selector changed leaf wealth");
        }

        vm.revertToState(snap);
    }

    function testFuzz_arbitraryUint128ReadPath(uint256 seed) public {
        uint48 cutoff = FIRST + uint48(seed % FIRST);

        h.inject(1, type(uint128).max, 0);

        uint48 node = 1;
        uint48 start = FIRST;
        uint48 end = LAST;

        for (uint256 i; end != cutoff; i++) {
            uint128 l = uint128(rnd(seed, i, 1));
            uint128 r = uint128(rnd(seed, i, 2));

            if (i % 7 == 0) l = 0;
            if (i % 11 == 0) r = 0;

            h.inject(node * 2, l, uint64(rnd(seed, i, 3)));
            h.inject(node * 2 + 1, r, uint64(rnd(seed, i, 4)));

            uint48 mid = (start + end) / 2;

            if (cutoff <= mid) {
                node *= 2;
                end = mid;
            } else {
                node = node * 2 + 1;
                start = mid + 1;
            }
        }

        check(cutoff);
        check(LAST);

        assertEq(h.covers(cutoff, seed), h.full(cutoff) >= seed);
    }

    function test_uint128MaximumMultiplicationAndUpperEquality() public {
        h.inject(1, type(uint128).max, 1);
        h.inject(2, type(uint128).max, 1);
        h.inject(3, type(uint128).max, 1);

        uint256 p = uint256(type(uint128).max) / 2;

        assertEq(h.full(MID), p);
        check(MID);

        h.inject(3, 0, 1);

        assertEq(h.full(MID), type(uint128).max);
        check(MID);

        assertTrue(h.covers(MID, type(uint128).max), "upper-bound equality incorrectly false");
    }

    function test_ghostZeroChildrenAndAlignedEnds() public {
        h.inject(1, 100, 1);
        check(FIRST);
        check(MID);
        check(LAST);

        h.inject(2, 0, 999);
        h.inject(3, 0, 999);
        check(FIRST);
        check(MID);
        check(LAST - 1);
        check(LAST);

        h.inject(2, 100, 1);
        check(MID);
        check(LAST - 1);
    }

    function testFuzz_primitiveHistoryAndProductionAllocation(uint256 seed) public {
        for (uint256 i; i < 32; i++) {
            uint256 op = used.length == 0 ? 0 : rnd(seed, i, 0) % 6;

            uint128 a = uint128(1 + rnd(seed, i, 1) % 10000);

            uint48 id = used.length == 0 ? FIRST : used[rnd(seed, i, 2) % used.length];

            if (op == 0) {
                id = h.deposit(a);
                used.push(id);
            }else if (op == 1) {
                h.withdraw(id, uint40(1 + rnd(seed, i, 3) % ONE));
            }else if (op == 2) {
                h.withdraw(id, ONE);
            }else if (op == 3 && h.getReserve() > 0) {
                h.profit(a, id);
            }else if (op >= 4 && h.getReserve() > 0) {
                h.loss(uint128(1 + rnd(seed, i, 4) % h.getReserve()), id);
            }

            check(id);
            check(h.nextNode() - 1);

            uint128 root = h.getReserve();

            if (root > 0) {
                uint128 k = uint128(1 + rnd(seed, i, 5) % root);

                oracleDiff(id, k, 1, true);
                oracleDiff(id, k, k, false);

                uint256 p = h.full(id);

                if (p > 0) {
                    oracleDiff(id, uint128(p), 1, true);
                    oracleDiff(id, uint128(p), uint128(p), false);
                }

                oracleDiff(id, 0, 1, true);
            }
        }
    }

    function test_sparseLazyHistoryAndMaximumCapital() public {
        uint128 cap = uint128(h.MAX_TREE_CAPITAL());

        used.push(h.deposit(cap / 3));
        h.jump(MID);
        used.push(h.deposit(cap / 3));

        h.jump(LAST);
        used.push(h.deposit(cap - 2 * (cap / 3)));

        h.loss(cap / 4, LAST);
        h.profit(cap / 4, FIRST);
        h.withdraw(MID, ONE - 1);

        for (uint256 i; i < used.length; i++) {
            check(used[i]);
            uint256 p = h.full(used[i]);
            if (p > 0) oracleDiff(used[i], uint128(p), 1, true);
        }

        check(LAST - 1);
    }

    function test_realNftBurnedCutoffAndProtocolEmptyRoot() public {
        address owner = address(0xA10);
        token.mint(owner, 1000);

        vm.startPrank(owner);
        token.approve(address(h), 1000);
        uint48 id = h.addDeposit(1000);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);

        vm.prank(owner);
        h.withdrawDeposit(id, ONE);

        assertEq(h.getReserve(), 0);
        check(id);

        assertEq(h.applySettlement(id, 0, 7, 0), 7);

        assertEq(h.getReserve(), 0);
    }

    function test_earlyFalseAndTrueActualReads() public {
        h.deposit(248);
        h.jump(MID);
        h.deposit(7);
        h.jump(LAST);
        h.deposit(1246510000132);

        vm.record();
        bool result = h.covers(MID - 1, 499500000);

        (bytes32[] memory reads, bytes32[] memory writes) = vm.accesses(address(h));

        assertFalse(result);
        assertEq(reads.length, 3);
        assertEq(writes.length, 0);

        assertEq(h.full(MID - 1), 248);

        vm.record();
        result = h.covers(LAST - 1, 1);

        (reads, writes) = vm.accesses(address(h));
        assertTrue(result);
        assertEq(reads.length, 3);
        assertEq(writes.length, 0);
    }

    function test_admittedActualBankFirstCutoffStillNeedsFortySplits() public {
        Bank b = new Bank(address(token), address(this), 6000, 6, 10000);

        b.setSettlementRouterOnce(address(this));
        b.setRandomnessConsumerOnce(address(this));

        LiquidityVault v = LiquidityVault(b.vault());

        token.mint(address(this), 2002e6);
        token.approve(address(v), type(uint256).max);
        token.approve(address(b), type(uint256).max);

        uint48 first = v.addDeposit(2000e6);

        b.holdBet(77, address(0xBEEF), 1e6, 500500000, bytes32(uint256(77)), address(this));

        (,,, uint48 cutoff,) = b.holds(77);
        assertEq(cutoff, FIRST);
        assertEq(first, FIRST);

        v.addDeposit(1e6);

        for (uint48 n = 1; n < FIRST; n *= 2) {
            (, uint128 a) = v.treeNode(n);
            h.inject(n, a, 1);

            (, a) = v.treeNode(n + 1);
            if (n > 1) h.inject(n + 1, a, 1);
        }

        (, uint128 leafAmount) = v.treeNode(FIRST);
        h.inject(FIRST, leafAmount, 1);

        (, leafAmount) = v.treeNode(FIRST + 1);
        h.inject(FIRST + 1, leafAmount, 1);

        vm.record();
        assertTrue(h.covers(FIRST, 499500000));

        (bytes32[] memory reads, bytes32[] memory writes) = vm.accesses(address(h));

        assertEq(reads.length, 81, "public admitted amount projection still takes40 splits");
        assertEq(writes.length, 0);

        uint256 begin = gasleft();
        h.full(FIRST);
        uint256 fullGas = begin - gasleft();

        begin = gasleft();
        h.covers(FIRST, 499500000);
        uint256 thresholdGas = begin - gasleft();

        emit log_named_uint("warm helper + subclass dispatch original full-prefix gas", fullGas);

        emit log_named_uint("warm helper + subclass dispatch full40 predicate gas", thresholdGas);

        assertGt(thresholdGas, fullGas, "new full40 path should expose extra checks, not universal savings");

        b.settleBet(77, 2e6, 2e6, 0, 0, new SSOTTypes.XPAward[](0));

        assertEq(v.nodeWithdrawView(FIRST), 1999e6);
        assertEq(v.nodeWithdrawView(FIRST + 1), 1e6);

        assertTrue(b.getSSOT().accountingValid);
    }
}

