// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";

import {Bank} from "../../src/core/Bank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {IReferralEngine} from "../../src/engines/referral/IReferralEngine.sol";

/// @dev Drives the Bank through the six classes of operation that move its
///      accounting: deposit, withdraw, hold, settle, refund, and the optional
///      outflows (protocol fees, XP claims).
///
///      `settleBet` performs no solvency check of its own -- it releases the
///      reserve, pays the player, and accrues PF/XP without consulting `nav()`.
///      The handler models GameHub's two independent calculations: the fee is
///      charged on payoutGross, while PF/XP accrue on stake minus refund. A
///      losing bet therefore accrues liabilities even when its payout fee is
///      zero. The real referral engine splits a valid two-level configuration
///      into accrued, locked, holdback and protocol sink buckets.
///
///      This Bank-focused model bounds reserves as the casino modules do
///      (reserved >= stake), and checks NAV >= all remaining reserves after
///      interleaved settlements. GameHubE2E separately exercises the real hub,
///      module, VRF and router path for the losing-bet case.
contract BankHandler is Test {
    Bank public bank;
    MockERC20 public asset;
    address public gov;
    DefaultReferralEngine public referralEngine;

    address[3] public lps;
    address[3] public players;
    address[2] public payees;

    uint256 public nextBetId = 1;

    struct HeldBet {
        address player;
        uint256 stake;
        uint256 reserved;
    }

    mapping(uint256 => HeldBet) public heldBets;
    uint256[] public openBetIds;

    // Mirrors maintained independently of the Bank so the assertions compare two
    // sources rather than restating one.
    uint256 public mirrorReserved;
    uint256 public settleCount;
    uint256 public refundCount;
    uint256 public solvencyReverts;
    uint256 public unexpectedDebtOutReverts;

    constructor(Bank bank_, MockERC20 asset_, address gov_) {
        bank = bank_;
        asset = asset_;
        gov = gov_;
        referralEngine = new DefaultReferralEngine();

        lps = [address(0x1111), address(0x2222), address(0x3333)];
        players = [address(0xAAA1), address(0xAAA2), address(0xAAA3)];
        payees = [address(0xBBB1), address(0xBBB2)];

        for (uint256 i = 0; i < lps.length; i++) {
            asset.mint(lps[i], 1_000_000e6);
            vm.prank(lps[i]);
            asset.approve(address(bank), type(uint256).max);
        }
        for (uint256 i = 0; i < players.length; i++) {
            asset.mint(players[i], 1_000_000e6);
            vm.prank(players[i]);
            asset.approve(address(bank), type(uint256).max);
        }
    }

    function openBetCount() external view returns (uint256) {
        return openBetIds.length;
    }

    // ------------------------------------------------------------- LP actions

    function action_deposit(uint256 seed, uint256 amountRaw) external {
        address lp = lps[seed % lps.length];
        uint256 amount = (amountRaw % 50_000e6) + 1e6;
        if (asset.balanceOf(lp) < amount) return;

        vm.prank(lp);
        try bank.deposit(amount, lp) {} catch {}
    }

    function action_withdraw(uint256 seed, uint256 amountRaw) external {
        address lp = lps[seed % lps.length];
        uint256 max = bank.maxWithdraw(lp);
        if (max == 0) return;
        uint256 amount = (amountRaw % max) + 1;
        if (amount > max) amount = max;

        vm.prank(lp);
        try bank.withdraw(amount, lp, lp) {} catch {}
    }

    // ----------------------------------------------------------- bet lifecycle

    function action_hold(uint256 seed, uint256 stakeRaw, uint256 multRaw) external {
        address player = players[seed % players.length];
        uint256 stake = (stakeRaw % 1_000e6) + 1e6;
        // Reserve is the worst-case payout, so it is a multiple of the stake.
        uint256 reserved = stake * ((multRaw % 5) + 1);
        if (asset.balanceOf(player) < stake) return;

        uint256 betId = nextBetId;
        try bank.holdBet(betId, player, stake, reserved, keccak256(abi.encode(betId))) {
            heldBets[betId] = HeldBet({player: player, stake: stake, reserved: reserved});
            openBetIds.push(betId);
            mirrorReserved += reserved;
            nextBetId = betId + 1;
        } catch {
            // Refused for solvency or pause; counted so a run that never held
            // anything is visible rather than silently vacuous.
            solvencyReverts += 1;
        }
    }

    function action_settle(uint256 seed, uint256 grossRaw, uint256 feeBpsRaw, uint256 refundRaw) external {
        if (openBetIds.length == 0) return;
        uint256 idx = seed % openBetIds.length;
        uint256 betId = openBetIds[idx];
        HeldBet memory b = heldBets[betId];

        uint256 refundAmount = refundRaw % (b.stake + 1);
        uint256 maxGross = b.reserved - refundAmount;
        uint256 payoutGross = maxGross == 0 ? 0 : grossRaw % (maxGross + 1);

        // A 2% base edge plus a permitted affiliate delta, up to 10% total.
        uint16 deltaBps = uint16(feeBpsRaw % 801);
        uint256 effectiveHouseEdgeBps = 200 + uint256(deltaBps);
        uint256 feeOnPayout = (payoutGross * effectiveHouseEdgeBps) / 10_000;
        uint256 payoutNet = payoutGross - feeOnPayout;
        (uint256 pfAccrual, SSOTTypes.XPAward[] memory awards) = _turnoverAwards(b, refundAmount, deltaBps);

        try bank.settleBet(betId, payoutGross, payoutNet, refundAmount, pfAccrual, awards) {
            mirrorReserved -= b.reserved;
            _removeOpenBet(idx);
            settleCount += 1;
        } catch {
            unexpectedDebtOutReverts += 1;
        }
    }

    function action_refund(uint256 seed, uint256 refundRaw) external {
        if (openBetIds.length == 0) return;
        uint256 idx = seed % openBetIds.length;
        uint256 betId = openBetIds[idx];
        HeldBet memory b = heldBets[betId];
        uint256 refundAmount = refundRaw % (b.stake + 1);

        try bank.refundBet(betId, refundAmount) {
            mirrorReserved -= b.reserved;
            _removeOpenBet(idx);
            refundCount += 1;
        } catch {
            unexpectedDebtOutReverts += 1;
        }
    }

    // -------------------------------------------------------- optional outflows

    function action_claimProtocolFees(uint256 amountRaw) external {
        uint256 payable_ = bank.protocolFeesPayable();
        if (payable_ == 0) return;
        uint256 amount = (amountRaw % payable_) + 1;

        vm.prank(gov);
        try bank.claimProtocolFees(amount, gov) {} catch {}
    }

    function action_claimXPAccrued(uint256 seed, uint256 amountRaw) external {
        address payee = payees[seed % payees.length];
        uint256 accrued = bank.xpAccruedOf(payee);
        if (accrued == 0) return;
        uint256 amount = (amountRaw % accrued) + 1;

        vm.prank(payee);
        try bank.claimXPAccrued(amount, payee) {} catch {}
    }

    function action_unlockXPLocked(uint256 seed) external {
        address payee = payees[seed % payees.length];
        address player = players[seed % players.length];
        try bank.unlockXPLocked(payee, player) {} catch {}
    }

    function action_syncXPHoldback(uint256 seed, uint256 elapsedRaw) external {
        vm.warp(block.timestamp + (elapsedRaw % 7 days) + 1);
        bank.syncXPHoldback(payees[seed % payees.length]);
    }

    function action_setBps(uint256 riskRaw, uint256 bufferRaw) external {
        vm.startPrank(gov);
        try bank.setRiskReserveBps(riskRaw % 5_001) {} catch {}
        try bank.setWithdrawalBufferBps(bufferRaw % 5_001) {} catch {}
        vm.stopPrank();
    }

    function action_togglePause(uint256 seed) external {
        // Pause sparingly. A run that pauses early and never unpauses cannot
        // hold anything afterwards, which makes the rest of its sequence
        // vacuous -- the paused state is worth reaching, not worth camping in.
        bool pause = seed % 4 == 0;
        vm.prank(gov);
        try bank.setRiskInPaused(pause) {} catch {}
    }

    // ------------------------------------------------------------------ helpers

    function _turnoverAwards(HeldBet memory b, uint256 refundAmount, uint16 deltaBps)
        internal
        view
        returns (uint256 pfAccrual, SSOTTypes.XPAward[] memory awards)
    {
        uint256 usedTurnover = b.stake - refundAmount;
        uint256 baseHEAmount = (usedTurnover * 200) / 10_000;
        uint256 deltaHEAmount = (usedTurnover * uint256(deltaBps)) / 10_000;
        uint256 baseBudget = (baseHEAmount * 5_000) / 10_000;
        uint256 deltaBudget = (deltaHEAmount * 7_500) / 10_000;
        uint256 turnoverAfter = bank.playerTurnover(b.player) + usedTurnover;
        uint256 minTurnover = bank.minPlayerTurnoverForUnlock();

        uint16[6] memory levelBps;
        levelBps[1] = 10_000;
        address[] memory uplines = new address[](1);
        uplines[0] = payees[0];
        IReferralEngine.Plan memory basePlan = referralEngine.splitBase(
            IReferralEngine.BaseInput({
                baseBudget: baseBudget,
                levelBps: levelBps,
                levels: 2,
                uplines: uplines,
                holdbackBps: 3_000,
                minTurnover: minTurnover,
                playerTurnover: turnoverAfter
            })
        );
        IReferralEngine.Plan memory deltaPlan = referralEngine.splitDelta(
            abi.encodePacked(payees[1], deltaBps),
            IReferralEngine.DeltaPolicy({
                deltaBudget: deltaBudget, holdbackBps: 3_000, minTurnover: minTurnover, playerTurnover: turnoverAfter
            })
        );
        pfAccrual = baseHEAmount - baseBudget + deltaHEAmount - deltaBudget + basePlan.sink + deltaPlan.sink;

        // L0 is zero in this configuration, matching GameHub's absence of a
        // player-kick award. The base upline and one skyline segment each get
        // the exact bucket amounts returned by DefaultReferralEngine.
        uint256 baseCount = basePlan.payees.length;
        awards = new SSOTTypes.XPAward[](baseCount + deltaPlan.payees.length);
        for (uint256 i = 0; i < awards.length; ++i) {
            IReferralEngine.Plan memory plan = i < baseCount ? basePlan : deltaPlan;
            uint256 index = i < baseCount ? i : i - baseCount;
            awards[i] = SSOTTypes.XPAward({
                payee: plan.payees[index],
                sourcePlayer: b.player,
                accrued: plan.immediate[index],
                locked: plan.locked[index],
                holdback: plan.holdback[index],
                reason: i < baseCount ? bytes32("base") : bytes32("delta")
            });
        }
    }

    function _removeOpenBet(uint256 idx) internal {
        openBetIds[idx] = openBetIds[openBetIds.length - 1];
        openBetIds.pop();
    }

    function sumOpenReserved() external view returns (uint256 total) {
        for (uint256 i = 0; i < openBetIds.length; i++) {
            total += heldBets[openBetIds[i]].reserved;
        }
    }
}

