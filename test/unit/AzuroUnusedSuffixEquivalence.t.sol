// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {AzuroTreeHarness} from "../helpers/azuro-tree/AzuroTreeHarness.sol";
import {FixedMath} from "../../src/vendor/azuro-v3/libraries/FixedMath.sol";
import {LiquidityTree} from "../../src/vendor/azuro-v3/utils/LiquidityTree.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {VaultPrefixHarness} from "./LiquidityVaultAllocation.t.sol";

/// @dev The applied tree (both patches) next to a reference copy of `_pushLazy` as it was before UNUSED_SUFFIX
///      (tree SHA-256 26d612e9810943233b1804f71a511ce10dafd12740e4367c32147ef2add06108), plus the vendor
///      operations that call it. The copy is verbatim except its name and the `skipFrom` hook on the suffix query:
///      0 is the pre-patch behaviour, 1 reproduces the applied patch (a check of this copy), 2 is the off-by-one
///      mutant the differential must reject.
contract AzuroUnusedSuffixHarness is AzuroTreeHarness {
    using FixedMath for *;

    uint48 public skipFrom;

    function setSkipFrom(uint48 value) external {
        skipFrom = value;
    }

    function add(uint128 amount) external {
        _add(amount);
    }

    function remove(uint128 amount) external {
        _remove(amount);
    }

    /// The Vault's k > 0 allocation: one push, then one lazy update ending at `leaf`.
    function pushAndLazy(uint48 leaf, uint128 amount, bool isSub) external {
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        _pushLazy(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, isSub, ++updateId);
    }

    /// P3': value held by nodes whose whole range lies after the last used leaf (the root is never in this cover
    /// once a leaf is used).
    function unusedSuffixAmount() external view returns (uint128) {
        return _getLeavesAmount(nextNode, LIQUIDITYLASTNODE);
    }

    /// Every node a vendor write can reach lies on a root-to-used-leaf path or is a sibling of one.
    function digest(uint48[] calldata leaves) external view returns (bytes32 d) {
        d = keccak256(abi.encode(nextNode, updateId, treeNode[1].updateId, treeNode[1].amount));
        for (uint256 j; j < leaves.length; ++j) {
            for (uint48 x = leaves[j]; x > 1; x /= 2) {
                Node memory a = treeNode[x];
                Node memory b = treeNode[x ^ 1];
                d = keccak256(abi.encode(d, x, a.updateId, a.amount, b.updateId, b.amount));
            }
        }
    }

    function addRef(uint128 amount) external checkAmount(amount) {
        uint48 leaf = nextNode > LIQUIDITYNODES ? nextNode - 1 : LIQUIDITYLASTNODE;
        if (treeNode[1].amount != 0) _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        _pushLazyRef(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, false, ++updateId);
    }

    function removeRef(uint128 amount) external checkAmount(amount) {
        if (treeNode[1].amount < amount) revert InsufficientTopNodeAmount();
        uint48 leaf = nextNode - 1;
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        _pushLazyRef(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, true, ++updateId);
    }

    function addLimitRef(uint128 amount, uint48 leaf) external checkLeaf(leaf) checkAmount(amount) {
        uint48 lastUsedNode = nextNode - 1;
        if (leaf > lastUsedNode) leaf = lastUsedNode;
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        if (_isNeedUpdateWholeLeaves(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, false)) {
            leaf = lastUsedNode;
            _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        }
        _pushLazyRef(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, false, ++updateId);
    }

    function removeLimitRef(uint128 amount, uint48 leaf) external checkLeaf(leaf) checkAmount(amount) {
        uint48 lastUsedNode = nextNode - 1;
        if (leaf > lastUsedNode) leaf = lastUsedNode;
        if (treeNode[1].amount < amount) revert InsufficientTopNodeAmount();
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        if (_isNeedUpdateWholeLeaves(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, true)) {
            leaf = lastUsedNode;
            _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        }
        _pushLazyRef(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, true, ++updateId);
    }

    function pushAndLazyRef(uint48 leaf, uint128 amount, bool isSub) external {
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        _pushLazyRef(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, isSub, ++updateId);
    }

    // forgefmt: disable-start
    function _pushLazyRef(
        uint48 node,
        uint48 start,
        uint48 end,
        uint48 l,
        uint48 r,
        uint128 amount,
        bool isSub,
        uint64 updateId_
    ) internal {
        if (node == 1 && !isSub && treeNode[node].amount == 0) {
            _changeAmount(node, amount, isSub, updateId_);
            return;
        }
        if ((start == l && end == r) || (start == end)) {
            // if node leafs equal to leaf interval then stop
            // only for not zero node or add to top node
            if (treeNode[node].amount > 0)
                _changeAmount(node, amount, isSub, updateId_);
            return;
        }

        uint48 mid = (start + end) / 2;

        if (start <= l && l <= mid) {
            if (start <= r && r <= mid) {
                // [l,r] in [start,mid] - all leafs in left child
                _pushLazyRef(node * 2, start, mid, l, r, amount, isSub, updateId_);
            } else {
                uint256 lAmount = treeNode[node * 2].amount;
                // get right amount excluding unused leaves
                uint256 rAmount = treeNode[node * 2 + 1].amount -
                    (skipFrom != 0 && r >= nextNode - skipFrom ? 0 : _getLeavesAmount(r + 1, end));
                uint256 sumAmounts = lAmount + rAmount;

                if (sumAmounts == 0) {
                    if (node == 1 || (treeNode[node].amount > 0))
                        _changeAmount(node, amount, isSub, updateId_);
                    return;
                }
                uint128 forLeftAmount = uint128(
                    (amount * lAmount).div(sumAmounts) / FixedMath.ONE
                );

                // l in [start,mid] - part in left child
                _pushLazyRef(
                    node * 2,
                    start,
                    mid,
                    l,
                    mid,
                    forLeftAmount,
                    isSub,
                    updateId_
                );

                // r in [mid+1,end] - part in right child
                _pushLazyRef(
                    node * 2 + 1,
                    mid + 1,
                    end,
                    mid + 1,
                    r,
                    amount - forLeftAmount,
                    isSub,
                    updateId_
                );
            }
        } else {
            // [l,r] in [mid+1,end] - all leafs in right child
            _pushLazyRef(
                node * 2 + 1,
                mid + 1,
                end,
                l,
                r,
                amount,
                isSub,
                updateId_
            );
        }
        if (node == 1 || (treeNode[node].amount > 0))
            _changeAmount(node, amount, isSub, updateId_);
    }
    // forgefmt: disable-end
}

