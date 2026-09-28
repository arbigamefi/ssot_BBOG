// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

/// @notice The security scan's two counterexamples ("LP exit shifts unsettled risk", 2026-09-28), rewritten as
///         safety assertions for liquid exits plus historical recovery (ADR-0035). The synchronous Bank of `979be07a6` fails both: there the
///         bettor-LP exits with 1,049,975,012 instead of 1,000,000,000, and the result observer takes 99,950,025
///         from the remaining LP. Here unresolved reserves keep their original owners after liquid cash is claimed.
/// @dev Uses the real Bank with this test as its router, as in BankObservabilityTest. The second test models a
///      known result; it does not run a VRF or a hub end to end.
contract BankPendingExposureTest is Test {
    address internal gov = address(0xA11CE);
    address internal alice = address(0xA11CE1);
    address internal bob = address(0xB0B);
    address internal player = address(0xBEEF);

    MockERC20 internal asset;
    Bank internal bank;

    function setUp() external {
        asset = new MockERC20("USD Coin", "USDC", 6);
        bank = new Bank(address(asset), gov, 0, "LP USDC", "lpUSDC", 6);
        vm.startPrank(gov);
        bank.setSettlementRouterOnce(address(this));
        bank.setWithdrawalBufferBps(1000);
        vm.stopPrank();

        _deposit(alice, 1_000e6);
        _deposit(bob, 1_000e6);
    }

    function test_lpBettorCannotExitAgainstOwnPendingStake() external {
        // Alice owns LP shares and funds the wager, then asks to exit while it is open.
        _hold(alice);
        _requestAll(alice);
        vm.warp(_cutoff());
        bank.activateBatch();
        vm.prank(alice);
        uint256 liquid = bank.redeem(1_000e6, alice, alice);
        assertEq(liquid, 950e6, "the open reserve is not withdrawable cash");
        bank.refundBet(1, 100e6);
        vm.prank(alice);
        uint256 recovered = bank.claimRecovery(1, alice, alice);

        assertEq(liquid + recovered, 1_000e6, "liquid exit plus actual recovery returns principal only");
        assertEq(asset.balanceOf(alice), 1_100e6, "principal and refunded stake, nothing extracted");
        assertEq(bank.totalAssets(), 950e6);
        assertEq(bank.getRecovery(1, bob).claimableAssets, 50e6, "the staying owner also keeps old recovery");
        assertEq(bank.totalAssets() + bank.getRecovery(1, bob).claimableAssets, 1_000e6);
        assertEq(_exitAll(bob), 950e6);
        vm.prank(bob);
        assertEq(bank.claimRecovery(1, bob, bob), 50e6);
        assertEq(asset.balanceOf(bob), 1_000e6);
        assertEq(asset.balanceOf(address(bank)), 0);
        assertEq(bank.totalBetsRefunded(), 1);
    }

    function test_resultObserverExitBearsThePendingPayout() external {
        _hold(player);
        uint256 snapshot = vm.snapshotState();

        // Control ordering: the win settles before Alice asks to exit.
        _settleWinningWager();
        uint256 settledFirst = _exitAll(alice);
        uint256 remainingNavSettledFirst = bank.totalAssets();

        assertTrue(vm.revertToState(snapshot));

        // A result observer asks to exit while the Bank still sees the winning bet open.
        _requestAll(alice);
        vm.warp(_cutoff());
        bank.activateBatch();
        vm.prank(alice);
        uint256 exitedFirst = bank.redeem(1_000e6, alice, alice);
        _settleWinningWager();
        vm.prank(alice);
        exitedFirst += bank.claimRecovery(1, alice, alice);

        // 1,900 NAV over 2,000 shares: the real-equity ceiling pays 950, below the 950.024987 virtual quote.
        assertEq(settledFirst, 950e6);
        assertEq(exitedFirst, settledFirst, "asking to exit first gains nothing");
        assertEq(bank.totalAssets(), remainingNavSettledFirst, "the remaining LP bears nothing extra");
        assertEq(bank.totalAssets(), 950e6);
        assertEq(asset.balanceOf(player), 200e6, "the identical player payout is honored");
        assertEq(bank.totalReserved(), 0);
        assertEq(bank.totalBetsSettled(), 1);
    }

    function _deposit(address owner, uint256 amount) internal {
        asset.mint(owner, amount);
        vm.startPrank(owner);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(amount, owner);
        vm.stopPrank();
    }

    function _hold(address bettor) internal {
        asset.mint(bettor, 100e6);
        vm.prank(bettor);
        asset.approve(address(bank), type(uint256).max);
        bank.holdBet(1, bettor, 100e6, 200e6, bytes32(uint256(1)));
    }

    function _settleWinningWager() internal {
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);
        bank.settleBet(1, 200e6, 200e6, 0, 0, awards);
    }

    function _requestAll(address lp) internal {
        uint256 shares = bank.balanceOf(lp);
        vm.prank(lp);
        bank.requestRedeem(shares, lp, lp);
    }

    function _cutoff() internal view returns (uint256) {
        return bank.redeemBatch(bank.currentEpoch()).cutoff;
    }

    function _exitAll(address lp) internal returns (uint256 assets) {
        uint256 shares = bank.balanceOf(lp);
        _requestAll(lp);
        vm.warp(_cutoff());
        bank.activateBatch();
        vm.prank(lp);
        assets = bank.redeem(shares, lp, lp);
    }
}
