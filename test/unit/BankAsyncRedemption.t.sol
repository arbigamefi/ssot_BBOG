// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {IBank, IBankVault} from "../../src/core/interfaces/IBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";

/// @notice ADR-0035 in the Bank: liquid ERC-7540 claims, historical risk ownership and player payables.
///         This test is the Bank's SettlementRouter; GameHubE2E covers the real game path.
contract BankAsyncRedemptionTest is Test {
    uint256 internal constant DAY = 1 days;

    address internal gov = address(0xA11CE);
    address internal alice = address(0xA11CE1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA201);
    address internal player = address(0xBEEF);
    address internal stranger = address(0x5712);

    BlacklistToken internal asset;
    Bank internal bank;
    uint256 internal nextBetId = 1;

    function setUp() external {
        vm.warp(100 * DAY + 5 hours);
        asset = new BlacklistToken();
        bank = new Bank(address(asset), gov, 0, "LP USDC", "lpUSDC", 6);
        vm.prank(gov);
        bank.setSettlementRouterOnce(address(this));

        asset.mint(player, 1_000_000e6);
        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);
    }

    // ------------------------------------------------------------ standard surface

    function test_supportsTheErc7540RedeemAndErc7575InterfaceIds() external view {
        bytes4 operators = _sel("isOperator(address,address)") ^ _sel("setOperator(address,bool)");
        bytes4 asyncRedeem = _sel("requestRedeem(uint256,address,address)")
            ^ _sel("pendingRedeemRequest(uint256,address)") ^ _sel("claimableRedeemRequest(uint256,address)");
        string[17] memory vault7575 = [
            "asset()",
            "totalAssets()",
            "convertToShares(uint256)",
            "convertToAssets(uint256)",
            "maxDeposit(address)",
            "previewDeposit(uint256)",
            "deposit(uint256,address)",
            "maxMint(address)",
            "previewMint(uint256)",
            "mint(uint256,address)",
            "maxWithdraw(address)",
            "previewWithdraw(uint256)",
            "withdraw(uint256,address,address)",
            "maxRedeem(address)",
            "previewRedeem(uint256)",
            "redeem(uint256,address,address)",
            "share()"
        ];
        bytes4 erc7575;
        for (uint256 i; i < vault7575.length; ++i) {
            erc7575 ^= _sel(vault7575[i]);
        }

        assertEq(operators, bytes4(0xe3bc4e65));
        assertEq(asyncRedeem, bytes4(0x620ee8e4));
        assertEq(erc7575, bytes4(0x2f0a18c5));
        assertEq(_sel("vault(address)"), bytes4(0xf815c03d));
        assertTrue(bank.supportsInterface(0x01ffc9a7), "ERC-165");
        assertTrue(bank.supportsInterface(operators), "ERC-7540 operators");
        assertTrue(bank.supportsInterface(asyncRedeem), "ERC-7540 asynchronous redemption");
        assertTrue(bank.supportsInterface(erc7575), "ERC-7575 vault");
        assertTrue(bank.supportsInterface(0xf815c03d), "ERC-7575 share");
        assertFalse(bank.supportsInterface(0xce3bbe50), "deposits are synchronous");
        assertFalse(bank.supportsInterface(0xffffffff));
    }

    function test_theBankIsItsOwnShareToken() external view {
        assertEq(bank.share(), address(bank));
        assertEq(bank.vault(address(asset)), address(bank));
        assertEq(bank.vault(address(0x1234)), address(0));
    }

    function test_redemptionPreviewsRevertAndDepositViewsFollowPause() external {
        vm.expectRevert(IBank.AsyncRedemption.selector);
        bank.previewRedeem(1);
        vm.expectRevert(IBank.AsyncRedemption.selector);
        bank.previewWithdraw(1);

        _deposit(alice, 1_000e6);
        _winBet(10e6, 110e6); // NAV 900 over 1000 shares
        uint256 preview = bank.previewDeposit(100e6);
        assertEq(preview, 111_098_779);
        assertEq(_deposit(bob, 100e6), preview, "the deposit mints what the preview said");
        uint256 cost = bank.previewMint(50e6);
        asset.mint(bob, cost);
        vm.prank(bob);
        assertEq(bank.mint(50e6, bob), cost, "the mint costs what the preview said");

        assertEq(bank.maxDeposit(alice), type(uint256).max);
        assertEq(bank.maxMint(alice), type(uint256).max);
        vm.prank(gov);
        bank.setRiskInPaused(true);
        assertEq(bank.maxDeposit(alice), 0);
        assertEq(bank.maxMint(alice), 0);
    }

    // ------------------------------------------------------------ requests

    function test_pendingBatchViewShowsOnlyTheCurrentQueueAndKeepsRecoverySeparate() external {
        _deposit(alice, 1_000e6);
        _hold(10e6, 20e6);
        _request(alice, 300e6);
        _priceDue();
        assertEq(bank.pendingRedeemRequest(0, alice), 0);
        assertEq(bank.claimableRedeemRequest(0, alice), 300e6);
        assertEq(bank.redeemBatch(1).assignedShares, 0, "views do not assign liquid entitlements");
        assertEq(bank.getRecovery(1, alice).shares, 1_000e6, "all original units own recovery");
        _request(alice, 200e6);
        (uint256 id, uint256 shares_) = bank.pendingRedeemBatch(alice);
        assertEq(id, 2);
        assertEq(shares_, 200e6);
        assertEq(bank.balanceOf(address(bank)), 200e6);
        assertEq(bank.maxRedeem(alice), 300e6, "old cash is immediately claimable despite the open hold");
        vm.prank(alice);
        bank.cancelRedeemRequest(alice);
        (id, shares_) = bank.pendingRedeemBatch(alice);
        assertEq(id + shares_, 0);
        assertEq(bank.balanceOf(alice), 700e6);
        assertEq(bank.getRecovery(1, alice).shares, 1_000e6);
    }

    function test_requestEscrowsSharesThatKeepBearingResults() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);

        uint64 cutoff = uint64(101 * DAY);
        vm.expectEmit(true, false, false, true, address(bank));
        emit IBank.RedeemBatchOpened(1, cutoff);
        vm.expectEmit(true, true, true, true, address(bank));
        emit IBankVault.RedeemRequest(alice, alice, 0, alice, 400e6);
        vm.prank(alice);
        assertEq(bank.requestRedeem(400e6, alice, alice), 0, "requests aggregate under ID 0");

        assertEq(bank.balanceOf(alice), 600e6);
        assertEq(bank.balanceOf(address(bank)), 400e6, "escrowed in the Bank");
        assertEq(bank.totalSupply(), 2_000e6, "requested shares stay in supply");
        assertEq(bank.pendingRedeemRequest(0, alice), 400e6);
        assertEq(bank.pendingRedeemRequest(1, alice), 0, "only request ID 0 exists");
        assertEq(bank.claimableRedeemRequest(0, alice), 0);
        assertEq(bank.maxRedeem(alice), 0, "pending shares cannot be claimed");
        assertEq(bank.maxWithdraw(alice), 0);

        // A win before the cutoff lowers what the requested shares are worth, like every other share.
        _winBet(100e6, 300e6); // NAV 2000 + 100 - 300 = 1800
        vm.warp(cutoff);
        bank.activateBatch();
        assertEq(bank.redeemBatch(1).assets, 360e6, "400 of 2000 shares of a 1800 NAV");
    }

    function test_requestSpendsAFiniteAllowanceButNotAnOperatorOrInfiniteOne() external {
        _deposit(alice, 1_000e6);

        vm.prank(bob);
        vm.expectRevert(Errors.InsufficientAllowance.selector);
        bank.requestRedeem(100e6, bob, alice);

        vm.prank(alice);
        bank.approve(bob, 150e6);
        vm.prank(bob);
        bank.requestRedeem(100e6, bob, alice);
        assertEq(bank.allowance(alice, bob), 50e6, "a finite allowance is spent");
        assertEq(bank.pendingRedeemRequest(0, bob), 100e6, "the controller holds the Request");
        assertEq(bank.pendingRedeemRequest(0, alice), 0);

        vm.prank(alice);
        bank.approve(bob, type(uint256).max);
        vm.prank(bob);
        bank.requestRedeem(100e6, bob, alice);
        assertEq(bank.allowance(alice, bob), type(uint256).max, "an infinite allowance is kept");

        vm.prank(alice);
        bank.approve(bob, 0);
        vm.prank(alice);
        bank.setOperator(carol, true);
        vm.prank(carol);
        bank.requestRedeem(100e6, alice, alice);
        assertEq(bank.allowance(alice, carol), 0, "an operator needs no allowance");
        assertEq(bank.pendingRedeemRequest(0, alice), 100e6);
        assertEq(bank.balanceOf(alice), 700e6);
    }

    function test_requestRejectsZeroSharesAndZeroController() external {
        _deposit(alice, 1_000e6);
        vm.startPrank(alice);
        vm.expectRevert(Errors.InsufficientBalance.selector);
        bank.requestRedeem(0, alice, alice);
        vm.expectRevert(Errors.ZeroAddress.selector);
        bank.requestRedeem(1, address(0), alice);
        vm.expectRevert(Errors.InsufficientBalance.selector);
        bank.requestRedeem(1_000e6 + 1, alice, alice);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ cutoffs and batches

    function test_cutoffIsEligibilityAndOverdueRequestsStillJoinTheQueue() external {
        _deposit(alice, 1_000e6);
        _request(alice, 1e6);
        assertEq(bank.redeemBatch(1).cutoff, 101 * DAY);
        vm.warp(101 * DAY - 1);
        _request(alice, 1e6);
        vm.warp(102 * DAY);
        _request(alice, 1e6);
        assertEq(bank.currentEpoch(), 1, "time cannot advance the ownership boundary");
        assertEq(bank.redeemBatch(1).shares, 3e6);
        assertEq(bank.redeemBatch(1).cutoff, 101 * DAY);
        bank.activateBatch();
        _request(alice, 1e6);
        assertEq(bank.currentEpoch(), 2);
        assertEq(bank.redeemBatch(2).cutoff, 103 * DAY);
    }

    function test_bettingContinuesBeforeEligibilityAndAcrossHistoricalRecovery() external {
        _deposit(alice, 1_000e6);
        _request(alice, 100e6);
        vm.warp(101 * DAY - 1);
        uint256 beforeEligibility = _hold(10e6, 20e6);
        vm.warp(101 * DAY);
        uint256 afterEligibility = _hold(10e6, 20e6);
        assertEq(bank.redeemBatch(1).activatedAt, 0);
        bank.activateBatch();
        assertEq(bank.recoveryEpoch(1).remainingHolds, 2);
        assertEq(bank.recoveryBacking(), 40e6);
        assertEq(bank.redeemBatch(1).assets, 98e6);
        assertEq(bank.totalSupply(), 900e6);
        assertEq(bank.activeReserved(), 0);
        uint256 later = _hold(10e6, 20e6);
        _deposit(bob, 100e6);
        asset.mint(address(bank), 1e6);
        _settle(later, 20e6);
        assertEq(bank.recoveryEpoch(1).backingAssets, 40e6, "new operations cannot spend old backing");
        uint256 newest = _hold(10e6, 20e6);
        uint256 activeBefore = bank.totalAssets();
        bank.refundBet(beforeEligibility, 10e6);
        _settle(afterEligibility, 20e6);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 0);
        assertEq(bank.recoveryEpoch(1).recoveredAssets, 10e6);
        assertEq(bank.totalAssets(), activeBefore, "old recovery never enters active NAV");
        assertEq(bank.openHolds(), 1);
        assertEq(_claimRecovery(1, alice), 10e6, "wallet and exiting units share their original risk");
        assertEq(bank.getRecovery(1, bob).shares, 0);
        _settle(newest, 0);
        _hold(10e6, 20e6);
    }

    function test_permanentlyOpenFirstEpochNeverBlocksLaterPositiveCashExits() external {
        _deposit(alice, 1_000e6);
        _hold(10e6, 20e6);
        _request(alice, 100e6);
        _priceDue();
        for (uint256 epoch = 2; epoch <= 5; ++epoch) {
            _deposit(bob, 100e6);
            uint256 later = _hold(10e6, 20e6);
            uint256 shares = bank.balanceOf(bob);
            _request(bob, shares);
            _priceDue();
            assertEq(bank.currentEpoch(), epoch + 1);
            vm.prank(bob);
            assertGt(bank.redeem(shares, bob, bob), 0, "each later exit actually pays cash");
            _settle(later, 0);
            assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
            assertEq(bank.recoveryEpoch(1).settledCost, 0);
            assertEq(bank.recoveryEpoch(1).remainingReserve, 20e6);
        }
        assertEq(bank.getRecovery(1, bob).shares, 0);
        assertEq(bank.balanceOf(bob), 0);
    }

    function test_cancelReturnsSharesToControllerUntilActualActivation() external {
        _deposit(alice, 1_000e6);
        vm.prank(alice);
        bank.approve(bob, type(uint256).max);
        vm.prank(bob);
        bank.requestRedeem(300e6, bob, alice);
        vm.prank(alice);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.cancelRedeemRequest(bob);
        vm.warp(102 * DAY);
        vm.expectEmit(true, true, true, true, address(bank));
        emit IBank.RedeemRequestCancelled(bob, bob, 1, 300e6);
        vm.prank(bob);
        assertEq(bank.cancelRedeemRequest(bob), 300e6);
        assertEq(bank.balanceOf(bob), 300e6);
        assertEq(bank.balanceOf(address(bank)), 0);
        _request(alice, 100e6);
        uint256 oldBet = _hold(10e6, 20e6);
        vm.warp(bank.redeemBatch(1).cutoff);
        bank.activateBatch();
        vm.prank(alice);
        vm.expectRevert(IBank.NothingToCancel.selector);
        bank.cancelRedeemRequest(alice);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
        _settle(oldBet, 0);
    }

    function test_cancellingEveryRequestRetiresTheBatch() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
        _request(alice, 100e6);
        _request(bob, 200e6);

        vm.prank(alice);
        bank.cancelRedeemRequest(alice);
        vm.expectEmit(true, false, false, false, address(bank));
        emit IBank.RedeemBatchRetired(1);
        vm.prank(bob);
        bank.cancelRedeemRequest(bob);

        assertEq(bank.currentEpoch(), 1, "cancellation does not seal or advance the epoch");
        assertEq(bank.redeemBatch(1).cutoff, 0);
        vm.warp(101 * DAY);
        vm.expectRevert(IBank.NoBatchDue.selector);
        bank.activateBatch();
        _hold(10e6, 20e6);

        vm.warp(101 * DAY + 3 hours);
        _request(alice, 50e6);
        assertEq(bank.redeemBatch(1).cutoff, 102 * DAY, "a later request opens at the next boundary");
        assertEq(bank.redeemBatch(1).shares, 50e6);
    }

    function test_batchPeriodIsBoundedAndAppliesToLaterBatches() external {
        vm.startPrank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank.setBatchPeriod(1 hours - 1);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank.setBatchPeriod(7 days + 1);
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.setBatchPeriod(1 hours);

        _deposit(alice, 1_000e6);
        _request(alice, 1e6);
        vm.prank(gov);
        bank.setBatchPeriod(1 hours);
        assertEq(bank.redeemBatch(1).cutoff, 101 * DAY, "an open batch keeps its cutoff");

        vm.warp(101 * DAY + 30 minutes);
        bank.activateBatch();
        _request(alice, 1e6);
        assertEq(bank.redeemBatch(2).cutoff, 101 * DAY + 1 hours);
    }

    // ------------------------------------------------------------ pricing

    function test_activationRequiresEligibilityAndUnpauseButNeverOldCompletion() external {
        _deposit(alice, 1_000e6);
        _request(alice, 100e6);
        _hold(10e6, 20e6);
        vm.expectRevert(IBank.NoBatchDue.selector);
        bank.activateBatch();
        vm.warp(101 * DAY);
        vm.prank(gov);
        bank.setRiskInPaused(true);
        vm.expectRevert(IBank.RiskInPaused.selector);
        bank.activateBatch();
        vm.prank(gov);
        bank.setRiskInPaused(false);
        vm.prank(stranger);
        assertEq(bank.activateBatch(), 1);
        assertEq(bank.maxWithdraw(alice), 99e6);
        assertTrue(bank.redeemBatch(1).priced);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
        _request(alice, 100e6);
        _priceDue();
        assertEq(bank.currentEpoch(), 3);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
    }

    function test_profitablePoolPricesAtTheVirtualOffsetQuote() external {
        _deposit(alice, 1_000e6);
        _request(alice, 1_000e6);
        uint256 betId = _hold(100e6, 200e6);
        _settle(betId, 0); // NAV 1100 over 1000 shares

        _priceDue();
        // The virtual residual belongs to protocol capital on a full real-share exit.
        assertEq(bank.redeemBatch(1).assets, 1_099_900_099);
        assertEq(bank.totalSupply(), 0);
        assertEq(bank.exitPayable(), 1_099_900_099);
        assertEq(bank.totalAssets(), 0);
        assertEq(bank.protocolFeesPayable(), 99_901);
        assertEq(bank.totalProtocolFeeAccrued(), 0, "protocol capital is not a gameplay fee");
    }

    function test_depletedPoolPricesAtItsRealEquity() external {
        // Real-equity ceiling: S = 10e6, N = 5e6 and V = 1e6 quote 5,454,545 for the whole supply, but only 5,000,000 exist.
        _deposit(alice, 4e6);
        _deposit(bob, 6e6);
        _winBet(1e6, 6e6);
        assertEq(bank.totalAssets(), 5e6);

        _request(alice, 4e6);
        _request(bob, 6e6);
        _priceDue();
        assertEq(bank.redeemBatch(1).assets, 5e6, "capped at the real equity, not the 5,454,545 quote");
        assertEq(bank.totalAssets(), 0);

        // A partial exit takes only its proportional share: 4 of 10 shares of 5 is 2, not the 2,181,818 quote.
        vm.warp(block.timestamp + 1);
        Bank second = _freshBank();
        _depositTo(second, alice, 4e6);
        _depositTo(second, bob, 6e6);
        uint256 betId = nextBetId++;
        second.holdBet(betId, player, 1e6, 6e6, bytes32(betId));
        _settleOn(second, betId, 6e6);
        vm.prank(alice);
        second.requestRedeem(4e6, alice, alice);
        vm.warp(second.redeemBatch(1).cutoff);
        second.activateBatch();
        assertEq(second.redeemBatch(1).assets, 2e6);
        assertEq(second.totalAssets(), 3e6, "the remaining LP keeps its proportional equity");
    }

    function test_zeroNavBatchClearsItsSharesWithoutATransfer() external {
        _deposit(alice, 10e6);
        _winBet(1e6, 11e6);
        assertEq(bank.totalAssets(), 0);
        _request(alice, 10e6);
        _priceDue();
        assertEq(bank.redeemBatch(1).assets, 0);

        vm.recordLogs();
        vm.prank(alice);
        assertEq(bank.redeem(10e6, alice, alice), 0);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            assertTrue(logs[i].emitter != address(asset), "no token transfer");
        }
        assertEq(bank.maxRedeem(alice), 0, "the zero-asset shares are cleared");
    }

    function test_nextQueuePricesItsCashBeforeAnyOldPositionTerminates() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
        _request(alice, 500e6);
        uint256 oldBet = _hold(100e6, 300e6);
        _priceDue();
        assertEq(bank.redeemBatch(1).assets, 450e6);
        _request(bob, 500e6);
        _priceDue();
        assertEq(bank.redeemBatch(2).assets, 450e6);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
        assertEq(bank.currentEpoch(), 3);
        assertEq(bank.totalSupply(), 1_000e6);
        uint256 active = bank.totalAssets();
        _settle(oldBet, 300e6);
        assertEq(bank.totalAssets(), active);
        assertEq(bank.getRecovery(1, alice).claimableAssets, 0);
        assertEq(bank.getRecovery(1, bob).claimableAssets, 0);
    }

    function test_pricedAssetsAreIsolatedFromLaterBets() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
        _request(alice, 1_000e6);
        _priceDue();
        assertEq(bank.exitPayable(), 1_000e6);

        _winBet(100e6, 600e6); // Bob's pool pays a 500 loss
        assertEq(bank.exitPayable(), 1_000e6, "later bets neither pay into nor draw on exits");
        vm.prank(alice);
        assertEq(bank.redeem(1_000e6, alice, alice), 1_000e6);
        assertEq(bank.totalAssets(), 500e6);
    }

    // ------------------------------------------------------------ claims

    function test_partialClaimOrderDoesNotChangeTheTotal() external {
        _deposit(alice, 700e6);
        _deposit(bob, 300e6);
        _winBet(7e6, 107e6); // NAV 900
        _request(alice, 700e6);
        _priceDue();
        uint256 entitled = bank.maxWithdraw(alice);
        assertEq(entitled, 630e6);
        uint256 snapshot = vm.snapshotState();

        vm.startPrank(alice);
        assertEq(bank.redeem(123_456_789, alice, alice), 111_111_110, "floor(123456789 * 630 / 700)");
        bank.withdraw(100e6 + 1, alice, alice);
        bank.redeem(bank.maxRedeem(alice), alice, alice);
        vm.stopPrank();
        assertEq(asset.balanceOf(alice), entitled);
        assertEq(bank.maxWithdraw(alice), 0);

        assertTrue(vm.revertToState(snapshot));
        vm.startPrank(alice);
        uint256 burned = bank.withdraw(333e6, alice, alice);
        assertEq(burned, 370e6, "ceil(333 * 700 / 630)");
        bank.withdraw(bank.maxWithdraw(alice), alice, alice);
        vm.stopPrank();
        assertEq(asset.balanceOf(alice), entitled, "a different order, the same total");
        assertEq(bank.maxRedeem(alice), 0);
        assertEq(bank.exitPayable(), 0);
    }

    function test_withdrawCannotConsumeEveryShareAndLeaveAssets() external {
        _deposit(alice, 10);
        _deposit(bob, 1_000e6);
        _settle(_hold(1_000e6, 1_000e6), 0); // a lost bet doubles the share price
        _request(alice, 3);
        _priceDue();
        assertEq(bank.maxWithdraw(alice), 5);
        assertEq(bank.maxRedeem(alice), 3);

        vm.startPrank(alice);
        vm.expectRevert(IBank.ClaimWouldStrandAssets.selector);
        bank.withdraw(4, alice, alice); // ceil(4 * 3 / 5) is every share, but 1 asset would remain
        assertEq(bank.withdraw(3, alice, alice), 2);
        vm.expectRevert(IBank.ClaimWouldStrandAssets.selector);
        bank.withdraw(1, alice, alice);
        assertEq(bank.redeem(1, alice, alice), 2, "the last share takes the last assets");
        vm.stopPrank();
        assertEq(asset.balanceOf(alice), 5);
    }

    function test_onlyTheControllerOrItsOperatorClaimsAndPicksTheReceiver() external {
        _deposit(alice, 1_000e6);
        vm.prank(alice);
        bank.approve(bob, type(uint256).max);
        _request(alice, 1_000e6);
        _priceDue();

        vm.prank(bob);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.redeem(1, bob, alice); // an ERC-20 allowance grants no claim

        vm.prank(alice);
        bank.setOperator(carol, true);
        vm.expectEmit(true, true, true, true, address(bank));
        emit IBankVault.Withdraw(carol, stranger, alice, 100e6, 100e6);
        vm.prank(carol);
        bank.withdraw(100e6, stranger, alice);
        assertEq(asset.balanceOf(stranger), 100e6, "an operator chooses the receiver");

        vm.prank(alice);
        bank.setOperator(carol, false);
        vm.prank(carol);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.withdraw(1, carol, alice);

        vm.prank(alice);
        vm.expectRevert(Errors.ZeroAddress.selector);
        bank.redeem(1, address(0), alice);
    }

    function test_repeatedFailedLiquidClaimsPreserveEveryUnitAndRetryPaysOnce() external {
        _deposit(alice, 1_000e6);
        _request(alice, 1_000e6);
        _priceDue();
        uint256 cash = asset.balanceOf(address(bank));
        asset.setBlocked(alice, true);
        for (uint256 i; i < 2; ++i) {
            vm.prank(alice);
            vm.expectRevert(bytes("blocked"));
            bank.redeem(1_000e6, alice, alice);
            assertEq(bank.maxRedeem(alice), 1_000e6);
            assertEq(bank.maxWithdraw(alice), 1_000e6);
            assertEq(bank.exitPayable(), 1_000e6);
            assertEq(asset.balanceOf(address(bank)), cash);
            assertEq(asset.balanceOf(alice), 0);
        }
        asset.setBlocked(alice, false);
        vm.prank(alice);
        assertEq(bank.redeem(1_000e6, alice, alice), 1_000e6);
        assertEq(bank.exitPayable(), 0);
        assertEq(bank.maxRedeem(alice), 0);
        vm.prank(alice);
        vm.expectRevert(IBank.ExceedsClaimable.selector);
        bank.redeem(1, alice, alice);
        assertEq(asset.balanceOf(alice), 1_000e6);
    }

    function test_pauseStopsClaimsButNotRequestsSyncOrCancellation() external {
        _deposit(alice, 1_000e6);
        _request(alice, 500e6);
        _priceDue();
        _request(alice, 100e6);

        vm.prank(gov);
        bank.setRiskInPaused(true);
        assertEq(bank.maxRedeem(alice), 0);
        assertEq(bank.maxWithdraw(alice), 0);
        (, uint256 claimableShares, uint256 claimableAssets) = bank.redeemRequestOf(alice);
        assertEq(claimableShares, 500e6, "the SDK view still shows the claim");
        assertEq(claimableAssets, 500e6);

        vm.startPrank(alice);
        vm.expectRevert(IBank.RiskInPaused.selector);
        bank.redeem(1, alice, alice);
        vm.expectRevert(IBank.RiskInPaused.selector);
        bank.withdraw(1, alice, alice);
        bank.requestRedeem(100e6, alice, alice);
        bank.cancelRedeemRequest(alice);
        vm.stopPrank();
        bank.syncRedeem(alice);
        assertEq(bank.balanceOf(alice), 500e6);
    }

    function test_remainderReturnsToNavOnceEveryShareIsAssigned() external {
        _deposit(alice, 1);
        _deposit(bob, 1);
        _deposit(carol, 1);
        _deposit(gov, 1_000e6);
        _winBet(1e6, 1e6 + 500e6); // NAV per share halves
        _request(alice, 1);
        _request(bob, 1);
        _request(carol, 1);
        _priceDue();
        uint256 batchAssets = bank.redeemBatch(1).assets;
        assertEq(batchAssets, 1, "3 shares of a half-value pool");
        assertEq(bank.exitPayable(), 1);

        bank.syncRedeem(alice);
        bank.syncRedeem(bob);
        assertEq(bank.exitPayable(), 1, "an unsynced controller's entitlement stays reserved");
        uint256 navBefore = bank.totalAssets();
        vm.expectEmit(true, false, false, true, address(bank));
        emit IBank.RedeemRemainderReleased(1, 1, false);
        bank.syncRedeem(carol);
        assertEq(bank.exitPayable(), 0, "floor(1 * 1 / 3) is zero for each; the unit returns to NAV");
        assertEq(bank.totalAssets(), navBefore + 1);

        bank.syncRedeem(carol);
        assertEq(bank.totalAssets(), navBefore + 1, "released exactly once");
        assertEq(bank.redeemBatch(1).assignedShares, 3);
    }

    function test_viewsAgreeWithStoredStateAfterSync() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 2_000e6);
        _winBet(3e6, 303e6); // NAV 2700
        _request(alice, 900e6);
        _priceDue();
        _request(alice, 1e6);

        (uint256 pendingBefore, uint256 sharesBefore, uint256 assetsBefore) = bank.redeemRequestOf(alice);
        assertEq(pendingBefore, 1e6);
        assertEq(sharesBefore, 900e6, "the new request synchronized the priced batch");
        assertEq(assetsBefore, 810e6);

        _request(bob, 2_000e6);
        vm.warp(block.timestamp + DAY);
        bank.activateBatch(); // prices Alice's second request together with Bob's
        assertEq(bank.redeemBatch(2).assets, 1_800_900_000);
        (uint256 pendingView, uint256 sharesView, uint256 assetsView) = bank.redeemRequestOf(alice);
        uint256 maxW = bank.maxWithdraw(alice);
        bank.syncRedeem(alice);
        (uint256 pendingAfter, uint256 sharesAfter, uint256 assetsAfter) = bank.redeemRequestOf(alice);
        assertEq(pendingView, 0);
        assertEq(sharesView, 901e6);
        assertEq(assetsView, 810_900_000);
        assertEq(assetsView, maxW);
        assertEq(pendingAfter, pendingView);
        assertEq(sharesAfter, sharesView);
        assertEq(assetsAfter, assetsView);
        assertEq(bank.claimableRedeemRequest(0, alice), sharesAfter);
    }

    function test_exitsAreExemptFromTheWithdrawalBuffer() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
        uint256 oldBet = _hold(100e6, 300e6);
        _request(alice, 500e6);
        _priceDue();
        uint256 active = bank.totalAssets();
        vm.prank(gov);
        bank.setWithdrawalBufferBps(10_000);
        assertEq(bank.getSSOT().withdrawable, 0);
        bank.refundBet(oldBet, 100e6);
        assertEq(bank.totalAssets(), active);
        vm.prank(alice);
        assertEq(bank.redeem(500e6, alice, alice), 450e6);
        assertEq(_claimRecovery(1, alice), 100e6);
        assertEq(bank.totalAssets(), active, "paying fixed exit debts cannot spend active capital");
        assertEq(bank.getRecovery(1, bob).claimableAssets, 100e6);
        assertEq(bank.recoveryBacking(), 100e6);
    }

    function test_claimToTheBankItselfDonatesToNav() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
        _request(alice, 1_000e6);
        _priceDue();
        uint256 navBefore = bank.totalAssets();
        vm.prank(alice);
        bank.withdraw(100e6, address(bank), alice);
        assertEq(bank.totalAssets(), navBefore + 100e6);
    }

    function test_escrowedSharesCannotBeRescuedOrMovedByOthers() external {
        _deposit(alice, 1_000e6);
        _request(alice, 400e6);

        vm.startPrank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank.rescueToken(address(bank), gov, 400e6);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank.rescueToken(address(asset), gov, 1);
        vm.stopPrank();

        vm.prank(stranger);
        vm.expectRevert(Errors.InsufficientAllowance.selector);
        bank.transferFrom(address(bank), stranger, 1);

        // Bank escrow has a controller; ordinary transfers cannot create ownerless snapshot units.
        vm.prank(alice);
        vm.expectRevert();
        bank.transfer(address(bank), 100e6);
        assertEq(bank.pendingRedeemRequest(0, alice), 400e6);
        assertEq(bank.redeemBatch(1).shares, 400e6);
    }

    function test_allExternalShareDestinationsRejectTheBankWithoutChangingOwnership() external {
        _deposit(alice, 1_000e6);
        asset.mint(alice, 100e6);
        uint256 cashBefore = asset.balanceOf(address(bank));
        assertEq(bank.maxDeposit(address(bank)), 0);
        assertEq(bank.maxMint(address(bank)), 0);
        vm.startPrank(alice);
        vm.expectRevert();
        bank.deposit(10e6, address(bank));
        vm.expectRevert();
        bank.mint(10e6, address(bank));
        vm.expectRevert();
        bank.transfer(address(bank), 10e6);
        bank.approve(bob, 100e6);
        vm.expectRevert();
        bank.requestRedeem(10e6, address(bank), alice);
        vm.stopPrank();
        vm.prank(bob);
        vm.expectRevert();
        bank.transferFrom(alice, address(bank), 10e6);
        assertEq(bank.allowance(alice, bob), 100e6, "a rejected destination cannot consume allowance");
        assertEq(bank.balanceOf(alice), 1_000e6);
        assertEq(bank.balanceOf(address(bank)), 0);
        assertEq(bank.totalSupply(), 1_000e6);
        assertEq(bank.pendingRedeemRequest(0, address(bank)), 0);
        assertEq(asset.balanceOf(address(bank)), cashBefore);
    }

    // ------------------------------------------------------------ player payables

    function test_refusedPayoutBecomesAPayableAndTheBatchStillPrices() external {
        _deposit(alice, 1_000e6);
        _request(alice, 1_000e6);
        uint256 betId = _hold(100e6, 300e6);
        asset.setBlocked(player, true);

        vm.warp(101 * DAY);
        vm.expectEmit(true, true, false, true, address(bank));
        emit IBank.PlayerPayableCreated(betId, player, 300e6);
        _settle(betId, 300e6);

        assertEq(bank.playerPayable(player), 300e6);
        assertEq(bank.playerPayableTotal(), 300e6);
        assertEq(bank.totalReserved(), 0, "the reserve is released");
        assertEq(bank.openHolds(), 0, "the position ended");
        assertEq(bank.totalPayoutNet(), 300e6, "counted once, at settlement");
        assertEq(bank.totalAssets(), 800e6, "the payable is a liability outside NAV");
        assertEq(asset.balanceOf(address(bank)), 1_100e6);

        bank.activateBatch();
        assertEq(bank.redeemBatch(1).assets, 800e6, "one blacklisted winner does not block the exit");

        // A payable claim works while paused, can be triggered by anyone and pays only the player.
        vm.prank(gov);
        bank.setRiskInPaused(true);
        vm.prank(stranger);
        vm.expectRevert(bytes("blocked"));
        bank.claimPlayerPayable(player);
        assertEq(bank.playerPayable(player), 300e6, "a failed claim keeps the debt");

        asset.setBlocked(player, false);
        uint256 navBefore = bank.totalAssets();
        uint256 playerBefore = asset.balanceOf(player);
        vm.expectEmit(true, true, false, true, address(bank));
        emit IBank.PlayerPayablePaid(player, stranger, 300e6);
        vm.prank(stranger);
        assertEq(bank.claimPlayerPayable(player), 300e6);
        assertEq(asset.balanceOf(player), playerBefore + 300e6, "paid to the player, not the caller");
        assertEq(asset.balanceOf(stranger), 0);
        assertEq(bank.playerPayableTotal(), 0);
        assertEq(bank.totalAssets(), navBefore, "paying a payable leaves NAV unchanged");
        assertEq(bank.claimPlayerPayable(player), 0);
        assertEq(bank.totalPayoutNet(), 300e6, "not counted again on claim");
    }

    function test_refusedRefundBecomesAPayable() external {
        _deposit(alice, 1_000e6);
        uint256 betId = _hold(100e6, 300e6);
        asset.setBlocked(player, true);
        bank.refundBet(betId, 100e6);
        assertEq(bank.playerPayable(player), 100e6);
        assertEq(bank.totalBetsRefunded(), 1);
        assertEq(bank.openHolds(), 0);
    }

    function test_tokenOutOfGasPreservesTheWholePayoutAsPayable() external {
        _assertGasLimitedTransfer(false, false);
    }

    function test_proxyTokenOutOfGasPreservesTheWholePayoutAsPayable() external {
        _assertGasLimitedTransfer(true, false);
    }

    function test_tokenOutOfGasPreservesTheWholeRefundAsPayable() external {
        _assertGasLimitedTransfer(false, true);
    }

    function test_proxyTokenPaysDirectlyWithEnoughGas() external {
        _useProxyAsset();
        _deposit(alice, 1_000e6);
        uint256 betId = _hold(100e6, 300e6);
        asset.setGasSink(player, 10_000_000);
        uint256 playerBefore = asset.balanceOf(player);
        SSOTTypes.XPAward[] memory none;
        bank.settleBet{gas: 20_000_000}(betId, 300e6, 300e6, 0, 0, none);
        assertEq(asset.balanceOf(player), playerBefore + 300e6);
        assertEq(bank.playerPayable(player), 0);
        assertEq(bank.playerPayableTotal(), 0);
        assertEq(bank.openHolds(), 0);
        assertEq(bank.totalAssets(), 800e6);
    }

    function test_underfundedSettlementRollsBackTheWholePosition() external {
        _deposit(alice, 1_000e6);
        uint256 betId = _hold(100e6, 300e6);
        asset.setGasSink(player, 25_000_000);
        SSOTTypes.XPAward[] memory none;
        uint256 cashBefore = asset.balanceOf(address(bank));
        // Not enough gas remains to book the payable and finish settlement. The whole operation must revert.
        vm.expectRevert();
        bank.settleBet{gas: 1_000_000}(betId, 300e6, 300e6, 0, 0, none);
        assertEq(bank.openHolds(), 1);
        assertEq(bank.totalReserved(), 300e6);
        assertEq(bank.totalBetsSettled(), 0);
        assertEq(bank.totalPayoutNet(), 0);
        assertEq(bank.playerPayable(player), 0);
        assertEq(bank.playerPayableTotal(), 0);
        assertEq(asset.balanceOf(address(bank)), cashBefore);

        asset.setGasSink(address(0), 0);
        _settle(betId, 300e6);
        assertEq(bank.openHolds(), 0);
        assertEq(bank.totalBetsSettled(), 1);
    }

    function test_everyNavComputationSubtractsBothPayables() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
        _request(alice, 1_000e6);
        _priceDue();
        uint256 betId = _hold(100e6, 300e6);
        asset.setBlocked(player, true);
        _settle(betId, 300e6);

        // B 2100, exits 1000, player payable 300: NAV 800, not B - PF - XP = 2100.
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertEq(s.B, 2_100e6);
        assertEq(s.PF + s.XP, 0);
        assertEq(s.NAV, 800e6);
        assertEq(bank.totalAssets(), s.NAV);
        assertEq(bank.convertToAssets(1e6), Math.mulDiv(1e6, s.NAV + 1e6, 1_000e6 + 1e6));

        // The risk-in check sees the same NAV: a reserve above it is refused.
        asset.setBlocked(player, false);
        vm.expectRevert(IBank.SolvencyViolation.selector);
        bank.holdBet(50, player, 1, s.NAV + 2, bytes32(0));
    }

    // ------------------------------------------------------------ helpers

    function _useProxyAsset() internal {
        asset = BlacklistToken(address(new ERC1967Proxy(address(new BlacklistToken()), "")));
        asset.mint(player, 1_000_000e6);
        bank = _freshBank();
    }

    function _assertGasLimitedTransfer(bool useProxy, bool refund) internal {
        if (useProxy) _useProxyAsset();
        _deposit(alice, 1_000e6);
        _request(alice, 1_000e6);
        uint256 betId = _hold(100e6, 300e6);
        uint256 playerBefore = asset.balanceOf(player);
        uint256 owed = refund ? 100e6 : 300e6;
        asset.setGasSink(player, useProxy ? 10_000_000 : 25_000_000);
        if (refund) {
            bank.refundBet{gas: 20_000_000}(betId, owed);
        } else {
            SSOTTypes.XPAward[] memory none;
            bank.settleBet{gas: useProxy ? 10_000_000 : 20_000_000}(betId, owed, owed, 0, 0, none);
        }
        assertEq(asset.balanceOf(player), playerBefore, "no cash transferred on failure");
        assertEq(bank.playerPayable(player), owed);
        assertEq(bank.playerPayableTotal(), owed);
        assertEq(bank.openHolds(), 0);
        assertEq(bank.totalReserved(), 0);
        assertEq(bank.totalBetsSettled() + bank.totalBetsRefunded(), 1);
        uint256 nav = 1_100e6 - owed;
        assertEq(bank.totalAssets(), nav);
        _priceDue();
        assertEq(bank.maxWithdraw(alice), nav, "the unpaid player is excluded from LP equity");

        vm.expectRevert();
        bank.claimPlayerPayable{gas: 1_000_000}(player);
        assertEq(bank.playerPayable(player), owed, "failed claim preserves the whole debt");
        assertEq(bank.playerPayableTotal(), owed);

        asset.setGasSink(address(0), 0);
        vm.prank(stranger);
        assertEq(bank.claimPlayerPayable(player), owed);
        assertEq(asset.balanceOf(player), playerBefore + owed);
        assertEq(bank.playerPayableTotal(), 0);
        assertEq(bank.claimPlayerPayable(player), 0, "no double payment");
        assertEq(bank.totalBetsSettled() + bank.totalBetsRefunded(), 1);
        vm.prank(alice);
        assertEq(bank.withdraw(nav, alice, alice), 1_000e6);
        assertEq(bank.exitPayable(), 0);
    }

    function test_combinedPlayerProtocolAndEveryXpBucketMustFitTheHoldReserve() external {
        _deposit(alice, 1_000e6);
        uint256 oldBet = _hold(100e6, 200e6);
        _request(alice, 500e6);
        _priceDue();
        uint256 active = bank.totalAssets();
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](1);
        awards[0] = SSOTTypes.XPAward({
            payee: bob, sourcePlayer: player, accrued: 20e6, locked: 20e6, holdback: 20e6, reason: 0
        });
        vm.expectRevert(abi.encodeWithSelector(IBank.ReservedTooSmall.selector, oldBet, 200e6, 230e6));
        bank.settleBet(oldBet, 120e6, 120e6, 20e6, 30e6, awards);
        assertEq(bank.recoveryEpoch(1).settledCost, 0);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
        assertEq(bank.protocolFeesPayable(), 0);
        assertEq(bank.externalPayablesTotal(), 0);
        awards[0].accrued = 5e6;
        awards[0].locked = 6e6;
        awards[0].holdback = 7e6;
        bank.settleBet(oldBet, 120e6, 100e6, 20e6, 10e6, awards);
        assertEq(bank.recoveryEpoch(1).settledCost, 148e6);
        assertEq(bank.recoveryEpoch(1).remainingReserve, 0);
        assertEq(bank.recoveryEpoch(1).recoveredAssets, 52e6);
        assertEq(bank.totalAssets(), active);
        assertEq(bank.totalProtocolFeeAccrued(), 10e6);
        assertEq(bank.protocolFeesPayable(), 10e6);
        assertEq(bank.externalPayablesTotal(), 18e6);
        assertEq(bank.xpLockedBySource(bob, player), 6e6);
    }

    function test_holdMustReserveAtLeastItsFullRefund() external {
        _deposit(alice, 1_000e6);
        vm.expectRevert(abi.encodeWithSelector(IBank.ReservedTooSmall.selector, 99, 9e6, 10e6));
        bank.holdBet(99, player, 10e6, 9e6, bytes32(0));
        assertEq(bank.totalBetsHeld(), 0);
        assertEq(bank.totalReserved(), 0);
    }

    function test_cumulativeRecoveryRoundingCannotSpendTheRemainingReserve() external {
        _deposit(alice, 4);
        _winBet(1, 5);
        uint256 first = _hold(1, 1);
        uint256 second = _hold(1, 1);
        _request(alice, 2);
        _priceDue();
        assertEq(bank.recoveryBacking(), 2);
        assertEq(bank.totalAssets(), 0);
        assertEq(bank.activeReserved(), 0);
        bank.refundBet(first, 1);
        assertEq(bank.recoveryBacking(), 1);
        assertEq(bank.recoveryEpoch(1).remainingReserve, 1);
        assertEq(_claimRecovery(1, alice), 0);
        bank.refundBet(second, 1);
        assertEq(bank.recoveryBacking(), 0);
        vm.prank(alice);
        assertEq(bank.redeem(2, alice, alice), 0);
        assertEq(bank.getRecovery(1, alice).shares, 4, "zero recovery does not rewrite ownership");
    }

    function test_fullExitNeedsActiveCapitalAndNewDepositsDoNotOwnOldRecovery() external {
        _deposit(alice, 1_000e6);
        uint256 oldBet = _hold(100e6, 300e6);
        _request(alice, 1_000e6);
        _priceDue();
        assertEq(bank.totalSupply(), 0);
        assertEq(bank.totalAssets(), 0);
        assertEq(bank.activeReserved(), 0);
        assertEq(bank.recoveryBacking(), 300e6);
        vm.prank(alice);
        assertEq(bank.redeem(1_000e6, alice, alice), 800e6);
        vm.expectRevert(IBank.SolvencyViolation.selector);
        bank.holdBet(99, player, 10e6, 20e6, bytes32(0));
        assertEq(_deposit(bob, 100e6), 100e6);
        uint256 newer = _hold(10e6, 20e6);
        uint256 active = bank.totalAssets();
        bank.refundBet(oldBet, 100e6);
        assertEq(_claimRecovery(1, alice), 200e6);
        assertEq(bank.getRecovery(1, bob).shares, 0);
        assertEq(bank.totalAssets(), active);
        assertEq(bank.openHolds(), 1);
        _settle(newer, 0);
    }

    function test_historicalPayableCostsAreChargedOnceRegardlessOfWhenThePlayerClaims() external {
        _deposit(alice, 1_000e6);
        _request(alice, 500e6);
        uint256 paidLater = _hold(100e6, 300e6);
        uint256 stillOpen = _hold(10e6, 20e6);
        _priceDue();
        asset.setBlocked(player, true);
        _settle(paidLater, 300e6);
        assertEq(bank.playerPayable(player), 300e6);
        assertEq(bank.recoveryEpoch(1).settledCost, 300e6);
        uint256 backing = bank.recoveryBacking();
        uint256 active = bank.totalAssets();
        asset.setBlocked(player, false);
        bank.claimPlayerPayable(player);
        assertEq(bank.recoveryBacking(), backing);
        assertEq(bank.totalAssets(), active);
        assertEq(bank.recoveryEpoch(1).settledCost, 300e6);
        bank.refundBet(stillOpen, 10e6);
        assertEq(bank.recoveryEpoch(1).settledCost, 310e6);
        assertEq(bank.recoveryEpoch(1).recoveredAssets, 10e6);
        assertEq(bank.redeemBatch(1).assets, 395e6);
    }

    function test_activeRiskChecksCannotBorrowHistoricalCapitalAndSsotUsesActiveReserve() external {
        _deposit(alice, 1_000e6);
        uint256 oldBet = _hold(100e6, 300e6);
        _request(alice, 900e6);
        _priceDue();
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertEq(s.NAV, 80e6);
        assertEq(s.R, bank.activeReserved());
        assertEq(s.R, 0);
        assertEq(bank.totalReserved(), 300e6);
        assertEq(s.riskFree, s.NAV - s.R);
        vm.expectRevert(IBank.SolvencyViolation.selector);
        bank.holdBet(99, player, 1e6, 200e6, bytes32(0));
        _settle(oldBet, 0);
        assertEq(bank.totalAssets(), s.NAV, "released old capital is not available for new risk");
        assertEq(bank.activeReserved(), 0);
        assertEq(bank.totalReserved(), 0);
        assertGt(bank.recoveryBacking(), 0);
    }

    function test_feeAndXpOutflowChecksUseActiveReserveWithoutSpendingHistoricalBacking() external {
        _deposit(alice, 1_000e6);
        _hold(100e6, 300e6);
        _request(alice, 900e6);
        _priceDue();
        uint256 backing = bank.recoveryBacking();
        uint256 later = _hold(10e6, 20e6);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](1);
        awards[0] =
            SSOTTypes.XPAward({payee: bob, sourcePlayer: player, accrued: 1e6, locked: 0, holdback: 0, reason: 0});
        bank.settleBet(later, 0, 0, 0, 1e6, awards);
        uint256 active = bank.totalAssets();
        assertLt(active, bank.totalReserved());
        vm.prank(gov);
        assertEq(bank.claimProtocolFees(1e6, gov), 1e6);
        vm.prank(bob);
        assertEq(bank.claimXPAccrued(1e6, bob), 1e6);
        assertEq(bank.totalAssets(), active);
        assertEq(bank.recoveryBacking(), backing);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
        assertEq(bank.recoveryEpoch(1).settledCost, 0);
    }

    function test_holdOwnershipUsesItsAcceptanceEpochNotBetId() external {
        _deposit(alice, 1_000e6);
        bank.holdBet(999, player, 10e6, 20e6, bytes32(0));
        _request(alice, 100e6);
        _priceDue();
        bank.holdBet(1, player, 10e6, 20e6, bytes32(0));
        bank.refundBet(1, 10e6);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
        assertEq(bank.recoveryEpoch(1).settledCost, 0);
        bank.refundBet(999, 10e6);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 0);
        assertEq(bank.recoveryEpoch(1).settledCost, 10e6);
        assertEq(bank.redeemBatch(1).assets, 99e6);
        assertEq(bank.getRecovery(1, alice).claimableAssets, 10e6);
    }

    function testFuzz_oldSettlementOrderPreservesRecoveryAndVirtualResidual(uint64 firstCost, uint64 secondCost)
        external
    {
        uint256 c1 = bound(firstCost, 0, 200e6);
        uint256 c2 = bound(secondCost, 0, 150e6);
        _deposit(alice, 1_000e6);
        uint256 first = _hold(100e6, 200e6);
        uint256 second = _hold(50e6, 150e6);
        _request(alice, 700e6);
        _priceDue();
        uint256 active = bank.totalAssets();
        uint256 liquid = bank.redeemBatch(1).assets;
        uint256 expected = _g(1_150e6 - c1 - c2, 1_000e6) - _g(800e6, 1_000e6);
        uint256 snapshot = vm.snapshotState();
        _settle(first, c1);
        assertGe(bank.recoveryBacking(), bank.recoveryEpoch(1).remainingReserve);
        uint256 interim = _claimRecovery(1, alice);
        _settle(second, c2);
        assertEq(interim + _claimRecovery(1, alice), expected);
        uint256 protocol = bank.protocolFeesPayable();
        assertEq(protocol, 350e6 - c1 - c2 - expected);
        assertTrue(vm.revertToState(snapshot));
        _settle(second, c2);
        assertGe(bank.recoveryBacking(), bank.recoveryEpoch(1).remainingReserve);
        _settle(first, c1);
        assertEq(_claimRecovery(1, alice), expected);
        assertEq(bank.protocolFeesPayable(), protocol);
        assertEq(bank.totalProtocolFeeAccrued(), 0);
        assertEq(bank.totalAssets(), active);
        assertEq(bank.redeemBatch(1).assets, liquid);
    }

    function testFuzz_recoveryCurveIncludesProfitLossAndTinyVirtualBalances(
        uint32 supplyRaw,
        uint32 navRaw,
        uint32 reserveRaw,
        uint32 costRaw,
        uint32 requestRaw
    ) external {
        uint256 supply = bound(supplyRaw, 1, 2e6);
        uint256 nav = bound(navRaw, 0, 4e6);
        _deposit(alice, supply);
        if (nav > supply) asset.mint(address(bank), nav - supply);
        else if (nav < supply) _winBet(1, supply - nav + 1);
        uint256 reserve = bound(reserveRaw, 1, nav + 1);
        uint256 cost = bound(costRaw, 0, reserve);
        uint256 held = _hold(1, reserve);
        uint256 requested = bound(requestRaw, 1, supply);
        _request(alice, requested);
        _priceDue();
        uint256 liquidPool = _g(nav + 1 - reserve, supply);
        uint256 liquid = Math.mulDiv(requested, liquidPool, supply);
        assertEq(bank.redeemBatch(1).assets, liquid);
        uint256 active = bank.totalAssets();
        _settle(held, cost);
        uint256 h = _g(nav + 1 - cost, supply) - liquidPool;
        uint256 u = reserve - cost - h;
        IBank.RecoveryEpoch memory epoch = bank.recoveryEpoch(1);
        assertEq(epoch.recoveredAssets, h);
        assertEq(epoch.protocolAssets, u);
        assertEq(epoch.backingAssets, h);
        assertEq(bank.protocolFeesPayable(), u + (requested == supply ? nav + 1 - reserve - liquidPool : 0));
        assertEq(bank.totalProtocolFeeAccrued(), 0);
        vm.prank(alice);
        assertEq(bank.redeem(requested, alice, alice), liquid);
        assertEq(_claimRecovery(1, alice), h);
        assertEq(bank.recoveryBacking(), 0);
        assertEq(bank.totalAssets(), active);
    }

    function test_snapshotIncludesWalletsAndControllersAndIgnoresLaterSameBlockTransfers() external {
        _deposit(alice, 60e6);
        _deposit(bob, 40e6);
        uint256 oldBet = _hold(10e6, 20e6);
        vm.prank(alice);
        bank.requestRedeem(20e6, carol, alice);
        _request(bob, 10e6);
        uint256 blockBefore = block.number;
        _priceDue();
        assertEq(bank.getRecovery(1, alice).shares, 40e6);
        assertEq(bank.getRecovery(1, bob).shares, 40e6);
        assertEq(bank.getRecovery(1, carol).shares, 20e6);
        assertEq(bank.getRecovery(1, address(bank)).shares, 0);
        vm.prank(alice);
        bank.transfer(stranger, 40e6);
        _deposit(gov, 10e6);
        vm.prank(bob);
        bank.requestRedeem(5e6, carol, bob);
        vm.prank(carol);
        bank.cancelRedeemRequest(carol);
        assertEq(block.number, blockBefore, "the ownership changes really occur in the activation block");
        assertEq(bank.getRecovery(1, stranger).shares, 0);
        assertEq(bank.getRecovery(1, gov).shares, 0);
        assertEq(bank.getRecovery(1, alice).shares, 40e6);
        assertEq(bank.getRecovery(1, carol).shares, 20e6);
        bank.refundBet(oldBet, 10e6);
        assertEq(_claimRecovery(1, alice), 4e6);
        assertEq(_claimRecovery(1, bob), 4e6);
        assertEq(_claimRecovery(1, carol), 2e6);
        _request(stranger, 1e6);
        _priceDue();
        assertEq(bank.getRecovery(2, stranger).shares, 40e6);
        assertEq(bank.getRecovery(1, stranger).shares, 0);
    }

    function test_queuedQuoteUsesQueuedUnitsWhileSealedRecoveryIncludesTheWholeOwner() external {
        _deposit(alice, 60e6);
        _deposit(bob, 40e6);
        _hold(10e6, 20e6);
        _request(alice, 20e6);
        _request(bob, 10e6);
        (uint256 liquid, uint256 upper) = bank.quoteQueuedRedeem(alice);
        uint256 wholeRecovery = _g(110e6, 100e6) - _g(90e6, 100e6);
        assertEq(liquid, 18e6);
        assertEq(upper, Math.mulDiv(20e6, wholeRecovery, 100e6));
        assertEq(bank.getRecovery(1, alice).shares, 0, "an unsealed epoch has no historical entitlement");
        _priceDue();
        IBank.RecoveryPosition memory r = bank.getRecovery(1, alice);
        assertEq(r.shares, 60e6);
        assertEq(r.claimableAssets, 0);
        assertEq(r.claimedAssets, 0);
        assertEq(r.pendingAssets, Math.mulDiv(60e6, wholeRecovery, 100e6));
        (liquid, upper) = bank.quoteQueuedRedeem(alice);
        assertEq(liquid + upper, 0);
    }

    function test_partialRecoveryIsClaimableWhileAnotherOldHoldRemainsOpen() external {
        _deposit(alice, 50e6);
        _deposit(bob, 50e6);
        uint256 stuck = _hold(1e6, 20e6);
        uint256 resolved = _hold(1e6, 20e6);
        _request(alice, 10e6);
        _priceDue();
        _settle(resolved, 4e6);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
        assertEq(bank.recoveryEpoch(1).recoveredAssets, 16e6);
        uint256 active = bank.totalAssets();
        assertEq(_claimRecovery(1, alice), 8e6);
        assertEq(_claimRecovery(1, bob), 8e6);
        assertEq(bank.recoveryBacking(), 20e6, "remaining reserve cannot be withdrawn");
        IBank.RecoveryPosition memory r = bank.getRecovery(1, alice);
        assertEq(r.claimableAssets, 0);
        assertEq(r.claimedAssets, 8e6);
        assertEq(r.pendingAssets, Math.mulDiv(50e6, _g(98e6, 100e6) - _g(62e6, 100e6), 100e6) - 8e6);
        bank.syncRecovery(1, alice);
        assertFalse(bank.getRecovery(1, alice).finalSynced);
        bank.refundBet(stuck, 1e6);
        assertEq(_claimRecovery(1, alice), 9_500_000);
        assertEq(_claimRecovery(1, bob), 9_500_000);
        assertEq(bank.totalAssets(), active);
        assertEq(bank.recoveryBacking(), 0);
    }

    function test_recoveryAuthorizationPauseAndRepeatedTransferFailurePreserveRights() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
        uint256 oldBet = _hold(100e6, 200e6);
        _request(alice, 500e6);
        _priceDue();
        bank.refundBet(oldBet, 100e6);
        vm.prank(alice);
        bank.approve(bob, type(uint256).max);
        vm.prank(bob);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.claimRecovery(1, bob, alice);
        vm.prank(alice);
        bank.setOperator(carol, true);
        vm.prank(gov);
        bank.setRiskInPaused(true);
        vm.prank(carol);
        vm.expectRevert(IBank.RiskInPaused.selector);
        bank.claimRecovery(1, stranger, alice);
        vm.prank(stranger);
        bank.syncRecovery(1, alice);
        assertTrue(bank.getRecovery(1, alice).finalSynced);
        assertEq(bank.getRecovery(1, alice).claimableAssets, 50e6, "views retain entitlement during pause");
        _request(alice, 100e6);
        vm.prank(alice);
        bank.cancelRedeemRequest(alice);
        vm.prank(gov);
        bank.setRiskInPaused(false);
        uint256 backing = bank.recoveryBacking();
        uint256 active = bank.totalAssets();
        asset.setBlocked(stranger, true);
        for (uint256 i; i < 2; ++i) {
            vm.prank(carol);
            vm.expectRevert(bytes("blocked"));
            bank.claimRecovery(1, stranger, alice);
            assertEq(bank.getRecovery(1, alice).claimedAssets, 0);
            assertEq(bank.getRecovery(1, alice).claimableAssets, 50e6);
            assertEq(bank.recoveryBacking(), backing);
            assertEq(bank.totalAssets(), active);
        }
        asset.setBlocked(stranger, false);
        vm.expectEmit(true, true, true, true, address(bank));
        emit IBank.RecoveryClaimed(1, alice, stranger, carol, 50e6);
        vm.prank(carol);
        assertEq(bank.claimRecovery(1, stranger, alice), 50e6);
        assertEq(asset.balanceOf(stranger), 50e6);
        assertEq(asset.balanceOf(carol), 0);
        assertEq(bank.getRecovery(1, alice).shares, 1_000e6);
        assertEq(bank.totalAssets(), active);
        vm.recordLogs();
        assertEq(_claimRecovery(1, alice), 0);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            assertTrue(logs[i].emitter != address(asset));
        }
        vm.prank(alice);
        bank.setOperator(carol, false);
        vm.prank(carol);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.claimRecovery(1, carol, alice);
    }

    function test_finalSyncReleasesOnlyDustAndKeepsAssignedUnclaimedRecoveryBacked() external {
        _deposit(alice, 2);
        _deposit(bob, 1);
        asset.mint(address(bank), 2);
        uint256 oldBet = _hold(1, 5);
        _request(alice, 2);
        _priceDue();
        _settle(oldBet, 0);
        assertEq(bank.recoveryEpoch(1).recoveredAssets, 2);
        assertEq(bank.recoveryBacking(), 2);
        assertEq(bank.protocolFeesPayable(), 3);
        bank.syncRecovery(1, alice);
        assertEq(bank.recoveryBacking(), 2);
        vm.prank(stranger);
        bank.syncRecovery(1, bob);
        assertEq(bank.recoveryBacking(), 1, "Alice's one assigned but unclaimed unit stays backed");
        assertEq(bank.protocolFeesPayable(), 4);
        assertEq(bank.totalProtocolFeeAccrued(), 0);
        assertEq(bank.getRecovery(1, alice).claimedAssets, 0);
        bank.syncRecovery(1, alice);
        bank.syncRecovery(1, bob);
        assertEq(bank.recoveryBacking(), 1);
        assertEq(bank.protocolFeesPayable(), 4);
        _deposit(stranger, 10);
        uint256 active = bank.totalAssets();
        vm.prank(gov);
        bank.claimProtocolFees(4, gov);
        assertEq(_claimRecovery(1, alice), 1);
        assertEq(_claimRecovery(1, bob), 0);
        assertEq(bank.getRecovery(1, stranger).shares, 0);
        assertEq(bank.totalAssets(), active);
        assertEq(bank.recoveryBacking(), 0);
    }

    function test_zeroLiquidFullExitDoesNotBlockALaterFundedFullExit() external {
        _deposit(alice, 100);
        uint256 oldBet = _hold(1, 101);
        _request(alice, 100);
        _priceDue();
        assertEq(bank.totalSupply(), 0);
        assertEq(bank.totalAssets(), 0);
        vm.prank(alice);
        assertEq(bank.redeem(100, alice, alice), 0);
        assertEq(bank.getRecovery(1, alice).shares, 100);
        assertEq(_deposit(bob, 20), 20);
        uint256 newer = _hold(1, 2);
        _request(bob, 20);
        _priceDue();
        vm.prank(bob);
        assertEq(bank.redeem(20, bob, bob), 19);
        assertEq(bank.recoveryEpoch(1).remainingHolds, 1);
        assertEq(bank.recoveryEpoch(1).remainingReserve, 101);
        _settle(newer, 1);
        assertEq(_claimRecovery(2, bob), 1);
        assertEq(bank.getRecovery(1, bob).shares, 0);
        _settle(oldBet, 0);
        assertEq(_claimRecovery(1, alice), 100);
        assertEq(bank.protocolFeesPayable(), 1);
        assertEq(bank.recoveryBacking(), 0);
        assertEq(bank.totalAssets(), 0);
        assertEq(bank.totalSupply(), 0);
    }

    function test_fullExitLiquidDustCannotBeInheritedAfterANewDeposit() external {
        _deposit(alice, 1);
        _deposit(bob, 1);
        _winBet(1, 2);
        _request(alice, 1);
        _request(bob, 1);
        _priceDue();
        assertTrue(bank.redeemBatch(1).fullExit);
        _deposit(stranger, 10);
        bank.syncRedeem(alice);
        bank.syncRedeem(bob);
        assertEq(bank.protocolFeesPayable(), 1);
        assertEq(bank.totalProtocolFeeAccrued(), 0);
        assertEq(bank.totalAssets(), 10);
        assertEq(bank.exitPayable(), 0);
    }

    function _g(uint256 assets_, uint256 supply_) internal pure returns (uint256) {
        return Math.min(Math.mulDiv(supply_, assets_ + 1e6, supply_ + 1e6), assets_);
    }

    function _claimRecovery(uint256 epoch, address owner) internal returns (uint256) {
        vm.prank(owner);
        return bank.claimRecovery(epoch, owner, owner);
    }

    function _sel(string memory signature) internal pure returns (bytes4) {
        return bytes4(keccak256(bytes(signature)));
    }

    function _deposit(address lp, uint256 amount) internal returns (uint256 shares) {
        return _depositTo(bank, lp, amount);
    }

    function _depositTo(Bank target, address lp, uint256 amount) internal returns (uint256 shares) {
        asset.mint(lp, amount);
        vm.startPrank(lp);
        asset.approve(address(target), type(uint256).max);
        shares = target.deposit(amount, lp);
        vm.stopPrank();
    }

    function _request(address lp, uint256 shares) internal {
        if (shares == 0) return;
        vm.prank(lp);
        bank.requestRedeem(shares, lp, lp);
    }

    function _hold(uint256 stake, uint256 reserved) internal returns (uint256 betId) {
        betId = nextBetId++;
        bank.holdBet(betId, player, stake, reserved, bytes32(betId));
    }

    function _settle(uint256 betId, uint256 payout) internal {
        _settleOn(bank, betId, payout);
    }

    function _settleOn(Bank target, uint256 betId, uint256 payout) internal {
        SSOTTypes.XPAward[] memory none;
        target.settleBet(betId, payout, payout, 0, 0, none);
    }

    /// @dev A player bet of `stake` that wins `payout`: the pool's NAV falls by `payout - stake`.
    function _winBet(uint256 stake, uint256 payout) internal {
        _settle(_hold(stake, payout), payout);
    }

    function _priceDue() internal {
        vm.warp(bank.redeemBatch(bank.currentEpoch()).cutoff);
        bank.activateBatch();
    }

    function _freshBank() internal returns (Bank fresh) {
        fresh = new Bank(address(asset), gov, 0, "LP USDC 2", "lpUSDC2", 6);
        vm.prank(gov);
        fresh.setSettlementRouterOnce(address(this));
        vm.prank(player);
        asset.approve(address(fresh), type(uint256).max);
    }
}
