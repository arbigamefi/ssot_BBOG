// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {VaultPrefixReference} from "../utils/VaultPrefixReference.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

/// The candidate predicate and retained original full-prefix helper are called directly.
/// Tree primitives and sparse-ID states isolate arithmetic; no full LP admission/custody
/// history, callback budget, new gas certificate or predicted random result is claimed.
contract PrefixThresholdHarness is VaultPrefixReference {
    constructor(address token) VaultPrefixReference(token, msg.sender) {}

    function covers(uint48 cutoff, uint256 maxLoss) external view returns (bool) {
        return _prefixCovers(cutoff, maxLoss);
    }

    function fullPrefix(uint48 cutoff) external view returns (uint256) {
        return _prefixCapital(cutoff);
    }

    function deposit(uint128 amount) external returns (uint48) {
        return _nodeAddLiquidity(amount);
    }

    function profit(uint128 amount, uint48 cutoff) external {
        _addLimit(amount, cutoff);
    }

    function loss(uint128 amount, uint48 cutoff) external {
        _removeLimit(amount, cutoff);
    }

    function withdraw(uint48 leaf, uint40 percent) external {
        _nodeWithdrawPercent(leaf, percent);
    }

    /// Moves `nextNode` forward only, which keeps UNUSED_SUFFIX's premise P3'.
    function nextForStructuralFixture(uint48 leaf) external {
        nextNode = leaf;
    }

    /// Raw nodes for the read-only predicate's arithmetic only. A test that injects value after `nextNode - 1`
    /// never reaches `_pushLazy`, so such states lie outside UNUSED_SUFFIX's premise P3'.
    function rawForArithmeticFixture(uint48 node, uint128 amount) external {
        treeNode[node] = Node(1, amount);
    }
}

