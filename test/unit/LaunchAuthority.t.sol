// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {GovernanceTimelock} from "../../src/access/GovernanceTimelock.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {IPoolRegistry} from "../../src/core/interfaces/IPoolRegistry.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {GovernedStub} from "../utils/GovernedStub.sol";
import {LaunchFixture} from "../utils/LaunchFixture.sol";

/// @notice B1 acceptance (ADR-0037 §2, §3, §9; audit F-03; design review R1-R7, P1, P3, P4) on a system deployed
///         as decision D1 prescribes.
contract LaunchAuthorityTest is LaunchFixture {
    // ------------------------------------------------------------------ timelock

    /// R1: the Safe proposes and cancels, the guardian only cancels, execution is open, only T administers T, and
    /// the deployer holds no power at any time.
    function test_timelockRolesLeaveTheDeployerNoPower() public {
        _deploy();
        assertEq(tl.MIN_DELAY(), DELAY);
        assertEq(tl.getMinDelay(), DELAY);
        assertTrue(tl.hasRole(tl.PROPOSER_ROLE(), SAFE));
        assertTrue(tl.hasRole(tl.CANCELLER_ROLE(), SAFE));
        assertTrue(tl.hasRole(tl.CANCELLER_ROLE(), GUARDIAN));
        assertFalse(tl.hasRole(tl.PROPOSER_ROLE(), GUARDIAN));
        assertTrue(tl.hasRole(tl.EXECUTOR_ROLE(), address(0)));
        assertTrue(tl.hasRole(tl.DEFAULT_ADMIN_ROLE(), address(tl)));
        assertFalse(tl.hasRole(tl.DEFAULT_ADMIN_ROLE(), DEPLOYER));
        assertFalse(tl.hasRole(tl.PROPOSER_ROLE(), DEPLOYER));
        assertFalse(tl.hasRole(tl.CANCELLER_ROLE(), DEPLOYER));
        assertEq(registry.governance(), address(tl));
        assertEq(hub.governance(), address(tl));
        assertEq(bank.governance(), address(tl));
        assertEq(refReg.governance(), address(tl));

        bytes32 proposerRole = tl.PROPOSER_ROLE();
        vm.startPrank(DEPLOYER);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.setSettlementRouterOnce(address(router));
        vm.expectRevert();
        tl.schedule(address(bank), 0, "", bytes32(0), bytes32(0), DELAY);
        vm.expectRevert();
        tl.grantRole(proposerRole, DEPLOYER);
        vm.stopPrank();
        vm.prank(SAFE);
        vm.expectRevert();
        tl.updateDelay(DELAY + 1);
    }

    /// D7: the constructor refuses a delay below 72 hours, a zero proposer or canceller and a canceller that is also
    /// a proposer. try/catch keeps every case in one test: an expected revert of a creation ends the test.
    function test_timelockConstructorRefusesShortDelaysAndBadRoles() public {
        address[] memory safe = _list(SAFE);
        address[] memory guardian = _list(GUARDIAN);
        _assertConstructorRefuses(DELAY - 1, safe, guardian);
        _assertConstructorRefuses(DELAY, _list(address(0)), guardian);
        _assertConstructorRefuses(DELAY, safe, _list(address(0)));
        _assertConstructorRefuses(DELAY, safe, safe);
        GovernanceTimelock longer = new GovernanceTimelock(DELAY + 1, safe, guardian, _list(address(0)));
        assertEq(longer.getMinDelay(), DELAY + 1);
    }

    /// D7: an executed delay change can raise the delay but never set it below 72 hours, and the new delay binds
    /// operations scheduled afterwards.
    function test_executedDelayChangeRaisesButNeverLowersTheDelay() public {
        _deploy();
        (address[] memory t, bytes[] memory d) = _one(address(tl), abi.encodeCall(tl.updateDelay, (DELAY - 1)));
        _schedule(t, d, "lower");
        vm.warp(vm.getBlockTimestamp() + DELAY);
        vm.expectRevert(abi.encodeWithSelector(GovernanceTimelock.DelayBelowMinimum.selector, DELAY - 1));
        _execute(t, d, "lower");

        _govCall(address(tl), abi.encodeCall(tl.updateDelay, (DELAY * 2)), "raise");
        assertEq(tl.getMinDelay(), DELAY * 2);
        (t, d) = _one(address(bank), abi.encodeCall(bank.setMinBetAmount, (20_000)));
        vm.prank(SAFE);
        vm.expectRevert();
        tl.scheduleBatch(t, new uint256[](1), d, bytes32(0), "short", DELAY);
    }

    // ------------------------------------------------------------------ admission (audit F-03)

    /// F-03 and R2: no admission takes effect at once. Before the batch nothing can take risk; at 72 h - 1 s the batch
    /// is not executable; afterwards the pool is inactive and takes deposits but no bets until a second operation.
    function test_admissionsWaitSeventyTwoHoursAndLaunchInactive() public {
        _deploy();
        vm.prank(SAFE);
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.registerPool(POOL, address(token), address(bank), SSOTTypes.PoolDomain.Casino);
        _fund(ALICE);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.UnknownGame.selector, GAME_DICE));
        hub.quoteVRFFee(GAME_DICE, 1, tx.gasprice);

        (address[] memory t, bytes[] memory d) = _wiringBatch();
        _schedule(t, d, "wiring");
        vm.warp(vm.getBlockTimestamp() + DELAY - 1);
        vm.expectRevert();
        _execute(t, d, "wiring");
        vm.warp(vm.getBlockTimestamp() + 1);
        _execute(t, d, "wiring");

        assertFalse(registry.isPoolActive(POOL));
        assertFalse(bank.riskInPaused());
        assertEq(registry.sentinel(), SAFE);
        assertEq(hub.sentinel(), SAFE);
        assertEq(bank.sentinel(), SAFE);
        assertEq(bank.guardian(), GUARDIAN);
        token.mint(LP, 1_000e6);
        vm.startPrank(LP);
        token.approve(address(vault), type(uint256).max);
        vault.addDeposit(1_000e6);
        vm.stopPrank();
        uint256 fee = _fee(GAME_DICE);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.RiskInPaused.selector, POOL));
        hub.placeBet{value: fee}(GAME_DICE, POOL, abi.encode(true, uint8(50)), _spec(1e6), address(0), 0);

        _govCall(address(registry), abi.encodeCall(registry.setPoolActive, (POOL, true)), "activate");
        uint256 betId = _bet(ALICE, GAME_DICE, 1e6, address(0));
        assertEq(uint256(hub.getBet(betId).state), uint256(SSOTTypes.BetState.PendingVRF));
    }

    /// R4: a Bank still governed by its deployer is refused when the queued admission executes.
    function test_queuedAdmissionOfAStrayBankFailsAtExecution() public {
        _launch();
        vm.prank(DEPLOYER);
        Bank stray = new Bank(address(token), DEPLOYER, 6000, 6, 10_000);
        (address[] memory t, bytes[] memory d) = _one(
            address(registry),
            abi.encodeCall(registry.registerPool, (2, address(token), address(stray), SSOTTypes.PoolDomain.Casino))
        );
        _schedule(t, d, "pool2");
        vm.warp(vm.getBlockTimestamp() + DELAY);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.ForeignGovernance.selector, address(stray)));
        _execute(t, d, "pool2");
    }

    // ------------------------------------------------------------------ sentinel

    /// R3: the sentinel's risk-reducing directions take effect at once; it cannot admit, loosen or unpause, and none
    /// of its actions blocks settlement of an accepted bet. The guardian cannot disable a game.
    function test_sentinelDeclinesAtOnceButCannotAdmit() public {
        _launch();
        uint256 pending = _bet(ALICE, GAME_DICE, 10e6, address(0));
        vm.startPrank(SAFE);
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.setPoolActive(POOL, true);
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.setHubAllowedForPool(POOL, address(hub), true);
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.setHubRegistered(address(hub), true);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.registerGame(keccak256("X"), address(dice), 1, CALLBACK_GAS);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.queueEdgeChange(100);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.setRiskInPaused(false);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.setSentinel(address(0));

        registry.setHubAllowedForPool(POOL, address(hub), false);
        registry.setPoolActive(POOL, false);
        registry.setHubRegistered(address(hub), false);
        hub.disableGame(GAME_DICE);
        bank.setRiskInPaused(true);
        vm.stopPrank();
        assertFalse(registry.isPoolActive(POOL));
        assertFalse(registry.isRegisteredHub(address(hub)));
        assertTrue(hub.gameDisabled(GAME_DICE));
        assertTrue(bank.riskInPaused());

        _fulfill(pending, _seed(pending, true));
        assertEq(uint256(hub.getBet(pending).state), uint256(SSOTTypes.BetState.Settled));
        vm.prank(GUARDIAN);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.disableGame(keccak256("OTHER"));
    }

    /// The sentinel cancels a queued edge change, which keeps the current edge.
    function test_sentinelCancelsAQueuedEdgeChange() public {
        _launch();
        _govCall(address(hub), abi.encodeCall(hub.queueEdgeChange, (300)), "edge");
        vm.prank(SAFE);
        hub.cancelEdgeChange();
        vm.prank(GUARDIAN);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.cancelEdgeChange();
        assertEq(hub.defaultHouseEdgeBps(), 200);
    }

    // ------------------------------------------------------------------ D5 and residual R-8

    /// R7 (D5): once ready, anyone executes an operation and a later cancel loses the race; nothing expires.
    function test_readyOperationsRunForAnyoneAndNeverExpire() public {
        _launch();
        (address[] memory t, bytes[] memory d) = _one(address(bank), abi.encodeCall(bank.setMinBetAmount, (20_000)));
        bytes32 id = _schedule(t, d, "race");
        vm.warp(vm.getBlockTimestamp() + DELAY);
        _execute(t, d, "race");
        vm.prank(GUARDIAN);
        vm.expectRevert();
        tl.cancel(id);
        assertEq(bank.minBetAmount(), 20_000);

        (t, d) = _one(address(bank), abi.encodeCall(bank.setMinBetAmount, (30_000)));
        _schedule(t, d, "stale");
        vm.warp(vm.getBlockTimestamp() + DELAY + 365 days);
        _execute(t, d, "stale");
        assertEq(bank.minBetAmount(), 30_000);
    }

    /// The guardian cancels any operation while it waits.
    function test_guardianCancelsAWaitingOperation() public {
        _launch();
        (address[] memory t, bytes[] memory d) = _one(address(bank), abi.encodeCall(bank.setMinBetAmount, (20_000)));
        bytes32 id = _schedule(t, d, "cancelled");
        vm.warp(vm.getBlockTimestamp() + DELAY - 1);
        vm.prank(GUARDIAN);
        tl.cancel(id);
        vm.warp(vm.getBlockTimestamp() + 1);
        vm.expectRevert();
        _execute(t, d, "cancelled");
        assertEq(bank.minBetAmount(), 10_000);
    }

    /// Residual R-8: the Safe renouncing PROPOSER_ROLE takes effect at once and leaves nobody to propose.
    function test_safeRenouncingProposerFreezesGovernance() public {
        _launch();
        bytes32 proposer = tl.PROPOSER_ROLE();
        vm.prank(SAFE);
        tl.renounceRole(proposer, SAFE);
        vm.prank(SAFE);
        vm.expectRevert();
        tl.schedule(address(registry), 0, abi.encodeCall(registry.setPoolActive, (POOL, false)), 0, 0, DELAY);
        vm.prank(GUARDIAN);
        vm.expectRevert();
        tl.schedule(address(tl), 0, abi.encodeCall(tl.grantRole, (proposer, SAFE)), 0, 0, DELAY);
        assertFalse(tl.hasRole(proposer, SAFE));
    }

    // ------------------------------------------------------------------ the exit window

    /// P1: a pause refuses deposits and lets a mature NFT exit in full.
    function test_pauseRefusesDepositsAndAMatureNftExits() public {
        _launch();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(GUARDIAN);
        bank.setRiskInPaused(true);
        token.mint(LP, 1e6);
        vm.prank(LP);
        vm.expectRevert(LiquidityVault.DepositsPaused.selector);
        vault.addDeposit(1e6);
        uint256 before = token.balanceOf(LP);
        vm.prank(LP);
        assertEq(vault.withdrawDeposit(lpId, ONE), 10_000e6);
        assertEq(token.balanceOf(LP) - before, 10_000e6);
    }

    /// P4 (plan §7.6): a compromised Safe pauses as sentinel and queues a hostile hub together with the unpause; a
    /// mature LP still exits in full inside the 72-hour window.
    function test_lpExitsInsideTheWindowWhileAHostileAdmissionIsQueued() public {
        _launch();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        uint256 queuedAt = vm.getBlockTimestamp();
        vm.prank(SAFE);
        bank.setRiskInPaused(true);
        address rogue = address(new GovernedStub(address(tl)));
        address[] memory t = new address[](3);
        bytes[] memory d = new bytes[](3);
        t[0] = address(registry);
        d[0] = abi.encodeCall(registry.setHubRegistered, (rogue, true));
        t[1] = address(registry);
        d[1] = abi.encodeCall(registry.setHubAllowedForPool, (POOL, rogue, true));
        t[2] = address(bank);
        d[2] = abi.encodeCall(bank.setRiskInPaused, (false));
        _schedule(t, d, "hostile");

        vm.warp(queuedAt + 1 hours);
        vm.prank(LP);
        assertEq(vault.withdrawDeposit(lpId, ONE), 10_000e6);
        assertFalse(registry.isRegisteredHub(rogue));
    }

    /// P3 after B3 and D6 (a): a rogue guardian that pauses and cancels both the unpause and its own replacement
    /// freezes no LP, player or referrer funds, even a year later. Residual R-3 is limited to stopping new bets
    /// and deposits.
    function test_rogueGuardianFreezesNoLpPlayerOrReferrerFunds() public {
        _launch();
        vm.prank(BOB);
        refReg.bind(BOB, CAROL);
        uint256 betId = _bet(ALICE, GAME_DICE, 100e6, BOB);
        _fulfill(betId, _seed(betId, false));
        uint256 aliceXp = bank.xpAccruedOf(ALICE);
        uint256 bobXp = bank.xpAccruedOf(BOB);
        assertGt(aliceXp, 0);
        assertGt(bobXp, 0);

        vm.prank(GUARDIAN);
        bank.setRiskInPaused(true);
        (address[] memory t1, bytes[] memory d1) = _one(address(bank), abi.encodeCall(bank.setRiskInPaused, (false)));
        bytes32 unpause = _schedule(t1, d1, "unpause");
        address[] memory t2 = new address[](2);
        bytes[] memory d2 = new bytes[](2);
        t2[0] = address(bank);
        d2[0] = abi.encodeCall(bank.setGuardian, (NEW_GUARDIAN));
        t2[1] = address(tl);
        d2[1] = abi.encodeCall(tl.revokeRole, (tl.CANCELLER_ROLE(), GUARDIAN));
        bytes32 replace = _schedule(t2, d2, "replace");
        vm.startPrank(GUARDIAN);
        tl.cancel(unpause);
        tl.cancel(replace);
        vm.stopPrank();

        vm.warp(vm.getBlockTimestamp() + 365 days);
        assertTrue(bank.riskInPaused());
        vm.prank(ALICE);
        assertEq(bank.claimXPAccrued(aliceXp, ALICE), aliceXp);
        vm.prank(BOB);
        assertEq(bank.claimXPAccrued(bobXp, BOB), bobXp);
        LiquidityVault.DepositState memory state = vault.depositState(lpId);
        assertEq(uint256(state.status), uint256(ILiquidityVaultBank.LPStatus.Ready));
        vm.prank(LP);
        assertEq(vault.withdrawDeposit(lpId, ONE), state.assets);
    }

    function _assertConstructorRefuses(uint256 delay, address[] memory proposers, address[] memory cancellers)
        internal
    {
        try new GovernanceTimelock(delay, proposers, cancellers, _list(address(0))) returns (GovernanceTimelock) {
            fail();
        } catch (bytes memory reason) {
            assertEq(bytes4(reason), GovernanceTimelock.InvalidTimelockConfig.selector);
        }
    }
}
