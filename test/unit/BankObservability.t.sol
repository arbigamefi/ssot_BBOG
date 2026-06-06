// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract BankObservabilityTest is Test {
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    address internal gov = address(0xA11CE);
    address internal alice = address(0xA11CE1);
    address internal bob = address(0xB0B);
    address internal player = address(0xBEEF);

    MockERC20 internal asset;
    Bank internal bank;

    function setUp() external {
        asset = new MockERC20("USD Coin", "USDC", 6);
        bank = new Bank(address(asset), gov, 0, "LP USDC", "lpUSDC", 6);

        vm.prank(gov);
        bank.setSettlementRouterOnce(address(this));
    }

    function test_erc4626EventsAndOwnerScopedMaxWithdraw() external {
        asset.mint(alice, 1_000e6);

        vm.startPrank(alice);
        asset.approve(address(bank), type(uint256).max);

        vm.expectEmit(true, true, false, true, address(bank));
        emit Deposit(alice, alice, 100e6, 100e6);
        uint256 shares = bank.deposit(100e6, alice);
        assertEq(shares, 100e6, "initial shares should be 1:1");

        assertEq(bank.maxWithdraw(alice), 100e6, "owner max withdraw should use owner shares");
        assertEq(bank.maxWithdraw(bob), 0, "non-owner max withdraw must not expose global bank cap");

        vm.expectEmit(true, true, true, true, address(bank));
        emit Withdraw(alice, alice, alice, 25e6, 25e6);
        uint256 burned = bank.withdraw(25e6, alice, alice);
        assertEq(burned, 25e6, "withdraw should burn expected shares");
        assertEq(bank.maxWithdraw(alice), 75e6, "max withdraw should track remaining owner shares");

        vm.expectEmit(true, true, false, true, address(bank));
        emit Deposit(alice, bob, 10e6, 10e6);
        uint256 assetsIn = bank.mint(10e6, bob);
        assertEq(assetsIn, 10e6, "mint should use 1:1 assets at current share price");
        vm.stopPrank();

        vm.prank(bob);
        vm.expectEmit(true, true, true, true, address(bank));
        emit Withdraw(bob, bob, bob, 10e6, 10e6);
        uint256 assetsOut = bank.redeem(10e6, bob, bob);
        assertEq(assetsOut, 10e6, "redeem should emit and return expected assets");
    }

    function test_performanceCountersTrackSettledTurnoverPayoutFeesAndRefunds() external {
        asset.mint(gov, 1_000e6);
        asset.mint(player, 200e6);

        vm.startPrank(gov);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(1_000e6, gov);
        vm.stopPrank();

        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);

        bank.holdBet(1, player, 100e6, 250e6, bytes32(uint256(1)));
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);
        bank.settleBet(1, 140e6, 130e6, 20e6, 3e6, awards);

        assertEq(bank.playerTurnover(player), 80e6, "player turnover should exclude refunded stake");
        assertEq(bank.protocolFeesPayable(), 3e6, "payable protocol fee should accrue");
        assertEq(bank.totalTurnover(), 80e6, "settled turnover should exclude refund");
        assertEq(bank.totalPayoutGross(), 140e6, "gross payout should accumulate");
        assertEq(bank.totalPayoutNet(), 130e6, "net payout should accumulate");
        assertEq(bank.totalRefunded(), 20e6, "settle refund should accumulate");
        assertEq(bank.totalFeeOnPayout(), 10e6, "fee on payout should accumulate");
        assertEq(bank.totalProtocolFeeAccrued(), 3e6, "lifetime protocol fee should accumulate");
        assertEq(bank.totalBetsHeld(), 1, "held counter should increment");
        assertEq(bank.totalBetsSettled(), 1, "settled counter should increment");
        assertEq(bank.totalBetsRefunded(), 0, "refund counter should not increment on settle refund");

        bank.holdBet(2, player, 50e6, 70e6, bytes32(uint256(2)));
        bank.refundBet(2, 50e6);

        assertEq(bank.totalTurnover(), 80e6, "full refund should not add turnover");
        assertEq(bank.totalRefunded(), 70e6, "refund path should accumulate refunded stake");
        assertEq(bank.totalBetsHeld(), 2, "second hold should increment held counter");
        assertEq(bank.totalBetsSettled(), 1, "settled counter should remain unchanged");
        assertEq(bank.totalBetsRefunded(), 1, "refund counter should increment");

        (
            uint256 turnover,
            uint256 payoutGross,
            uint256 payoutNet,
            uint256 refunded,
            uint256 feeOnPayout,
            uint256 protocolFeeAccrued,
            uint256 betsHeld,
            uint256 betsSettled,
            uint256 betsRefunded
        ) = bank.getPerformance();

        assertEq(turnover, 80e6, "aggregate turnover");
        assertEq(payoutGross, 140e6, "aggregate gross payout");
        assertEq(payoutNet, 130e6, "aggregate net payout");
        assertEq(refunded, 70e6, "aggregate refunded");
        assertEq(feeOnPayout, 10e6, "aggregate payout fee");
        assertEq(protocolFeeAccrued, 3e6, "aggregate protocol fee");
        assertEq(betsHeld, 2, "aggregate held bets");
        assertEq(betsSettled, 1, "aggregate settled bets");
        assertEq(betsRefunded, 1, "aggregate refunded bets");
    }

    function test_performanceCountersAreBankAndAssetScoped() external {
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        Bank wethBank = new Bank(address(weth), gov, 0, "LP WETH", "lpWETH", 18);

        vm.prank(gov);
        wethBank.setSettlementRouterOnce(address(this));

        asset.mint(gov, 1_000e6);
        weth.mint(gov, 100 ether);
        asset.mint(player, 20e6);
        weth.mint(player, 2 ether);

        vm.startPrank(gov);
        asset.approve(address(bank), type(uint256).max);
        weth.approve(address(wethBank), type(uint256).max);
        bank.deposit(1_000e6, gov);
        wethBank.deposit(100 ether, gov);
        vm.stopPrank();

        vm.startPrank(player);
        asset.approve(address(bank), type(uint256).max);
        weth.approve(address(wethBank), type(uint256).max);
        vm.stopPrank();

        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        bank.holdBet(1, player, 10e6, 20e6, bytes32(uint256(1)));
        bank.settleBet(1, 11e6, 10e6, 0, 1e6, awards);

        wethBank.holdBet(2, player, 1 ether, 2 ether, bytes32(uint256(2)));
        wethBank.settleBet(2, 0.8 ether, 0.79 ether, 0, 0.01 ether, awards);

        assertEq(bank.totalTurnover(), 10e6, "USDC turnover");
        assertEq(bank.totalPayoutGross(), 11e6, "USDC gross payout");
        assertEq(bank.totalProtocolFeeAccrued(), 1e6, "USDC protocol fee");
        assertEq(bank.totalBetsSettled(), 1, "USDC settled count");

        assertEq(wethBank.totalTurnover(), 1 ether, "WETH turnover");
        assertEq(wethBank.totalPayoutGross(), 0.8 ether, "WETH gross payout");
        assertEq(wethBank.totalProtocolFeeAccrued(), 0.01 ether, "WETH protocol fee");
        assertEq(wethBank.totalBetsSettled(), 1, "WETH settled count");
    }
}