contract VaultPrefixThresholdCandidateTest is Test {
    uint48 private constant FIRST = uint48(1) << 40;
    uint48 private constant LAST = FIRST * 2 - 1;
    uint48 private constant MID = FIRST + FIRST / 2 - 1;
    uint40 private constant ONE = 1e12;
    PrefixThresholdHarness private h;

    function setUp() public {
        h = new PrefixThresholdHarness(address(new MockERC20("test", "test", 6)));
    }

    function _assertAt(uint48 cutoff, uint256 maxLoss, uint256 prefix) private {
        vm.record();
        bool actual = h.covers(cutoff, maxLoss);
        (, bytes32[] memory writes) = vm.accesses(address(h));
        assertEq(writes.length, 0, "predicate may not write the tree");
        assertEq(actual, prefix >= maxLoss, "candidate differs from retained full-prefix helper");
    }

    function _assertBoundaries(uint48 cutoff) private {
        uint256 prefix = h.fullPrefix(cutoff);
        _assertAt(cutoff, 0, prefix);
        if (prefix != 0) _assertAt(cutoff, prefix - 1, prefix);
        _assertAt(cutoff, prefix, prefix);
        _assertAt(cutoff, prefix + 1, prefix);
        _assertAt(cutoff, type(uint128).max, prefix);
    }

    function _assertReads(uint48 cutoff, uint256 threshold, uint256 expectedFull, uint256 expectedCandidate) private {
        vm.record();
        uint256 prefix = h.fullPrefix(cutoff);
        (bytes32[] memory fullReads, bytes32[] memory fullWrites) = vm.accesses(address(h));
        vm.record();
        bool actual = h.covers(cutoff, threshold);
        (bytes32[] memory candidateReads, bytes32[] memory candidateWrites) = vm.accesses(address(h));
        assertEq(fullWrites.length, 0);
        assertEq(candidateWrites.length, 0);
        assertEq(actual, prefix >= threshold);
        assertEq(fullReads.length, expectedFull, "actual original-helper SLOAD count");
        assertEq(candidateReads.length, expectedCandidate, "actual candidate-helper SLOAD count");
    }

    function test_emptyTreeAndZeroThreshold() public {
        _assertBoundaries(FIRST);
        _assertBoundaries(MID);
        _assertBoundaries(LAST);
    }

    function test_leftOnlyAmountsAndExactGreaterOrEqual() public {
        h.deposit(1000);
        assertEq(h.fullPrefix(FIRST), 1000);
        _assertBoundaries(FIRST);
        _assertBoundaries(MID);
        _assertBoundaries(LAST);
    }

    function test_rightOnlyAmountsAndEmptyLeftPrefix() public {
        h.nextForStructuralFixture(MID + 1);
        h.deposit(300);
        assertEq(h.fullPrefix(MID), 0);
        _assertBoundaries(FIRST);
        _assertBoundaries(MID);
        _assertBoundaries(MID + 1);
        _assertBoundaries(LAST);
    }

    function test_contiguousUnequalBalancesAtThresholdNeighbours() public {
        h.deposit(7);
        h.deposit(11);
        h.deposit(13);
        h.deposit(17);
        assertEq(h.fullPrefix(FIRST + 1), 18);
        for (uint48 i; i < 4; ++i) {
            _assertBoundaries(FIRST + i);
        }
    }

    function test_deepLazyProfitLossAndThinWithdrawal() public {
        uint48 a = h.deposit(10_000);
        h.nextForStructuralFixture(FIRST + (uint48(1) << 20));
        uint48 b = h.deposit(20_000);
        h.nextForStructuralFixture(MID + 1);
        uint48 c = h.deposit(30_000);
        h.nextForStructuralFixture(LAST);
        uint48 d = h.deposit(40_000);
        h.profit(7777, b);
        h.loss(9999, d);
        h.withdraw(c, ONE - 1);
        _assertBoundaries(a);
        _assertBoundaries(b);
        _assertBoundaries(MID);
        _assertBoundaries(c);
        _assertBoundaries(d);
    }

    function test_rawRoundingAndZeroChildrenKeepOriginalSemantics() public {
        // Parent29 over children11+17: floor(29*11/28)=11, with remainder18 on the right.
        // Raw children below these nodes deliberately need not be a production history.
        h.rawForArithmeticFixture(1, 29);
        h.rawForArithmeticFixture(2, 11);
        h.rawForArithmeticFixture(3, 17);
        assertEq(h.fullPrefix(MID), 11);
        _assertBoundaries(FIRST);
        _assertBoundaries(MID);
        _assertBoundaries(MID + 1);
        _assertBoundaries(LAST);
        h.rawForArithmeticFixture(2, 0);
        _assertBoundaries(MID);
        _assertBoundaries(MID + 1);
        h.rawForArithmeticFixture(3, 0);
        _assertBoundaries(FIRST);
        _assertBoundaries(MID + 1);
    }

    function test_earlyFalseUpperBoundAvoidsThirtyNineRemainingLevels() public {
        h.deposit(248);
        h.nextForStructuralFixture(MID);
        h.deposit(7);
        h.nextForStructuralFixture(LAST);
        h.deposit(1_246_510_000_132);
        // Match the independently reread witness's first split, not its entire history:
        // raw children255/1246510000132, root1246510000387, final prefix248.
        assertEq(h.getReserve(), 1_246_510_000_387);
        uint48 cutoff = MID - 1;
        assertEq(h.fullPrefix(cutoff), 248);
        _assertBoundaries(cutoff);
        _assertReads(cutoff, 499_500_000, 81, 3);
    }

    function test_earlyTrueLowerBoundAvoidsThirtyNineRemainingLevels() public {
        h.deposit(1000);
        h.nextForStructuralFixture(LAST - 1);
        h.deposit(5);
        h.deposit(1000);
        assertEq(h.fullPrefix(LAST - 1), 1005);
        _assertBoundaries(LAST - 1);
        _assertReads(LAST - 1, 500, 81, 3);
    }

    function test_fullFortyLevelCaseKeepsAllReadsAndAddsThresholdChecks() public {
        // Positive same-prefix siblings force C=0 and k<=A throughout all40 levels.
        // This demonstrates why early exits are not a universal gas improvement.
        h.deposit(1500);
        h.deposit(1);
        _assertBoundaries(FIRST);
        _assertReads(FIRST, 500, 81, 81);
    }

    function test_admittedCapitalLimitWithLazyUpdates() public {
        uint128 cap = uint128(h.MAX_TREE_CAPITAL());
        h.deposit(cap / 3);
        h.deposit(cap - cap / 3);
        h.loss(cap / 2, FIRST + 1);
        _assertBoundaries(FIRST);
        _assertBoundaries(FIRST + 1);
        h.profit(cap / 2, FIRST + 1);
        _assertBoundaries(FIRST);
        _assertBoundaries(FIRST + 1);
    }
}
