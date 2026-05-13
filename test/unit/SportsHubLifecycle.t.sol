// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {SportsHub} from "../../src/core/SportsHub.sol";
import {SportsRiskEngine} from "../../src/core/SportsRiskEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract SportsHubLifecycleTest is Test {
    address internal gov = address(0xA11CE);
    address internal player = address(0xB0B);
    address internal reporter = address(0xBEEF);
    uint256 internal oddsSignerKey = 0xA11CE1;
    address internal oddsSigner;

    bytes32 internal constant ODDS_SET_HASH = keccak256("ODDS_SET");
    bytes32 internal constant REPORTER_SET_HASH = keccak256("REPORTER_SET");
    bytes32 internal constant RESOLVED_MARKET_KEY = keccak256("NBA:LAL:BOS:ML:RESOLVED");
    bytes32 internal constant VOID_MARKET_KEY = keccak256("NBA:LAL:BOS:ML:VOID");
    bytes32 internal constant RULEBOOK_HASH = keccak256("SPORTS_RULEBOOK_V1");
    bytes32 internal constant RESULT_SOURCE_HASH = keccak256("NBA_FINAL_SCORE_PROVIDER");
    bytes32 internal constant RESULT_EVIDENCE_HASH = keccak256("LAL_WIN_EVIDENCE");
    bytes32 internal constant VOID_REASON = keccak256("EVENT_CANCELLED");

    uint64 internal constant SPORTS_POOL_ID = 2;
    uint64 internal constant RESOLVED_EVENT_ID = 7007;
    uint64 internal constant VOID_EVENT_ID = 7008;
    uint32 internal constant WINNING_OUTCOME_ID = 1;
    uint32 internal constant LOSING_OUTCOME_ID = 0;
    uint32 internal constant OUTCOME_COUNT = 2;
    uint64 internal constant FINALITY = 30 minutes;
    uint256 internal constant STAKE = 100e6;
    uint256 internal constant PAYOUT = 190e6;

    MockERC20 internal usdc;
    Bank internal sportsBank;
    PoolRegistry internal registry;
    SettlementRouter internal router;
    SportsRiskEngine internal riskEngine;
    SportsHub internal sportsHub;

    function setUp() external {
        vm.warp(1_700_000_000);
        oddsSigner = vm.addr(oddsSignerKey);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        sportsBank = new Bank(address(usdc), gov, 1000, "LP USDC Sports", "lpUSDC-S", 6);
        registry = new PoolRegistry(gov);
        router = new SettlementRouter(address(registry));
        riskEngine = new SportsRiskEngine(gov, 1_000e6, 2_000e6, 10_000e6, 5_000e6, 20_000e6);
        sportsHub = new SportsHub(address(router), address(riskEngine), gov, ODDS_SET_HASH, REPORTER_SET_HASH);

        vm.startPrank(gov);
        registry.registerPool(SPORTS_POOL_ID, address(usdc), address(sportsBank), SSOTTypes.PoolDomain.Sports);
        registry.setHubRegistered(address(sportsHub), true);
        registry.setHubAllowedForPool(SPORTS_POOL_ID, address(sportsHub), true);
        sportsBank.setSettlementRouterOnce(address(router));
        sportsHub.setOddsSigner(oddsSigner, true);
        sportsHub.setResultReporter(reporter, true);
        vm.stopPrank();

        usdc.mint(gov, 1_000_000e6);
        vm.startPrank(gov);
        usdc.approve(address(sportsBank), type(uint256).max);
        sportsBank.deposit(500_000e6, gov);
        vm.stopPrank();

        usdc.mint(player, 10_000e6);
        vm.prank(player);
        usdc.approve(address(sportsBank), type(uint256).max);
    }

    function test_phase0MockEventLifecycle_resolveAndVoidMarkets() external {
        uint64 resolvedMarket = _createAndOpenMarket(RESOLVED_EVENT_ID, RESOLVED_MARKET_KEY, 1 days);
        uint256 winningTicket = _placeTicket(resolvedMarket, WINNING_OUTCOME_ID, 1);
        uint256 losingTicket = _placeTicket(resolvedMarket, LOSING_OUTCOME_ID, 2);

        assertEq(usdc.balanceOf(player), 9_800e6);
        assertEq(sportsBank.totalReserved(), PAYOUT * 2);
        assertEq(sportsHub.marketReserved(resolvedMarket), PAYOUT * 2);
        assertEq(sportsHub.marketOutcomeReserved(resolvedMarket, WINNING_OUTCOME_ID), PAYOUT);
        assertEq(sportsHub.marketOutcomeReserved(resolvedMarket, LOSING_OUTCOME_ID), PAYOUT);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, RESOLVED_EVENT_ID), PAYOUT * 2);
        assertEq(sportsHub.eventReserved(RESOLVED_EVENT_ID), PAYOUT * 2);

        _lockProposeAndFinalize(resolvedMarket);

        uint256[] memory settleIds = new uint256[](2);
        settleIds[0] = winningTicket;
        settleIds[1] = losingTicket;
        sportsHub.settleTickets(settleIds);

        assertEq(usdc.balanceOf(player), 9_990e6);
        _assertMarketExposureCleared(resolvedMarket, RESOLVED_EVENT_ID);
        _assertTicketState(winningTicket, SSOTTypes.SportsTicketState.Settled, SSOTTypes.PositionState.Settled);
        _assertTicketState(losingTicket, SSOTTypes.SportsTicketState.Settled, SSOTTypes.PositionState.Settled);
        assertEq(uint256(sportsHub.getMarket(resolvedMarket).state), uint256(SSOTTypes.SportsMarketState.Resolved));

        uint64 voidMarket = _createAndOpenMarket(VOID_EVENT_ID, VOID_MARKET_KEY, 60 days);
        uint256 refundTicket = _placeTicket(voidMarket, WINNING_OUTCOME_ID, 3);
        uint256 voidTicket = _placeTicket(voidMarket, LOSING_OUTCOME_ID, 4);

        assertEq(usdc.balanceOf(player), 9_790e6);
        assertEq(sportsBank.totalReserved(), PAYOUT * 2);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, VOID_EVENT_ID), PAYOUT * 2);

        vm.prank(gov);
        sportsHub.voidMarket(voidMarket, VOID_REASON);

        uint256[] memory refundIds = new uint256[](1);
        refundIds[0] = refundTicket;
        sportsHub.refundTickets(refundIds);

        uint256[] memory voidIds = new uint256[](1);
        voidIds[0] = voidTicket;
        sportsHub.voidTickets(voidIds);

        assertEq(usdc.balanceOf(player), 9_990e6);
        _assertMarketExposureCleared(voidMarket, VOID_EVENT_ID);
        _assertTicketState(refundTicket, SSOTTypes.SportsTicketState.Refunded, SSOTTypes.PositionState.Refunded);
        _assertTicketState(voidTicket, SSOTTypes.SportsTicketState.Voided, SSOTTypes.PositionState.Refunded);
        assertEq(uint256(sportsHub.getMarket(voidMarket).state), uint256(SSOTTypes.SportsMarketState.Voided));
    }

    function _createAndOpenMarket(uint64 eventId, bytes32 marketKey, uint64 lockOffset)
        internal
        returns (uint64 marketId)
    {
        uint64 lockTime = uint64(block.timestamp + lockOffset);
        uint64 startsAt = lockTime + 1 hours;

        vm.startPrank(gov);
        marketId = sportsHub.createMarket(
            eventId, SPORTS_POOL_ID, OUTCOME_COUNT, startsAt, lockTime, FINALITY, marketKey, RULEBOOK_HASH
        );
        sportsHub.openMarket(marketId);
        vm.stopPrank();
    }

    function _placeTicket(uint64 marketId, uint32 outcomeId, uint64 nonce) internal returns (uint256 ticketId) {
        SSOTTypes.SportsOddsSnapshot memory odds = SSOTTypes.SportsOddsSnapshot({
            marketId: marketId,
            outcomeId: outcomeId,
            marketVersion: 2,
            oddsWad: 19e17,
            maxStake: 1_000e6,
            maxPayout: 2_000e6,
            expiresAt: uint64(block.timestamp + 1 hours),
            nonce: nonce,
            riskHash: riskEngine.currentRiskHashForPool(SPORTS_POOL_ID)
        });

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, STAKE);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oddsSignerKey, oddsTicketHash);

        vm.prank(player);
        ticketId = sportsHub.placeTicket(marketId, outcomeId, odds, STAKE, abi.encodePacked(r, s, v));
    }

    function _lockProposeAndFinalize(uint64 marketId) internal {
        vm.prank(gov);
        sportsHub.lockMarket(marketId);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        vm.warp(market.startsAt);

        vm.prank(reporter);
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp)
        );

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        vm.warp(result.finalizesAt);
        sportsHub.finalizeResult(marketId);
    }

    function _assertMarketExposureCleared(uint64 marketId, uint64 eventId) internal view {
        assertEq(sportsBank.totalReserved(), 0);
        assertEq(sportsHub.marketReserved(marketId), 0);
        assertEq(sportsHub.marketOutcomeReserved(marketId, WINNING_OUTCOME_ID), 0);
        assertEq(sportsHub.marketOutcomeReserved(marketId, LOSING_OUTCOME_ID), 0);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, eventId), 0);
        assertEq(sportsHub.eventReserved(eventId), 0);
    }

    function _assertTicketState(
        uint256 ticketId,
        SSOTTypes.SportsTicketState ticketState,
        SSOTTypes.PositionState positionState
    ) internal view {
        SSOTTypes.SportsTicket memory ticket = sportsHub.getTicket(ticketId);
        assertEq(uint256(ticket.state), uint256(ticketState));
        assertEq(uint256(router.getPosition(ticket.positionId).state), uint256(positionState));
    }
}
