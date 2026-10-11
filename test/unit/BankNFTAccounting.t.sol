// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {Bank} from "../../src/core/Bank.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Fault injection outside the admitted exact-transfer asset assumptions.
contract BankNFTInexactToken is ERC20 {
    address public target;
    bool public returnFalse;

    constructor() ERC20("Fault token", "FAULT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailure(address who, bool falseReturn) external {
        target = who;
        returnFalse = falseReturn;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (to != target) return super.transfer(to, amount);
        if (returnFalse) {
            super.transfer(to, amount);
            return false;
        }
        super.transfer(to, amount - 1);
        _burn(msg.sender, 1);
        return true;
    }
}

/// @dev Only the routing/result authority is substituted; Bank and Vault are production contracts.
contract BankNFTRouterHarness {
    mapping(address => address) public settlementConsumer;
    uint256 public unbooked;
    bool public failRead;
    bool public failAck;

    function bindRandomnessConsumer(address consumer) external {
        require(settlementConsumer[msg.sender] == address(0), "bound");
        settlementConsumer[msg.sender] = consumer;
    }

    function unbookedResultCount(address) external view returns (uint256) {
        require(!failRead, "read failure");
        return unbooked;
    }

    function setState(uint256 count, bool readFailure, bool ackFailure) external {
        unbooked = count;
        failRead = readFailure;
        failAck = ackFailure;
    }

    function open(Bank bank, uint256 id, address player, uint256 stake, uint256 reserve, address hub) external {
        bank.holdBet(id, player, stake, reserve, bytes32(id), hub);
    }

    function finish(
        Bank bank,
        uint256 id,
        uint256 gross,
        uint256 net,
        uint256 refundAmount,
        uint256 fee,
        SSOTTypes.XPAward[] calldata awards
    ) external {
        bank.settleBet(id, gross, net, refundAmount, fee, awards);
        require(!failAck, "ack failure");
        if (unbooked != 0) --unbooked;
    }

    function refund(Bank bank, uint256 id, uint256 amount) external {
        bank.refundBet(id, amount);
    }
}

