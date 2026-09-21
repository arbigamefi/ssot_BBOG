// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

/// @dev Covers the two V15 governance-surface changes:
///      - AGF-08: the dead `settlementRouter` pause allowance becomes a real
///        `guardian` role that may pause but never unpause.
///      - AGF-07: `minPlayerTurnoverForUnlock` gains an upper bound.
contract BankGuardianAndTurnoverBoundTest is Test {
    event GuardianSet(address indexed guardian);
    event RiskInPausedSet(bool paused);

    address internal gov = address(0xA11CE);
    address internal guardian = address(0x6A12D);
    address internal router = address(0x4007E2);
    address internal stranger = address(0xBAD);

    MockERC20 internal asset6;
    Bank internal bank6;

    function setUp() external {
        asset6 = new MockERC20("USD Coin", "USDC", 6);
        bank6 = new Bank(address(asset6), gov, 0, "LP USDC", "lpUSDC", 6);

        vm.prank(gov);
        bank6.setSettlementRouterOnce(router);
    }

    // ---------------------------------------------------------------- guardian

    function test_guardianDefaultsToZeroSoOnlyGovCanPause() external {
        assertEq(bank6.guardian(), address(0));

        vm.prank(stranger);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank6.setRiskInPaused(true);

        vm.prank(gov);
        bank6.setRiskInPaused(true);
        assertTrue(bank6.riskInPaused());
    }

    function test_onlyGovCanSetGuardian() external {
        vm.prank(stranger);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank6.setGuardian(guardian);

        vm.expectEmit(true, false, false, false, address(bank6));
        emit GuardianSet(guardian);
        vm.prank(gov);
        bank6.setGuardian(guardian);

        assertEq(bank6.guardian(), guardian);
    }

    /// The whole point of the role: pausing must not need a multisig quorum.
    function test_guardianCanPause() external {
        vm.prank(gov);
        bank6.setGuardian(guardian);

        vm.expectEmit(false, false, false, true, address(bank6));
        emit RiskInPausedSet(true);
        vm.prank(guardian);
        bank6.setRiskInPaused(true);

        assertTrue(bank6.riskInPaused());
    }

    /// The asymmetry. A compromised guardian must not be able to re-admit risk.
    function test_guardianCannotUnpause() external {
        vm.startPrank(gov);
        bank6.setGuardian(guardian);
        bank6.setRiskInPaused(true);
        vm.stopPrank();

        vm.prank(guardian);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank6.setRiskInPaused(false);

        assertTrue(bank6.riskInPaused(), "guardian must not be able to unpause");

        vm.prank(gov);
        bank6.setRiskInPaused(false);
        assertFalse(bank6.riskInPaused());
    }

    /// AGF-08: the router's allowance is gone, in both directions.
    function test_settlementRouterCanNoLongerPauseOrUnpause() external {
        assertEq(bank6.settlementRouter(), router);

        vm.prank(router);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank6.setRiskInPaused(true);

        vm.prank(gov);
        bank6.setRiskInPaused(true);

        vm.prank(router);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank6.setRiskInPaused(false);
    }

    function test_revokingGuardianRemovesPausePower() external {
        vm.prank(gov);
        bank6.setGuardian(guardian);

        vm.prank(gov);
        bank6.setGuardian(address(0));

        vm.prank(guardian);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank6.setRiskInPaused(true);
    }

    /// Pausing must not touch the payout path, which is the reason it is safe
    /// to hand the guardian a fast trigger at all.
    function test_guardianPauseDoesNotBlockDebtOut() external {
        vm.prank(gov);
        bank6.setGuardian(guardian);
        vm.prank(guardian);
        bank6.setRiskInPaused(true);

        // Debt-Out never consults nav(), so a paused bank still reports SSOT and
        // keeps settle/refund callable by the router.
        assertTrue(bank6.riskInPaused());
        bank6.getSSOT();
    }

    // ------------------------------------------------- turnover bound (AGF-07)

    function test_rejectsThresholdAboveBound_6Decimals() external {
        // The exact mainnet mistake: 20e18 on a 6-decimal asset is 20 trillion
        // USDC, which froze every referral award until governance retuned it.
        vm.prank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank6.setMinPlayerTurnoverForUnlock(20e18);
    }

    function test_acceptsSaneThreshold_6Decimals() external {
        vm.prank(gov);
        bank6.setMinPlayerTurnoverForUnlock(20e6);
        assertEq(bank6.minPlayerTurnoverForUnlock(), 20e6);
    }

    /// The same raw number is legitimate on an 18-decimal asset, so the bound
    /// has to scale with decimals rather than be a flat constant.
    function test_sameRawValueIsAcceptedOn18Decimals() external {
        MockERC20 asset18 = new MockERC20("Wrapped Ether", "WETH", 18);
        Bank bank18 = new Bank(address(asset18), gov, 0, "LP WETH", "lpWETH", 18);

        vm.prank(gov);
        bank18.setMinPlayerTurnoverForUnlock(20e18);
        assertEq(bank18.minPlayerTurnoverForUnlock(), 20e18);
    }

    function test_rejectsMaxUint() external {
        vm.prank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank6.setMinPlayerTurnoverForUnlock(type(uint256).max);
    }

    function test_zeroRemainsValid() external {
        vm.prank(gov);
        bank6.setMinPlayerTurnoverForUnlock(0);
        assertEq(bank6.minPlayerTurnoverForUnlock(), 0);
    }

    function test_boundaryIsExactlyAtMaxUnits() external {
        uint256 atLimit = bank6.MAX_MIN_TURNOVER_UNITS() * 1e6;
        vm.prank(gov);
        bank6.setMinPlayerTurnoverForUnlock(atLimit);
        assertEq(bank6.minPlayerTurnoverForUnlock(), atLimit);

        // One whole unit past the ceiling is refused.
        vm.prank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank6.setMinPlayerTurnoverForUnlock(atLimit + 1e6);
    }

    /// The bound is computed by division precisely so it cannot overflow on a
    /// high-decimals asset; multiplying would revert here and leave the
    /// parameter permanently unsettable.
    function test_boundDoesNotOverflowOnExtremeDecimals() external {
        MockERC20 asset38 = new MockERC20("Extreme", "EXT", 38);
        Bank bank38 = new Bank(address(asset38), gov, 0, "LP EXT", "lpEXT", 38);

        vm.prank(gov);
        bank38.setMinPlayerTurnoverForUnlock(20 * 10 ** 38);
        assertEq(bank38.minPlayerTurnoverForUnlock(), 20 * 10 ** 38);

        vm.prank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        bank38.setMinPlayerTurnoverForUnlock(type(uint256).max);
    }

    function test_onlyGovCanSetThreshold() external {
        vm.prank(stranger);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank6.setMinPlayerTurnoverForUnlock(20e6);
    }
}
