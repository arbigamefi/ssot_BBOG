// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {IBank, IBankVault} from "../../src/core/interfaces/IBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";

/// @notice ADR-0034 in the Bank: ERC-7540 redemption Requests, time cutoffs, drained batch pricing, claims and
///         player payables. This test is the Bank's SettlementRouter.
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
        bank.settleBatch();
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

    function test_cutoffIsTheFirstBoundaryStrictlyAfterTheFirstRequest() external {
        _deposit(alice, 1_000e6);
        _request(alice, 1e6);
        assertEq(bank.redeemBatch(1).cutoff, 101 * DAY);

        // A later request before the cutoff joins the same batch.
        vm.warp(101 * DAY - 1);
        _request(alice, 1e6);
        assertEq(bank.nextBatchId(), 2);
        assertEq(bank.redeemBatch(1).shares, 2e6);

        // A request exactly on the cutoff joins the next batch, whose cutoff is the next boundary.
        vm.warp(101 * DAY);
        _request(alice, 1e6);
        assertEq(bank.nextBatchId(), 3);
        assertEq(bank.redeemBatch(2).cutoff, 102 * DAY);
    }

    function test_bettingClosesAtTheCutoffWithoutAnyCall() external {
        _deposit(alice, 1_000e6);
        _request(alice, 100e6);

        vm.warp(101 * DAY - 1);
        assertFalse(bank.redemptionDraining());
        uint256 betId = _hold(10e6, 20e6);

        vm.warp(101 * DAY);
        assertTrue(bank.redemptionDraining());
        vm.expectRevert(IBank.RedemptionDraining.selector);
        bank.holdBet(99, player, 10e6, 20e6, bytes32(0));

        // Deposits stay open, and the position opened before the cutoff still settles.
        _deposit(bob, 100e6);
        _settle(betId, 0);
        bank.settleBatch();
        assertFalse(bank.redemptionDraining(), "betting resumes once the batch is priced");
        _hold(10e6, 20e6);
    }

    function test_aRequestNeedingAThirdUnpricedBatchReverts() external {
        _deposit(alice, 1_000e6);
        _request(alice, 100e6); // batch 1, cutoff day 101
        _hold(10e6, 20e6); // keeps batch 1 draining

        vm.warp(101 * DAY + 1);
        _request(alice, 100e6); // batch 2, cutoff day 102
        vm.warp(102 * DAY);
        assertEq(bank.nextBatchId() - bank.firstUnpricedBatch(), 2);
        vm.prank(alice);
        vm.expectRevert(IBank.RedeemBatchesFull.selector);
        bank.requestRedeem(100e6, alice, alice);

        assertEq(bank.redeemBatch(1).cutoff, 101 * DAY, "no cutoff moves");
        assertEq(bank.redeemBatch(2).cutoff, 102 * DAY);
    }

    function test_cancelReturnsSharesToTheControllerBeforeTheCutoffOnly() external {
        _deposit(alice, 1_000e6);
        vm.prank(alice);
        bank.approve(bob, type(uint256).max);
        vm.prank(bob);
        bank.requestRedeem(300e6, bob, alice); // Bob controls Alice's former shares

        vm.prank(alice);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.cancelRedeemRequest(bob);

        vm.expectEmit(true, true, true, true, address(bank));
        emit IBank.RedeemRequestCancelled(bob, bob, 1, 300e6);
        vm.prank(bob);
        assertEq(bank.cancelRedeemRequest(bob), 300e6);
        assertEq(bank.balanceOf(bob), 300e6, "cancellation returns shares to the controller");
        assertEq(bank.balanceOf(address(bank)), 0);

        _request(alice, 100e6);
        vm.warp(101 * DAY);
        vm.prank(alice);
        vm.expectRevert(IBank.NothingToCancel.selector);
        bank.cancelRedeemRequest(alice);
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

        assertEq(bank.nextBatchId(), 1, "the empty batch frees its ID");
        assertEq(bank.redeemBatch(1).cutoff, 0);
        vm.warp(101 * DAY);
        assertFalse(bank.redemptionDraining(), "a retired batch never blocks betting");
        vm.expectRevert(IBank.NoBatchDue.selector);
        bank.settleBatch();
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
        bank.settleBatch();
        _request(alice, 1e6);
        assertEq(bank.redeemBatch(2).cutoff, 101 * DAY + 1 hours);
    }

    // ------------------------------------------------------------ pricing

    function test_settleBatchWaitsForTheCutoffEveryPositionAndUnpause() external {
        _deposit(alice, 1_000e6);
        _request(alice, 100e6);
        uint256 betId = _hold(10e6, 20e6);

        vm.expectRevert(abi.encodeWithSelector(IBank.OpenHolds.selector, 1));
        bank.settleBatch();
        _settle(betId, 0);
        vm.expectRevert(IBank.NoBatchDue.selector);
        bank.settleBatch();

        vm.warp(101 * DAY);
        vm.prank(gov);
        bank.setRiskInPaused(true);
        vm.expectRevert(IBank.RiskInPaused.selector);
        bank.settleBatch();
        vm.prank(gov);
        bank.setRiskInPaused(false);

        vm.expectEmit(true, false, false, true, address(bank));
        emit IBank.RedeemBatchPriced(1, 100e6, 100_999_000);
        vm.prank(stranger);
        assertEq(bank.settleBatch(), 1, "anyone can price a due batch");
        assertEq(bank.openHolds(), 0);
    }

    function test_profitablePoolPricesAtTheVirtualOffsetQuote() external {
        _deposit(alice, 1_000e6);
        _request(alice, 1_000e6);
        uint256 betId = _hold(100e6, 200e6);
        _settle(betId, 0); // NAV 1100 over 1000 shares

        _priceDue();
        // min(1000 * 1101 / 1001, 1000 * 1100 / 1000): the virtual quote, leaving its residual in the vault.
        assertEq(bank.redeemBatch(1).assets, 1_099_900_099);
        assertEq(bank.totalSupply(), 0);
        assertEq(bank.exitPayable(), 1_099_900_099);
        assertEq(bank.totalAssets(), 99_901);
    }

    function test_depletedPoolPricesAtItsRealEquity() external {
        // ADR-0034: S = 10e6, N = 5e6 and V = 1e6 quote 5,454,545 for the whole supply, but only 5,000,000 exist.
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
        second.settleBatch();
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

    function test_twoDueBatchesArePricedInOneCall() external {
        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
        _request(alice, 500e6);
        uint256 betId = _hold(100e6, 300e6);
        vm.warp(101 * DAY + 1);
        _request(bob, 500e6);
        vm.warp(102 * DAY);
        _settle(betId, 300e6); // NAV 1800 over 2000 shares

        assertEq(bank.settleBatch(), 2);
        assertEq(bank.redeemBatch(1).assets, 450e6);
        assertEq(bank.redeemBatch(2).assets, 450e6, "priced after the first, at the same real equity");
        assertEq(bank.firstUnpricedBatch(), 3);
        assertFalse(bank.redemptionDraining());
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
        emit IBank.RedeemRemainderReleased(1, 1);
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
        bank.settleBatch(); // prices Alice's second request together with Bob's
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

        // Shares sent to the Bank directly are not a Request and cannot be claimed or cancelled.
        vm.prank(alice);
        bank.transfer(address(bank), 100e6);
        assertEq(bank.pendingRedeemRequest(0, alice), 400e6);
        assertEq(bank.redeemBatch(1).shares, 400e6);
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

        bank.settleBatch();
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

    function test_payoutThatRanOutOfGasRevertsInsteadOfBecomingAPayable() external {
        _deposit(alice, 1_000e6);
        uint256 betId = _hold(100e6, 300e6);
        asset.setGasSink(player);
        SSOTTypes.XPAward[] memory none;
        vm.expectRevert(IBank.PayoutOutOfGas.selector);
        bank.settleBet{gas: 1_000_000}(betId, 300e6, 300e6, 0, 0, none);
        assertEq(bank.openHolds(), 1);
        assertEq(bank.playerPayableTotal(), 0);
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
        vm.warp(bank.redeemBatch(bank.firstUnpricedBatch()).cutoff);
        bank.settleBatch();
    }

    function _freshBank() internal returns (Bank fresh) {
        fresh = new Bank(address(asset), gov, 0, "LP USDC 2", "lpUSDC2", 6);
        vm.prank(gov);
        fresh.setSettlementRouterOnce(address(this));
        vm.prank(player);
        asset.approve(address(fresh), type(uint256).max);
    }
}
