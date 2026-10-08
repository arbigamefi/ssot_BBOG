// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {BankTestBase} from "../utils/BankTestBase.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

/// @notice Public-behavior regression for the packed aggregate holdback clock.
/// @dev No storage injection: real Bank/Vault accrual, partial release and re-award paths.
contract BankHoldbackScheduleTest is BankTestBase {
    uint256 private constant START = 1_000_000;
    address private constant PAYEE = address(0xCAFE);
    address private constant PLAYER = address(0xBEEF);
    MockERC20 private token;
    Bank private bank;
    uint256 private nextBet = 1;

    function setUp() public {
        vm.warp(START);
        token = new MockERC20("Asset", "AST", 6);
        bank = new Bank(address(token), address(this), 0, 6, 1);
        bank.setSettlementRouterOnce(address(this));
        _bindTestConsumer(bank);
        bank.setHoldbackVestingSeconds(100);
        token.mint(address(this), 1e30);
        token.approve(address(bank), type(uint256).max);
        token.approve(bank.vault(), type(uint256).max);
        LiquidityVault(bank.vault()).addDeposit(1_000e6);
    }

    function _awards(uint256 first, uint256 second) private pure returns (SSOTTypes.XPAward[] memory awards) {
        awards = new SSOTTypes.XPAward[](second == 0 ? 1 : 2);
        awards[0] = SSOTTypes.XPAward(PAYEE, PLAYER, 0, 0, first, bytes32("L1"));
        if (second != 0) awards[1] = SSOTTypes.XPAward(PAYEE, PLAYER, 0, 0, second, bytes32("MARKUP"));
    }

    function _award(uint256 first, uint256 second) private {
        uint256 id = nextBet++;
        uint256 amount = first + second;
        bank.holdBet(id, PLAYER, amount, amount, bytes32(id), address(this));
        bank.settleBet(id, 0, 0, 0, 0, _awards(first, second));
        _assertPayables();
    }

    function _assertPayables() private view {
        assertEq(bank.xpAccruedTotal(), bank.xpAccruedOf(PAYEE));
        assertEq(bank.xpHoldbackTotal(), bank.xpHoldbackOf(PAYEE));
        assertEq(token.balanceOf(address(bank)), bank.externalPayablesTotal());
        assertTrue(bank.getSSOT().accountingValid);
    }

    function test_emptySyncThenFirstAwardStartsItsOwnFullDuration() public {
        assertEq(bank.syncXPHoldback(PAYEE), 0);
        vm.warp(START + 50);
        assertEq(bank.syncXPHoldback(PAYEE), 0);
        _award(100, 0);
        vm.warp(START + 100);
        assertEq(bank.syncXPHoldback(PAYEE), 50);
        vm.warp(START + 150);
        assertEq(bank.syncXPHoldback(PAYEE), 50);
        _assertPayables();
    }

    function test_duplicatePayeeKeepsAwardTotalAndOriginalEnd() public {
        _award(30, 70);
        assertEq(bank.holdbackReleasable(PAYEE), 0);
        assertEq(bank.syncXPHoldback(PAYEE), 0);
        vm.warp(START + 50);
        assertEq(bank.holdbackReleasable(PAYEE), 50);
        assertEq(bank.syncXPHoldback(PAYEE), 50);
        vm.warp(START + 100);
        assertEq(bank.syncXPHoldback(PAYEE), 50);
        assertEq(bank.xpAccruedOf(PAYEE), 100);
        _assertPayables();
    }

    function test_partialSyncAndNewAwardNeverExtendActiveSchedule() public {
        _award(100, 0);
        vm.warp(START + 25);
        assertEq(bank.syncXPHoldback(PAYEE), 25);
        vm.warp(START + 50);
        bank.setHoldbackVestingSeconds(1_000);
        _award(40, 60);
        assertEq(bank.xpAccruedOf(PAYEE), 50);
        assertEq(bank.xpHoldbackOf(PAYEE), 150);
        vm.warp(START + 75);
        assertEq(bank.syncXPHoldback(PAYEE), 75);
        vm.warp(START + 100);
        assertEq(bank.syncXPHoldback(PAYEE), 75);
        assertEq(bank.xpAccruedOf(PAYEE), 200);
        assertEq(bank.xpHoldbackOf(PAYEE), 0);
        _assertPayables();
    }

    function test_expiredUnSyncedBalanceReleasesBeforeNewSchedule() public {
        _award(100, 0);
        vm.warp(START + 100);
        _award(40, 60);
        assertEq(bank.xpAccruedOf(PAYEE), 100);
        assertEq(bank.xpHoldbackOf(PAYEE), 100);
        assertEq(bank.syncXPHoldback(PAYEE), 0);
        vm.warp(START + 150);
        assertEq(bank.syncXPHoldback(PAYEE), 50);
        vm.warp(START + 200);
        assertEq(bank.syncXPHoldback(PAYEE), 50);
        assertEq(bank.xpAccruedOf(PAYEE), 200);
        _assertPayables();
    }

    function test_roundingToZeroRetainsAllDebtUntilScheduleEnds() public {
        _award(3, 0);
        vm.warp(START + 3);
        assertEq(bank.syncXPHoldback(PAYEE), 0);
        vm.warp(START + 5);
        assertEq(bank.syncXPHoldback(PAYEE), 0);
        assertEq(bank.xpHoldbackOf(PAYEE), 3);
        vm.warp(START + 100);
        assertEq(bank.syncXPHoldback(PAYEE), 3);
        assertEq(bank.syncXPHoldback(PAYEE), 0);
        _assertPayables();
    }

    function test_scheduleTimestampOverflowRevertsWithoutChangingDebt() public {
        vm.warp(type(uint64).max - 5);
        bank.holdBet(1, PLAYER, 100, 100, bytes32(uint256(1)), address(this));
        SSOTTypes.XPAward[] memory awards = _awards(100, 0);
        vm.expectRevert(abi.encodeWithSignature("Panic(uint256)", 0x11));
        bank.settleBet(1, 0, 0, 0, 0, awards);
        assertEq(bank.xpHoldbackOf(PAYEE), 0);
        assertEq(bank.xpAccruedOf(PAYEE), 0);
        assertEq(bank.openHolds(), 1);
        assertTrue(bank.getSSOT().accountingValid);
    }

    function testFuzz_partialReleaseAndReawardPreserveEndAndDebt(uint64 a, uint64 b, uint8 elapsed) public {
        uint256 first = bound(a, 1, 1e12);
        uint256 second = bound(b, 1, 1e12);
        uint256 t = bound(elapsed, 1, 99);
        _award(first, 0);
        vm.warp(START + t);
        uint256 released = first * t / 100;
        assertEq(bank.syncXPHoldback(PAYEE), released);
        _award(second, 0);
        assertEq(bank.xpHoldbackOf(PAYEE), first + second - released);
        assertEq(bank.xpAccruedOf(PAYEE), released);
        vm.warp(START + 100);
        assertEq(bank.syncXPHoldback(PAYEE), first + second - released);
        assertEq(bank.xpHoldbackOf(PAYEE), 0);
        assertEq(bank.xpAccruedOf(PAYEE), first + second);
        _assertPayables();
    }
}
