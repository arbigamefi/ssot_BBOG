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
import {ISportsRiskEngine} from "../../src/core/interfaces/ISportsRiskEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract MockSportsRiskEngine is ISportsRiskEngine {
    uint256 internal _payout;
    uint256 internal _reserved;
    bytes32 internal _riskHash;
    bool internal _shouldRevert;

    function setDecision(uint256 payout_, uint256 reserved_, bytes32 riskHash_) external {
        _payout = payout_;
        _reserved = reserved_;
        _riskHash = riskHash_;
    }

    function setShouldRevert(bool shouldRevert_) external {
        _shouldRevert = shouldRevert_;
    }

    function checkTicket(RiskInput calldata input) external view returns (RiskDecision memory decision) {
        if (_shouldRevert) {
            revert MarketExposureExceeded(input.market.marketId, input.marketReserved + _reserved);
        }
        decision = RiskDecision({payout: _payout, reserved: _reserved, riskHash: _riskHash});
    }
}

contract SportsHubTicketTest is Test {
    address internal gov = address(0xA11CE);
    address internal player = address(0xB0B);
    uint256 internal oddsSignerKey = 0xA11CE1;
    address internal oddsSigner;

    bytes32 internal constant ODDS_SET_HASH = keccak256("ODDS_SET");
    bytes32 internal constant REPORTER_SET_HASH = keccak256("REPORTER_SET");
    bytes32 internal constant MARKET_KEY = keccak256("NBA:LAL:BOS:SPREAD");
    bytes32 internal constant RULEBOOK_HASH = keccak256("SPORTS_RULEBOOK_V1");
    bytes32 internal constant RISK_HASH = keccak256("RISK_CAPS_V1");

    uint64 internal constant SPORTS_POOL_ID = 2;
    uint64 internal constant SECOND_SPORTS_POOL_ID = 3;
    uint64 internal constant EVENT_ID = 2002;
    uint32 internal constant OUTCOME_ID = 1;
    uint32 internal constant OUTCOME_COUNT = 2;
    uint64 internal constant FINALITY = 30 minutes;

    MockERC20 internal usdc;
    Bank internal sportsBank;
    PoolRegistry internal registry;
    SettlementRouter internal router;
    MockSportsRiskEngine internal riskEngine;
    SportsHub internal sportsHub;

    function setUp() external {
        vm.warp(1_700_000_000);
        oddsSigner = vm.addr(oddsSignerKey);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        sportsBank = new Bank(address(usdc), gov, 1000, "LP USDC Sports", "lpUSDC-S", 6);
        registry = new PoolRegistry(gov);
        router = new SettlementRouter(address(registry));
        riskEngine = new MockSportsRiskEngine();
        sportsHub = new SportsHub(address(router), address(riskEngine), gov, ODDS_SET_HASH, REPORTER_SET_HASH);

        vm.startPrank(gov);
        registry.registerPool(SPORTS_POOL_ID, address(usdc), address(sportsBank), SSOTTypes.PoolDomain.Sports);
        registry.setHubRegistered(address(sportsHub), true);
        registry.setHubAllowedForPool(SPORTS_POOL_ID, address(sportsHub), true);
        sportsBank.setSettlementRouterOnce(address(router));
        sportsHub.setOddsSigner(oddsSigner, true);
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

    function test_placeTicket_successOpensRouterPositionAndTracksExposure() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 stake = 100e6;
        uint256 payout = 190e6;
        uint256 reserved = 190e6;
        SSOTTypes.SportsOddsSnapshot memory odds = _odds(marketId, 2, OUTCOME_ID, uint64(block.timestamp + 1 hours));
        riskEngine.setDecision(payout, reserved, RISK_HASH);

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, stake);
        bytes memory signature = _signOdds(oddsTicketHash);

        vm.prank(player);
        uint256 ticketId = sportsHub.placeTicket(marketId, OUTCOME_ID, odds, stake, signature);

        assertEq(ticketId, 1);
        assertEq(sportsHub.nextTicketId(), 2);
        assertTrue(sportsHub.oddsSnapshotUsed(oddsTicketHash));

        SSOTTypes.SportsTicket memory ticket = sportsHub.getTicket(ticketId);
        assertEq(ticket.ticketId, ticketId);
        assertEq(ticket.positionId, 1);
        assertEq(ticket.marketId, marketId);
        assertEq(ticket.eventId, EVENT_ID);
        assertEq(ticket.poolId, SPORTS_POOL_ID);
        assertEq(ticket.outcomeId, OUTCOME_ID);
        assertEq(ticket.player, player);
        assertEq(ticket.stake, stake);
        assertEq(ticket.payout, payout);
        assertEq(ticket.reserved, reserved);
        assertEq(ticket.oddsSnapshotHash, oddsTicketHash);
        assertEq(ticket.rulebookHash, RULEBOOK_HASH);
        assertEq(ticket.acceptedAt, block.timestamp);
        assertEq(uint256(ticket.state), uint256(SSOTTypes.SportsTicketState.Held));

        SSOTTypes.Position memory position = router.getPosition(ticket.positionId);
        assertEq(position.ownerHub, address(sportsHub));
        assertEq(position.poolId, SPORTS_POOL_ID);
        assertEq(position.player, player);
        assertEq(position.stake, stake);
        assertEq(position.reserved, reserved);
        assertEq(position.snapshotHash, oddsTicketHash);
        assertEq(position.edgeBps, 0, "sports tickets carry no house-edge allocation (SSOT v1.6 A9)");
        assertEq(uint256(position.state), uint256(SSOTTypes.PositionState.Held));

        assertEq(sportsBank.totalReserved(), reserved);
        assertEq(usdc.balanceOf(player), 10_000e6 - stake);
        assertEq(sportsHub.marketReserved(marketId), reserved);
        assertEq(sportsHub.marketOutcomeReserved(marketId, OUTCOME_ID), reserved);
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, EVENT_ID), reserved);
        assertEq(sportsHub.eventReserved(EVENT_ID), reserved);
    }

    function test_placeTicket_tracksEventExposurePerPool() external {
        Bank secondSportsBank = new Bank(address(usdc), gov, 1000, "LP USDC Sports B", "lpUSDC-SB", 6);

        vm.startPrank(gov);
        registry.registerPool(
            SECOND_SPORTS_POOL_ID, address(usdc), address(secondSportsBank), SSOTTypes.PoolDomain.Sports
        );
        registry.setHubAllowedForPool(SECOND_SPORTS_POOL_ID, address(sportsHub), true);
        secondSportsBank.setSettlementRouterOnce(address(router));
        usdc.approve(address(secondSportsBank), type(uint256).max);
        secondSportsBank.deposit(500_000e6, gov);
        vm.stopPrank();

        vm.prank(player);
        usdc.approve(address(secondSportsBank), type(uint256).max);

        uint64 firstMarketId = _createAndOpenMarketForPool(SPORTS_POOL_ID);
        uint64 secondMarketId = _createAndOpenMarketForPool(SECOND_SPORTS_POOL_ID);
        uint256 stake = 100e6;
        uint256 reserved = 190e6;
        riskEngine.setDecision(reserved, reserved, RISK_HASH);

        SSOTTypes.SportsOddsSnapshot memory firstOdds =
            _odds(firstMarketId, 2, OUTCOME_ID, uint64(block.timestamp + 1 hours));
        bytes32 firstHash = sportsHub.hashOddsTicket(firstOdds, player, stake);
        vm.prank(player);
        sportsHub.placeTicket(firstMarketId, OUTCOME_ID, firstOdds, stake, _signOdds(firstHash));

        SSOTTypes.SportsOddsSnapshot memory secondOdds =
            _odds(secondMarketId, 2, OUTCOME_ID, uint64(block.timestamp + 1 hours));
        secondOdds.nonce = 2;
        bytes32 secondHash = sportsHub.hashOddsTicket(secondOdds, player, stake);
        vm.prank(player);
        sportsHub.placeTicket(secondMarketId, OUTCOME_ID, secondOdds, stake, _signOdds(secondHash));

        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, EVENT_ID), reserved);
        assertEq(sportsHub.poolEventReserved(SECOND_SPORTS_POOL_ID, EVENT_ID), reserved);
        assertEq(sportsHub.eventReserved(EVENT_ID), reserved * 2);
        assertEq(sportsBank.totalReserved(), reserved);
        assertEq(secondSportsBank.totalReserved(), reserved);
    }

    function test_placeTicket_withConcreteRiskEngine() external {
        SportsRiskEngine concreteRiskEngine = new SportsRiskEngine(gov, 1_000e6, 2_000e6, 10_000e6, 5_000e6, 20_000e6);
        vm.prank(gov);
        sportsHub.setRiskEngine(address(concreteRiskEngine));

        uint64 marketId = _createAndOpenMarket();
        uint256 stake = 100e6;
        SSOTTypes.SportsOddsSnapshot memory odds = _odds(marketId, 2, OUTCOME_ID, uint64(block.timestamp + 1 hours));
        odds.riskHash = concreteRiskEngine.currentRiskHashForPool(SPORTS_POOL_ID);

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, stake);
        bytes memory signature = _signOdds(oddsTicketHash);

        vm.prank(player);
        uint256 ticketId = sportsHub.placeTicket(marketId, OUTCOME_ID, odds, stake, signature);

        SSOTTypes.SportsTicket memory ticket = sportsHub.getTicket(ticketId);
        assertEq(ticket.payout, 190e6);
        assertEq(ticket.reserved, 190e6);
        assertEq(sportsHub.marketReserved(marketId), 190e6);
        assertEq(sportsBank.totalReserved(), 190e6);
    }

    function test_placeTicket_rejectsUnauthorizedSigner() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 stake = 100e6;
        SSOTTypes.SportsOddsSnapshot memory odds = _odds(marketId, 2, OUTCOME_ID, uint64(block.timestamp + 1 hours));
        riskEngine.setDecision(190e6, 190e6, RISK_HASH);

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, stake);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADC0DE, oddsTicketHash);
        bytes memory badSignature = abi.encodePacked(r, s, v);

        vm.prank(player);
        vm.expectRevert(ISportsHub.BadOddsSignature.selector);
        sportsHub.placeTicket(marketId, OUTCOME_ID, odds, stake, badSignature);
    }

    function test_placeTicket_rejectsReplay() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 stake = 100e6;
        SSOTTypes.SportsOddsSnapshot memory odds = _odds(marketId, 2, OUTCOME_ID, uint64(block.timestamp + 1 hours));
        riskEngine.setDecision(190e6, 190e6, RISK_HASH);

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, stake);
        bytes memory signature = _signOdds(oddsTicketHash);

        vm.prank(player);
        sportsHub.placeTicket(marketId, OUTCOME_ID, odds, stake, signature);

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.BadOddsSnapshot.selector, marketId, OUTCOME_ID));
        sportsHub.placeTicket(marketId, OUTCOME_ID, odds, stake, signature);
    }

    function test_placeTicket_rejectsRiskHashMismatchWithoutAccountingChanges() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 stake = 100e6;
        SSOTTypes.SportsOddsSnapshot memory odds = _odds(marketId, 2, OUTCOME_ID, uint64(block.timestamp + 1 hours));
        riskEngine.setDecision(190e6, 190e6, keccak256("WRONG_RISK"));

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, stake);
        bytes memory signature = _signOdds(oddsTicketHash);

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.BadOddsSnapshot.selector, marketId, OUTCOME_ID));
        sportsHub.placeTicket(marketId, OUTCOME_ID, odds, stake, signature);

        assertFalse(sportsHub.oddsSnapshotUsed(oddsTicketHash));
        assertEq(sportsHub.nextTicketId(), 1);
        assertEq(sportsBank.totalReserved(), 0);
        assertEq(sportsHub.marketReserved(marketId), 0);
    }

    function test_placeTicket_bubblesRiskEngineCapRevertWithoutAccountingChanges() external {
        uint64 marketId = _createAndOpenMarket();
        uint256 stake = 100e6;
        SSOTTypes.SportsOddsSnapshot memory odds = _odds(marketId, 2, OUTCOME_ID, uint64(block.timestamp + 1 hours));
        riskEngine.setDecision(190e6, 190e6, RISK_HASH);
        riskEngine.setShouldRevert(true);

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, stake);
        bytes memory signature = _signOdds(oddsTicketHash);

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(ISportsRiskEngine.MarketExposureExceeded.selector, marketId, 190e6));
        sportsHub.placeTicket(marketId, OUTCOME_ID, odds, stake, signature);

        assertFalse(sportsHub.oddsSnapshotUsed(oddsTicketHash));
        assertEq(sportsHub.nextTicketId(), 1);
        assertEq(sportsBank.totalReserved(), 0);
        assertEq(sportsHub.marketReserved(marketId), 0);
    }

    function _createAndOpenMarket() internal returns (uint64 marketId) {
        return _createAndOpenMarketForPool(SPORTS_POOL_ID);
    }

    function _createAndOpenMarketForPool(uint64 poolId) internal returns (uint64 marketId) {
        vm.startPrank(gov);
        marketId = sportsHub.createMarket(
            EVENT_ID, poolId, OUTCOME_COUNT, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );
        sportsHub.openMarket(marketId);
        vm.stopPrank();
    }

    function _odds(uint64 marketId, uint64 marketVersion, uint32 outcomeId, uint64 expiresAt)
        internal
        pure
        returns (SSOTTypes.SportsOddsSnapshot memory odds)
    {
        odds = SSOTTypes.SportsOddsSnapshot({
            marketId: marketId,
            outcomeId: outcomeId,
            marketVersion: marketVersion,
            oddsWad: 19e17,
            maxStake: 1_000e6,
            maxPayout: 2_000e6,
            expiresAt: expiresAt,
            nonce: 1,
            riskHash: RISK_HASH
        });
    }

    function _signOdds(bytes32 oddsTicketHash) internal view returns (bytes memory signature) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oddsSignerKey, oddsTicketHash);
        signature = abi.encodePacked(r, s, v);
    }

    function _lockTime() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }

    function _startsAt() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days + 1 hours);
    }
}