contract BankInvariants is StdInvariant, Test {
    address internal gov = address(0xA11CE);

    MockERC20 internal asset;
    Bank internal bank;
    BankHandler internal handler;

    function setUp() external {
        asset = new MockERC20("USD Coin", "USDC", 6);
        bank = new Bank(address(asset), gov, 1_000, "LP USDC", "lpUSDC", 6);

        handler = new BankHandler(bank, asset, gov);

        // The handler stands in for the SettlementRouter, which is the only
        // caller allowed to hold, settle and refund.
        vm.startPrank(gov);
        bank.setSettlementRouterOnce(address(handler));
        bank.setMinPlayerTurnoverForUnlock(20e6);
        vm.stopPrank();

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](11);
        selectors[0] = handler.action_deposit.selector;
        selectors[1] = handler.action_withdraw.selector;
        selectors[2] = handler.action_hold.selector;
        selectors[3] = handler.action_settle.selector;
        selectors[4] = handler.action_refund.selector;
        selectors[5] = handler.action_claimProtocolFees.selector;
        selectors[6] = handler.action_claimXPAccrued.selector;
        selectors[7] = handler.action_unlockXPLocked.selector;
        selectors[8] = handler.action_setBps.selector;
        selectors[9] = handler.action_togglePause.selector;
        selectors[10] = handler.action_syncXPHoldback.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// Cash must cover both accrued liabilities and every outstanding reserve.
    /// Checking only B >= PF + XP would miss the insolvent state 0 <= NAV < R.
    function invariant_bank_is_solvent() external view {
        uint256 B = asset.balanceOf(address(bank));
        uint256 liabilities = bank.protocolFeesPayable() + bank.externalPayablesTotal();
        assertGe(B, liabilities, "B must cover PF + XP");
        assertGe(B - liabilities, bank.totalReserved(), "NAV must cover all open reserves");
    }

    function invariant_valid_debt_out_never_reverts() external view {
        assertEq(handler.unexpectedDebtOutReverts(), 0, "valid settle/refund must stay live");
    }

    /// getSSOT() computes NAV through AccountingLib.nav(), so it must not revert
    /// under any reachable sequence. This is the end-to-end form of the above.
    function invariant_ssot_is_readable() external view {
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertEq(s.NAV, s.B - s.PF - s.XP, "NAV must equal B - PF - XP");
    }

    /// Reserved is mirrored two ways: the handler's running total and the sum of
    /// the bets it believes are still open. Both must equal the Bank's own.
    function invariant_reserved_mirrors_open_holds() external view {
        assertEq(bank.totalReserved(), handler.mirrorReserved(), "reserved must match handler mirror");
        assertEq(bank.totalReserved(), handler.sumOpenReserved(), "reserved must match sum of open holds");
    }

    /// The XP bucket decomposition the SSOT documents as an E-class invariant.
    function invariant_xp_buckets_decompose() external view {
        assertEq(
            bank.externalPayablesTotal(),
            bank.xpAccruedTotal() + bank.xpLockedTotal() + bank.xpHoldbackTotal(),
            "XP must equal accrued + locked + holdback"
        );
    }

    /// `convertToAssets(totalSupply) <= NAV` is NOT an invariant, and asserting
    /// it fails within a few hundred calls. The ERC4626 virtual offset makes a
    /// share worth marginally more on paper than the vault holds as soon as
    /// per-share value drops below 1 -- which happens whenever the house has
    /// paid out more than it took in. Concretely
    ///
    ///     convertToAssets(supply) - NAV = v * (supply - NAV) / (supply + v)
    ///
    /// which is positive exactly when `supply > NAV`. The offset exists to make
    /// a dust first deposit unable to dilute later LPs, and it errs in the
    /// direction that protects them, so the overstatement is intended.
    ///
    /// What must hold is that it stays dust: the expression above is strictly
    /// below `v`, so the paper overstatement can never accumulate into real
    /// over-issuance no matter how the vault is driven.
    function invariant_virtual_offset_overstatement_stays_dust() external view {
        uint256 supply = bank.totalSupply();
        if (supply == 0) return;
        SSOTTypes.SSOT memory s = bank.getSSOT();
        uint256 claim = bank.convertToAssets(supply);
        if (claim <= s.NAV) return;
        assertLt(claim - s.NAV, 10 ** bank.decimals(), "overstatement must stay under one asset unit");
    }

    /// Proof that the handler can actually drive the Bank, rather than having
    /// every action swallowed by its `try/catch` and leaving the invariants
    /// above to hold vacuously.
    ///
    /// Deliberately a plain deterministic test and NOT `afterInvariant`:
    /// `afterInvariant` runs after *every* sequence, including the one-call
    /// sequences the shrinker produces, so asserting coverage there fails as
    /// soon as a run happens to pause first and hold nothing. Coverage is a
    /// property of the suite, not of each individual run.
    function test_handlerCanDriveFullBetLifecycle() external {
        // Raw arguments are reduced modulo a cap inside each action, so pick
        // values that survive it: 100_000e6 % 50_000e6 is 0, which would deposit
        // 1 USDC and make every hold below fail on solvency.
        handler.action_deposit(0, 40_000e6);

        handler.action_hold(0, 500e6, 2);
        assertEq(handler.openBetCount(), 1, "hold did not take");
        assertGt(bank.totalReserved(), 0, "reserve was not taken");

        handler.action_settle(0, 900e6, 200, 0);
        assertEq(handler.settleCount(), 1, "settle did not take");
        assertGt(bank.protocolFeesPayable(), 0, "settle accrued no protocol fee");
        assertGt(bank.externalPayablesTotal(), 0, "settle awarded no XP");

        handler.action_hold(1, 400e6, 3);
        handler.action_refund(0, 100e6);
        assertEq(handler.refundCount(), 1, "refund did not take");

        handler.action_claimProtocolFees(type(uint256).max);
        handler.action_claimXPAccrued(0, type(uint256).max);

        assertEq(bank.totalReserved(), handler.mirrorReserved(), "mirror drifted");
    }

    function test_turnoverAccrualPreservesInterleavedReserves() external {
        handler.action_deposit(0, 40_000e6);
        handler.action_hold(0, 9e6, 1); // stake 10, reserve 20
        handler.action_hold(1, 100e6, 2); // stake 101, reserve 303
        handler.action_hold(2, 200e6, 3); // stake 201, reserve 804
        assertEq(handler.openBetCount(), 3);

        // No payout, a partial refund, and 5% of used turnover still accrues.
        // The old payout-fee model would incorrectly accrue nothing here.
        handler.action_settle(0, 0, 300, 2e6);
        assertEq(handler.settleCount(), 1);
        assertEq(bank.totalFeeOnPayout(), 0);
        assertEq(bank.totalTurnover(), 8e6);
        assertEq(bank.protocolFeesPayable() + bank.externalPayablesTotal(), 400_000);
        assertGt(bank.xpLockedTotal(), 0, "below-threshold referral amount must lock");
        assertGt(bank.xpHoldbackTotal(), 0, "holdback must be exercised");
        _assertOpenReserveSolvency(303e6 + 804e6);

        // The first removal swaps bet 3 into index 0; bet 2 remains at index 1.
        // Settle bet 2 at its maximum gross payout while bet 3 stays reserved.
        handler.action_settle(1, 303e6, 800, 0);
        assertEq(handler.settleCount(), 2);
        _assertOpenReserveSolvency(804e6);
        handler.action_claimProtocolFees(type(uint256).max);
        handler.action_claimXPAccrued(0, type(uint256).max);
        _assertOpenReserveSolvency(804e6);

        handler.action_refund(0, 201e6);
        assertEq(handler.refundCount(), 1);
        assertEq(handler.unexpectedDebtOutReverts(), 0);
        _assertOpenReserveSolvency(0);
    }

    function _assertOpenReserveSolvency(uint256 expectedReserved) internal view {
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertEq(s.R, expectedReserved);
        assertEq(s.R, handler.mirrorReserved());
        assertGe(s.NAV, s.R, "settlement must preserve every other open reserve");
    }
}
