// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {Errors} from "../../src/libs/Errors.sol";

/// @notice ExecutableSSOT v1.6 obligations for the house-edge allocation (SSOT v1.6, ADR-0032).
/// @dev LPs retain E - O of the turnover edge E, where O = floor(E / 2). Referral rewards and markup are paid
///      from O and the rest of O accrues as protocol fees. Worked-example numbers follow SSOT v1.6 section 9:
///      a 100-unit bet at a 2% edge under the schedule (L0, L1, L2) = (10%, 20%, 5%) of the base edge.
contract HouseEdgeAllocationV16Test is Test {
    uint64 internal constant POOL = 1;
    bytes32 internal constant DICE = keccak256("DICE");
    bytes32 internal constant COIN = keccak256("COIN_TOSS");
    bytes internal constant RNG_DOMAIN = "SSOT_RNG_V1";
    uint256 internal constant STAKE = 100 ether;

    address internal gov = address(0xA11CE);
    address internal alice = address(0xBEEF); // player
    address internal bob = address(0xB0B); // alice's referrer (L1)
    address internal carol = address(0xCA201); // bob's referrer (L2)
    address internal dave = address(0xDA7E);

    MockERC20 internal asset;
    Bank internal bank;
    SettlementRouter internal router;
    ReferralRegistry internal refRegistry;
    GameHub internal hub;
    VRFHub internal vrf;

    struct Allocated {
        uint256 usedTurnover;
        uint16 edgeBps;
        uint256 edge;
        uint256 operatorShare;
        uint256 lpRetained;
        uint256 protocolFee;
        uint256 r0;
        uint256 r1;
        uint256 r2;
        uint256 markup;
    }

    struct Outcome {
        uint256 id;
        Allocated a;
        uint256 pf; // protocol fees accrued by the settlement
        uint256 xp; // XP liabilities accrued by the settlement
    }

    function setUp() external {
        asset = new MockERC20("USD", "USD", 18);
        bank = new Bank(address(asset), gov, 1000, "LP", "LP", 18);
        PoolRegistry reg = new PoolRegistry(gov);
        router = new SettlementRouter(address(reg));
        vrf = new VRFHub(address(this), gov);
        refRegistry = new ReferralRegistry(gov);

        hub = new GameHub(
            address(router),
            address(vrf),
            address(refRegistry),
            address(new DefaultReferralEngine()),
            gov,
            3600,
            200,
            1000,
            2000,
            500,
            3000
        );

        vm.startPrank(gov);
        reg.registerPool(POOL, address(asset), address(bank), SSOTTypes.PoolDomain.Casino);
        reg.setHubRegistered(address(hub), true);
        reg.setHubAllowedForPool(POOL, address(hub), true);
        bank.setSettlementRouterOnce(address(router));
        refRegistry.setBinderOnce(address(hub));
        hub.registerGame(DICE, address(new DiceModule()));
        hub.registerGame(COIN, address(new CoinTossModule()));
        asset.mint(gov, 100_000 ether);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(50_000 ether, gov);
        vm.stopPrank();

        asset.mint(alice, 10_000 ether);
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        asset.approve(address(bank), type(uint256).max);
    }

    // ---------------------------------------------------------------------
    // SSOT v1.6 section 9 worked example (A1, A4, A5)
    // ---------------------------------------------------------------------

    function test_workedExample_noReferrer() external {
        Outcome memory o = _play(STAKE, false);

        _assertAllocation(o, 2 ether, 1 ether, 0, 0, 0, 0, 1 ether);
        assertEq(bank.xpAccruedOf(alice), 0, "no rakeback without a referrer");
    }

    function test_workedExample_l1Only() external {
        vm.prank(alice);
        hub.bindReferrer(bob);

        Outcome memory o = _play(STAKE, false);

        _assertAllocation(o, 2 ether, 1 ether, 0.2 ether, 0.4 ether, 0, 0, 0.4 ether);
        assertEq(bank.xpAccruedOf(alice), 0.2 ether, "L0 rakeback is immediately claimable");
        assertEq(bank.xpHoldbackOf(alice), 0, "L0 rakeback has no holdback");
        assertEq(bank.xpAccruedOf(bob) + bank.xpLockedOf(bob) + bank.xpHoldbackOf(bob), 0.4 ether);
        assertEq(bank.xpHoldbackOf(bob), 0.12 ether, "L1 follows the XP bucket rules");
    }

    function test_workedExample_l1AndL2() external {
        vm.prank(bob);
        refRegistry.bind(bob, carol);
        vm.prank(alice);
        hub.bindReferrer(bob);

        Outcome memory o = _play(STAKE, false);

        _assertAllocation(o, 2 ether, 1 ether, 0.2 ether, 0.4 ether, 0.1 ether, 0, 0.3 ether);
        assertEq(bank.xpAccruedOf(carol) + bank.xpLockedOf(carol) + bank.xpHoldbackOf(carol), 0.1 ether);
    }

    function test_affiliateHintBindsFirstTouchAndPaysFromThatBet() external {
        Outcome memory o = _playWithHint(STAKE, false, bob);

        assertEq(hub.referrerOf(alice), bob);
        _assertAllocation(o, 2 ether, 1 ether, 0.2 ether, 0.4 ether, 0, 0, 0.4 ether);
    }

    function test_nothingIsPaidBeyondL2() external {
        vm.prank(carol);
        refRegistry.bind(carol, dave);
        vm.prank(bob);
        refRegistry.bind(bob, carol);
        vm.prank(alice);
        hub.bindReferrer(bob);

        Outcome memory o = _play(STAKE, false);

        _assertAllocation(o, 2 ether, 1 ether, 0.2 ether, 0.4 ether, 0.1 ether, 0, 0.3 ether);
        assertEq(bank.xpAccruedOf(dave) + bank.xpLockedOf(dave) + bank.xpHoldbackOf(dave), 0, "no L3");
    }

    /// Over a fair win/lose pair LPs keep half of the edge: E - O per bet. NAV is measured across the whole
    /// bet lifecycle, since the stake enters the pool at placement.
    function test_fairPair_lpKeepsHalfTheEdge() external {
        int256 nav0 = int256(bank.totalAssets());
        _play(STAKE, false);
        int256 nav1 = int256(bank.totalAssets());
        _play(STAKE, true);
        int256 nav2 = int256(bank.totalAssets());

        assertEq(nav1 - nav0, int256(STAKE - 1 ether), "losing bet: stake minus the operator share");
        // winning bet: pays 200 gross minus the 2% fee, and still accrues the operator share
        assertEq(nav2 - nav1, -int256(STAKE - 4 ether + 1 ether), "winning bet");
        assertEq(nav2 - nav0, 2 ether, "LPs retain E - O = 1 on each of the two bets");
    }

    // ---------------------------------------------------------------------
    // Refunds and partial refunds (A6)
    // ---------------------------------------------------------------------

    function test_timeoutRefundAllocatesNothing() external {
        vm.prank(alice);
        hub.bindReferrer(bob);
        uint256 id = _place(DICE, abi.encode(true, uint8(50)), STAKE, 1, 0, address(0));
        SSOTTypes.SSOT memory before = bank.getSSOT();

        vm.warp(uint256(hub.getBet(id).placedAt) + hub.refundTimeoutSeconds());
        hub.refund(id);

        SSOTTypes.SSOT memory afterRefund = bank.getSSOT();
        assertEq(afterRefund.PF, before.PF);
        assertEq(afterRefund.XP, before.XP);
        assertEq(hub.getBetTerminal(id).protocolFeeAccrual, 0);
    }

    function test_partialRefundAllocatesOnUsedTurnoverOnly() external {
        vm.prank(alice);
        hub.bindReferrer(bob);

        // Five 20-unit coin tosses with a 10-unit stop gain: the first win stops the run, 80 is refunded.
        uint256 id = _place(COIN, abi.encode(true), 20 ether, 5, 10 ether, address(0));
        Outcome memory o = _finalize(id, _seedCoinFirstWin(id));

        assertEq(o.a.usedTurnover, 20 ether);
        // E = 0.4, O = 0.2, R0 = 0.04, R1 = 0.08, PF = 0.08
        _assertAllocation(o, 0.4 ether, 0.2 ether, 0.04 ether, 0.08 ether, 0, 0, 0.08 ether);
        assertEq(router.allocationCap(id, 80 ether), 0.2 ether);
    }

    // ---------------------------------------------------------------------
    // Non-retroactivity (A7)
    // ---------------------------------------------------------------------

    function test_bindingAfterAcceptanceDoesNotAddPayees() external {
        uint256 id = _place(DICE, abi.encode(true, uint8(50)), STAKE, 1, 0, address(0));
        (address l1, address l2) = hub.getBetReferralPayees(id);
        assertEq(l1, address(0));
        assertEq(l2, address(0));

        vm.prank(alice);
        hub.bindReferrer(bob);

        Outcome memory o = _finalize(id, _seedDice(id, false));
        _assertAllocation(o, 2 ether, 1 ether, 0, 0, 0, 0, 1 ether);
        assertEq(bank.xpAccruedOf(alice) + bank.xpHoldbackOf(bob) + bank.xpAccruedOf(bob), 0);
    }

    function test_uplineBindingAfterAcceptanceDoesNotAddL2() external {
        vm.prank(alice);
        hub.bindReferrer(bob);
        uint256 id = _place(DICE, abi.encode(true, uint8(50)), STAKE, 1, 0, address(0));

        vm.prank(bob);
        refRegistry.bind(bob, carol);

        Outcome memory o = _finalize(id, _seedDice(id, false));
        _assertAllocation(o, 2 ether, 1 ether, 0.2 ether, 0.4 ether, 0, 0, 0.4 ether);
        assertEq(bank.xpAccruedOf(carol) + bank.xpHoldbackOf(carol), 0);
    }

    function test_scheduleChangeAfterAcceptanceDoesNotApply() external {
        vm.prank(alice);
        hub.bindReferrer(bob);
        uint256 id = _place(DICE, abi.encode(true, uint8(50)), STAKE, 1, 0, address(0));

        vm.startPrank(gov);
        uint32 next = hub.createReferralConfig(0, 3500, 0, 0);
        hub.setActiveReferralConfig(next);
        vm.stopPrank();

        Outcome memory o = _finalize(id, _seedDice(id, false));
        _assertAllocation(o, 2 ether, 1 ether, 0.2 ether, 0.4 ether, 0, 0, 0.4 ether);

        // The next bet uses the new schedule: L1 35% of the base edge, no rakeback.
        Outcome memory n = _play(STAKE, false);
        _assertAllocation(n, 2 ether, 1 ether, 0, 0.7 ether, 0, 0, 0.3 ether);
    }

    function test_baseEdgeChangeWaitsForDelayAndIsNotRetroactive() external {
        uint256 id = _place(DICE, abi.encode(true, uint8(50)), STAKE, 1, 0, address(0));

        uint256 queuedAt = block.timestamp;
        vm.prank(gov);
        hub.queueBaseHouseEdge(300);
        (uint16 pendingBps, uint64 activatesAt) = hub.pendingBaseHouseEdge();
        assertEq(pendingBps, 300);
        assertEq(activatesAt, queuedAt + 7 days);

        vm.warp(activatesAt - 1);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.EdgeChangeNotReady.selector, activatesAt));
        hub.activateBaseHouseEdge();
        assertEq(hub.defaultHouseEdgeBps(), 200);

        vm.warp(activatesAt);
        vm.prank(dave); // activation is permissionless once the delay has passed
        hub.activateBaseHouseEdge();
        assertEq(hub.defaultHouseEdgeBps(), 300);
        (, activatesAt) = hub.pendingBaseHouseEdge();
        assertEq(activatesAt, 0);

        // The bet accepted at 2% settles at 2% even though it is finalized after the change.
        Outcome memory o = _finalize(id, _seedDice(id, false));
        assertEq(o.a.edgeBps, 200);
        assertEq(o.a.edge, 2 ether);

        Outcome memory n = _play(STAKE, false);
        assertEq(n.a.edgeBps, 300);
        _assertAllocation(n, 3 ether, 1.5 ether, 0, 0, 0, 0, 1.5 ether);
    }

    function test_cancelledBaseEdgeChangeCannotActivate() external {
        vm.startPrank(gov);
        hub.queueBaseHouseEdge(300);
        (, uint64 activatesAt) = hub.pendingBaseHouseEdge();
        hub.cancelBaseHouseEdge();
        vm.stopPrank();

        vm.warp(activatesAt);
        vm.expectRevert(IGameHub.NoPendingEdgeChange.selector);
        hub.activateBaseHouseEdge();
        assertEq(hub.defaultHouseEdgeBps(), 200);
    }

    // ---------------------------------------------------------------------
    // Affiliate markup (A1, A5, A8, G2)
    // ---------------------------------------------------------------------

    function test_markupStartsDisabled() external {
        assertEq(hub.maxAffiliateDeltaBps(), 0);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.HouseEdgeTooHigh.selector, uint16(201), uint16(200)));
        hub.setAffiliateHouseEdge(201);
    }

    function test_markupIncreaseWaitsForDelay_decreaseIsImmediate() external {
        vm.prank(gov);
        hub.setMaxAffiliateDeltaBps(100);
        assertEq(hub.maxAffiliateDeltaBps(), 0, "an increase is only queued");
        (uint16 pendingBps, uint64 activatesAt) = hub.pendingMaxAffiliateDelta();
        assertEq(pendingBps, 100);

        vm.expectRevert(abi.encodeWithSelector(IGameHub.EdgeChangeNotReady.selector, activatesAt));
        hub.activateMaxAffiliateDelta();

        vm.warp(activatesAt);
        hub.activateMaxAffiliateDelta();
        assertEq(hub.maxAffiliateDeltaBps(), 100);

        // A queued increase is superseded by a decrease, which applies at once.
        vm.startPrank(gov);
        hub.setMaxAffiliateDeltaBps(300);
        hub.setMaxAffiliateDeltaBps(50);
        vm.stopPrank();
        assertEq(hub.maxAffiliateDeltaBps(), 50);
        (, activatesAt) = hub.pendingMaxAffiliateDelta();
        assertEq(activatesAt, 0);
    }

    function test_markupOperatorHalfGoesToSkylinePayee() external {
        _enableMarkup(100);
        vm.prank(alice);
        hub.bindReferrer(bob);
        vm.prank(bob);
        hub.setAffiliateHouseEdge(300);

        Outcome memory o = _play(STAKE, false);

        // E = 3, E_b = 2, O = 1.5; markup budget = floor(1 / 2) = 0.5 to bob
        assertEq(o.a.edgeBps, 300);
        _assertAllocation(o, 3 ether, 1.5 ether, 0.2 ether, 0.4 ether, 0, 0.5 ether, 0.4 ether);
        assertEq(bank.xpAccruedOf(bob) + bank.xpLockedOf(bob) + bank.xpHoldbackOf(bob), 0.9 ether);
    }

    function test_markupSplitsAcrossSkylineInProportion() external {
        _enableMarkup(100);
        vm.prank(bob);
        refRegistry.bind(bob, carol);
        vm.prank(alice);
        hub.bindReferrer(bob);
        vm.prank(bob);
        hub.setAffiliateHouseEdge(250);
        vm.prank(carol);
        hub.setAffiliateHouseEdge(300);

        Outcome memory o = _play(STAKE, false);

        // Two 50 bps increments share the 0.5 markup budget equally.
        _assertAllocation(o, 3 ether, 1.5 ether, 0.2 ether, 0.4 ether, 0.1 ether, 0.5 ether, 0.3 ether);
        assertEq(bank.xpAccruedOf(bob) + bank.xpHoldbackOf(bob), 0.4 ether + 0.25 ether);
        assertEq(bank.xpAccruedOf(carol) + bank.xpHoldbackOf(carol), 0.1 ether + 0.25 ether);
    }

    function test_staleAffiliateEdgeIsClampedToTheCurrentCap() external {
        _enableMarkup(100);
        vm.prank(alice);
        hub.bindReferrer(bob);
        vm.prank(bob);
        hub.setAffiliateHouseEdge(300);

        vm.prank(gov);
        hub.setMaxAffiliateDeltaBps(0);

        Outcome memory o = _play(STAKE, false);
        assertEq(o.a.edgeBps, 200, "markup disabled: effective edge is the base edge");
        assertEq(o.a.markup, 0);
        assertEq(hub.getDeltaSkyline(o.id).length, 0);
    }

    function test_staleAffiliateEdgeIsClampedToALowerCap() external {
        _enableMarkup(100);
        vm.prank(alice);
        hub.bindReferrer(bob);
        vm.prank(bob);
        hub.setAffiliateHouseEdge(300);

        vm.prank(gov);
        hub.setMaxAffiliateDeltaBps(50);

        Outcome memory o = _play(STAKE, false);
        assertEq(o.a.edgeBps, 250, "a 300 bps setting prices at the 250 bps cap");
        // E = 2.5, E_b = 2, O = 1.25, markup budget = 0.25
        _assertAllocation(o, 2.5 ether, 1.25 ether, 0.2 ether, 0.4 ether, 0, 0.25 ether, 0.4 ether);
    }

    /// Every share is rounded down and remainders become protocol fees, never another payee's share.
    function test_roundingRemaindersAccrueToProtocol() external {
        _enableMarkup(100);
        vm.prank(bob);
        refRegistry.bind(bob, carol);
        vm.prank(alice);
        hub.bindReferrer(bob);
        vm.prank(bob);
        hub.setAffiliateHouseEdge(250); // +50 bps
        vm.prank(carol);
        hub.setAffiliateHouseEdge(270); // +20 bps

        Outcome memory o = _play(1_234_567, false);

        // E = floor(1234567 * 2.7%) = 33333, E_b = 24691, O = 16666, markup budget = floor(8642 / 2) = 4321.
        // R0 = 2469, R1 = 4938, R2 = 1234; markup: bob floor(4321 * 50/70) = 3086, carol floor(4321 * 20/70) =
        // 1234, one unit unallocated.
        _assertAllocation(o, 33_333, 16_666, 2_469, 4_938, 1_234, 4_320, 3_705);
        assertEq(bank.xpAccruedOf(carol) + bank.xpHoldbackOf(carol), 1_234 + 1_234);
    }

    function test_playerMaxHouseEdgeStillProtectsAgainstMarkup() external {
        _enableMarkup(100);
        vm.prank(alice);
        hub.bindReferrer(bob);
        vm.prank(bob);
        hub.setAffiliateHouseEdge(300);

        (uint256 fee,) = hub.quoteVRFFee(1);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: STAKE, betCount: 1, stopGain: 0, stopLoss: 0});
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.HouseEdgeTooHigh.selector, uint16(300), uint16(250)));
        hub.placeBet{value: fee}(DICE, POOL, abi.encode(true, uint8(50)), spec, address(0), 250);
    }

    function test_routerRecordsTheEffectiveEdge() external {
        _enableMarkup(100);
        vm.prank(alice);
        hub.bindReferrer(bob);
        vm.prank(bob);
        hub.setAffiliateHouseEdge(275);

        uint256 id = _place(DICE, abi.encode(true, uint8(50)), STAKE, 1, 0, address(0));
        assertEq(router.getPosition(id).edgeBps, 275);
        assertEq(hub.getBet(id).effectiveHouseEdgeBps, 275);
    }

    // ---------------------------------------------------------------------
    // Governance (G1-G4)
    // ---------------------------------------------------------------------

    function test_constants() external view {
        assertEq(hub.LP_SHARE_BPS(), 5000);
        assertEq(hub.MAX_REFERRAL_BPS(), 3500);
        assertEq(hub.MAX_HOUSE_EDGE_BPS(), 500);
        assertEq(hub.EDGE_CHANGE_DELAY(), 7 days);
    }

    function test_edgeBoundsAreEnforced() external {
        vm.startPrank(gov);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidBps.selector, uint256(0)));
        hub.queueBaseHouseEdge(0);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidBps.selector, uint256(501)));
        hub.queueBaseHouseEdge(501);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidBps.selector, uint256(501)));
        hub.setMaxAffiliateDeltaBps(501);
        vm.stopPrank();
    }

    function test_scheduleCapAndVersions() external {
        vm.startPrank(gov);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidBps.selector, uint256(3501)));
        hub.createReferralConfig(1000, 2000, 501, 3000);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidBps.selector, uint256(10_001)));
        hub.createReferralConfig(0, 0, 0, 10_001);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.UnknownReferralConfig.selector, uint32(2)));
        hub.setActiveReferralConfig(2);

        uint32 id = hub.createReferralConfig(0, 0, 0, 0); // referrals switched off
        hub.setActiveReferralConfig(id);
        vm.stopPrank();

        (uint16 l0, uint16 l1, uint16 l2, uint16 holdback) = hub.getReferralConfig(1);
        assertEq(abi.encode(l0, l1, l2, holdback), abi.encode(1000, 2000, 500, 3000), "schedule 1 is immutable");

        vm.prank(alice);
        hub.bindReferrer(bob);
        Outcome memory o = _play(STAKE, false);
        _assertAllocation(o, 2 ether, 1 ether, 0, 0, 0, 0, 1 ether);
    }

    function test_onlyGovernanceChangesAllocationParameters() external {
        vm.prank(gov);
        bank.setGuardian(dave);

        vm.startPrank(dave);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.queueBaseHouseEdge(300);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.cancelBaseHouseEdge();
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.setMaxAffiliateDeltaBps(0);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.cancelMaxAffiliateDelta();
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.createReferralConfig(0, 3500, 0, 0);
        vm.expectRevert(Errors.Unauthorized.selector);
        hub.setActiveReferralConfig(1);

        // Activation is permissionless, but only applies what governance queued.
        vm.expectRevert(IGameHub.NoPendingEdgeChange.selector);
        hub.activateBaseHouseEdge();
        vm.expectRevert(IGameHub.NoPendingEdgeChange.selector);
        hub.activateMaxAffiliateDelta();
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // Conservation and bounds under random schedules, chains and markup
    // ---------------------------------------------------------------------

    function testFuzz_allocationConservesTheEdge(
        uint256 stakeRaw,
        uint16 l0,
        uint16 l1,
        uint16 l2,
        uint8 depthRaw,
        uint16 markupRaw,
        bool win
    ) external {
        uint256 stake = bound(stakeRaw, 1_000, 1_000 ether);
        l0 = uint16(bound(l0, 0, 3500));
        l1 = uint16(bound(l1, 0, 3500 - uint256(l0)));
        l2 = uint16(bound(l2, 0, 3500 - uint256(l0) - uint256(l1)));
        uint256 depth = bound(depthRaw, 0, 2);
        uint16 markup = uint16(bound(markupRaw, 0, 300));

        vm.startPrank(gov);
        hub.setActiveReferralConfig(hub.createReferralConfig(l0, l1, l2, 3000));
        vm.stopPrank();
        _enableMarkup(300);
        if (depth == 2) {
            vm.prank(bob);
            refRegistry.bind(bob, carol);
        }
        if (depth >= 1) {
            vm.prank(alice);
            hub.bindReferrer(bob);
            vm.prank(bob);
            hub.setAffiliateHouseEdge(200 + markup);
        }

        Outcome memory o = _play(stake, win);
        Allocated memory a = o.a;
        uint16 effective = depth >= 1 ? 200 + markup : 200;
        uint256 baseEdge = stake * 200 / 10_000;

        assertEq(a.edgeBps, effective);
        assertEq(a.edge, stake * effective / 10_000, "E");
        assertEq(a.operatorShare, a.edge / 2, "O");
        assertEq(a.lpRetained, a.edge - a.operatorShare, "LP share");
        assertEq(a.r0, depth >= 1 ? baseEdge * l0 / 10_000 : 0, "R0");
        assertEq(a.r1, depth >= 1 ? baseEdge * l1 / 10_000 : 0, "R1");
        assertEq(a.r2, depth == 2 ? baseEdge * l2 / 10_000 : 0, "R2");
        assertEq(a.markup, depth >= 1 ? (a.edge - baseEdge) / 2 : 0, "M (single skyline segment)");
        assertLe(a.r0 + a.r1 + a.r2, baseEdge * 3500 / 10_000, "A3 referral cap");

        // A1 + A5: the event reconciles and the bank accrued exactly the operator share
        assertEq(a.lpRetained + a.protocolFee + a.r0 + a.r1 + a.r2 + a.markup, a.edge, "A1 conservation");
        assertEq(o.pf, a.protocolFee, "PF");
        assertEq(o.xp, a.r0 + a.r1 + a.r2 + a.markup, "XP");
        assertEq(o.pf + o.xp, router.allocationCap(o.id, 0), "accrues exactly the Router cap");
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    function _assertAllocation(
        Outcome memory o,
        uint256 edge,
        uint256 operatorShare,
        uint256 r0,
        uint256 r1,
        uint256 r2,
        uint256 markup,
        uint256 protocolFee
    ) internal pure {
        assertEq(o.a.edge, edge, "E");
        assertEq(o.a.operatorShare, operatorShare, "O");
        assertEq(o.a.lpRetained, edge - operatorShare, "LP retains E - O");
        assertEq(o.a.r0, r0, "R0");
        assertEq(o.a.r1, r1, "R1");
        assertEq(o.a.r2, r2, "R2");
        assertEq(o.a.markup, markup, "M");
        assertEq(o.a.protocolFee, protocolFee, "PF_new");
        assertEq(o.pf, protocolFee, "bank PF accrual");
        assertEq(o.xp, r0 + r1 + r2 + markup, "bank XP accrual");
    }

    function _enableMarkup(uint16 bps) internal {
        vm.prank(gov);
        hub.setMaxAffiliateDeltaBps(bps);
        (, uint64 activatesAt) = hub.pendingMaxAffiliateDelta();
        vm.warp(activatesAt);
        hub.activateMaxAffiliateDelta();
    }

    function _play(uint256 stake, bool win) internal returns (Outcome memory o) {
        return _playWithHint(stake, win, address(0));
    }

    function _playWithHint(uint256 stake, bool win, address hint) internal returns (Outcome memory o) {
        uint256 id = _place(DICE, abi.encode(true, uint8(50)), stake, 1, 0, hint);
        return _finalize(id, _seedDice(id, win));
    }

    function _place(
        bytes32 game,
        bytes memory params,
        uint256 amountPerRoll,
        uint32 betCount,
        uint256 stopGain,
        address hint
    ) internal returns (uint256 id) {
        (uint256 fee,) = hub.quoteVRFFee(betCount);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: amountPerRoll, betCount: betCount, stopGain: stopGain, stopLoss: 0});
        // The player accepts any edge up to the 5% cap; markup tests need more than the base edge.
        vm.prank(alice);
        id = hub.placeBet{value: fee}(game, POOL, params, spec, hint, 500);
    }

    function _finalize(uint256 id, uint256 seed) internal returns (Outcome memory o) {
        o.id = id;
        SSOTTypes.SSOT memory before = bank.getSSOT();

        uint256[] memory words = new uint256[](1);
        words[0] = seed;
        vrf.fulfillRandomWords(hub.getBet(id).requestId, words);
        vm.recordLogs();
        hub.finalize(id);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool found;
        for (uint256 i = 0; i < logs.length; ++i) {
            if (logs[i].emitter != address(hub) || logs[i].topics[0] != IGameHub.HouseEdgeAllocated.selector) {
                continue;
            }
            assertEq(uint256(logs[i].topics[1]), id);
            Allocated memory a = o.a;
            (
                a.usedTurnover,
                a.edgeBps,
                a.edge,
                a.operatorShare,
                a.lpRetained,
                a.protocolFee,
                a.r0,
                a.r1,
                a.r2,
                a.markup
            ) =
                abi.decode(
                    logs[i].data,
                    (uint256, uint16, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
                );
            found = true;
        }
        assertTrue(found, "HouseEdgeAllocated emitted");

        SSOTTypes.SSOT memory afterSettle = bank.getSSOT();
        o.pf = afterSettle.PF - before.PF;
        o.xp = afterSettle.XP - before.XP;

        // B1 / B2
        assertEq(bank.totalAssets(), afterSettle.NAV, "NAV identity");
        assertGe(afterSettle.B, afterSettle.PF + afterSettle.XP, "solvency");
        assertEq(hub.getBetTerminal(id).protocolFeeAccrual, o.pf, "terminal PF");
    }

    function _seedDice(uint256 id, bool win) internal pure returns (uint256 seed) {
        for (; seed < 4096; ++seed) {
            uint256 rolled = (uint256(keccak256(abi.encodePacked(RNG_DOMAIN, id, uint256(0), seed))) % 100) + 1;
            if ((rolled > 50) == win) return seed;
        }
        revert("no seed");
    }

    function _seedCoinFirstWin(uint256 id) internal pure returns (uint256 seed) {
        for (; seed < 4096; ++seed) {
            if (uint256(keccak256(abi.encodePacked(RNG_DOMAIN, id, uint256(0), seed))) % 2 == 1) return seed;
        }
        revert("no seed");
    }
}
