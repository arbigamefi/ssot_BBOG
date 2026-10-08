// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {AzuroTreeHarness} from "../helpers/azuro-tree/AzuroTreeHarness.sol";

contract AzuroRangeSumHarness is AzuroTreeHarness {
    function optimized(uint48 l, uint48 r) external view returns (uint128) {
        return _getLeavesAmount(l, r);
    }

    function pushCutoff(uint48 leaf) external {
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, 1);
    }

    function original(uint48 node, uint48 start, uint48 end, uint48 l, uint48 r) external view returns (uint128) {
        return _original(node, start, end, l, r);
    }

    /// @dev Deliberately inconsistent raw parents/children are query inputs, not claimed production histories.
    ///      No test that injects them reaches `_pushLazy`, so they lie outside UNUSED_SUFFIX's premise P3'.
    function setRaw(uint48 node, uint128 amount, uint64 version) external {
        treeNode[node] = Node(version, amount);
    }

    // Original upstream query from LiquidityTree.sol SHA-256
    // f8b05891ad5a99dba2b315d69b78c515e8e9319679ba8667e0da4f02bcc9ae57.
    // Keep this recursive reference independent of the optimized implementation.
    function _original(uint48 node, uint48 start, uint48 end, uint48 l, uint48 r)
        internal
        view
        returns (uint128 amount)
    {
        if ((start == l && end == r) || (start == end)) return treeNode[node].amount;
        uint48 mid = (start + end) / 2;
        if (start <= l && l <= mid) {
            if (start <= r && r <= mid) {
                amount += _original(node * 2, start, mid, l, r);
            } else {
                amount += _original(node * 2, start, mid, l, mid);
                amount += _original(node * 2 + 1, mid + 1, end, mid + 1, r);
            }
        } else {
            amount += _original(node * 2 + 1, mid + 1, end, l, r);
        }
        return amount;
    }
}

