// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Bank} from "../../src/core/Bank.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";

/// @notice F01 release blocker: actual Bank, no impersonation of Bank accounting.
///         Router-authorized test calls isolate capital allocation from game outcome generation.
contract BankCapitalContinuityTest is Test {
    function test_dustExitsAndFullRefundsKeepStayingCapitalAvailableInSameTransaction() external {
        address stayer = address(0xA11CE);
        address exiter = address(0xB0B);
        address player = address(0xBEEF);
        BlacklistToken asset = new BlacklistToken();
        Bank bank = new Bank(address(asset), address(this), 1_000, "LP", "LP", 6);
        bank.setSettlementRouterOnce(address(this));
        asset.mint(stayer, 100e6);
        asset.mint(exiter, 4);
        asset.mint(player, 100e6);
        vm.startPrank(stayer);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(100e6, stayer);
        vm.stopPrank();
        vm.prank(player);
        asset.approve(address(bank), type(uint256).max);
        vm.startPrank(exiter);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(4, exiter);
        vm.stopPrank();

        for (uint256 id = 1; id <= 4; ++id) {
            vm.startPrank(exiter);
            bank.requestRedeem(1, exiter, exiter);
            vm.stopPrank();
            bank.holdBet(id, player, 20e6, 40e6, bytes32(id));
            vm.warp(bank.redeemBatch(bank.currentEpoch()).cutoff);
            bank.activateBatch();
            bank.refundBet(id, 20e6);
            // No claim, keeper, deposit or other transaction between refund and observation.
            // Allow token-unit rounding for dust exits, never a 20-USDC capital quarantine.
            assertGe(bank.totalAssets(), 100e6 - id * 4, "staying capital must remain active on refund");
            assertEq(bank.openHolds(), 0);
        }
        bank.holdBet(5, player, 20e6, 40e6, bytes32(uint256(5)));
    }

    function test_fullActiveBookHasBoundedActivationAndClaimGasAndFullExitFreesSlots() external {
        BlacklistToken token = new BlacklistToken();
        Bank pool = new Bank(address(token), address(this), 0, "LP", "LP", 6);
        pool.setSettlementRouterOnce(address(this));
        token.mint(address(this), 10_000e6);
        token.approve(address(pool), type(uint256).max);
        pool.deposit(1_000e6, address(this));
        for (uint256 id = 1; id <= pool.MAX_ACTIVE_HOLDS(); ++id) {
            pool.holdBet(id, address(this), 1e6, 2e6, bytes32(id));
        }
        vm.expectRevert(IBank.ActiveHoldLimit.selector);
        pool.holdBet(1000, address(this), 1e6, 2e6, bytes32(0));
        pool.requestRedeem(1_000e6, address(this), address(this));
        vm.warp(pool.redeemBatch(1).cutoff);
        vm.cool(address(pool));
        vm.cool(address(token));
        uint256 before = gasleft();
        pool.activateBatch();
        uint256 activateGas = before - gasleft();
        emit log_named_uint("full-book activation gas", activateGas);
        assertLt(activateGas, 12_000_000);
        assertEq(pool.activeOpenHolds(), 0, "old protocol and exiting risk does not occupy new slots");
        pool.deposit(100e6, address(this));
        pool.holdBet(1000, address(this), 1e6, 2e6, bytes32(0));
        uint256 nav = pool.totalAssets();
        for (uint256 id = 1; id <= pool.MAX_ACTIVE_HOLDS(); ++id) {
            pool.refundBet(id, 1e6);
        }
        assertEq(pool.totalAssets(), nav, "full-exit historical recovery cannot accrue to new deposits");
        vm.cool(address(pool));
        vm.cool(address(token));
        before = gasleft();
        pool.claimRecovery(1, address(this), address(this));
        uint256 claimGas = before - gasleft();
        emit log_named_uint("full-book recovery claim gas", claimGas);
        assertLt(claimGas, 12_000_000);
        assertEq(pool.recoveryBacking(), 0);
    }
}
