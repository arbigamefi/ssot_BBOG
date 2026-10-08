// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {LiquidityTree} from "../../src/vendor/azuro-v3/utils/LiquidityTree.sol";
import {AzuroTreeHarness} from "../helpers/azuro-tree/AzuroTreeHarness.sol";

/// @notice Properties of the pinned tree with the documented range-query and unused-suffix patches.
///         Model admissions bound root + incoming capital; Bank must additionally bound L + P.
contract AzuroTreePropertiesTest is Test {
    uint128 internal constant M_CAP = (uint128(1) << 108) - 1;
    uint40 internal constant ONE = 1e12;
    uint48 internal constant FIRST = uint48(1) << 40;
    uint48 internal constant LAST = 2 * FIRST - 1;
    AzuroTreeHarness internal tree;

    function setUp() public {
        tree = new AzuroTreeHarness();
    }

    function test_pinnedVendorSourceIdentity() public view {
        assertEq(
            sha256(vm.readFileBinary("src/vendor/azuro-v3/utils/LiquidityTree.sol")),
            bytes32(0x15fb55d36409da306ab508ffb497e6eea512a3b239bf19fa67b8a6af74565854)
        );
        assertEq(
            sha256(vm.readFileBinary("src/vendor/azuro-v3/libraries/FixedMath.sol")),
            bytes32(0x3edae4d9e0ccae6920c20bf08feaea1a923a8538dcdb4e116e147a0580e41f49)
        );
        assertEq(
            sha256(vm.readFileBinary("src/vendor/azuro-v3/interface/ILiquidityTree.sol")),
            bytes32(0x1ddf0b4e71845c56c57c626168711d62c4cc58d13baf5255623bcc2109d38708)
        );
    }

    function test_prefixCoveredProfitAndLossExcludeLaterDeposit() public {
        uint48 a = tree.deposit(1_000);
        uint48 b = tree.deposit(2_000);
        uint48 later = tree.deposit(4_000);
        tree.profit(300, b);
        assertEq(tree.nodeWithdrawView(a), 1_100);
        assertEq(tree.nodeWithdrawView(b), 2_200);
        assertEq(tree.nodeWithdrawView(later), 4_000);
        tree.loss(600, b);
        assertEq(tree.nodeWithdrawView(a), 900);
        assertEq(tree.nodeWithdrawView(b), 1_800);
        assertEq(tree.nodeWithdrawView(later), 4_000);
        _assertTree(3, 6_700, new bool[](3));
    }

    function test_insufficientPrefixSpreadsEntireLossNotOnlyExcess() public {
        uint48 old = tree.deposit(100);
        uint48 later = tree.deposit(900);
        tree.loss(200, old);
        assertEq(tree.nodeWithdrawView(old), 80);
        assertEq(tree.nodeWithdrawView(later), 720);
        _assertTree(2, 800, new bool[](2));
    }

    function test_emptyPrefixFallsBackForProfitAndLossWithoutRevivingWithdrawnLeaf() public {
        uint48 old = tree.deposit(500);
        uint48 later = tree.deposit(500);
        assertEq(tree.withdraw(old, ONE), 500);
        tree.profit(100, old);
        assertEq(tree.nodeWithdrawView(later), 600);
        tree.loss(100, old);
        assertEq(tree.nodeWithdrawView(later), 500);
        bool[] memory burned = new bool[](2);
        burned[0] = true;
        _assertTree(2, 500, burned);
    }

    function test_fullLossThenZeroCloseAndFreshDepositDoNotReviveClosedLeaf() public {
        uint48 a = tree.deposit(900);
        uint48 b = tree.deposit(100);
        tree.loss(1_000, b);
        assertEq(tree.withdraw(a, ONE), 0, "zero-valued position may be fully closed");
        uint48 fresh = tree.deposit(200);
        tree.profit(100, b);
        assertEq(tree.nodeWithdrawView(a), 0);
        assertEq(tree.nodeWithdrawView(b), 0, "unclosed zero leaf has no capital weight");
        assertEq(tree.nodeWithdrawView(fresh), 300);
        bool[] memory burned = new bool[](3);
        burned[0] = true;
        _assertTree(3, 300, burned);
    }

    /// @dev This is a vendor limitation witness, NOT a passing test of a production fix.
    ///      The new Vault must bypass _addLimit when the root is empty.
    function test_vendorEmptyRootProfitRequiresExplicitWrapperBranch() public {
        uint48 old = tree.deposit(500);
        tree.withdraw(old, ONE);
        tree.profit(100, old);
        assertEq(tree.reserve(), 100);
        assertEq(tree.nodeWithdrawView(old), 0, "root has no entitled leaf");
        uint48 fresh = tree.deposit(50);
        assertEq(tree.nodeWithdrawView(fresh), 150, "unguarded old profit reaches new depositor");
    }

    function test_lazyStoredAmountsCanExceedCurrentRootButRemainUnderHistoricalCap() public {
        tree.deposit(M_CAP / 4);
        tree.deposit(M_CAP / 4);
        tree.deposit(M_CAP / 4);
        uint48 last = tree.deposit(M_CAP - 3 * (M_CAP / 4));
        tree.loss(M_CAP - 1, last);
        (uint128 largest,) = tree.largestStoredNode(last);
        assertGt(largest, tree.reserve(), "test must retain stale high descendants");
        assertLe(largest, M_CAP);
        _assertTree(4, 1, new bool[](4));
        tree.deposit(M_CAP - 1);
        _assertTree(5, M_CAP, new bool[](5));
        tree.loss(M_CAP - 7, FIRST + 1);
        _assertTree(5, 7, new bool[](5));
    }

    function test_longLossDepositWithdrawSequenceChecksAllRawAncestors() public {
        bool[] memory burned = new bool[](130);
        tree.deposit(M_CAP);
        uint256 count = 1;
        uint256 expectedRoot = M_CAP;
        for (uint256 i; i < 96; ++i) {
            uint256 loss = expectedRoot - (i + 1);
            tree.loss(uint128(loss), FIRST + uint48(i % count));
            expectedRoot -= loss;
            _assertTree(count, expectedRoot, burned);
            tree.deposit(uint128(M_CAP - expectedRoot));
            ++count;
            expectedRoot = M_CAP;
            _assertTree(count, expectedRoot, burned);
            uint48 close = FIRST + uint48(i);
            uint128 paid = tree.withdraw(close, ONE);
            burned[i] = true;
            expectedRoot -= paid;
            _assertTree(count, expectedRoot, burned);
        }
    }

    function testFuzz_sequenceConservesRootAndPreservesEveryStoredNodeBound(uint256 seed) public {
        bool[] memory burned = new bool[](33);
        uint256 count;
        uint256 expectedRoot;
        for (uint256 step; step < 32; ++step) {
            seed = uint256(keccak256(abi.encode(seed, step)));
            uint256 action = seed % 4;
            uint48 cutoff = FIRST + uint48(count == 0 ? 0 : (seed >> 16) % count);
            if (count == 0 || expectedRoot == 0 || (action == 0 && expectedRoot < M_CAP)) {
                uint128 amount = uint128(1 + ((seed >> 32) % (M_CAP - expectedRoot)));
                assertEq(tree.deposit(amount), FIRST + count, "leaf IDs never reused");
                ++count;
                expectedRoot += amount;
            } else if (action == 1 && expectedRoot < M_CAP) {
                uint128 amount = uint128(1 + ((seed >> 32) % (M_CAP - expectedRoot)));
                tree.profit(amount, cutoff);
                expectedRoot += amount;
            } else if (action == 2) {
                uint128 amount = uint128(1 + ((seed >> 32) % expectedRoot));
                tree.loss(amount, cutoff);
                expectedRoot -= amount;
            } else {
                uint256 index = (seed >> 64) % count;
                if (!burned[index]) {
                    uint40 percent = ((seed >> 96) & 1) == 0 ? ONE : uint40(1 + ((seed >> 128) % ONE));
                    uint256 beforeValue = tree.nodeWithdrawView(FIRST + uint48(index));
                    uint128 paid = tree.withdraw(FIRST + uint48(index), percent);
                    assertEq(paid, beforeValue * percent / ONE, "withdraw preview agrees with cash");
                    expectedRoot -= paid;
                    if (percent == ONE) burned[index] = true;
                }
            }
            _assertTree(count, expectedRoot, burned);
        }
    }

    function test_mCapScaledProductFitsAndJustAboveBoundaryCanOverflow() public {
        uint256 result = tree.scaledProduct(M_CAP, M_CAP, 1);
        assertEq(result, uint256(M_CAP) * M_CAP * ONE);
        assertLe(result, type(uint256).max);
        vm.expectRevert(stdError.arithmeticError);
        tree.scaledProduct(uint256(1) << 109, uint256(1) << 109, 1);
    }

    function test_mCapProfitAndLossTraverseSplitRangeAtMaximumCapital() public {
        tree.deposit(M_CAP / 8);
        tree.deposit(M_CAP / 8);
        uint48 c = tree.deposit(M_CAP / 8);
        tree.deposit(M_CAP / 8);
        tree.profit(M_CAP - 4 * (M_CAP / 8), c);
        _assertTree(4, M_CAP, new bool[](4));
        tree.loss(M_CAP - 1, c);
        _assertTree(4, 1, new bool[](4));
    }

    function test_uint128RootOverflowRevertsAtomicallyOutsideAdmission() public {
        tree.deposit(type(uint128).max);
        uint48 next = tree.nextNode();
        uint64 update = tree.updateId();
        vm.expectRevert(stdError.arithmeticError);
        tree.deposit(1);
        assertEq(tree.nextNode(), next);
        assertEq(tree.updateId(), update);
        assertEq(tree.reserve(), type(uint128).max);
        assertEq(tree.nodeWithdrawView(next), 0);
    }

    function test_leafRangeExhaustsBeforeUint48Overflow() public {
        tree.forceNextNode(LAST);
        assertEq(tree.deposit(1), LAST);
        assertEq(tree.nextNode(), LAST + 1);
        assertLt(tree.nextNode(), type(uint48).max);
        vm.expectRevert(LiquidityTree.LeafNumberRangeExceeded.selector);
        tree.deposit(1);
        assertEq(tree.reserve(), 1);
        tree.forceNextNode(type(uint48).max);
        vm.expectRevert(LiquidityTree.LeafNumberRangeExceeded.selector);
        tree.deposit(1);
    }

    function test_updateIdOverflowOnDepositRevertsAtomically() public {
        tree.forceUpdateId(type(uint64).max);
        vm.expectRevert(stdError.arithmeticError);
        tree.deposit(1);
        assertEq(tree.nextNode(), FIRST);
        assertEq(tree.reserve(), 0);
        assertEq(tree.updateId(), type(uint64).max);
    }

    function test_updateIdOverflowMidWithdrawRollsBackInitialPush() public {
        uint48 a = tree.deposit(500);
        uint48 b = tree.deposit(500);
        tree.loss(100, b);
        (uint64 beforeId, uint128 beforeAmount) = tree.treeNode(a);
        tree.forceUpdateId(type(uint64).max - 1);
        vm.expectRevert(stdError.arithmeticError);
        tree.withdraw(a, ONE);
        (uint64 afterId, uint128 afterAmount) = tree.treeNode(a);
        assertEq(afterId, beforeId);
        assertEq(afterAmount, beforeAmount);
        assertEq(tree.reserve(), 900);
        assertEq(tree.updateId(), type(uint64).max - 1);
    }

    function test_zeroPercentAndZeroCashAreVendorPermittedAndRequireWrapperPolicy() public {
        uint48 leaf = tree.deposit(1);
        assertEq(tree.withdraw(leaf, 0), 0);
        assertEq(tree.withdraw(leaf, 1), 0);
        assertEq(tree.reserve(), 1);
        vm.expectRevert(LiquidityTree.IncorrectPercent.selector);
        tree.withdraw(leaf, ONE + 1);
    }

    function test_percentGranularityMakesAssetUpperBoundUnattainable() public {
        uint256 value = 1_009 * uint256(ONE) + 7;
        uint256 free = 1_010;
        uint256 pmax = ((free + 1) * ONE - 1) / value;
        uint48 leaf = tree.deposit(uint128(value));
        assertEq(pmax, 1);
        uint128 cash = tree.withdraw(leaf, uint40(pmax));
        assertEq(cash, 1_009);
        assertLt(cash, free, "free assets are not always an executable cash quote");
        assertGt(value * (pmax + 1) / ONE, free);
        assertEq(tree.reserve(), value - cash);
    }

    function test_percentQuoteCanBeNonzeroWhileNoPositiveCashFits() public pure {
        uint256 value = 1;
        uint256 free;
        uint256 pmax = ((free + 1) * ONE - 1) / value;
        assertEq(pmax, ONE - 1);
        assertEq(value * pmax / ONE, 0, "must not advertise a zero-cash partial");
    }

    /// @dev Sparse counter injection isolates both top-level branches without 2^39 deposits.
    ///      Sequence reachability is covered separately; this is a 40-level arithmetic fixture.
    function test_topLevelSplitAtMCapCoversBothFortyLevelPaths() public {
        uint48 a = tree.deposit(M_CAP / 4);
        tree.forceNextNode(FIRST + FIRST / 2 - 1);
        uint48 b = tree.deposit(M_CAP / 4);
        uint48 c = tree.deposit(M_CAP / 4);
        tree.forceNextNode(LAST);
        uint48 d = tree.deposit(M_CAP - 3 * (M_CAP / 4));
        tree.loss(M_CAP - 1, b);
        uint256 sum = tree.nodeWithdrawView(a) + uint256(tree.nodeWithdrawView(b)) + tree.nodeWithdrawView(c)
            + tree.nodeWithdrawView(d);
        assertEq(sum, 1);
        tree.profit(M_CAP - 1, c);
        sum = tree.nodeWithdrawView(a) + uint256(tree.nodeWithdrawView(b)) + tree.nodeWithdrawView(c)
            + tree.nodeWithdrawView(d);
        assertEq(sum, M_CAP);
        uint48[4] memory leaves = [a, b, c, d];
        for (uint256 i; i < leaves.length; ++i) {
            for (uint48 node = leaves[i]; node != 0; node >>= 1) {
                (, uint128 amount) = tree.treeNode(node);
                assertLe(amount, M_CAP, "sparse extreme raw ancestor bound");
            }
        }
    }

    function testFuzz_percentQuoteIsExecutableMaximum(uint128 rawValue, uint128 rawFree) public pure {
        uint256 value = 1 + uint256(rawValue) % M_CAP;
        uint256 free = uint256(rawFree) % (value + 1);
        uint256 pmax = free >= value ? ONE : ((free + 1) * ONE - 1) / value;
        uint256 cash = value * pmax / ONE;
        assertLe(pmax, ONE);
        assertLe(cash, free);
        if (pmax < ONE) assertGt(value * (pmax + 1) / ONE, free);
        if (pmax == 0 || cash == 0) assertEq(cash, 0, "no positive-cash feasible percent");
    }

    function _assertTree(uint256 count, uint256 expectedRoot, bool[] memory burned) internal view {
        assertEq(tree.reserve(), expectedRoot, "root conservation");
        uint256 liveSum;
        for (uint256 i; i < count; ++i) {
            uint256 value = tree.nodeWithdrawView(FIRST + uint48(i));
            if (burned[i]) assertEq(value, 0, "closed leaf must never revive");
            else liveSum += value;
        }
        assertEq(liveSum, expectedRoot, "root equals all live leaf entitlements");
        (uint128 largest,) = tree.largestStoredNode(FIRST + uint48(count - 1));
        assertLe(largest, M_CAP, "all raw lazy nodes obey historical capital cap");
    }
}
