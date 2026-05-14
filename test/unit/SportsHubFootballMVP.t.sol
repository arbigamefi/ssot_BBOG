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

contract SportsHubFootballMVPTest is Test {
    address internal gov = address(0xA11CE);
    address internal player = address(0xB0B);
    address internal reporter = address(0xBEEF);
    uint256 internal oddsSignerKey = 0xA11CE1;
    address internal oddsSigner;

    bytes32 internal constant ODDS_SET_HASH = keccak256("WORLD_CUP_2026_ODDS_SET");
    bytes32 internal constant REPORTER_SET_HASH = keccak256("WORLD_CUP_2026_REPORTER_SET");
    bytes32 internal constant MARKET_KEY = keccak256("FIFA_WORLD_CUP_2026_MEXICO_SOUTH_AFRICA_1X2");
    bytes32 internal constant RULEBOOK_HASH = keccak256("FIFA_WORLD_CUP_2026_1X2_RULEBOOK_V1");
    bytes32 internal constant RESULT_SOURCE_HASH = keccak256("FIFA_WORLD_CUP_2026_OPENING_MATCH_RESULT_SOURCE");
    bytes32 internal constant RESULT_EVIDENCE_HASH = keccak256("FIFA_WORLD_CUP_2026_OPENING_MATCH_EVIDENCE");

    uint64 internal constant SPORTS_POOL_ID = 2;
    uint64 internal constant EVENT_ID = 2026061101;
    uint32 internal constant OUTCOME_MEXICO = 0;
    uint32 internal constant OUTCOME_DRAW = 1;
    uint32 internal constant OUTCOME_SOUTH_AFRICA = 2;
    uint32 internal constant OUTCOME_COUNT = 3;
    uint64 internal constant FINALITY = 30 minutes;
    uint256 internal constant STAKE = 100e6;
    uint256 internal constant ODDS_WAD = 18e17;
    uint256 internal constant PAYOUT = 180e6;

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

    function test_worldCupOpeningMatch_football1X2MvpClosesThroughReporterOracle() external {
        uint64 marketId = _createAndOpenWorldCupMarket();

        uint256 mexicoTicket = _placeTicket(marketId, OUTCOME_MEXICO, 1);
        uint256 drawTicket = _placeTicket(marketId, OUTCOME_DRAW, 2);

        assertEq(usdc.balanceOf(player), 9_800e6);
        assertEq(sportsBank.totalReserved(), PAYOUT * 2);
        assertEq(sportsHub.marketReserved(marketId), PAYOUT * 2);
        assertEq(sportsHub.marketOutcomeReserved(marketId, OUTCOME_MEXICO), PAYOUT);
        assertEq(sportsHub.marketOutcomeReserved(marketId, OUTCOME_DRAW), PAYOUT);
        assertEq(sportsHub.marketOutcomeReserved(marketId, OUTCOME_SOUTH_AFRICA), 0);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, EVENT_ID), PAYOUT * 2);
        assertEq(sportsHub.eventReserved(EVENT_ID), PAYOUT * 2);

        _lockProposeAndFinalize(marketId, OUTCOME_MEXICO);

        uint256[] memory settleIds = new uint256[](2);
        settleIds[0] = mexicoTicket;
        settleIds[1] = drawTicket;
        sportsHub.settleTickets(settleIds);

        assertEq(usdc.balanceOf(player), 9_980e6);
        _assertMarketExposureCleared(marketId);
        _assertTicketState(mexicoTicket, SSOTTypes.SportsTicketState.Settled, SSOTTypes.PositionState.Settled);
        _assertTicketState(drawTicket, SSOTTypes.SportsTicketState.Settled, SSOTTypes.PositionState.Settled);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Resolved));
        assertEq(market.outcomeCount, OUTCOME_COUNT);
        assertEq(market.marketKey, MARKET_KEY);
        assertEq(market.rulebookHash, RULEBOOK_HASH);

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        assertEq(result.winningOutcomeId, OUTCOME_MEXICO);
        assertEq(result.resultSourceHash, RESULT_SOURCE_HASH);
        assertEq(result.evidenceHash, RESULT_EVIDENCE_HASH);
        assertEq(result.rulebookHash, RULEBOOK_HASH);
        assertEq(result.reporterSetHash, REPORTER_SET_HASH);
    }

    function _createAndOpenWorldCupMarket() internal returns (uint64 marketId) {
        uint64 lockTime = uint64(block.timestamp + 1 days);
        uint64 startsAt = lockTime + 1 hours;

        vm.startPrank(gov);
        marketId = sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, OUTCOME_COUNT, startsAt, lockTime, FINALITY, MARKET_KEY, RULEBOOK_HASH
        );
        sportsHub.openMarket(marketId);
        vm.stopPrank();
    }

    function _placeTicket(uint64 marketId, uint32 outcomeId, uint64 nonce) internal returns (uint256 ticketId) {
        SSOTTypes.SportsOddsSnapshot memory odds = SSOTTypes.SportsOddsSnapshot({
            marketId: marketId,
            outcomeId: outcomeId,
            marketVersion: 2,
            oddsWad: ODDS_WAD,
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

    function _lockProposeAndFinalize(uint64 marketId, uint32 winningOutcomeId) internal {
        vm.prank(gov);
        sportsHub.lockMarket(marketId);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        vm.warp(market.startsAt);

        vm.prank(reporter);
        sportsHub.proposeResult(marketId, winningOutcomeId, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp));

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        vm.warp(result.finalizesAt);
        sportsHub.finalizeResult(marketId);
    }

    function _assertMarketExposureCleared(uint64 marketId) internal view {
        assertEq(sportsBank.totalReserved(), 0);
        assertEq(sportsHub.marketReserved(marketId), 0);
        assertEq(sportsHub.marketOutcomeReserved(marketId, OUTCOME_MEXICO), 0);
        assertEq(sportsHub.marketOutcomeReserved(marketId, OUTCOME_DRAW), 0);
        assertEq(sportsHub.marketOutcomeReserved(marketId, OUTCOME_SOUTH_AFRICA), 0);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, EVENT_ID), 0);
        assertEq(sportsHub.eventReserved(EVENT_ID), 0);
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
