// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {BankTestBase, TestRandomnessConsumer, DirectRouterFixture} from "../utils/BankTestBase.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Bank} from "../../src/core/Bank.sol";
import {StakeFunding} from "../../src/libs/StakeFunding.sol";
import {Errors} from "../../src/libs/Errors.sol";

contract FundingFeeToken is ERC20 {
    address public taxedSender;
    constructor() ERC20("Funding fixture", "FFT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setTaxedSender(address sender) external {
        taxedSender = sender;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && from == taxedSender && value > 0) {
            super._update(from, address(0), 1);
            --value;
        }
        super._update(from, to, value);
    }
}

// Isolates the shared funding helper and the Router-authorized Bank boundary.
contract FundingBoundaryHarness is DirectRouterFixture {
    function open(FundingFeeToken token, Bank bank, uint256 stake) external {
        uint256 beforeBalance = StakeFunding.collect(address(token), address(bank), stake);
        bank.holdBet(1, msg.sender, stake, stake, bytes32(0), address(this));
        StakeFunding.finish(address(token), address(bank), beforeBalance);
    }
}

contract StakeFundingTest is BankTestBase {
    function test_exactFundingAndBothTaxedHopsAreAtomic() external {
        FundingFeeToken token = new FundingFeeToken();
        Bank bank = new Bank(address(token), address(this), 0, 18, 1);
        FundingBoundaryHarness hub = new FundingBoundaryHarness();
        bank.setSettlementRouterOnce(address(hub));
        _bindTestConsumer(bank);
        token.mint(address(this), 1000);
        token.approve(address(bank.vault()), 1000);
        LiquidityVault(bank.vault()).addDepositFor(address(this), 1000);
        address player = address(0xBEEF);
        token.mint(player, 100);
        token.mint(address(hub), 7); // Donation must never substitute for an underpayment.
        vm.prank(player);
        token.approve(address(hub), 100);
        for (uint256 hop; hop < 2; ++hop) {
            token.setTaxedSender(hop == 0 ? player : address(hub));
            vm.expectRevert(Errors.TransferFailed.selector);
            vm.prank(player);
            hub.open(token, bank, 100);
            assertEq(token.balanceOf(player), 100);
            assertEq(token.balanceOf(address(hub)), 7);
            assertEq(token.balanceOf(address(bank)), 0);
            assertEq(token.balanceOf(bank.vault()), 1000);
            assertEq(token.allowance(player, address(hub)), 100);
            assertEq(token.allowance(address(hub), address(bank)), 0);
            assertEq(bank.openHolds(), 0);
        }
        token.setTaxedSender(address(0));
        vm.prank(player);
        hub.open(token, bank, 100);
        assertEq(token.balanceOf(player), 0);
        assertEq(token.balanceOf(address(hub)), 7);
        assertEq(token.balanceOf(address(bank)), 100);
        assertEq(token.balanceOf(bank.vault()), 1000);
        assertEq(token.allowance(address(hub), address(bank)), 0);
        assertEq(bank.openHolds(), 1);
    }
}