/// UNUSED_SUFFIX must leave exactly the storage, return data and revert data of the pre-patch tree, step by step,
/// over vendor-generic histories: deep leaf-number jumps, thin and empty prefixes, lazy state and value booked into
/// an empty root before the first deposit. P3' (no value after the last used leaf) is asserted after every step.
/// Exactness holds for every call whose lazy range [LIQUIDITYNODES, r] is nonempty, i.e. once a leaf is used.
/// The one known exception (independent review 2026-10-07): on a never-used tree with root value booked by `_add`,
/// the pre-patch `_remove` underflows on a suffix cover that is the root itself, while the patched one succeeds.
/// The Vault never calls `_remove` and settles only below `nextNode`, so it cannot reach that state.
contract AzuroUnusedSuffixEquivalenceTest is Test {
    uint48 internal constant FIRST = uint48(1) << 40;
    uint48 internal constant LAST = FIRST * 2 - 1;
    uint40 internal constant ONE = 1e12;
    AzuroUnusedSuffixHarness internal applied;
    AzuroUnusedSuffixHarness internal ref;
    uint48[] internal used;

    function _rand(uint256 seed, uint256 i, string memory tag) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, i, tag)));
    }

    function _pair(uint48 skipFrom) internal {
        applied = new AzuroUnusedSuffixHarness();
        ref = new AzuroUnusedSuffixHarness();
        ref.setSkipFrom(skipFrom);
        delete used;
    }

    function _same() internal view returns (bool) {
        return applied.digest(used) == ref.digest(used);
    }

    /// The same call on both trees, the applied operation on one and its reference on the other.
    function _both(bytes memory appliedCall, bytes memory refCall) internal {
        (bool okA, bytes memory ra) = address(applied).call(appliedCall);
        (bool okR, bytes memory rr) = address(ref).call(refCall);
        assertEq(okA, okR, "revert behaviour differs");
        assertEq(ra, rr, "return or revert data differs");
    }

    function _jump(uint256 forward) internal {
        uint48 next = applied.nextNode();
        uint256 room = uint256(LAST) - next;
        if (room < 2) return;
        uint48 target = uint48(next + forward % (room / 2));
        applied.forceNextNode(target);
        ref.forceNextNode(target);
    }

    function _step(uint256 seed, uint256 i) internal {
        if (i == 0 && _rand(seed, i, "orphan") % 4 == 0) {
            // Value booked into a never-used root before the first deposit (vendor-legal, not Vault-reachable).
            uint128 orphan = uint128(1 + _rand(seed, i, "orphanAmt") % 1e18);
            _both(
                abi.encodeCall(AzuroUnusedSuffixHarness.add, (orphan)),
                abi.encodeCall(AzuroUnusedSuffixHarness.addRef, (orphan))
            );
        }
        uint256 op = used.length == 0 ? 0 : _rand(seed, i, "op") % 7;
        uint128 amount = uint128(1 + _rand(seed, i, "amt") % (_rand(seed, i, "big") % 3 == 0 ? 1e6 : 1e18));
        uint48 leaf = used.length == 0 ? FIRST : used[_rand(seed, i, "leaf") % used.length];
        // Range ends: a used leaf, the skip boundary nextNode - 1, or one below it (often a skipped id).
        uint256 e = _rand(seed, i, "end") % 4;
        uint48 next = applied.nextNode();
        uint48 end = e < 2 ? leaf : e == 2 || next < FIRST + 2 ? next - 1 : next - 2;
        uint128 root = applied.reserve();
        if (op == 0) {
            if (_rand(seed, i, "jmp") % 4 == 0) _jump(_rand(seed, i, "fwd"));
            if (applied.nextNode() > LAST) return;
            uint48 a = applied.deposit(amount);
            assertEq(ref.deposit(amount), a);
            used.push(a);
        } else if (op == 1) {
            uint40 pct = _rand(seed, i, "thin") % 2 == 0
                ? uint40(ONE - _rand(seed, i, "p") % 3)
                : uint40(1 + _rand(seed, i, "p") % ONE);
            bytes memory call = abi.encodeCall(AzuroTreeHarness.withdraw, (leaf, pct));
            _both(call, call);
        } else if (op == 2) {
            _both(
                abi.encodeCall(AzuroTreeHarness.profit, (amount, end)),
                abi.encodeCall(AzuroUnusedSuffixHarness.addLimitRef, (amount, end))
            );
        } else if (op == 3) {
            if (root == 0) return;
            uint128 loss = uint128(1 + _rand(seed, i, "loss") % root);
            _both(
                abi.encodeCall(AzuroTreeHarness.loss, (loss, end)),
                abi.encodeCall(AzuroUnusedSuffixHarness.removeLimitRef, (loss, end))
            );
        } else if (op == 4) {
            _both(
                abi.encodeCall(AzuroUnusedSuffixHarness.add, (amount)),
                abi.encodeCall(AzuroUnusedSuffixHarness.addRef, (amount))
            );
        } else if (op == 5) {
            if (root == 0) return;
            uint128 removed = uint128(1 + _rand(seed, i, "rm") % root);
            _both(
                abi.encodeCall(AzuroUnusedSuffixHarness.remove, (removed)),
                abi.encodeCall(AzuroUnusedSuffixHarness.removeRef, (removed))
            );
        } else {
            bool isSub = _rand(seed, i, "sub") % 2 == 0;
            uint128 v = isSub ? (root == 0 ? 0 : uint128(1 + _rand(seed, i, "v") % root)) : amount;
            if (v == 0) return;
            _both(
                abi.encodeCall(AzuroUnusedSuffixHarness.pushAndLazy, (end, v, isSub)),
                abi.encodeCall(AzuroUnusedSuffixHarness.pushAndLazyRef, (end, v, isSub))
            );
        }
    }

    function _run(uint256 seed) internal returns (bool diverged) {
        for (uint256 i; i < 48; ++i) {
            _step(seed, i);
            assertEq(applied.unusedSuffixAmount(), 0, "value after the last used leaf (P3')");
            if (!_same()) return true;
        }
    }

    function testFuzz_unusedSuffixSkipLeavesIdenticalState(uint256 seed) public {
        _pair(0);
        assertFalse(_run(seed), "patched tree diverged from the pre-patch reference");
    }

    function testFuzz_referenceCopyReproducesAppliedPatch(uint256 seed) public {
        _pair(1);
        assertFalse(_run(seed), "the reference copy does not reproduce the applied patch");
    }

    /// Negative control: skipping one leaf earlier keeps the last used leaf's value in the split.
    function test_offByOneSkipIsDetected() public {
        _pair(2);
        for (uint128 k = 1; k <= 4; ++k) {
            uint48 leaf = applied.deposit(k * 1_000);
            assertEq(ref.deposit(k * 1_000), leaf);
            used.push(leaf);
        }
        // [FIRST, FIRST + 2] forks below its four-leaf ancestor; the excluded suffix is the funded last leaf.
        applied.loss(900, used[2]);
        ref.removeLimitRef(900, used[2]);
        assertEq(applied.nodeWithdrawView(used[0]) + applied.nodeWithdrawView(used[1]), 3_000 - 450);
        assertFalse(_same(), "an off-by-one suffix skip must change the split");
    }

    /// The known exception: an empty lazy range on a never-used tree with root value.
    function test_neverUsedTreeRemoveIsTheKnownException() public {
        _pair(0);
        applied.add(5);
        ref.addRef(5);
        assertEq(applied.nextNode(), FIRST, "no leaf was ever used");
        vm.expectRevert(stdError.arithmeticError); // pre-patch: 0 - root underflows
        ref.removeRef(3);
        applied.remove(3); // patched: the root-covering query is skipped
        assertEq(applied.reserve(), 2);
    }

    /// Every other entry point that reaches `_pushLazy` agrees on that state; one used leaf removes the exception.
    function test_neverUsedTreeOtherEntryPointsAgreeAndOneLeafEndsTheException() public {
        _pair(0);
        applied.add(5);
        ref.addRef(5);
        vm.expectRevert(stdError.arithmeticError);
        applied.profit(1, FIRST);
        vm.expectRevert(stdError.arithmeticError);
        ref.addLimitRef(1, FIRST);
        vm.expectRevert(stdError.arithmeticError);
        applied.loss(1, FIRST);
        vm.expectRevert(stdError.arithmeticError);
        ref.removeLimitRef(1, FIRST);
        applied.add(7);
        ref.addRef(7);
        used.push(applied.deposit(10));
        assertEq(ref.deposit(10), used[0]);
        applied.remove(3);
        ref.removeRef(3);
        assertTrue(_same());
        assertEq(applied.reserve(), 19);
    }

    /// The Vault cannot reach an empty lazy range: settlement requires a used cutoff below `nextNode`.
    function test_vaultCannotReachTheEmptyRange() public {
        VaultPrefixHarness h = new VaultPrefixHarness(address(new BlacklistToken()));
        vm.expectRevert(LiquidityTree.IncorrectLeaf.selector);
        h.applySettlement(FIRST, 1, 1, 0);
        vm.expectRevert(LiquidityTree.IncorrectLeaf.selector);
        h.applySettlement(FIRST - 1, 0, 1, 0);
    }

    function test_offByOneSkipIsDetectedByTheRandomDifferential() public {
        uint256 detected;
        for (uint256 seed; seed < 16; ++seed) {
            _pair(2);
            if (_run(seed)) ++detected;
        }
        emit log_named_uint("off-by-one mutant detected in seeds (of 16)", detected);
        assertGe(detected, 4, "the random differential must keep its power against the off-by-one mutant");
    }
}
