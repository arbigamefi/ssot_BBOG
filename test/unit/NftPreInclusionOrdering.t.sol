// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {BankNFTRouterHarness} from "./BankNFTAccounting.t.sol";

/// @notice A conditional information-ordering witness, not a demonstrated VRF prediction attack.
/// @dev Production custody/tree; the harness substitutes result authority and supplies one fixed
/// legal terminal result. It proves the effect IF that result is known before on-chain receipt.
contract NftPreInclusionOrderingTest is Test {
    Bank private bank;
    LiquidityVault private vault;
    BlacklistToken private token;
    BankNFTRouterHarness private router;
    address private constant EXITING = address(0xA11CE);
    address private constant STAYING = address(0xB0B);
    address private constant BUYER = address(0xCAFE);
    uint48 private first;
    uint48 private second;

    function setUp() public {
        token = new BlacklistToken();
        router = new BankNFTRouterHarness();
        bank = new Bank(address(token), address(this), 6_000, 6, 10_000);
        vault = LiquidityVault(bank.vault());
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(router));
        first = _deposit(EXITING);
        second = _deposit(STAYING);
        vm.warp(block.timestamp + 1 days);
        token.mint(address(this), 100e6);
        token.approve(address(bank), 100e6);
        router.open(bank, 1, address(0xBEEF), 100e6, 200e6, address(this));
    }

    function _deposit(address owner) private returns (uint48 id) {
        token.mint(owner, 1_000e6);
        vm.startPrank(owner);
        token.approve(address(vault), 1_000e6);
        id = vault.addDeposit(1_000e6);
        vm.stopPrank();
    }

    function _loss() private {
        router.finish(bank, 1, 200e6, 200e6, 0, 0, new SSOTTypes.XPAward[](0));
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertTrue(s.accountingValid);
        assertEq(s.P + s.R + s.K + s.PF + s.XP + s.PP, 0);
        assertEq(token.balanceOf(address(vault)), s.L);
        assertEq(token.balanceOf(address(bank)), 0);
    }

    function test_knownLossBeforeReceiptPermitsExitAndTransfersLossToStayingCapital() public {
        uint256 before = vm.snapshotState();
        _loss();
        vm.prank(EXITING);
        uint256 control = vault.withdrawDeposit(first, 1e12);
        assertEq(control, 950e6);
        assertEq(vault.nodeWithdrawView(second), 950e6);

        assertTrue(vm.revertToState(before));
        vm.prank(EXITING);
        uint256 beforeReceipt = vault.withdrawDeposit(first, 1e12);
        assertEq(beforeReceipt, 1_000e6);
        _loss();
        assertEq(beforeReceipt - control, 50e6);
        assertEq(vault.nodeWithdrawView(second), 900e6);
        emit log_named_uint("conditional exit advantage, raw USDC", beforeReceipt - control);
    }

    function test_transferPreservesMaturityAndDoesNotRemoveConditionalOrderingAdvantage() public {
        uint64 deadline = vault.withdrawAfter(first);
        vm.prank(EXITING);
        vault.transferFrom(EXITING, BUYER, first);
        assertEq(vault.withdrawAfter(first), deadline);
        vm.prank(BUYER);
        assertEq(vault.withdrawDeposit(first, 1e12), 1_000e6);
        _loss();
        assertEq(vault.nodeWithdrawView(second), 900e6);
        // No acquisition price or buyer profit is invented: only the withdrawal capability is proven.
    }
}