contract BankNFTAccountingTest is Test {
    BlacklistToken internal token;
    Bank internal bank;
    LiquidityVault internal vault;
    BankNFTRouterHarness internal router;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal player = address(0x1234);
    uint40 internal constant ONE = 1e12;

    function setUp() public {
        token = new BlacklistToken();
        router = new BankNFTRouterHarness();
        bank = new Bank(address(token), address(this), 1_000, 6, 1);
        vault = LiquidityVault(bank.vault());
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(router));
        token.mint(address(this), 1_000_000e6);
        token.approve(address(bank), type(uint256).max);
    }

    function _deposit(address owner, uint256 amount) internal returns (uint48) {
        token.mint(owner, amount);
        vm.startPrank(owner);
        token.approve(address(vault), type(uint256).max);
        uint48 id = vault.addDeposit(amount);
        vm.stopPrank();
        return id;
    }

    function _open(uint256 id, uint256 stake, uint256 reserved) internal {
        router.open(bank, id, player, stake, reserved, address(this));
    }

    function _finish(uint256 id, uint256 gross, uint256 net, uint256 refund, uint256 fee) internal {
        router.finish(bank, id, gross, net, refund, fee, new SSOTTypes.XPAward[](0));
    }

    function _assertAccounting(uint256 bankSurplus, uint256 vaultSurplus) internal view {
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertTrue(s.accountingValid);
        assertEq(s.bankCash, s.P + s.PF + s.XP + s.PP + bankSurplus);
        assertEq(s.vaultCash, s.L + vaultSurplus);
        assertEq(s.bankSurplus, bankSurplus);
        assertEq(s.vaultSurplus, vaultSurplus);
        assertEq(s.K, s.R - s.P);
        assertEq(s.G, s.L + s.P);
        assertEq(s.G, bank.riskAssets());
        assertEq(s.lpFreeCapital, s.L - s.K);
        assertEq(s.riskReserve, s.G * s.riskReserveBps / 10_000);
        assertGe(s.L, s.K);
    }

    function test_immutableVaultBindingAndFullBankDeploymentLimits() public view {
        assertEq(vault.bank(), address(bank));
        assertEq(vault.asset(), address(token));
        assertEq(bank.assetDecimals(), 6);
        assertEq(token.allowance(address(bank), address(vault)), type(uint256).max);
        assertLt(address(bank).code.length, 24_576 - 1_024);
        assertLt(type(Bank).creationCode.length + 5 * 32, 49_152);
    }

    function test_bindingIsGovernanceOnlyOnceAndUnavailableCanonicalReadFencesLP() public {
        vm.prank(alice);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.setRandomnessConsumerOnce(address(router));
        vm.expectRevert(bytes("bound"));
        bank.setRandomnessConsumerOnce(address(router));
        uint48 id = _deposit(alice, 1_000e6);
        vm.warp(block.timestamp + 1 days);
        router.setState(0, true, false);
        assertEq(uint8(vault.depositState(id).status), uint8(ILiquidityVaultBank.LPStatus.Unavailable));
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityVault.LPUnavailable.selector, ILiquidityVaultBank.LPStatus.Unavailable)
        );
        vault.withdrawDeposit(id, ONE);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(LiquidityVault.LPUnavailable.selector, ILiquidityVaultBank.LPStatus.Unavailable)
        );
        vault.addDeposit(1);
    }

    function test_stakeExcludedFromNFTValueAndOriginalCutoffSurvivesNewDeposits() public {
        uint48 old = _deposit(alice, 1_000e6);
        _open(1, 100e6, 300e6);
        (,,, uint48 cutoff, bool open) = bank.holds(1);
        assertEq(cutoff, old);
        assertTrue(open);
        assertEq(vault.nodeWithdrawView(old), 1_000e6);
        assertEq(bank.riskAssets(), 1_100e6);
        uint48 fresh = _deposit(bob, 500e6);
        _finish(1, 200e6, 195e6, 10e6, 3e6);
        assertEq(vault.nodeWithdrawView(old), 892e6);
        assertEq(vault.nodeWithdrawView(fresh), 500e6);
        assertEq(bank.pendingStakeTotal(), 0);
        assertEq(bank.totalReserved(), 0);
        assertEq(bank.openHolds(), 0);
        _assertAccounting(0, 0);
    }

    function test_knownResultPauseAndFailedPlayerTransferStillTerminalizeThenClaimOnce() public {
        uint48 id = _deposit(alice, 1_000e6);
        _open(1, 100e6, 300e6);
        router.setState(1, false, false);
        assertEq(uint8(vault.depositState(id).status), uint8(ILiquidityVaultBank.LPStatus.UnbookedResult));
        token.setBlocked(player, true);
        bank.setRiskInPaused(true);
        _finish(1, 230e6, 220e6, 10e6, 3e6);
        assertEq(bank.playerPayable(player), 230e6);
        assertEq(vault.getReserve(), 867e6);
        assertEq(bank.openHolds(), 0);
        _assertAccounting(0, 0);
        vm.expectRevert(abi.encodeWithSelector(IBank.BetNotOpen.selector, 1));
        _finish(1, 230e6, 220e6, 10e6, 3e6);
        vm.expectRevert();
        bank.claimPlayerPayable(player);
        assertEq(bank.playerPayable(player), 230e6);
        token.setBlocked(player, false);
        vm.prank(bob);
        assertEq(bank.claimPlayerPayable(player), 230e6);
        assertEq(token.balanceOf(player), 230e6);
        assertEq(bank.claimPlayerPayable(player), 0);
        assertEq(vault.getReserve(), 867e6);
        _assertAccounting(0, 0);
    }

    function test_ackFailureRollsBackRealBankCashCountersAndVaultTree() public {
        _deposit(alice, 1_000e6);
        _open(1, 100e6, 300e6);
        router.setState(1, false, true);
        vm.expectRevert(bytes("ack failure"));
        _finish(1, 220e6, 220e6, 0, 3e6);
        assertEq(vault.getReserve(), 1_000e6);
        assertEq(bank.pendingStakeTotal(), 100e6);
        assertEq(bank.totalBetsSettled(), 0);
        assertEq(bank.totalPayoutNet(), 0);
        assertEq(token.balanceOf(player), 0);
        _assertAccounting(0, 0);
        router.setState(1, false, false);
        _finish(1, 220e6, 220e6, 0, 3e6);
        assertEq(bank.totalBetsSettled(), 1);
        assertEq(vault.getReserve(), 877e6);
        _assertAccounting(0, 0);
    }

    function test_custodyFundingFailureRollsBackBothProfitAndLossWithoutPlayerDebt() public {
        _deposit(alice, 1_000e6);
        _open(1, 100e6, 300e6);
        token.setBlocked(address(vault), true);
        vm.expectRevert();
        _finish(1, 200e6, 200e6, 0, 0);
        vm.expectRevert();
        _finish(1, 0, 0, 0, 0);
        assertEq(bank.playerPayableTotal(), 0);
        assertEq(bank.pendingStakeTotal(), 100e6);
        assertEq(bank.openHolds(), 1);
        assertEq(vault.getReserve(), 1_000e6);
        _assertAccounting(0, 0);
    }

    function test_terminalCannotSpendOtherPrincipalThenHideAnExistingBankDeficit() public {
        _deposit(alice, 1_000e6);
        _open(1, 100e6, 300e6);
        _open(2, 100e6, 300e6);
        deal(address(token), address(bank), 199e6);
        vm.expectRevert(IBank.AccountingFault.selector);
        _finish(1, 200e6, 200e6, 0, 0);
        vm.expectRevert(IBank.AccountingFault.selector);
        router.refund(bank, 1, 100e6);
        assertEq(bank.openHolds(), 2);
        assertEq(bank.pendingStakeTotal(), 200e6);
        assertEq(bank.totalBetsSettled(), 0);
        assertEq(bank.totalBetsRefunded(), 0);
        assertEq(token.balanceOf(player), 0);
        assertEq(token.balanceOf(address(bank)), 199e6);
        assertEq(vault.getReserve(), 1_000e6);
        assertEq(vault.lockedLiquidity(), 400e6);
        token.mint(address(bank), 1e6);
        _finish(1, 200e6, 200e6, 0, 0);
        assertEq(bank.pendingStakeTotal(), 100e6);
        _assertAccounting(0, 0);
    }

    function test_fullAndPartialRefundRetireOriginalPrincipalExactlyOnce() public {
        _deposit(alice, 1_000e6);
        _open(1, 100e6, 300e6);
        router.refund(bank, 1, 100e6);
        assertEq(vault.getReserve(), 1_000e6);
        _open(2, 100e6, 300e6);
        _finish(2, 0, 0, 40e6, 1e6);
        assertEq(bank.pendingStakeTotal(), 0);
        assertEq(bank.totalRefunded(), 140e6);
        assertEq(bank.totalTurnover(), 60e6);
        assertEq(bank.totalBetsRefunded(), 1);
        assertEq(bank.totalBetsSettled(), 1);
        assertEq(vault.getReserve(), 1_059e6);
        _assertAccounting(0, 0);
    }

    function test_fullExitAtZeroLockRoutesOldProfitToProtocolExcludingGameFeeCounters() public {
        uint48 id = _deposit(alice, 100e6);
        vm.warp(block.timestamp + 1 days);
        _open(1, 100e6, 100e6);
        vm.prank(alice);
        vault.withdrawDeposit(id, ONE);
        assertEq(vault.getReserve(), 0);
        _finish(1, 0, 0, 0, 1e6);
        assertEq(bank.protocolFeesPayable(), 100e6);
        assertEq(bank.totalProtocolFeeAccrued(), 1e6);
        assertEq(bank.riskAssets(), 0);
        uint48 fresh = _deposit(bob, 50e6);
        assertEq(vault.nodeWithdrawView(fresh), 50e6);
        _assertAccounting(0, 0);
    }

    function test_grossCapitalAdmissionCountsPendingPrincipalAnd128SlotsOnlyReleaseOnTerminal() public {
        bank.setRiskReserveBps(0);
        _deposit(alice, 1_000e6);
        for (uint256 id = 1; id <= bank.MAX_OPEN_HOLDS(); ++id) {
            _open(id, 1, 1);
        }
        vm.expectRevert(IBank.OpenHoldLimit.selector);
        _open(129, 1, 1);
        router.refund(bank, 1, 1);
        _open(129, 1, 1);
        assertEq(bank.openHolds(), 128);
        _assertAccounting(0, 0);
    }

    function test_newStakeCannotExceedGCapEvenWhenNetReserveIsZero() public {
        bank.setRiskReserveBps(0);
        uint256 cap = vault.MAX_TREE_CAPITAL();
        _deposit(alice, cap - 100);
        _open(1, 100, 100);
        assertEq(bank.riskAssets(), cap);
        vm.expectRevert(IBank.CapitalLimit.selector);
        _open(2, 1, 1);
        _finish(1, 0, 0, 0, 0);
        assertEq(vault.getReserve(), cap);
        assertEq(bank.pendingStakeTotal(), 0);
        _assertAccounting(0, 0);
    }

    function test_PFXPClaimsUseOwnBankLiabilitiesAndDoNotDebitTree() public {
        _deposit(alice, 1_000e6);
        bank.setMinPlayerTurnoverForUnlock(60e6);
        _open(1, 100e6, 300e6);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](1);
        awards[0] = SSOTTypes.XPAward(bob, player, 3e6, 5e6, 4e6, bytes32("referral"));
        router.finish(bank, 1, 20e6, 20e6, 40e6, 2e6, awards);
        assertEq(vault.getReserve(), 1_026e6);
        assertEq(bank.unlockXPLocked(bob, player), 5e6);
        vm.prank(bob);
        assertEq(bank.claimXPAccrued(8e6, bob), 8e6);
        assertEq(bank.claimProtocolFees(2e6, address(this)), 2e6);
        assertEq(vault.getReserve(), 1_026e6);
        assertEq(bank.externalPayablesTotal(), 4e6);
        uint256 started = block.timestamp;
        vm.warp(started + 15 days);
        assertEq(bank.syncXPHoldback(bob), 2e6);
        vm.warp(started + 30 days);
        assertEq(bank.syncXPHoldback(bob), 2e6);
        assertEq(bank.xpHoldbackTotal(), 0);
        _assertAccounting(0, 0);
    }

    /// ADR-0037 §4 (B3): a pause stops new positions and new deposits only. Settlement, XP unlocks and claims,
    /// protocol-fee claims and mature NFT withdrawals continue, and the LP status does not report the pause.
    function test_pauseStopsNewRiskAndDepositsButNoOutflow() public {
        uint48 id = _deposit(alice, 1_000e6);
        bank.setMinPlayerTurnoverForUnlock(60e6);
        _open(1, 100e6, 300e6);
        bank.setRiskInPaused(true);

        (,, ILiquidityVaultBank.LPStatus status) = bank.lpAccounting();
        assertEq(uint8(status), uint8(ILiquidityVaultBank.LPStatus.Ready));
        vm.expectRevert(IBank.RiskInPaused.selector);
        _open(2, 1e6, 2e6);
        token.mint(bob, 1e6);
        vm.startPrank(bob);
        token.approve(address(vault), 1e6);
        vm.expectRevert(LiquidityVault.DepositsPaused.selector);
        vault.addDeposit(1e6);
        vm.stopPrank();

        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](1);
        awards[0] = SSOTTypes.XPAward(bob, player, 3e6, 5e6, 4e6, bytes32("referral"));
        router.finish(bank, 1, 20e6, 20e6, 40e6, 2e6, awards);
        assertEq(bank.unlockXPLocked(bob, player), 5e6);
        vm.prank(bob);
        assertEq(bank.claimXPAccrued(8e6, bob), 8e6);
        assertEq(bank.claimProtocolFees(2e6, address(this)), 2e6);

        vm.warp(block.timestamp + 1 days);
        LiquidityVault.DepositState memory quote = vault.depositState(id);
        assertEq(uint8(quote.status), uint8(ILiquidityVaultBank.LPStatus.Ready));
        assertEq(quote.maxPercent, ONE);
        vm.prank(alice);
        assertEq(vault.withdrawDeposit(id, ONE), 1_026e6);
        assertTrue(bank.riskInPaused());
        _assertAccounting(0, 0);

        bank.setRiskInPaused(false);
        vm.prank(bob);
        vault.addDeposit(1e6);
    }

    /// Without the pause check an optional outflow is still held back by the outflow domain (ADR-0037 D6 (a)).
    function test_pausedClaimsStillRespectTheOutflowDomain() public {
        _deposit(alice, 1_000e6);
        bank.setRiskReserveBps(0);
        _open(1, 100e6, 100e6);
        _finish(1, 0, 0, 0, 5e6);
        bank.setWithdrawalBufferBps(9_000);
        _open(2, 100e6, 1_000e6);
        bank.setRiskInPaused(true);
        vm.expectRevert(IBank.OptionalOutflowDomainViolation.selector);
        bank.claimProtocolFees(1e6, address(this));
        _finish(2, 0, 0, 0, 0);
        assertEq(bank.claimProtocolFees(1e6, address(this)), 1e6);
        _assertAccounting(0, 0);
    }

    function test_optionalBufferNeverReducesNFTWithdrawalLimitAndSelfFeePaymentIsSurplus() public {
        uint48 id = _deposit(alice, 1_000e6);
        bank.setRiskReserveBps(0);
        _open(1, 100e6, 100e6);
        _finish(1, 0, 0, 0, 5e6);
        assertEq(bank.claimProtocolFees(1e6, address(bank)), 1e6);
        bank.setWithdrawalBufferBps(9_000);
        _open(2, 100e6, 1_000e6);
        vm.expectRevert(IBank.OptionalOutflowDomainViolation.selector);
        bank.claimProtocolFees(1e6, address(this));
        vm.warp(block.timestamp + 1 days);
        LiquidityVault.DepositState memory quote = vault.depositState(id);
        assertGt(quote.maxAssets, 0);
        vm.prank(alice);
        vault.withdrawDeposit(id, quote.maxPercent);
        _assertAccounting(1e6, 0);
    }

    function test_donationsRemainOutsideLAndGAndDeficitIsExplicit() public {
        token.mint(address(bank), 11e6);
        token.mint(address(vault), 7e6);
        uint48 id = _deposit(alice, 1_000e6);
        _open(1, 100e6, 300e6);
        assertEq(bank.riskAssets(), 1_100e6);
        _finish(1, 0, 0, 0, 2e6);
        assertEq(vault.nodeWithdrawView(id), 1_098e6);
        _assertAccounting(11e6, 7e6);
        // Balance manipulation is a failure injection, not an admitted-asset operation.
        deal(address(token), address(bank), 1);
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertFalse(s.accountingValid);
        assertEq(s.L, 1_098e6, "fault must not pretend NFT capital is healthy zero");
        vm.expectRevert(IBank.AccountingFault.selector);
        _open(2, 1e6, 2e6);
        vm.expectRevert(IBank.AccountingFault.selector);
        bank.claimProtocolFees(1e6, address(this));
    }

    function test_inexactPlayerPaymentAndMutatingFalseReturnMustRollbackNotCreateDebt() public {
        BankNFTInexactToken badToken = new BankNFTInexactToken();
        Bank subject = new Bank(address(badToken), address(this), 0, 18, 1);
        subject.setSettlementRouterOnce(address(router));
        subject.setRandomnessConsumerOnce(address(router));
        LiquidityVault lp = LiquidityVault(subject.vault());
        badToken.mint(alice, 1_000);
        vm.startPrank(alice);
        badToken.approve(address(lp), type(uint256).max);
        lp.addDeposit(1_000);
        vm.stopPrank();
        badToken.mint(address(this), 100);
        badToken.approve(address(subject), type(uint256).max);
        router.open(subject, 1, player, 100, 300, address(this));
        SSOTTypes.XPAward[] memory noAwards = new SSOTTypes.XPAward[](0);
        badToken.setFailure(player, false);
        vm.expectRevert(Errors.TransferFailed.selector);
        router.finish(subject, 1, 200, 200, 0, 0, noAwards);
        badToken.setFailure(player, true);
        vm.expectRevert(Errors.TransferFailed.selector);
        router.finish(subject, 1, 200, 200, 0, 0, noAwards);
        assertEq(subject.openHolds(), 1);
        assertEq(subject.playerPayableTotal(), 0);
        assertEq(subject.pendingStakeTotal(), 100);
        assertEq(lp.getReserve(), 1_000);
        assertEq(lp.lockedLiquidity(), 200);
        assertEq(badToken.balanceOf(player), 0);
    }

    /// @dev Selected economics, not a claim that the pre-inclusion ordering release gate is resolved.
    function test_matureInformedExitAvoidsLossComparedWithIdenticalNoExitControl() public {
        uint48 old = _deposit(alice, 1_000e6);
        uint48 remaining = _deposit(bob, 1_000e6);
        vm.warp(block.timestamp + 1 days);
        _open(1, 100e6, 500e6);
        uint256 snapshot = vm.snapshotState();
        _finish(1, 500e6, 500e6, 0, 0);
        uint256 aliceControl = vault.nodeWithdrawView(old);
        uint256 bobControl = vault.nodeWithdrawView(remaining);
        assertEq(aliceControl, 800e6);
        assertEq(bobControl, 800e6);
        assertTrue(vm.revertToState(snapshot));
        vm.prank(alice);
        uint256 cash = vault.withdrawDeposit(old, ONE);
        _finish(1, 500e6, 500e6, 0, 0);
        assertEq(cash - aliceControl, 200e6);
        assertEq(bobControl - vault.nodeWithdrawView(remaining), 200e6);
        _assertAccounting(0, 0);
    }

    function test_newDepositBeforeOldProfitCapturesFallbackButWaitsItsOwnCooldown() public {
        uint48 old = _deposit(alice, 100e6);
        vm.warp(block.timestamp + 1 days);
        _open(1, 100e6, 100e6);
        vm.prank(alice);
        vault.withdrawDeposit(old, ONE);
        uint48 fresh = _deposit(bob, 50e6);
        uint64 deadline = vault.withdrawAfter(fresh);
        _finish(1, 0, 0, 0, 0);
        assertEq(vault.nodeWithdrawView(fresh), 150e6);
        assertEq(vault.withdrawAfter(fresh), deadline);
        assertEq(uint8(vault.depositState(fresh).status), uint8(ILiquidityVaultBank.LPStatus.CoolingDown));
        _assertAccounting(0, 0);
    }

    function testFuzz_realBankAndVaultConserveCashAcrossTerminal(uint128 payoutSeed, uint128 refundSeed, bool blocked)
        public
    {
        _deposit(alice, 1_000e6);
        _open(1, 100e6, 300e6);
        uint256 refund = bound(refundSeed, 0, 100e6);
        uint256 payout = bound(payoutSeed, 0, 300e6 - refund - 5e6);
        token.setBlocked(player, blocked);
        _finish(1, payout, payout, refund, 5e6);
        assertEq(vault.getReserve(), 1_100e6 - payout - refund - 5e6);
        assertEq(bank.pendingStakeTotal(), 0);
        assertEq(bank.totalReserved(), 0);
        _assertAccounting(0, 0);
    }
}
