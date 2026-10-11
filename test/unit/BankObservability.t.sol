// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {BankTestBase, TestRandomnessConsumer, DirectRouterFixture} from "../utils/BankTestBase.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";

import {Bank} from "../../src/core/Bank.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract BankObservabilityTest is BankTestBase {
    event DepositAdded(
        address indexed payer, address indexed owner, uint48 indexed depositId, uint128 assets, uint64 withdrawAfter
    );
    event DepositWithdrawn(
        address indexed owner, uint48 indexed depositId, uint40 percent, uint128 assets, uint64 withdrawAfter
    );

    address internal gov = address(0xA11CE);
    address internal alice = address(0xA11CE1);
    address internal bob = address(0xB0B);
    address internal player = address(0xBEEF);

    MockERC20 internal asset;
    Bank internal bank;

    function setUp() external {
        asset = new MockERC20("USD Coin", "USDC", 6);
        bank = new Bank(address(asset), gov, 0, 6, 1);

        vm.prank(gov);
        bank.setSettlementRouterOnce(address(this));
        _bindTestConsumer(bank);
    }

    function test_constructorRejectsDecimalsThatDoNotMatchAsset() external {
        vm.expectRevert(Errors.InvalidConfig.selector);
        new Bank(address(asset), gov, 0, 18, 1);
    }

    function test_nftDepositWithdrawalEventsAndSeparateCustody() external {
        LiquidityVault vault = LiquidityVault(bank.vault());
        asset.mint(alice, 100e6);
        vm.startPrank(alice);
        asset.approve(address(vault), 100e6);
        uint48 id = vault.getLastDepositId() + 1;
        vm.expectEmit(true, true, true, true, address(vault));
        emit DepositAdded(alice, alice, id, 100e6, uint64(block.timestamp + 1 days));
        assertEq(vault.addDeposit(100e6), id);
        vm.stopPrank();
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertEq(s.L, 100e6);
        assertEq(s.vaultCash, 100e6);
        assertEq(s.bankCash, 0);
        vm.warp(block.timestamp + 1 days);
        vm.expectEmit(true, true, false, true, address(vault));
        emit DepositWithdrawn(alice, id, 1e12, 100e6, 0);
        vm.prank(alice);
        assertEq(vault.withdrawDeposit(id, 1e12), 100e6);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.getReserve(), 0);
        assertEq(asset.balanceOf(alice), 100e6);
    }

    function test_withdrawalBufferAccountsForReservedRiskOnFeeClaims() external {
        Bank bufferedBank = new Bank(address(asset), gov, 0, 6, 1);
        vm.prank(gov);
        bufferedBank.setSettlementRouterOnce(address(this));
        _bindTestConsumer(bufferedBank);
        vm.prank(gov);
        bufferedBank.setWithdrawalBufferBps(1000);

        asset.mint(alice, 1_000e6);
        asset.mint(player, 20e6);

        vm.startPrank(alice);
        asset.approve(address(bufferedBank.vault()), type(uint256).max);
        LiquidityVault(bufferedBank.vault()).addDepositFor(alice, 1_000e6);
        vm.stopPrank();

        vm.prank(player);
        asset.approve(address(bufferedBank), type(uint256).max);

        // A lost bet accrues a protocol fee, then an open bet reserves most of the pool.
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);
        bufferedBank.holdBet(1, player, 10e6, 20e6, bytes32(uint256(1)), player);
        bufferedBank.settleBet(1, 0, 0, 0, 5e6, awards);
        bufferedBank.holdBet(2, player, 10e6, 915e6, bytes32(uint256(2)), player);

        SSOTTypes.SSOT memory s = bufferedBank.getSSOT();
        assertEq(s.G, 1_015e6, "player stakes enter NAV while the bets are open");
        assertEq(s.withdrawalBuffer, 101_500_000);
        assertLt(s.G - s.R, s.withdrawalBuffer, "gross capacity is below the optional outflow buffer");

        vm.prank(gov);
        vm.expectRevert(IBank.OptionalOutflowDomainViolation.selector);
        bufferedBank.claimProtocolFees(5e6, gov);

        bufferedBank.refundBet(2, 10e6);
        vm.prank(gov);
        assertEq(bufferedBank.claimProtocolFees(5e6, gov), 5e6, "the buffer holds once the reserve is released");
    }

    function test_performanceCountersTrackSettledTurnoverPayoutFeesAndRefunds() external {
        asset.mint(gov, 1_000e6);
        asset.mint(player, 200e6);

        vm.startPrank(gov);
        asset.approve(address(bank.vault()), type(uint256).max);
        LiquidityVault(bank.vault()).addDepositFor(gov, 1_000e6);
        vm.stopPrank();

        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);

        bank.holdBet(1, player, 100e6, 250e6, bytes32(uint256(1)), player);
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

        bank.holdBet(2, player, 50e6, 70e6, bytes32(uint256(2)), player);
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
            uint256 betsRefunded,
            uint256 betsVoided,
            uint256 voided
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
        assertEq(betsVoided, 0, "aggregate voided bets");
        assertEq(voided, 0, "aggregate voided stake");
    }

    function test_performanceCountersAreBankAndAssetScoped() external {
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);
        Bank wethBank = new Bank(address(weth), gov, 0, 18, 1);

        vm.prank(gov);
        wethBank.setSettlementRouterOnce(address(this));
        _bindTestConsumer(wethBank);

        asset.mint(gov, 1_000e6);
        weth.mint(gov, 100 ether);
        asset.mint(player, 20e6);
        weth.mint(player, 2 ether);

        vm.startPrank(gov);
        asset.approve(address(bank.vault()), type(uint256).max);
        weth.approve(address(wethBank.vault()), type(uint256).max);
        LiquidityVault(bank.vault()).addDepositFor(gov, 1_000e6);
        LiquidityVault(wethBank.vault()).addDepositFor(gov, 100 ether);
        vm.stopPrank();

        vm.startPrank(player);
        asset.approve(address(bank), type(uint256).max);
        weth.approve(address(wethBank), type(uint256).max);
        vm.stopPrank();

        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        bank.holdBet(1, player, 10e6, 20e6, bytes32(uint256(1)), player);
        bank.settleBet(1, 11e6, 10e6, 0, 1e6, awards);

        wethBank.holdBet(2, player, 1 ether, 2 ether, bytes32(uint256(2)), player);
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
