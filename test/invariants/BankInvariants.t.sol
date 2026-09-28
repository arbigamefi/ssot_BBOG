// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";

import {Bank} from "../../src/core/Bank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {IReferralEngine} from "../../src/engines/referral/IReferralEngine.sol";

/// @dev Drives the Bank through the classes of operation that move its
///      accounting: deposit, redemption Requests and their batches and claims
///      (ADR-0034), hold, settle, refund, player payables, and the optional
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
    BlacklistToken public asset;
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

    // ADR-0034 mirrors and violation counters. A counter records a violation instead of asserting, because a
    // failed assertion inside a handler call is just a reverted call to the invariant runner.
    uint256 public holdsWhileDraining;
    uint256 public pricingViolations;
    uint256 public pricedBatchCount;
    uint256 public claimedAssets;
    uint256 public claimedShares;
    uint256 public cancelCount;
    uint256 public claimCount;

    constructor(Bank bank_, BlacklistToken asset_, address gov_) {
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

    function action_requestRedeem(uint256 seed, uint256 sharesRaw) external {
        address owner = lps[seed % lps.length];
        // Usually the owner controls its own Request; sometimes it hands control to another LP.
        address controller = lps[(seed / lps.length) % lps.length];
        uint256 balance = bank.balanceOf(owner);
        if (balance == 0) return;
        uint256 shares = (sharesRaw % balance) + 1;

        vm.prank(owner);
        try bank.requestRedeem(shares, controller, owner) {} catch {}
    }

    function action_cancelRedeem(uint256 seed) external {
        address controller = lps[seed % lps.length];
        vm.prank(controller);
        try bank.cancelRedeemRequest(controller) {
            cancelCount += 1;
        } catch {}
    }

    function action_settleBatch() external {
        uint256 first = bank.firstUnpricedBatch();
        if (first == bank.nextBatchId()) return;
        uint256 q = bank.redeemBatch(first).shares;
        uint256 nav = bank.totalAssets();
        uint256 supply = bank.totalSupply();
        uint256 v = 10 ** bank.decimals();

        try bank.settleBatch() returns (uint256 priced) {
            pricedBatchCount += priced;
            // The first batch priced here saw exactly these inputs.
            uint256 expected = Math.min(Math.mulDiv(q, nav + v, supply + v), Math.mulDiv(q, nav, supply));
            if (bank.redeemBatch(first).assets != expected) pricingViolations += 1;
            if (bank.openHolds() != 0 || bank.totalReserved() != 0) pricingViolations += 1;
        } catch {}
    }

    function action_syncRedeem(uint256 seed) external {
        bank.syncRedeem(lps[seed % lps.length]);
    }

    function action_claim(uint256 seed, uint256 amountRaw, bool byAssets) external {
        address controller = lps[seed % lps.length];
        vm.startPrank(controller);
        if (byAssets) {
            uint256 max = bank.maxWithdraw(controller);
            if (max != 0) {
                try bank.withdraw((amountRaw % max) + 1, controller, controller) returns (uint256 shares) {
                    claimedAssets += (amountRaw % max) + 1;
                    claimedShares += shares;
                    claimCount += 1;
                } catch {}
            }
        } else {
            uint256 max = bank.maxRedeem(controller);
            if (max != 0) {
                try bank.redeem((amountRaw % max) + 1, controller, controller) returns (uint256 assets) {
                    claimedAssets += assets;
                    claimedShares += (amountRaw % max) + 1;
                    claimCount += 1;
                } catch {}
            }
        }
        vm.stopPrank();
    }

    function action_warp(uint256 elapsedRaw) external {
        vm.warp(block.timestamp + (elapsedRaw % 2 days) + 1);
    }

    function action_toggleBlock(uint256 seed) external {
        address player = players[seed % players.length];
        asset.setBlocked(player, !asset.blocked(player));
    }

    function action_claimPlayerPayable(uint256 seed) external {
        try bank.claimPlayerPayable(players[seed % players.length]) {} catch {}
    }

    // ----------------------------------------------------------- bet lifecycle

    function action_hold(uint256 seed, uint256 stakeRaw, uint256 multRaw) external {
        address player = players[seed % players.length];
        uint256 stake = (stakeRaw % 1_000e6) + 1e6;
        // Reserve is the worst-case payout, so it is a multiple of the stake.
        uint256 reserved = stake * ((multRaw % 5) + 1);
        if (asset.balanceOf(player) < stake) return;

        uint256 betId = nextBetId;
        bool draining = bank.redemptionDraining();
        try bank.holdBet(betId, player, stake, reserved, keccak256(abi.encode(betId))) {
            if (draining) holdsWhileDraining += 1;
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

        // A 2% base edge plus a permitted affiliate markup, up to the 5% edge cap.
        uint16 deltaBps = uint16(feeBpsRaw % 301);
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

    /// @dev SSOT v1.6 allocation for a bet with a 2% base edge plus `deltaBps` markup: payees[0] is the player's
    ///      referrer (L1, no L2) and payees[1] owns the single markup segment. Protocol fees take whatever of the
    ///      operator share the awards do not.
    function _turnoverAwards(HeldBet memory b, uint256 refundAmount, uint16 deltaBps)
        internal
        view
        returns (uint256 pfAccrual, SSOTTypes.XPAward[] memory awards)
    {
        uint256 usedTurnover = b.stake - refundAmount;
        IReferralEngine.Allocation memory alloc;
        (alloc, awards) = referralEngine.allocate(
            IReferralEngine.AllocationInput({
                usedTurnover: usedTurnover,
                baseEdgeBps: 200,
                effectiveEdgeBps: 200 + deltaBps,
                player: b.player,
                l1: payees[0],
                l2: address(0),
                l0Bps: 1_000,
                l1Bps: 2_000,
                l2Bps: 500,
                holdbackBps: 3_000,
                minTurnover: bank.minPlayerTurnoverForUnlock(),
                playerTurnover: bank.playerTurnover(b.player) + usedTurnover
            }),
            abi.encodePacked(payees[1], deltaBps)
        );
        pfAccrual = alloc.protocolFee;
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

    BlacklistToken internal asset;
    Bank internal bank;
    BankHandler internal handler;

    function setUp() external {
        asset = new BlacklistToken();
        bank = new Bank(address(asset), gov, 1_000, "LP USDC", "lpUSDC", 6);

        handler = new BankHandler(bank, asset, gov);

        // The handler stands in for the SettlementRouter, which is the only
        // caller allowed to hold, settle and refund.
        vm.startPrank(gov);
        bank.setSettlementRouterOnce(address(handler));
        bank.setMinPlayerTurnoverForUnlock(20e6);
        vm.stopPrank();

        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](19);
        selectors[0] = handler.action_deposit.selector;
        selectors[1] = handler.action_requestRedeem.selector;
        selectors[2] = handler.action_hold.selector;
        selectors[3] = handler.action_settle.selector;
        selectors[4] = handler.action_refund.selector;
        selectors[5] = handler.action_claimProtocolFees.selector;
        selectors[6] = handler.action_claimXPAccrued.selector;
        selectors[7] = handler.action_unlockXPLocked.selector;
        selectors[8] = handler.action_setBps.selector;
        selectors[9] = handler.action_togglePause.selector;
        selectors[10] = handler.action_syncXPHoldback.selector;
        selectors[11] = handler.action_cancelRedeem.selector;
        selectors[12] = handler.action_settleBatch.selector;
        selectors[13] = handler.action_syncRedeem.selector;
        selectors[14] = handler.action_claim.selector;
        selectors[15] = handler.action_warp.selector;
        selectors[16] = handler.action_toggleBlock.selector;
        selectors[17] = handler.action_claimPlayerPayable.selector;
        selectors[18] = handler.action_settleBatch.selector; // weighted: batches must actually get priced
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// Cash must cover every liability and every outstanding reserve: PF, XP, priced exits and player payables
    /// (ADR-0034 invariant 14). Checking only B >= liabilities would miss the insolvent state 0 <= NAV < R.
    function invariant_bank_is_solvent() external view {
        uint256 B = asset.balanceOf(address(bank));
        uint256 liabilities =
            bank.protocolFeesPayable() + bank.externalPayablesTotal() + bank.exitPayable() + bank.playerPayableTotal();
        assertGe(B, liabilities, "B must cover PF + XP + exitPayable + playerPayableTotal");
        assertGe(B - liabilities, bank.totalReserved(), "NAV must cover all open reserves");
    }

    function invariant_valid_debt_out_never_reverts() external view {
        assertEq(handler.unexpectedDebtOutReverts(), 0, "valid settle/refund must stay live");
    }

    /// getSSOT() computes NAV through AccountingLib.nav(), so it must not revert
    /// under any reachable sequence. This is the end-to-end form of the above.
    function invariant_ssot_is_readable() external view {
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertEq(
            s.NAV,
            s.B - s.PF - s.XP - bank.exitPayable() - bank.playerPayableTotal(),
            "NAV must equal B - PF - XP - exitPayable - playerPayableTotal"
        );
        assertEq(bank.totalAssets(), s.NAV, "one NAV for the share price and the SSOT");
    }

    /// Escrowed shares stay in supply and are held by the Bank until their batch is priced; nothing else moves
    /// them (ADR-0034 invariants 1 and 13). The handler never sends shares to the Bank directly.
    function invariant_escrow_matches_pending_requests() external view {
        uint256 unpriced;
        for (uint256 id = bank.firstUnpricedBatch(); id < bank.nextBatchId(); ++id) {
            unpriced += bank.redeemBatch(id).shares;
        }
        uint256 pending;
        uint256 wallets;
        for (uint256 i; i < 3; ++i) {
            pending += bank.pendingRedeemRequest(0, handler.lps(i));
            wallets += bank.balanceOf(handler.lps(i));
        }
        assertEq(bank.balanceOf(address(bank)), unpriced, "the Bank holds exactly the unpriced batches' shares");
        assertEq(pending, unpriced, "pending views add up to the unpriced batches");
        assertEq(bank.totalSupply(), wallets + unpriced, "shares are conserved");
    }

    /// Every priced asset is either still payable, claimed, or a released rounding remainder, and every priced
    /// share is either claimable or claimed (ADR-0034 invariants 7 and 8).
    function invariant_priced_exits_are_conserved() external view {
        uint256 pricedAssets;
        uint256 pricedShares;
        uint256 released;
        for (uint256 id = 1; id < bank.firstUnpricedBatch(); ++id) {
            IBank.RedeemBatch memory b = bank.redeemBatch(id);
            assertTrue(b.priced, "every batch below the first unpriced one is priced");
            pricedAssets += b.assets;
            pricedShares += b.shares;
            if (b.assignedShares == b.shares) released += b.assets - b.assignedAssets;
        }
        assertEq(bank.exitPayable() + handler.claimedAssets() + released, pricedAssets, "exit assets conserved");

        uint256 claimableShares;
        uint256 claimableAssets;
        for (uint256 i; i < 3; ++i) {
            (, uint256 shares, uint256 assets) = bank.redeemRequestOf(handler.lps(i));
            claimableShares += shares;
            claimableAssets += assets;
        }
        assertEq(claimableShares + handler.claimedShares(), pricedShares, "priced shares conserved");
        assertGe(bank.exitPayable(), claimableAssets, "exitPayable covers every claimable entitlement");
        // An unassigned rounding remainder is below one unit per controller of its batch.
        assertLe(bank.exitPayable() - claimableAssets, 3 * handler.pricedBatchCount(), "remainders stay dust");
    }

    /// At most two unpriced batches; no position opens while a batch that reached its cutoff is unpriced; every
    /// batch is priced at min(virtual quote, real equity) with no position open (ADR-0034 invariants 2 and 3).
    function invariant_batches_close_betting_and_price_at_real_equity() external view {
        assertLe(bank.nextBatchId() - bank.firstUnpricedBatch(), 2, "at most two unpriced batches");
        assertEq(handler.holdsWhileDraining(), 0, "no hold accepted while a batch drains");
        assertEq(handler.pricingViolations(), 0, "pricing inputs and ceiling");
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

    /// Coverage for the redemption actions, as above: a full request, drain, price and claim cycle, a
    /// cancellation, and a refused payout that becomes a player payable.
    function test_handlerCanDriveARedemptionCycle() external {
        handler.action_deposit(0, 40_000e6);
        handler.action_deposit(1, 20_000e6);
        handler.action_hold(0, 500e6, 2);
        handler.action_requestRedeem(0, 10_000e6 - 1); // LP 0 asks for 10,000 shares under its own control
        handler.action_requestRedeem(4, 5_000e6 - 1); // seed 4: LP 1 owns and controls its Request
        handler.action_cancelRedeem(1);
        assertEq(handler.cancelCount(), 1, "cancel did not take");

        handler.action_warp(2 days - 1);
        assertTrue(bank.redemptionDraining(), "the cutoff passed");
        handler.action_hold(1, 100e6, 1);
        assertEq(handler.openBetCount(), 1, "a hold was accepted while draining");

        handler.action_settleBatch();
        assertEq(handler.pricedBatchCount(), 0, "priced with a position open");
        handler.action_toggleBlock(0);
        handler.action_settle(0, 1_000e6, 0, 0);
        assertGt(bank.playerPayableTotal(), 0, "the refused payout did not become a payable");

        handler.action_settleBatch();
        assertEq(handler.pricedBatchCount(), 1, "the drained batch was not priced");
        handler.action_claim(0, 3_000e6 - 1, true);
        handler.action_claim(0, type(uint256).max, false);
        assertEq(handler.claimCount(), 2, "claims did not take");

        handler.action_toggleBlock(0);
        handler.action_claimPlayerPayable(0);
        assertEq(bank.playerPayableTotal(), 0, "the payable was not paid");
        assertEq(handler.pricingViolations(), 0);
        assertEq(handler.holdsWhileDraining(), 0);
    }

    function test_turnoverAccrualPreservesInterleavedReserves() external {
        handler.action_deposit(0, 40_000e6);
        handler.action_hold(0, 9e6, 1); // stake 10, reserve 20
        handler.action_hold(1, 100e6, 2); // stake 101, reserve 303
        handler.action_hold(2, 200e6, 3); // stake 201, reserve 804
        assertEq(handler.openBetCount(), 3);

        // No payout, a partial refund, and the operator half of the 5% used-turnover edge still accrues.
        // The old payout-fee model would incorrectly accrue nothing here.
        handler.action_settle(0, 0, 300, 2e6);
        assertEq(handler.settleCount(), 1);
        assertEq(bank.totalFeeOnPayout(), 0);
        assertEq(bank.totalTurnover(), 8e6);
        assertEq(bank.protocolFeesPayable() + bank.externalPayablesTotal(), 200_000);
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
