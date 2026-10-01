// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";

/// @notice A second, independent test for each redemption guarantee that only one test in BankAsyncRedemption
///         used to catch (mutants M23, M25, M30-M32, M35, M37, M39, M41, M44, M49, M50). Every scenario here
///         differs from the original one. This test is the Bank's SettlementRouter.
contract BankRedemptionGuardsTest is Test {
    address internal gov = address(0xA11CE);
    address internal alice = address(0xA11CE1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA201);
    address internal dave = address(0xDA7E);
    address internal player = address(0xBEEF);
    address internal guardian = address(0x6A2D);
    address internal stranger = address(0x5712);

    BlacklistToken internal asset;
    Bank internal bank;
    uint256 internal nextBetId = 1;

    function setUp() external {
        vm.warp(200 days + 3 hours);
        asset = new BlacklistToken();
        bank = new Bank(address(asset), gov, 0, "LP USDC", "lpUSDC", 6, 1);
        vm.prank(gov);
        bank.setSettlementRouterOnce(address(this));
        asset.mint(player, 1_000_000_000e6);
        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);
    }

    // M23: the Bank's own escrow can never be the beneficiary of a Request.
    function test_theBankCannotControlARequest() external {
        _deposit(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank.requestRedeem(10e6, address(bank), alice);
        assertEq(bank.balanceOf(alice), 100e6);
        assertEq(bank.balanceOf(address(bank)), 0);
    }

    // M25: rescue cannot move queued shares, so activation burns exactly the queue.
    function test_rescueCannotSweepQueuedSharesBeforeActivation() external {
        _deposit(alice, 100e6);
        _deposit(bob, 100e6);
        _request(alice, 40e6);
        vm.prank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank.rescueToken(address(bank), gov, 40e6);
        _activate();
        assertEq(bank.totalSupply(), 160e6, "exactly the queued shares were burned");
        assertEq(bank.balanceOf(gov), 0);
    }

    // M30: neither exit claim path accepts a caller that is not the controller or its operator.
    function test_aStrangerCannotClaimAnotherControllersExit() external {
        _deposit(alice, 100e6);
        _request(alice, 100e6);
        _activate();
        vm.startPrank(stranger);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.redeem(1e6, stranger, alice);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.withdraw(1e6, stranger, alice);
        vm.stopPrank();
        assertEq(asset.balanceOf(stranger), 0);
        assertEq(bank.maxWithdraw(alice), 100e6);
    }

    // M31: across every partial withdrawal, claimable shares remain while claimable assets remain.
    function test_everyPartialWithdrawalKeepsSharesWhileAssetsRemain() external {
        _deposit(alice, 10);
        _deposit(bob, 1_000e6);
        _loseBet(1_000e6); // the share price roughly doubles
        _request(alice, 3);
        _activate();
        (, uint256 shares, uint256 assets) = bank.redeemRequestOf(alice);
        assertEq(shares, 3);
        assertEq(assets, 5);
        for (uint256 amount = 1; amount < assets; ++amount) {
            uint256 snapshot = vm.snapshotState();
            uint256 needed = (amount * shares + assets - 1) / assets;
            vm.prank(alice);
            if (needed == shares) {
                vm.expectRevert(IBank.ClaimWouldStrandAssets.selector);
                bank.withdraw(amount, alice, alice);
            } else {
                bank.withdraw(amount, alice, alice);
                (, uint256 leftShares, uint256 leftAssets) = bank.redeemRequestOf(alice);
                assertGt(leftShares, 0, "assets remain, so shares must remain");
                assertEq(leftAssets, assets - amount);
            }
            assertTrue(vm.revertToState(snapshot));
        }
    }

    // M32: a finite allowance caps the total a spender can request, across several requests.
    function test_aFiniteAllowanceCapsRepeatedRequests() external {
        _deposit(alice, 100e6);
        vm.prank(alice);
        bank.approve(bob, 30e6);
        vm.startPrank(bob);
        bank.requestRedeem(20e6, bob, alice);
        vm.expectRevert(Errors.InsufficientAllowance.selector);
        bank.requestRedeem(20e6, bob, alice);
        bank.requestRedeem(10e6, bob, alice);
        vm.stopPrank();
        assertEq(bank.allowance(alice, bob), 0);
        assertEq(bank.pendingRedeemRequest(0, bob), 30e6);
    }

    // M35: an overdue queue that nobody has activated keeps accepting requests from new controllers.
    function test_aLateRequestJoinsTheOverdueQueue() external {
        _deposit(alice, 100e6);
        _deposit(bob, 100e6);
        _request(alice, 10e6);
        uint256 epoch = bank.currentEpoch();
        vm.warp(bank.redeemBatch(epoch).cutoff + 1 hours);
        _request(bob, 5e6);
        assertEq(bank.currentEpoch(), epoch);
        assertEq(bank.redeemBatch(epoch).shares, 15e6);
        assertEq(bank.pendingRedeemRequest(0, bob), 5e6);
        bank.activateBatch();
        assertEq(bank.maxRedeem(bob), 5e6);
    }

    // M37: a guardian pause does not block paying a refused refund to its player.
    function test_aGuardianPauseDoesNotBlockAPayableRefund() external {
        _deposit(alice, 100e6);
        uint256 betId = _hold(5e6, 10e6);
        asset.setBlocked(player, true);
        bank.refundBet(betId, 5e6);
        assertEq(bank.playerPayable(player), 5e6);
        vm.prank(gov);
        bank.setGuardian(guardian);
        vm.prank(guardian);
        bank.setRiskInPaused(true);
        asset.setBlocked(player, false);
        uint256 before = asset.balanceOf(player);
        vm.prank(stranger);
        assertEq(bank.claimPlayerPayable(player), 5e6);
        assertEq(asset.balanceOf(player), before + 5e6);
    }

    // M39: before synchronization, views report exactly what synchronization then records, under rounding.
    function test_viewsMatchSynchronizedEntitlementsUnderRounding() external {
        _deposit(alice, 1e6);
        _deposit(bob, 1e6);
        _deposit(carol, 1e6);
        _deposit(dave, 7e6);
        _loseBet(1_000_004);
        _request(alice, 1e6);
        _request(bob, 1e6);
        _request(carol, 1e6);
        _activate();
        assertEq(bank.redeemBatch(1).assets, 3_299_971, "three floors of 1,099,990 leave one unit");
        address[3] memory controllers = [alice, bob, carol];
        for (uint256 i; i < 3; ++i) {
            (, uint256 shares, uint256 viewAssets) = bank.redeemRequestOf(controllers[i]);
            assertEq(bank.maxWithdraw(controllers[i]), viewAssets);
            bank.syncRedeem(controllers[i]);
            (, uint256 storedShares, uint256 storedAssets) = bank.redeemRequestOf(controllers[i]);
            assertEq(storedShares, shares);
            assertEq(storedAssets, viewAssets);
            assertEq(storedAssets, 1_099_990);
        }
        assertEq(bank.exitPayable(), 3 * 1_099_990, "the partial-exit remainder left exitPayable");
    }

    // M41: the last cancellation retires the queue, so keepers see nothing to activate.
    function test_theLastCancellationRetiresTheQueueForKeepers() external {
        _deposit(alice, 100e6);
        _request(alice, 10e6);
        uint256 epoch = bank.currentEpoch();
        vm.expectEmit(true, false, false, false, address(bank));
        emit IBank.RedeemBatchRetired(epoch);
        vm.prank(alice);
        bank.cancelRedeemRequest(alice);
        IBank.RedeemBatch memory batch = bank.redeemBatch(epoch);
        assertEq(batch.cutoff, 0);
        assertEq(batch.shares, 0);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(IBank.NoBatchDue.selector);
        bank.activateBatch();
    }

    // M44: an old epoch's hold cannot book more cost than its reserve, even after it was sealed.
    function test_aHistoricalSettlementCostMustFitItsReserve() external {
        _deposit(alice, 100e6);
        uint256 betId = _hold(10e6, 20e6);
        _request(alice, 50e6);
        _activate();
        SSOTTypes.XPAward[] memory none;
        vm.expectRevert(abi.encodeWithSelector(IBank.ReservedTooSmall.selector, betId, 20e6, 21e6));
        bank.settleBet(betId, 15e6, 15e6, 0, 6e6, none);
        bank.settleBet(betId, 15e6, 15e6, 0, 5e6, none);
        assertEq(bank.recoveryEpoch(1).settledCost, bank.recoveryEpoch(1).initialReserve);
        assertEq(bank.recoveryEpoch(1).recoveredAssets, 0);
    }

    // M49: nobody but the controller or its operator can send historical recovery to a receiver.
    function test_aStrangerCannotRedirectHistoricalRecovery() external {
        _deposit(alice, 100e6);
        uint256 betId = _hold(10e6, 20e6);
        _request(alice, 50e6);
        _activate();
        SSOTTypes.XPAward[] memory none;
        bank.settleBet(betId, 0, 0, 0, 0, none);
        vm.prank(stranger);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.claimRecovery(1, stranger, alice);
        assertEq(asset.balanceOf(stranger), 0);
        vm.prank(alice);
        assertGt(bank.claimRecovery(1, alice, alice), 0);
    }

    // M50: a full exit's allocation dust goes to protocol capital even when a new LP has deposited in between.
    function test_fullExitDustGoesToProtocolAfterANewDeposit() external {
        _deposit(alice, 1);
        _deposit(bob, 1);
        _deposit(carol, 1);
        _loseBet(335); // NAV 338 over 3 shares
        _request(alice, 1);
        _request(bob, 1);
        _request(carol, 1);
        _activate();
        assertEq(bank.redeemBatch(1).assets, 4);
        assertEq(bank.protocolFeesPayable(), 334, "the full-exit liquid residual");
        bank.syncRedeem(alice);
        bank.syncRedeem(bob);
        _deposit(dave, 1_000e6);
        uint256 navBefore = bank.totalAssets();
        vm.prank(stranger);
        bank.syncRedeem(carol);
        assertEq(bank.protocolFeesPayable(), 335, "the last unit of dust is protocol capital");
        assertEq(bank.totalAssets(), navBefore, "the new LP gains nothing from the old batch");
    }

    // ------------------------------------------------------------ helpers

    function _deposit(address lp, uint256 amount) internal {
        asset.mint(lp, amount);
        vm.startPrank(lp);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(amount, lp);
        vm.stopPrank();
    }

    function _request(address lp, uint256 shares) internal {
        vm.prank(lp);
        bank.requestRedeem(shares, lp, lp);
    }

    function _activate() internal {
        vm.warp(bank.redeemBatch(bank.currentEpoch()).cutoff);
        bank.activateBatch();
    }

    function _hold(uint256 stake, uint256 reserved) internal returns (uint256 betId) {
        betId = nextBetId++;
        bank.holdBet(betId, player, stake, reserved, bytes32(betId), player);
    }

    /// @dev A player bet of `amount` that loses: the pool's NAV rises by `amount`.
    function _loseBet(uint256 amount) internal {
        uint256 betId = _hold(amount, amount);
        SSOTTypes.XPAward[] memory none;
        bank.settleBet(betId, 0, 0, 0, 0, none);
    }
}
