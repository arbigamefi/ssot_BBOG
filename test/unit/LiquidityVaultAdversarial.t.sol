// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {LiquidityTree} from "../../src/vendor/azuro-v3/utils/LiquidityTree.sol";
import {ReviewToken, ReviewBank, ReviewNFTReceiver} from "../helpers/nft-vault-review/ReviewFixtures.sol";

/// @notice Independent Vault boundary tests against the actual reused tree.
/// @dev The Bank is a dependency fixture: these tests do not certify real Bank, VRF, Router or PP integration.
contract LiquidityVaultAdversarialTest is Test {
    uint40 private constant ONE = 1e12;
    bytes4 private constant REENTRANCY = bytes4(keccak256("ReentrancyGuardReentrantCall()"));
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA201);
    ReviewToken private token;
    ReviewBank private bank;
    LiquidityVault private vault;

    function setUp() external {
        vm.warp(200 days);
        token = new ReviewToken();
        bank = new ReviewBank(token);
        vault = bank.vault();
    }

    function test_standardERC721InterfacesAndEnumerationDescribeNFTsNotFunds() external {
        assertTrue(vault.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(vault.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(vault.supportsInterface(0x5b5e139f)); // ERC721Metadata
        assertTrue(vault.supportsInterface(0x780e9d63)); // ERC721Enumerable
        assertFalse(vault.supportsInterface(0xffffffff));
        uint48 first = _deposit(ALICE, 99);
        uint48 second = _deposit(ALICE, 1);
        assertEq(vault.balanceOf(ALICE), 2);
        assertEq(vault.totalSupply(), 2);
        assertEq(vault.tokenOfOwnerByIndex(ALICE, 0), first);
        assertEq(vault.tokenOfOwnerByIndex(ALICE, 1), second);
        vm.prank(ALICE);
        vault.transferFrom(ALICE, BOB, first);
        assertEq(vault.balanceOf(ALICE), 1);
        assertEq(vault.tokenOfOwnerByIndex(ALICE, 0), second);
        assertEq(vault.tokenOfOwnerByIndex(BOB, 0), first);
        _mature(first);
        vm.prank(BOB);
        vault.withdrawDeposit(first, ONE);
        assertEq(vault.totalSupply(), 1);
        assertEq(vault.tokenByIndex(0), second);
        assertEq(vault.getReserve(), 1);
    }

    function test_rejectedSafeNFTTransferRestoresOwnerApprovalAndDeadline() external {
        uint48 id = _deposit(ALICE, 100);
        uint64 deadline = vault.withdrawAfter(id);
        ReviewNFTReceiver receiver = new ReviewNFTReceiver(vault);
        receiver.configure(address(0), "", true, address(0));
        vm.prank(ALICE);
        vault.approve(BOB, id);
        vm.prank(BOB);
        vm.expectRevert("review: rejected NFT");
        vault.safeTransferFrom(ALICE, address(receiver), id);
        assertEq(vault.ownerOf(id), ALICE);
        assertEq(vault.getApproved(id), BOB);
        assertEq(vault.withdrawAfter(id), deadline);
        assertEq(vault.balanceOf(ALICE), 1);
        assertEq(vault.balanceOf(address(receiver)), 0);
        assertEq(vault.nodeWithdrawView(id), 100);
    }

    function test_approvalCannotWithdrawButCanTransferEconomicOwnership() external {
        uint48 id = _deposit(ALICE, 100);
        _mature(id);
        vm.prank(ALICE);
        vault.approve(BOB, id);
        vm.prank(BOB);
        vm.expectRevert(LiquidityVault.NotDepositOwner.selector);
        vault.withdrawDeposit(id, ONE);
        vm.prank(BOB);
        vault.transferFrom(ALICE, BOB, id);
        vm.prank(BOB);
        assertEq(vault.withdrawDeposit(id, ONE), 100);
        assertEq(token.balanceOf(BOB), 100);
        assertEq(token.balanceOf(ALICE), 0);
        assertEq(vault.totalSupply(), 0);
    }

    function test_operatorCannotWithdrawOrBypassMaturityAfterTransfer() external {
        uint48 id = _deposit(ALICE, 100);
        uint64 deadline = vault.withdrawAfter(id);
        vm.prank(ALICE);
        vault.setApprovalForAll(BOB, true);
        vm.prank(BOB);
        vm.expectRevert(LiquidityVault.NotDepositOwner.selector);
        vault.withdrawDeposit(id, ONE);
        vm.prank(BOB);
        vault.transferFrom(ALICE, BOB, id);
        assertEq(vault.withdrawAfter(id), deadline);
        vm.warp(deadline - 1);
        vm.prank(BOB);
        vm.expectRevert(_unavailable(ILiquidityVaultBank.LPStatus.CoolingDown));
        vault.withdrawDeposit(id, ONE);
        vm.warp(deadline);
        vm.prank(BOB);
        vault.withdrawDeposit(id, ONE);
        assertEq(token.balanceOf(BOB), 100);
    }

    function test_giftAndPartialWithdrawalOnlyResetTheirOwnDeposit() external {
        uint48 first = _deposit(ALICE, 100);
        uint64 initial = vault.withdrawAfter(first);
        vm.warp(block.timestamp + 12 hours);
        token.mint(BOB, 40);
        vm.startPrank(BOB);
        token.approve(address(vault), 40);
        uint48 gift = vault.addDepositFor(ALICE, 40);
        vm.stopPrank();
        assertEq(vault.withdrawAfter(first), initial);
        assertEq(vault.withdrawAfter(gift), initial + 12 hours);
        assertEq(vault.balanceOf(ALICE), 2, "ERC721 count is not an asset balance");
        vm.warp(initial);
        vm.prank(ALICE);
        assertEq(vault.withdrawDeposit(first, ONE / 2), 50);
        uint64 relocked = uint64(block.timestamp + 24 hours);
        assertEq(vault.withdrawAfter(first), relocked);
        assertEq(vault.withdrawAfter(gift), initial + 12 hours);
        vm.prank(ALICE);
        vault.transferFrom(ALICE, CAROL, first);
        assertEq(vault.withdrawAfter(first), relocked);
        assertEq(vault.nodeWithdrawView(first), 50);
    }

    function test_safeMintSeesCompleteStateAndCannotReenterFunding() external {
        ReviewNFTReceiver receiver = new ReviewNFTReceiver(vault);
        receiver.configure(address(vault), abi.encodeCall(vault.addDeposit, (1)), false, BOB);
        token.mint(ALICE, 90);
        vm.startPrank(ALICE);
        token.approve(address(vault), 90);
        uint48 id = vault.addDepositFor(address(receiver), 90);
        vm.stopPrank();
        assertTrue(receiver.attempted());
        assertFalse(receiver.succeeded());
        assertEq(bytes4(receiver.result()), REENTRANCY);
        assertEq(receiver.seenOwner(), address(receiver));
        assertEq(receiver.seenAssets(), 90);
        assertEq(receiver.seenDeadline(), block.timestamp + 24 hours);
        assertEq(uint256(receiver.seenStatus()), uint256(ILiquidityVaultBank.LPStatus.Busy));
        assertEq(vault.ownerOf(id), BOB, "standard transfer in the receiver is allowed");
        assertEq(vault.getReserve(), 90);
        assertEq(token.balanceOf(address(vault)), 90);
    }

    function test_safeMintCannotReenterWithdrawalEvenAsNewOwner() external {
        ReviewNFTReceiver receiver = new ReviewNFTReceiver(vault);
        uint48 next = vault.nextNode();
        receiver.configure(address(vault), abi.encodeCall(vault.withdrawDeposit, (next, ONE)), false, address(0));
        _gift(ALICE, address(receiver), 30);
        assertTrue(receiver.attempted());
        assertFalse(receiver.succeeded());
        assertEq(bytes4(receiver.result()), REENTRANCY);
        assertEq(vault.nodeWithdrawView(next), 30);
    }

    function test_receiverCannotEnterBankLockWhileVaultIsFunding() external {
        ReviewNFTReceiver receiver = new ReviewNFTReceiver(vault);
        receiver.configure(address(bank), abi.encodeCall(bank.rawLock, (1)), false, address(0));
        _gift(ALICE, address(receiver), 30);
        assertTrue(receiver.attempted());
        assertFalse(receiver.succeeded());
        assertEq(bytes4(receiver.result()), REENTRANCY);
        assertEq(vault.lockedLiquidity(), 0);
    }

    function test_receiverRejectionRestoresCashTreeIdAndNFTSupply() external {
        ReviewNFTReceiver receiver = new ReviewNFTReceiver(vault);
        receiver.configure(address(0), "", true, address(0));
        token.mint(ALICE, 90);
        uint48 next = vault.nextNode();
        vm.startPrank(ALICE);
        token.approve(address(vault), 90);
        vm.expectRevert("review: rejected NFT");
        vault.addDepositFor(address(receiver), 90);
        vm.stopPrank();
        assertEq(token.balanceOf(ALICE), 90);
        assertEq(token.balanceOf(address(vault)), 0);
        assertEq(vault.getReserve(), 0);
        assertEq(vault.nextNode(), next);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.withdrawAfter(next), 0);
    }

    function test_tokenCallbackCannotEnterBankSettlementDuringDeposit() external {
        uint48 first = _deposit(ALICE, 80);
        token.setHook(BOB, address(bank), abi.encodeCall(bank.rawApply, (first, 0, 0, 0)));
        _deposit(BOB, 20);
        assertTrue(token.hookAttempted());
        assertFalse(token.hookSucceeded());
        assertEq(bytes4(token.hookResult()), REENTRANCY);
        assertEq(vault.getReserve(), 100);
    }

    function test_tokenCallbackCannotWithdrawAnotherMatureNFTDuringWithdrawal() external {
        uint48 first = _deposit(ALICE, 60);
        uint48 second = _deposit(address(token), 40);
        _mature(first);
        token.setHook(address(vault), address(vault), abi.encodeCall(vault.withdrawDeposit, (second, ONE)));
        vm.prank(ALICE);
        vault.withdrawDeposit(first, ONE / 2);
        assertTrue(token.hookAttempted());
        assertFalse(token.hookSucceeded());
        assertEq(bytes4(token.hookResult()), REENTRANCY);
        assertEq(vault.nodeWithdrawView(second), 40);
        assertEq(vault.getReserve(), 70);
    }

    function test_tokenCallbackCannotWithdrawThroughAnInternalSettlement() external {
        uint48 first = _deposit(address(token), 100);
        _mature(first);
        bank.hold(10, 20);
        token.setHook(address(vault), address(vault), abi.encodeCall(vault.withdrawDeposit, (first, ONE)));
        bank.setStatus(ILiquidityVaultBank.LPStatus.Busy);
        bank.settleToPayable(first, 10, 20, 15);
        assertTrue(token.hookAttempted());
        assertFalse(token.hookSucceeded());
        assertEq(bytes4(token.hookResult()), REENTRANCY);
        assertEq(vault.getReserve(), 95);
        assertEq(vault.lockedLiquidity(), 0);
    }

    function test_blockedReceiverRollsBackPartialDeadlineAndTreeChanges() external {
        uint48 id = _deposit(ALICE, 100);
        _mature(id);
        uint64 oldDeadline = vault.withdrawAfter(id);
        token.setBlocked(ALICE, true);
        vm.prank(ALICE);
        vm.expectRevert();
        vault.withdrawDeposit(id, ONE / 2);
        assertEq(vault.withdrawAfter(id), oldDeadline);
        assertEq(vault.getReserve(), 100);
        assertEq(vault.nodeWithdrawView(id), 100);
        assertEq(token.balanceOf(address(vault)), 100);
        assertEq(vault.ownerOf(id), ALICE);
        token.setBlocked(ALICE, false);
        vm.prank(ALICE);
        assertEq(vault.withdrawDeposit(id, ONE / 2), 50);
        assertEq(vault.withdrawAfter(id), block.timestamp + 24 hours);
    }

    function test_failedFullPaymentDoesNotBurnNFTOrLoseItsDeadline() external {
        uint48 id = _deposit(ALICE, 100);
        _mature(id);
        uint64 oldDeadline = vault.withdrawAfter(id);
        token.setBlocked(ALICE, true);
        vm.prank(ALICE);
        vm.expectRevert();
        vault.withdrawDeposit(id, ONE);
        assertEq(vault.ownerOf(id), ALICE);
        assertEq(vault.withdrawAfter(id), oldDeadline);
        assertEq(vault.totalSupply(), 1);
        assertEq(vault.getReserve(), 100);
    }

    function test_insufficientFreeCapitalDoesNotRelockOrPartiallyPay() external {
        uint48 id = _deposit(ALICE, 100);
        bank.hold(1, 61);
        _mature(id);
        uint64 oldDeadline = vault.withdrawAfter(id);
        vm.prank(ALICE);
        vm.expectRevert(LiquidityVault.InsufficientFreeCapital.selector);
        vault.withdrawDeposit(id, ONE / 2);
        assertEq(vault.withdrawAfter(id), oldDeadline);
        assertEq(vault.nodeWithdrawView(id), 100);
        assertEq(vault.lockedLiquidity(), 60);
        assertEq(token.balanceOf(ALICE), 0);
    }

    function test_quoteRespectsUnattainableAssetUpperBound() external {
        uint128 value = uint128(3 * uint256(ONE) + 7);
        uint48 id = _deposit(ALICE, value);
        bank.hold(1, value - 6); // K=value-7, so free capital is seven asset units.
        _mature(id);
        LiquidityVault.DepositState memory state = vault.depositState(id);
        assertEq(state.maxPercent, 2);
        assertEq(state.maxAssets, 6, "free upper bound 7 is not exactly achievable");
        vm.prank(ALICE);
        vm.expectRevert(LiquidityVault.InsufficientFreeCapital.selector);
        vault.withdrawDeposit(id, 3);
        vm.prank(ALICE);
        assertEq(vault.withdrawDeposit(id, state.maxPercent), state.maxAssets);
        assertEq(vault.getReserve() - vault.lockedLiquidity(), 1);
    }

    function test_quoteReportsNoCashWhenOnlyZeroValuePercentagesFit() external {
        uint48 id = _deposit(ALICE, 1);
        bank.hold(1, 2);
        _mature(id);
        LiquidityVault.DepositState memory state = vault.depositState(id);
        assertEq(uint256(state.status), uint256(ILiquidityVaultBank.LPStatus.NoLiquidity));
        assertEq(state.maxPercent, 0);
        assertEq(state.maxAssets, 0);
        vm.prank(ALICE);
        vm.expectRevert(LiquidityVault.ZeroWithdrawal.selector);
        vault.withdrawDeposit(id, ONE - 1);
    }

    function test_zeroPercentAndZeroCashPartialDoNotChangeDeadline() external {
        uint48 id = _deposit(ALICE, 1);
        _mature(id);
        uint64 deadline = vault.withdrawAfter(id);
        vm.prank(ALICE);
        vm.expectRevert(LiquidityTree.IncorrectPercent.selector);
        vault.withdrawDeposit(id, 0);
        vm.prank(ALICE);
        vm.expectRevert(LiquidityVault.ZeroWithdrawal.selector);
        vault.withdrawDeposit(id, ONE / 2);
        assertEq(vault.withdrawAfter(id), deadline);
        assertEq(vault.getReserve(), 1);
    }

    function test_matureZeroBalanceCanCloseAndLeafIdsAreNeverReused() external {
        uint48 id = _deposit(ALICE, 100);
        bank.hold(1, 101);
        bank.settleToPayable(id, 1, 101, 101);
        assertEq(vault.getReserve(), 0);
        _mature(id);
        LiquidityVault.DepositState memory state = vault.depositState(id);
        assertEq(state.maxPercent, ONE);
        assertEq(state.maxAssets, 0);
        vm.prank(ALICE);
        assertEq(vault.withdrawDeposit(id, ONE), 0);
        assertEq(vault.totalSupply(), 0);
        uint48 newId = _deposit(BOB, 9);
        assertGt(newId, id);
        assertEq(vault.nodeWithdrawView(newId), 9);
        assertEq(vault.nodeWithdrawView(id), 0);
        vm.expectRevert();
        vault.depositState(id);
    }

    function test_zeroRootProfitStaysInBankAndCannotRewardNextFirstDeposit() external {
        uint48 id = _deposit(ALICE, 100);
        bank.hold(10, 10); // An old position may remain open while K is zero.
        _mature(id);
        vm.prank(ALICE);
        vault.withdrawDeposit(id, ONE);
        assertEq(vault.getReserve(), 0);
        assertEq(bank.settleToPayable(id, 10, 10, 0), 10);
        assertEq(bank.protocolCapital(), 10);
        assertEq(token.balanceOf(address(bank)), 10);
        assertEq(token.balanceOf(address(vault)), 0);
        uint48 next = _deposit(BOB, 7);
        assertEq(vault.getReserve(), 7);
        assertEq(vault.nodeWithdrawView(next), 7);
    }

    function test_knownSeedGateBlocksCashButNotNFTTransferOrInternalSettlement() external {
        uint48 id = _deposit(ALICE, 100);
        bank.hold(10, 20);
        _mature(id);
        bank.setStatus(ILiquidityVaultBank.LPStatus.UnbookedResult);
        _assertCashBlocked(id, ALICE, ILiquidityVaultBank.LPStatus.UnbookedResult);
        vm.prank(ALICE);
        vault.transferFrom(ALICE, BOB, id);
        assertEq(vault.ownerOf(id), BOB);
        bank.settleToPayable(id, 10, 20, 15);
        assertEq(vault.getReserve(), 95);
        assertEq(vault.lockedLiquidity(), 0);
        assertEq(bank.playerPayable(), 15);
        assertEq(uint256(vault.depositState(id).status), uint256(ILiquidityVaultBank.LPStatus.UnbookedResult));
        bank.setStatus(ILiquidityVaultBank.LPStatus.Ready);
        assertEq(vault.depositState(id).maxAssets, 95);
    }

    function test_pauseBusyAndUnavailableReadsFailCashClosed() external {
        uint48 id = _deposit(ALICE, 100);
        _mature(id);
        bank.setStatus(ILiquidityVaultBank.LPStatus.Paused);
        _assertCashBlocked(id, ALICE, ILiquidityVaultBank.LPStatus.Paused);
        bank.setStatus(ILiquidityVaultBank.LPStatus.Busy);
        _assertCashBlocked(id, ALICE, ILiquidityVaultBank.LPStatus.Busy);
        bank.setStatus(ILiquidityVaultBank.LPStatus.Ready);
        bank.setReadFails(true);
        _assertCashBlocked(id, ALICE, ILiquidityVaultBank.LPStatus.Unavailable);
    }

    function test_cashDeficitAndReserveMismatchAreNotHealthyZeroQuotes() external {
        uint48 id = _deposit(ALICE, 100);
        _mature(id);
        bank.setAccounting(0, 1);
        _assertCashBlocked(id, ALICE, ILiquidityVaultBank.LPStatus.InvalidAccounting);
        bank.setAccounting(0, 0);
        token.burn(address(vault), 1);
        _assertCashBlocked(id, ALICE, ILiquidityVaultBank.LPStatus.InvalidAccounting);
        assertEq(vault.depositState(id).assets, 100, "ownership amount is distinct from invalid cash coverage");
    }

    function test_playerPayableDischargeDoesNotChargeTreeTwiceOrUseLPGate() external {
        uint48 id = _deposit(ALICE, 100);
        bank.hold(10, 20);
        bank.setStatus(ILiquidityVaultBank.LPStatus.UnbookedResult);
        bank.settleToPayable(id, 10, 20, 15);
        assertEq(vault.getReserve(), 95);
        assertEq(token.balanceOf(address(bank)), 15);
        bank.setStatus(ILiquidityVaultBank.LPStatus.Paused);
        token.setBlocked(CAROL, true);
        vm.expectRevert();
        bank.payDebt(CAROL);
        assertEq(bank.playerPayable(), 15);
        token.setBlocked(CAROL, false);
        bank.payDebt(CAROL);
        assertEq(token.balanceOf(CAROL), 15);
        assertEq(bank.playerPayable(), 0);
        assertEq(token.balanceOf(address(bank)), 0);
        assertEq(vault.getReserve(), 95);
        assertEq(vault.lockedLiquidity(), 0);
    }

    function test_failedCustodyFundingCannotCreateTreeProfitOrReleaseLock() external {
        uint48 id = _deposit(ALICE, 100);
        bank.hold(10, 20);
        token.setBlocked(address(bank), true);
        vm.expectRevert();
        bank.settleToPayable(id, 10, 20, 0);
        assertEq(vault.getReserve(), 100);
        assertEq(vault.lockedLiquidity(), 10);
        assertEq(bank.pending(), 10);
        assertEq(bank.reserved(), 20);
        assertEq(bank.playerPayable(), 0);
    }

    function test_failedCustodyLossCannotBecomeSyntheticPlayerDebt() external {
        uint48 id = _deposit(ALICE, 100);
        bank.hold(10, 20);
        token.setBlocked(address(bank), true);
        vm.expectRevert();
        bank.settleToPayable(id, 10, 20, 15);
        assertEq(vault.getReserve(), 100);
        assertEq(vault.lockedLiquidity(), 10);
        assertEq(bank.playerPayable(), 0);
        assertEq(bank.pending(), 10);
    }

    function test_inexactDepositCannotMintNFTOrUseDonatedSurplusAsFunding() external {
        token.mint(address(vault), 30);
        token.mint(ALICE, 100);
        token.setShortPay(true);
        vm.startPrank(ALICE);
        token.approve(address(vault), 100);
        vm.expectRevert(LiquidityVault.InexactTransfer.selector);
        vault.addDeposit(100);
        vm.stopPrank();
        assertEq(vault.getReserve(), 0);
        assertEq(vault.totalSupply(), 0);
        assertEq(token.balanceOf(address(vault)), 30);
        assertEq(token.balanceOf(ALICE), 100);
    }

    function test_inexactOutgoingTransferRestoresBurnAndTree() external {
        uint48 id = _deposit(ALICE, 100);
        _mature(id);
        token.setShortPay(true);
        vm.prank(ALICE);
        vm.expectRevert(LiquidityVault.InexactTransfer.selector);
        vault.withdrawDeposit(id, ONE);
        assertEq(vault.ownerOf(id), ALICE);
        assertEq(vault.getReserve(), 100);
        assertEq(token.balanceOf(address(vault)), 100);
        assertEq(token.balanceOf(ALICE), 0);
    }

    function test_unallocatedSurplusDoesNotIncreaseNFTCapitalOrExitAmount() external {
        token.mint(address(vault), 73);
        uint48 id = _deposit(ALICE, 27);
        _mature(id);
        assertEq(vault.getReserve(), 27);
        assertEq(vault.depositState(id).maxAssets, 27);
        vm.prank(ALICE);
        vault.withdrawDeposit(id, ONE);
        assertEq(token.balanceOf(address(vault)), 73);
        assertEq(token.balanceOf(ALICE), 27);
    }

    function test_pendingPrincipalCountsAgainstDepositNumericalAdmission() external {
        uint256 limit = vault.MAX_TREE_CAPITAL();
        bank.setAccounting(1, 1);
        _deposit(ALICE, limit - 1);
        token.mint(BOB, 1);
        vm.startPrank(BOB);
        token.approve(address(vault), 1);
        vm.expectRevert(LiquidityVault.CapitalLimit.selector);
        vault.addDeposit(1);
        vm.stopPrank();
        assertEq(uint256(vault.getReserve()) + bank.pending(), limit);
    }

    function test_onlyBankMayChangeLocksOrApplyResults() external {
        uint48 id = _deposit(ALICE, 100);
        vm.prank(BOB);
        vm.expectRevert(LiquidityVault.OnlyBank.selector);
        vault.lockLiquidity(1);
        vm.prank(BOB);
        vm.expectRevert(LiquidityVault.OnlyBank.selector);
        vault.applySettlement(id, 0, 0, 0);
        assertEq(vault.getReserve(), 100);
        assertEq(vault.lockedLiquidity(), 0);
    }

    function test_depositRejectsCustodyOwnersWithoutChangingOrdinaryTransferRules() external {
        token.mint(ALICE, 30);
        vm.startPrank(ALICE);
        token.approve(address(vault), 30);
        vm.expectRevert(LiquidityVault.InvalidDepositOwner.selector);
        vault.addDepositFor(address(bank), 10);
        vm.expectRevert(LiquidityVault.InvalidDepositOwner.selector);
        vault.addDepositFor(address(vault), 10);
        vm.expectRevert(LiquidityVault.InvalidDepositOwner.selector);
        vault.addDepositFor(address(0), 10);
        uint48 id = vault.addDeposit(10);
        vault.transferFrom(ALICE, address(bank), id);
        vm.stopPrank();
        assertEq(vault.ownerOf(id), address(bank), "standard ERC721 transfer recipient rules remain unchanged");
        assertEq(vault.nodeWithdrawView(id), 10);
    }

    function testFuzz_quoteAmountAndOneGreaterPercentAgreeWithExecution(uint128 rawValue, uint128 rawFree) external {
        uint128 value = uint128(bound(rawValue, 1, 1e25));
        uint128 free = uint128(bound(rawFree, 0, value));
        uint48 id = _deposit(ALICE, value);
        if (free != value) bank.hold(1, value - free + 1);
        _mature(id);
        LiquidityVault.DepositState memory state = vault.depositState(id);
        if (state.maxAssets == 0) {
            assertEq(state.maxPercent, 0);
            assertEq(uint256(state.status), uint256(ILiquidityVaultBank.LPStatus.NoLiquidity));
            assertLt(uint256(free) * ONE, value, "no positive percentage can pay a funded amount");
            return;
        }
        assertLe(state.maxAssets, free);
        assertEq(state.maxAssets, uint256(value) * state.maxPercent / ONE);
        if (state.maxPercent < ONE) {
            vm.prank(ALICE);
            vm.expectRevert(LiquidityVault.InsufficientFreeCapital.selector);
            vault.withdrawDeposit(id, state.maxPercent + 1);
        }
        vm.prank(ALICE);
        assertEq(vault.withdrawDeposit(id, state.maxPercent), state.maxAssets);
        assertEq(token.balanceOf(ALICE), state.maxAssets);
    }

    function _deposit(address owner, uint256 amount) private returns (uint48 id) {
        token.mint(owner, amount);
        vm.startPrank(owner);
        token.approve(address(vault), amount);
        id = vault.addDeposit(amount);
        vm.stopPrank();
    }

    function _gift(address payer, address owner, uint256 amount) private returns (uint48 id) {
        token.mint(payer, amount);
        vm.startPrank(payer);
        token.approve(address(vault), amount);
        id = vault.addDepositFor(owner, amount);
        vm.stopPrank();
    }

    function _mature(uint48 id) private {
        vm.warp(vault.withdrawAfter(id));
    }

    function _unavailable(ILiquidityVaultBank.LPStatus status) private pure returns (bytes memory) {
        return abi.encodeWithSelector(LiquidityVault.LPUnavailable.selector, status);
    }

    function _assertCashBlocked(uint48 id, address owner, ILiquidityVaultBank.LPStatus expected) private {
        LiquidityVault.DepositState memory state = vault.depositState(id);
        assertEq(uint256(state.status), uint256(expected));
        assertEq(state.maxPercent, 0);
        assertEq(state.maxAssets, 0);
        vm.prank(owner);
        vm.expectRevert(_unavailable(expected));
        vault.withdrawDeposit(id, ONE);
        vm.prank(owner);
        vm.expectRevert(_unavailable(expected));
        vault.addDeposit(1);
    }
}
