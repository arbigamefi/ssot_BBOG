// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {ISettlementRouter} from "../../src/core/interfaces/ISettlementRouter.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {LaunchFixture} from "../utils/LaunchFixture.sol";

/// @dev Always reverts with the gas its resolve starts with as the 32-byte revert data, which the void records as
///      BetVoided.settlementErrorPrefix: the test reads how much the settlement attempt inside voidBet received. It is
///      not an IGameModule because resolve must read gasleft (view, not pure); the Hub reaches it with a static call
///      all the same.
contract GasProbeModule {
    function validate(bytes calldata, SSOTTypes.StakeSpec calldata) external pure {}

    function maxPayout(bytes calldata, SSOTTypes.StakeSpec calldata s) external pure returns (uint256) {
        return s.amountPerRoll * uint256(s.betCount) * 2;
    }

    function resolve(bytes calldata, SSOTTypes.StakeSpec calldata, uint256, uint256[] calldata)
        external
        view
        returns (uint256, uint256)
    {
        uint256 g = gasleft();
        assembly ("memory-safe") {
            mstore(0, g)
            revert(0, 32)
        }
    }
}

/// @notice B5 acceptance (ADR-0037 §7, §10; design review V1-V13, C1, G1): the void of a received result that can
///         never be booked.
contract VoidBetTest is LaunchFixture {
    using stdStorage for StdStorage;

    uint256 internal constant TX_GAS_CAP = 16_777_216; // EIP-7825 on Base since Azul
    bytes32 internal constant GAME_PROBE = keccak256("PROBE");

    function setUp() public {
        _launch();
    }

    /// V1: a bookable result whose first callback ran out of gas settles inside voidBet and pays the winner.
    function test_bookableResultSettlesInsideVoidBet() public {
        uint256 id = _bet(ALICE, GAME_DICE_LOWGAS, 10e6, address(0));
        _fulfill(id, _seed(id, true));
        assertEq(_unbooked(), 1, "the first callback left the result unbooked");
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        uint256 before = token.balanceOf(ALICE);
        vm.prank(KEEPER);
        assertFalse(hub.voidBet(id), "settled, not voided");
        assertEq(uint256(hub.getBet(id).state), uint256(SSOTTypes.BetState.Settled));
        assertGt(token.balanceOf(ALICE) - before, 10e6, "the winner is paid");
        assertEq(_unbooked(), 0);
    }

    /// V2: without a window a bet waits 7 days; a window makes bets requested at or before it eligible after 24 h.
    function test_eligibilityClock() public {
        uint256 t0 = vm.getBlockTimestamp();
        uint256 a = _bet(ALICE, GAME_DEFECT, 10e6, address(0));
        _fulfill(a, 1);
        vm.warp(t0 + 24 hours);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.VoidNotEligible.selector, a, t0 + 24 hours, t0 + 7 days));
        hub.voidBet(a);

        _window(); // cohortEnd = t0 + 24 h
        uint256 b = _bet(BOB, GAME_DEFECT, 10e6, address(0)); // requested in the window's block: inside
        vm.warp(t0 + 24 hours + 1);
        uint256 c = _bet(CAROL, GAME_DEFECT, 10e6, address(0)); // requested after the window
        _fulfill(b, 2);
        _fulfill(c, 3);
        vm.prank(ALICE);
        assertTrue(hub.voidBet(a), "the affected player completes the set");
        vm.expectRevert(
            abi.encodeWithSelector(IGameHub.VoidNotEligible.selector, b, t0 + 24 hours + 1, t0 + 48 hours)
        );
        hub.voidBet(b);
        vm.warp(t0 + 48 hours);
        vm.prank(KEEPER);
        assertTrue(hub.voidBet(b));
        vm.expectRevert(
            abi.encodeWithSelector(IGameHub.VoidNotEligible.selector, c, t0 + 48 hours, t0 + 24 hours + 1 + 7 days)
        );
        hub.voidBet(c);
        vm.warp(t0 + 24 hours + 1 + 7 days);
        assertTrue(hub.voidBet(c), "anyone after 7 days");
        assertEq(_unbooked(), 0);
    }

    /// V3: a window needs an unbooked result and governance, the GameHub sentinel or the pool Bank's guardian.
    function test_windowAuthorityAndPrecondition() public {
        vm.prank(GUARDIAN);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.NoUnbookedResult.selector, address(bank)));
        hub.openVoidWindow(POOL);
        uint256 a = _bet(ALICE, GAME_DEFECT, 10e6, address(0));
        vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
        hub.voidBet(a); // no result yet: the timeout refund path applies instead
        _fulfill(a, 1);
        vm.prank(ALICE);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.openVoidWindow(POOL);
        vm.prank(NEW_GUARDIAN);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.openVoidWindow(POOL);

        vm.expectEmit(true, true, true, true, address(hub));
        emit IGameHub.VoidWindowOpened(POOL, address(bank), uint64(vm.getBlockTimestamp()), SAFE);
        vm.prank(SAFE);
        hub.openVoidWindow(POOL);
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        vm.prank(GUARDIAN);
        hub.openVoidWindow(POOL);
        assertEq(hub.voidCohortEnd(address(bank)), vm.getBlockTimestamp());
        vm.prank(SAFE);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.UnknownPool.selector, uint64(9)));
        hub.openVoidWindow(9);
    }

    /// V4 and §10: below the floor the call reverts and changes nothing; at the smallest passing call gas the
    /// settlement attempt still receives its whole budget, so the outcome cannot depend on the caller's gas (review
    /// F1: without the EIP-150 term it would get 1/64 less); after an attempt that spends its whole budget the void
    /// completes on the reserve, and the transaction fits the 16,777,216 cap with at least 1,000,000 to spare. Run
    /// isolated (make test-casino-admission) the figures are transaction-level with cold state.
    function test_isolatedVoidGasFloorAndTransactionCap() public {
        _govCall(
            address(hub),
            abi.encodeCall(hub.registerGame, (GAME_PROBE, address(new GasProbeModule()), 25, CALLBACK_GAS)),
            "probe"
        );
        uint256 probe = _bet(ALICE, GAME_PROBE, 10e6, address(0));
        uint256 burn = _bet(BOB, GAME_BURN, 10e6, address(0));
        _fulfill(probe, 4);
        _fulfill(burn, 5);
        assertEq(_unbooked(), 2, "both first callbacks failed");
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);

        uint256 floor = hub.VOID_SETTLEMENT_GAS() + hub.VOID_RESERVE_GAS() + hub.VOID_CALL_OVERHEAD();
        vm.expectPartialRevert(IGameHub.VoidGasTooLow.selector);
        hub.voidBet{gas: floor}(burn);
        assertEq(uint256(hub.getBet(burn).state), uint256(SSOTTypes.BetState.RandomReady), "nothing changed");

        uint256 probeGas = _smallestPassingCallGas(probe);
        vm.recordLogs();
        vm.prank(KEEPER);
        assertTrue(hub.voidBet{gas: probeGas}(probe));
        uint256 seen = _gasSeenByTheModule(probe);
        emit log_named_uint("gas at the module's resolve inside the attempt", seen);
        // The attempt gets VOID_SETTLEMENT_GAS; its own call to the module keeps 1/64 back.
        uint256 budget = hub.VOID_SETTLEMENT_GAS();
        assertGe(seen, budget * 63 / 64 - 50_000, "the attempt received its whole budget");
        assertLt(seen, budget);

        uint256 burnGas = _smallestPassingCallGas(burn);
        vm.prank(KEEPER);
        assertTrue(hub.voidBet{gas: burnGas}(burn), "a spent budget still leaves the reserve for the void");
        // Isolated, lastCallGas is the transaction's gross gas: everything outside the spent attempt is the void
        // branch plus the 21,000 intrinsic. ADR §10 keeps the reserve at least twice that (mock token here; real
        // USDC on a fork for certificate v5). Without --isolate the figure is not transaction-level.
        uint256 used = vm.lastCallGas().gasTotalUsed;
        if (used > hub.VOID_SETTLEMENT_GAS()) {
            uint256 outside = used - hub.VOID_SETTLEMENT_GAS();
            emit log_named_uint("gas outside the spent attempt", outside);
            assertLe(2 * outside, hub.VOID_RESERVE_GAS(), "the reserve covers twice the void branch");
        } else {
            emit log("not isolated: the reserve check runs in make test-casino-admission");
        }
        // The cap binds the transaction gas limit: call gas, 21,000 intrinsic and the 36 calldata bytes.
        uint256 minLimit = burnGas + 21_000 + _calldataGas(abi.encodeCall(hub.voidBet, (burn)));
        emit log_named_uint("smallest passing voidBet call gas", burnGas);
        emit log_named_uint("smallest transaction gas limit", minLimit);
        assertLe(minLimit + 1_000_000, TX_GAS_CAP, "fits the per-transaction cap with 1,000,000 to spare");
        assertEq(_unbooked(), 0);
    }

    /// V5: exactly one decrement per void; void excludes finalize, retry, refund, a second void and acknowledge.
    function test_exactCountAndExclusivePaths() public {
        uint256 a = _bet(ALICE, GAME_DEFECT, 10e6, address(0));
        uint256 b = _bet(BOB, GAME_DEFECT, 10e6, address(0));
        _fulfill(a, 11);
        _fulfill(b, 12);
        assertEq(_unbooked(), 2);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        assertTrue(hub.voidBet(a));
        assertEq(_unbooked(), 1);
        assertEq(uint8(vault.depositState(lpId).status), uint8(ILiquidityVaultBank.LPStatus.UnbookedResult));

        uint256 req = hub.getBet(a).requestId;
        vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
        hub.finalize(a);
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestState.selector, req, IVRFHub.RequestState.Voided));
        vrf.retry(req);
        vm.expectRevert(
            abi.encodeWithSelector(IGameHub.BadState.selector, a, SSOTTypes.BetState.Voided, SSOTTypes.BetState.PendingVRF)
        );
        hub.refund(a);
        vm.expectRevert(
            abi.encodeWithSelector(IGameHub.BadState.selector, a, SSOTTypes.BetState.Voided, SSOTTypes.BetState.RandomReady)
        );
        hub.voidBet(a);
        vm.prank(address(hub));
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestState.selector, req, IVRFHub.RequestState.Voided));
        vrf.acknowledge(req);
        uint256 reqB = hub.getBet(b).requestId;
        vm.prank(KEEPER);
        vm.expectRevert(IVRFHub.NotOwningHub.selector);
        vrf.acknowledgeVoid(reqB);
        vm.prank(address(hub));
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidTerminalPosition.selector, b));
        vrf.acknowledgeVoid(reqB); // the position is still held

        SSOTTypes.BetTerminal memory term = hub.getBetTerminal(a);
        assertEq(uint256(term.state), uint256(SSOTTypes.BetState.Voided));
        assertEq(term.refundAmount, 10e6);
        assertEq(term.payoutGross, 0);
        assertEq(hub.getBetRandomWords(a)[0], 11);
        assertEq(uint256(router.getPosition(a).state), uint256(SSOTTypes.PositionState.Voided));
        assertTrue(hub.voidBet(b));
        assertEq(_unbooked(), 0);
        assertEq(uint8(vault.depositState(lpId).status), uint8(ILiquidityVaultBank.LPStatus.Ready));
        assertEq(bank.totalBetsVoided(), 2);
        assertEq(bank.totalVoided(), 20e6);
        assertEq(bank.openHolds(), 0);
        assertEq(bank.playerPayable(ALICE), 10e6);
        assertTrue(bank.getSSOT().accountingValid);
    }

    /// V13 and §7.4: P -= stake, PP += stake, R -= reserved, K -= released; L, Vault and Bank cash, PF, XP and
    /// turnover unchanged; a duplicate VRF fulfilment afterwards is ignored and keeps the first seed.
    function test_voidAccountingIdentities() public {
        uint256 a = _bet(ALICE, GAME_DEFECT, 10e6, address(0)); // reserved 20e6, so 10e6 of LP capital locked
        _fulfill(a, 1);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        SSOTTypes.SSOT memory s0 = bank.getSSOT();
        assertTrue(hub.voidBet(a));
        SSOTTypes.SSOT memory s1 = bank.getSSOT();
        assertEq(s0.P - s1.P, 10e6, "P");
        assertEq(s1.PP - s0.PP, 10e6, "PP");
        assertEq(s0.R - s1.R, 20e6, "R");
        assertEq(s0.K - s1.K, 10e6, "K");
        assertEq(s1.L, s0.L, "L");
        assertEq(s1.vaultCash, s0.vaultCash, "Vault cash");
        assertEq(s1.bankCash, s0.bankCash, "Bank cash");
        assertEq(s1.PF, s0.PF, "PF");
        assertEq(s1.XP, s0.XP, "XP");
        assertEq(bank.totalTurnover(), 0, "turnover");
        assertTrue(s1.accountingValid);
        uint256 req = hub.getBet(a).requestId;
        uint256[] memory w = new uint256[](1);
        w[0] = 99;
        wrapper.repeatFulfillment(req, w);
        assertEq(uint256(vrf.getRequest(req).state), uint256(IVRFHub.RequestState.Voided));
        assertEq(vrf.getRequest(req).seed, 1, "first seed kept");
        assertEq(_unbooked(), 0);
    }

    /// V6: a void and the player's claim both work while the Bank is paused.
    function test_voidAndClaimWhilePaused() public {
        uint256 a = _bet(ALICE, GAME_DEFECT, 10e6, address(0));
        _fulfill(a, 1);
        vm.prank(GUARDIAN);
        bank.setRiskInPaused(true);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        assertTrue(hub.voidBet(a));
        uint256 before = token.balanceOf(ALICE);
        vm.prank(KEEPER);
        bank.claimPlayerPayable(ALICE);
        assertEq(token.balanceOf(ALICE) - before, 10e6);
    }

    /// V7 (P5a, P5b): an issuer freeze of the Vault or of the Bank does not stop the void; the payable waits for
    /// the freeze to end.
    function test_issuerFreezeOfVaultOrBank() public {
        uint256 a = _bet(ALICE, GAME_DICE, 10e6, address(0));
        uint256 b = _bet(BOB, GAME_DICE, 10e6, address(0));
        token.setBlocked(address(vault), true);
        _fulfill(a, _seed(a, true));
        token.setBlocked(address(vault), false);
        token.setBlocked(address(bank), true);
        _fulfill(b, _seed(b, false));
        assertEq(_unbooked(), 2);
        token.setBlocked(address(bank), false);
        token.setBlocked(address(vault), true);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        assertTrue(hub.voidBet(a), "Vault frozen");
        token.setBlocked(address(vault), false);
        token.setBlocked(address(bank), true);
        assertTrue(hub.voidBet(b), "Bank frozen");
        vm.expectRevert(bytes("blocked"));
        bank.claimPlayerPayable(BOB);
        token.setBlocked(address(bank), false);
        bank.claimPlayerPayable(BOB);
        assertEq(_unbooked(), 0);
    }

    /// V8 (P5c): an accounting-class fault stops the void as well; it is out of scope and the LP fence reports it.
    function test_accountingFaultAlsoStopsTheVoid() public {
        uint256 a = _bet(ALICE, GAME_DEFECT, 10e6, address(0));
        _fulfill(a, 1);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        uint256 cash = token.balanceOf(address(vault));
        stdstore.target(address(token)).sig("balanceOf(address)").with_key(address(vault)).checked_write(cash - 1);
        vm.expectRevert(LiquidityVault.CashDeficit.selector);
        hub.voidBet(a);
    }

    /// V9 (M-5): VRFHub received the seed but delivery to GameHub failed entirely, so the bet is still PendingVRF.
    /// The timeout refund is closed; voidBet records the seed first, then a bookable bet settles and a defective
    /// one voids.
    function test_pendingVrfWithAReceivedRequest() public {
        uint256 a = _bet(ALICE, GAME_DICE, 10e6, address(0));
        uint256 b = _bet(BOB, GAME_DEFECT, 10e6, address(0));
        vm.mockCallRevert(address(hub), abi.encodeWithSelector(GameHub.onRandomWords.selector), "delivery failed");
        _fulfill(a, _seed(a, true));
        _fulfill(b, 9);
        vm.clearMockedCalls();
        assertEq(uint256(hub.getBet(a).state), uint256(SSOTTypes.BetState.PendingVRF));
        assertEq(uint256(vrf.getRequest(hub.getBet(a).requestId).state), uint256(IVRFHub.RequestState.Received));
        vm.warp(vm.getBlockTimestamp() + 2 hours);
        vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
        hub.refund(a);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        assertFalse(hub.voidBet(a));
        assertEq(uint256(hub.getBet(a).state), uint256(SSOTTypes.BetState.Settled));
        assertTrue(hub.voidBet(b));
        assertTrue(hub.getBet(b).randomHash != bytes32(0), "seed recorded before the void");
    }

    /// V10, disclosed as residual R-5: during a transient failure the executor's order decides. Here the winner is
    /// voided while the Vault is frozen and the loser settles after the freeze ends.
    function test_executorOrderDecidesDuringATransientFailure() public {
        uint256 w = _bet(ALICE, GAME_DICE, 10e6, address(0));
        uint256 l = _bet(BOB, GAME_DICE, 10e6, address(0));
        token.setBlocked(address(vault), true);
        _fulfill(w, _seed(w, true));
        _fulfill(l, _seed(l, false));
        assertEq(_unbooked(), 2);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        vm.prank(KEEPER);
        assertTrue(hub.voidBet(w));
        token.setBlocked(address(vault), false);
        vm.prank(KEEPER);
        assertFalse(hub.voidBet(l));
        assertEq(bank.playerPayable(ALICE), 10e6);
        assertEq(uint256(hub.getBet(l).state), uint256(SSOTTypes.BetState.Settled));
        assertEq(hub.getBetTerminal(l).payoutGross, 0);
    }

    /// V11, disclosed in §7.3: while the Vault is frozen new bets are still accepted, and each can only void or
    /// wait. Only a pause or the sentinel stops them.
    function test_betsAreAcceptedWhileTheVaultIsFrozen() public {
        token.setBlocked(address(vault), true);
        uint256 id = _bet(ALICE, GAME_DICE, 10e6, address(0));
        _fulfill(id, _seed(id, false));
        assertEq(_unbooked(), 1);
        assertEq(uint256(hub.getBet(id).state), uint256(SSOTTypes.BetState.RandomReady));
    }

    /// V12 and review B0-M5: a void emits the events of all four contracts, including PlayerPayableCreated for the
    /// stake, so an indexer of payables misses nothing.
    function test_voidEvents() public {
        uint256 a = _bet(ALICE, GAME_DEFECT, 10e6, address(0));
        _fulfill(a, 1);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        vm.expectEmit(true, true, true, true, address(bank));
        emit IBank.PlayerPayableCreated(a, ALICE, 10e6);
        vm.expectEmit(true, true, true, true, address(bank));
        emit IBank.BetVoided(a, ALICE, 10e6);
        vm.expectEmit(true, true, true, true, address(router));
        emit ISettlementRouter.PositionVoided(a, address(hub), POOL, 10e6);
        vm.expectEmit(true, true, true, true, address(vrf));
        emit IVRFHub.ResultVoided(hub.getBet(a).requestId, address(bank));
        vm.expectEmit(true, true, true, false, address(hub));
        emit IGameHub.BetVoided(a, KEEPER, 10e6, bytes32(0));
        vm.prank(KEEPER);
        hub.voidBet(a);
    }

    /// C1 and G1: a void releases the player's open-hold slot, and a disabled game's accepted bets still void.
    function test_voidReleasesTheSlotAndWorksForADisabledGame() public {
        uint256 first = _bet(ALICE, GAME_DEFECT, 10e6, address(0));
        _bet(ALICE, GAME_DICE, 10e6, address(0));
        assertEq(bank.openHoldsOf(ALICE), 2);
        vm.prank(SAFE);
        hub.disableGame(GAME_DEFECT);
        _fulfill(first, 3);
        _window();
        vm.warp(vm.getBlockTimestamp() + 24 hours);
        assertTrue(hub.voidBet(first));
        assertEq(bank.openHoldsOf(ALICE), 1);
        _bet(ALICE, GAME_DICE, 10e6, address(0));
        assertEq(bank.openHoldsOf(ALICE), 2);
    }

    function _window() internal {
        vm.prank(GUARDIAN);
        hub.openVoidWindow(POOL);
    }

    /// Smallest call gas at which voidBet passes its gas check, by bisection; the state is restored each time.
    function _smallestPassingCallGas(uint256 betId) internal returns (uint256 high) {
        uint256 low = 10_000_000;
        high = 12_000_000;
        while (high - low > 1) {
            uint256 mid = (low + high) / 2;
            uint256 snap = vm.snapshotState();
            vm.prank(KEEPER);
            (bool ok,) = address(hub).call{gas: mid}(abi.encodeCall(hub.voidBet, (betId)));
            assertTrue(vm.revertToState(snap));
            if (ok) high = mid;
            else low = mid;
        }
    }

    function _gasSeenByTheModule(uint256 betId) internal returns (uint256) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (
                logs[i].emitter == address(hub) && logs[i].topics[0] == IGameHub.BetVoided.selector
                    && uint256(logs[i].topics[1]) == betId
            ) {
                (, bytes32 prefix) = abi.decode(logs[i].data, (uint256, bytes32));
                return uint256(prefix);
            }
        }
        revert("no BetVoided");
    }

    function _calldataGas(bytes memory data) internal pure returns (uint256 cost) {
        for (uint256 i; i < data.length; ++i) {
            cost += data[i] == 0 ? 4 : 16;
        }
    }
}