contract AzuroRangeSumEquivalenceTest is Test {
    uint48 internal constant FIRST = uint48(1) << 40;
    uint48 internal constant LAST = 2 * FIRST - 1;
    uint40 internal constant ONE = 1e12;
    AzuroRangeSumHarness internal tree;

    function setUp() public {
        tree = new AzuroRangeSumHarness();
    }

    function test_fullRangeAndSingleEndLeavesPreserveRawCoverAtEveryDepth() public {
        _populateBoundaryAncestors(FIRST, 17);
        _populateBoundaryAncestors(LAST, 23);
        for (uint256 depth; depth <= 40; ++depth) {
            uint48 width = FIRST >> depth;
            uint48 firstNode = uint48(1) << depth;
            _assertQuery(firstNode, FIRST, FIRST + width - 1, FIRST, FIRST + width - 1);
            _assertQuery(firstNode, FIRST, FIRST + width - 1, FIRST, FIRST);
            uint48 lastNode = (firstNode << 1) - 1;
            _assertQuery(lastNode, LAST - width + 1, LAST, LAST - width + 1, LAST);
            _assertQuery(lastNode, LAST - width + 1, LAST, LAST, LAST);
        }
    }

    function testFuzz_arbitrarySubtreeAndRangeReadIdenticalRawNodes(uint256 seed) public {
        uint256 depth = seed % 41;
        uint48 width = FIRST >> depth;
        uint48 offset = uint48((seed >> 8) % (uint256(1) << depth));
        uint48 node = (uint48(1) << depth) + offset;
        uint48 start = FIRST + offset * width;
        uint48 end = start + width - 1;
        uint48 a = start + uint48((seed >> 64) % width);
        uint48 b = start + uint48((seed >> 112) % width);
        (uint48 l, uint48 r) = a <= b ? (a, b) : (b, a);
        _populateBoundaryAncestors(l, seed);
        _populateBoundaryAncestors(r, uint256(keccak256(abi.encode(seed))));
        _assertQuery(node, start, end, l, r);
    }

    function test_lazyParentAmountsAreNotReplacedWithDescendantSums() public {
        tree.setRaw(1, 17, 8);
        tree.setRaw(2, 3, 1);
        tree.setRaw(3, 5, 0);
        tree.setRaw(FIRST, 1000, 5);
        tree.setRaw(LAST, 2000, 2);
        assertEq(tree.optimized(FIRST, LAST), 17, "full range reads the raw parent");
        assertEq(tree.optimized(FIRST, FIRST + FIRST / 2 - 1), 3);
        assertEq(tree.optimized(LAST, LAST), 2000, "single leaf does not infer an updated balance");
        _assertQuery(1, FIRST, LAST, FIRST, LAST);
        _assertQuery(2, FIRST, FIRST + FIRST / 2 - 1, FIRST, FIRST + FIRST / 2 - 1);
        _assertQuery(1, FIRST, LAST, LAST, LAST);
    }

    function test_uint128SumMaximumAndOverflowMatchOriginal() public {
        uint48 l = FIRST + 1;
        uint48 r = FIRST + 2;
        tree.setRaw(l, type(uint128).max - 1, 1);
        tree.setRaw(r, 1, 2);
        _assertQuery(1, FIRST, LAST, l, r);
        assertEq(tree.optimized(l, r), type(uint128).max);
        tree.setRaw(r, 2, 3);
        vm.expectRevert(stdError.arithmeticError);
        tree.original(1, FIRST, LAST, l, r);
        vm.expectRevert(stdError.arithmeticError);
        tree.optimized(l, r);
    }

    function test_reachableDepositProfitLossAndWithdrawalStatesPreserveRangeQueries() public {
        for (uint128 i; i < 8; ++i) {
            tree.deposit(1000 + 37 * i);
        }
        _assertUsedRanges(8);
        tree.profit(777, FIRST + 2);
        _assertUsedRanges(8);
        tree.loss(999, FIRST + 5);
        _assertUsedRanges(8);
        tree.withdraw(FIRST + 1, ONE / 3);
        _assertUsedRanges(8);
        tree.withdraw(FIRST, ONE);
        tree.deposit(313);
        tree.profit(131, FIRST); // Empty old prefix exercises the unchanged whole-tree fallback.
        _assertUsedRanges(9);
        tree.loss(137, FIRST);
        _assertUsedRanges(9);
    }

    function test_extremalPrefixSuffixCoverUses400ReadsWithinPushPathSlots() public {
        // Twenty high ones followed by twenty zeros maximize the one-before-zero pairs.
        uint40 offset = ((uint40(1) << 20) - 1) << 20;
        assertEq(_assertPrefixSuffixReadBound(offset), 400);
    }

    function test_iterationHeavyPrefixStillUsesOnly178CoverReadsWithinPushPathSlots() public {
        // 1111111011111101111101111011110111011010. This endpoint has a different
        // iteration shape from the maximum-cover endpoint; reads do not count while iterations.
        assertEq(_assertPrefixSuffixReadBound(1_095_182_564_826), 178);
    }

    function testFuzz_prefixSuffixCoverReadsStayWithinPushPathSlots(uint40 offset) public {
        _assertPrefixSuffixReadBound(offset);
    }

    /// @dev Empty raw nodes isolate storage-access structure; this is neither a reachable-history
    ///      fixture nor a gas measurement. Every query calls the production optimized function.
    function _assertPrefixSuffixReadBound(uint40 offset) private returns (uint256 totalReads) {
        uint48 cutoff = FIRST + uint48(offset);
        vm.record();
        tree.pushCutoff(cutoff);
        (bytes32[] memory pushReads, bytes32[] memory pushWrites) = vm.accesses(address(tree));
        assertEq(pushWrites.length, 0, "empty-node push writes no amounts");
        (bytes32[] memory pushSlots, uint256 pushSlotCount) = _uniqueSlots(pushReads);
        assertEq(pushSlotCount, 81, "root plus both children at each of forty levels");

        // Independent combinatorial expectation: each high one pairs with every lower zero.
        uint256 expectedTotal;
        uint256 lowerZeros;
        for (uint256 bit; bit < 40; ++bit) {
            if ((uint256(offset) & (uint256(1) << bit)) == 0) ++lowerZeros;
            else expectedTotal += lowerZeros;
        }

        for (uint256 height = 40; height > 0; --height) {
            uint256 bit = height - 1;
            if ((uint256(offset) & (uint256(1) << bit)) == 0) continue;
            uint48 subtreeEnd = uint48(((uint256(cutoff) >> height) << height) | ((uint256(1) << height) - 1));
            if (subtreeEnd == cutoff) continue; // A complete prefix has no excluded suffix.
            uint256 lowerMask = (uint256(1) << bit) - 1;
            uint256 expectedReads = bit - _popcount(uint256(offset) & lowerMask);

            vm.record();
            uint128 amount = tree.optimized(cutoff + 1, subtreeEnd);
            (bytes32[] memory queryReads, bytes32[] memory queryWrites) = vm.accesses(address(tree));
            assertEq(amount, 0, "empty raw cover");
            assertEq(queryWrites.length, 0, "range query is read-only");
            assertEq(queryReads.length, expectedReads, "canonical cover has one node per lower zero");
            totalReads += queryReads.length;
            for (uint256 i; i < queryReads.length; ++i) {
                assertTrue(_containsSlot(pushSlots, pushSlotCount, queryReads[i]), "cover slot absent from cutoff push");
            }
        }
        assertEq(totalReads, expectedTotal, "one-before-zero pairs count cover reads across the prefix path");
        assertLe(totalReads, 400, "forty-bit prefix cover-read bound");
    }

    function _popcount(uint256 value) private pure returns (uint256 count) {
        while (value != 0) {
            value &= value - 1;
            ++count;
        }
    }

    function _uniqueSlots(bytes32[] memory slots) private pure returns (bytes32[] memory unique, uint256 count) {
        unique = new bytes32[](slots.length);
        for (uint256 i; i < slots.length; ++i) {
            if (!_containsSlot(unique, count, slots[i])) unique[count++] = slots[i];
        }
    }

    function _containsSlot(bytes32[] memory slots, uint256 count, bytes32 slot) private pure returns (bool) {
        for (uint256 i; i < count; ++i) {
            if (slots[i] == slot) return true;
        }
        return false;
    }

    function _populateBoundaryAncestors(uint48 leaf, uint256 seed) private {
        uint48 node = leaf;
        while (node != 0) {
            seed = uint256(keccak256(abi.encode(seed, node)));
            // A general interval covers at most 80 nodes, so these arbitrary weights cannot overflow.
            tree.setRaw(node, uint128(seed % (type(uint128).max / 128)), uint64(seed >> 128));
            if (node > 1) {
                tree.setRaw(node ^ 1, uint128((seed >> 8) % (type(uint128).max / 128)), uint64(seed));
            }
            node >>= 1;
        }
    }

    function _assertUsedRanges(uint48 count) private {
        for (uint48 a; a < count; ++a) {
            for (uint48 b = a; b < count; ++b) {
                _assertQuery(1, FIRST, LAST, FIRST + a, FIRST + b);
            }
        }
    }

    function _assertQuery(uint48 node, uint48 start, uint48 end, uint48 l, uint48 r) private {
        vm.record();
        uint128 expected = tree.original(node, start, end, l, r);
        (bytes32[] memory referenceReads, bytes32[] memory referenceWrites) = vm.accesses(address(tree));
        vm.record();
        uint128 actual = tree.optimized(l, r);
        (bytes32[] memory actualReads, bytes32[] memory actualWrites) = vm.accesses(address(tree));
        assertEq(actual, expected);
        assertEq(referenceWrites.length, 0);
        assertEq(actualWrites.length, 0);
        assertEq(actualReads.length, referenceReads.length, "same canonical-cover read count");
        // Range traversal order is intentionally different; storage-slot identity must not be.
        for (uint256 i; i < actualReads.length; ++i) {
            bool found;
            for (uint256 j; j < referenceReads.length; ++j) {
                if (actualReads[i] == referenceReads[j]) {
                    found = true;
                    break;
                }
            }
            assertTrue(found, "optimized query read a different raw node");
        }
    }
}
