// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {SportsHub} from "../../src/core/SportsHub.sol";
import {SportsRiskEngine} from "../../src/core/SportsRiskEngine.sol";
import {ISettlementRouter} from "../../src/core/interfaces/ISettlementRouter.sol";
import {ISportsHub} from "../../src/core/interfaces/ISportsHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract SportsHubSettlementTest is Test {
    address internal gov = address(0xA11CE);
    address internal player = address(0xB0B);
    address internal reporter = address(0xBEEF);
    uint256 internal oddsSignerKey = 0xA11CE1;
    address internal oddsSigner;

    bytes32 internal constant ODDS_SET_HASH = keccak256("ODDS_SET");
    bytes32 internal constant REPORTER_SET_HASH = keccak256("REPORTER_SET");
    bytes32 internal constant MARKET_KEY = keccak256("NBA:LAL:BOS:ML");
    bytes32 internal constant RULEBOOK_HASH = keccak256("SPORTS_RULEBOOK_V1");
    bytes32 internal constant RESULT_SOURCE_HASH = keccak256("NBA_FINAL_SCORE_PROVIDER");
    bytes32 internal constant RESULT_EVIDENCE_HASH = keccak256("LAL_WIN_EVIDENCE");
    bytes32 internal constant VOID_REASON = keccak256("EVENT_CANCELLED");

    uint64 internal constant SPORTS_POOL_ID = 2;
    uint64 internal constant EVENT_ID = 4004;
    uint32 internal constant WINNING_OUTCOME_ID = 1;
    uint32 internal constant LOSING_OUTCOME_ID = 0;
    uint32 internal constant OUTCOME_COUNT = 2;
    uint64 internal constant FINALITY = 30 minutes;

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

    function test_settleTicket_settlesWinnerAndLoserAndReleasesExposure() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 winningTicket = _placeTicket(marketId, WINNING_OUTCOME_ID, 1);
        uint256 losingTicket = _placeTicket(marketId, LOSING_OUTCOME_ID, 2);

        assertEq(sportsBank.totalReserved(), 380e6);
        assertEq(sportsHub.marketReserved(marketId), 380e6);
        assertEq(sportsHub.marketOutcomeReserved(marketId, WINNING_OUTCOME_ID), 190e6);
        assertEq(sportsHub.marketOutcomeReserved(marketId, LOSING_OUTCOME_ID), 190e6);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, EVENT_ID), 380e6);
        assertEq(sportsHub.eventReserved(EVENT_ID), 380e6);
        assertEq(usdc.balanceOf(player), 9_800e6);

        _lockProposeAndFinalize(marketId);

        sportsHub.settleTicket(winningTicket);
        assertEq(usdc.balanceOf(player), 9_990e6);
        assertEq(sportsBank.totalReserved(), 190e6);
        assertEq(sportsHub.marketReserved(marketId), 190e6);
        assertEq(sportsHub.marketOutcomeReserved(marketId, WINNING_OUTCOME_ID), 0);
        assertEq(sportsHub.marketOutcomeReserved(marketId, LOSING_OUTCOME_ID), 190e6);

        sportsHub.settleTicket(losingTicket);
        assertEq(usdc.balanceOf(player), 9_990e6);
        assertEq(sportsBank.totalReserved(), 0);
        assertEq(sportsHub.marketReserved(marketId), 0);
        assertEq(sportsHub.marketOutcomeReserved(marketId, LOSING_OUTCOME_ID), 0);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, EVENT_ID), 0);
        assertEq(sportsHub.eventReserved(EVENT_ID), 0);

        SSOTTypes.SportsTicket memory winner = sportsHub.getTicket(winningTicket);
        SSOTTypes.SportsTicket memory loser = sportsHub.getTicket(losingTicket);
        assertEq(uint256(winner.state), uint256(SSOTTypes.SportsTicketState.Settled));
        assertEq(uint256(loser.state), uint256(SSOTTypes.SportsTicketState.Settled));

        SSOTTypes.Position memory winnerPosition = router.getPosition(winner.positionId);
        SSOTTypes.Position memory loserPosition = router.getPosition(loser.positionId);
        assertEq(uint256(winnerPosition.state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(uint256(loserPosition.state), uint256(SSOTTypes.PositionState.Settled));
    }

    function test_settleTicket_rejectsBeforeResolvedAndDoubleSettlement() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 ticketId = _placeTicket(marketId, WINNING_OUTCOME_ID, 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Open,
                SSOTTypes.SportsMarketState.Resolved
            )
        );
        sportsHub.settleTicket(ticketId);

        _lockProposeAndFinalize(marketId);
        sportsHub.settleTicket(ticketId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadTicketState.selector,
                ticketId,
                SSOTTypes.SportsTicketState.Settled,
                SSOTTypes.SportsTicketState.Held
            )
        );
        sportsHub.settleTicket(ticketId);
    }

    function test_voidTicket_refundsStakeAndReleasesExposure() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 ticketId = _placeTicket(marketId, WINNING_OUTCOME_ID, 1);

        vm.prank(gov);
        sportsHub.voidMarket(marketId, VOID_REASON);

        sportsHub.voidTicket(ticketId);

        assertEq(usdc.balanceOf(player), 10_000e6);
        assertEq(sportsBank.totalReserved(), 0);
        assertEq(sportsHub.marketReserved(marketId), 0);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, EVENT_ID), 0);
        assertEq(sportsHub.eventReserved(EVENT_ID), 0);

        SSOTTypes.SportsTicket memory ticket = sportsHub.getTicket(ticketId);
        assertEq(uint256(ticket.state), uint256(SSOTTypes.SportsTicketState.Voided));

        SSOTTypes.Position memory position = router.getPosition(ticket.positionId);
        assertEq(uint256(position.state), uint256(SSOTTypes.PositionState.Refunded));
    }

    function test_refundTicket_requiresVoidedMarketAndMarksRefunded() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 ticketId = _placeTicket(marketId, WINNING_OUTCOME_ID, 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Open,
                SSOTTypes.SportsMarketState.Voided
            )
        );
        sportsHub.refundTicket(ticketId);

        vm.prank(gov);
        sportsHub.voidMarket(marketId, VOID_REASON);

        sportsHub.refundTicket(ticketId);

        assertEq(usdc.balanceOf(player), 10_000e6);
        assertEq(sportsBank.totalReserved(), 0);

        SSOTTypes.SportsTicket memory ticket = sportsHub.getTicket(ticketId);
        assertEq(uint256(ticket.state), uint256(SSOTTypes.SportsTicketState.Refunded));
    }

    function _createAndOpenMarket() internal returns (uint64 marketId) {
        vm.startPrank(gov);
        marketId = sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, OUTCOME_COUNT, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );
        sportsHub.openMarket(marketId);
        vm.stopPrank();
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

    function _placeTicket(uint64 marketId, uint32 outcomeId, uint64 nonce) internal returns (uint256 ticketId) {
        uint256 stake = 100e6;
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

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, stake);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oddsSignerKey, oddsTicketHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(player);
        ticketId = sportsHub.placeTicket(marketId, outcomeId, odds, stake, signature);
    }

    function _lockTime() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }

    function _startsAt() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days + 1 hours);
    }
}
