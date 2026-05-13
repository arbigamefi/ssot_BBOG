// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {SportsHub} from "../../src/core/SportsHub.sol";
import {ISportsHub} from "../../src/core/interfaces/ISportsHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract SportsHubResultTest is Test {
    address internal gov = address(0xA11CE);
    address internal reporter = address(0xBEEF);
    address internal challenger = address(0xCAFE);
    address internal riskEngine = address(0x5151);

    bytes32 internal constant ODDS_SET_HASH = keccak256("ODDS_SET");
    bytes32 internal constant REPORTER_SET_HASH = keccak256("REPORTER_SET");
    bytes32 internal constant MARKET_KEY = keccak256("NBA:LAL:BOS:ML");
    bytes32 internal constant RULEBOOK_HASH = keccak256("SPORTS_RULEBOOK_V1");
    bytes32 internal constant RESULT_PAYLOAD_HASH = keccak256("LAL_WIN");
    bytes32 internal constant CHALLENGE_REASON = keccak256("SCORE_DISPUTE");

    uint64 internal constant SPORTS_POOL_ID = 2;
    uint64 internal constant EVENT_ID = 3003;
    uint32 internal constant WINNING_OUTCOME_ID = 1;
    uint32 internal constant OUTCOME_COUNT = 2;
    uint64 internal constant FINALITY = 30 minutes;

    MockERC20 internal usdc;
    Bank internal sportsBank;
    PoolRegistry internal registry;
    SettlementRouter internal router;
    SportsHub internal sportsHub;

    function setUp() external {
        vm.warp(1_700_000_000);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        sportsBank = new Bank(address(usdc), gov, 1000, "LP USDC Sports", "lpUSDC-S", 6);
        registry = new PoolRegistry(gov);
        router = new SettlementRouter(address(registry));
        sportsHub = new SportsHub(address(router), riskEngine, gov, ODDS_SET_HASH, REPORTER_SET_HASH);

        vm.startPrank(gov);
        registry.registerPool(SPORTS_POOL_ID, address(usdc), address(sportsBank), SSOTTypes.PoolDomain.Sports);
        registry.setHubRegistered(address(sportsHub), true);
        registry.setHubAllowedForPool(SPORTS_POOL_ID, address(sportsHub), true);
        sportsHub.setResultReporter(reporter, true);
        vm.stopPrank();
    }

    function test_setResultReporter_governanceOnly() external {
        vm.expectRevert(Errors.Unauthorized.selector);
        sportsHub.setResultReporter(address(0x1234), true);

        vm.prank(gov);
        vm.expectRevert(Errors.ZeroAddress.selector);
        sportsHub.setResultReporter(address(0), true);
    }

    function test_proposeResult_successBindsFinalityPayloadAndReporterSet() external {
        uint64 marketId = _createOpenAndLockMarket();

        vm.prank(reporter);
        sportsHub.proposeResult(marketId, WINNING_OUTCOME_ID, RESULT_PAYLOAD_HASH);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.ResultProposed));
        assertEq(market.version, 4);

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        assertEq(result.marketId, marketId);
        assertEq(result.eventId, EVENT_ID);
        assertEq(result.winningOutcomeId, WINNING_OUTCOME_ID);
        assertEq(result.resultPayloadHash, RESULT_PAYLOAD_HASH);
        assertEq(result.rulebookHash, RULEBOOK_HASH);
        assertEq(result.reporterSetHash, REPORTER_SET_HASH);
        assertEq(result.proposer, reporter);
        assertEq(result.proposedAt, block.timestamp);
        assertEq(result.finalizesAt, block.timestamp + FINALITY);
        assertFalse(result.challenged);
    }

    function test_proposeResult_rejectsUnauthorizedReporterBadStateAndBadPayload() external {
        uint64 marketId = _createMarket();

        vm.expectRevert(abi.encodeWithSelector(ISportsHub.UnauthorizedReporter.selector, address(this)));
        sportsHub.proposeResult(marketId, WINNING_OUTCOME_ID, RESULT_PAYLOAD_HASH);

        vm.prank(reporter);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Draft,
                SSOTTypes.SportsMarketState.Locked
            )
        );
        sportsHub.proposeResult(marketId, WINNING_OUTCOME_ID, RESULT_PAYLOAD_HASH);

        vm.startPrank(gov);
        sportsHub.openMarket(marketId);
        sportsHub.lockMarket(marketId);
        vm.stopPrank();

        vm.prank(reporter);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.proposeResult(marketId, WINNING_OUTCOME_ID, bytes32(0));

        vm.prank(reporter);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.BadOddsSnapshot.selector, marketId, OUTCOME_COUNT));
        sportsHub.proposeResult(marketId, OUTCOME_COUNT, RESULT_PAYLOAD_HASH);
    }

    function test_challengeResult_blocksFinalizationAndCanBeVoided() external {
        uint64 marketId = _createOpenLockAndProposeResult();

        vm.prank(challenger);
        sportsHub.challengeResult(marketId, CHALLENGE_REASON);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Challenged));

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        assertTrue(result.challenged);

        vm.warp(result.finalizesAt);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.ResultAlreadyChallenged.selector, marketId));
        sportsHub.finalizeResult(marketId);

        vm.prank(gov);
        sportsHub.voidMarket(marketId);
        market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Voided));
    }

    function test_challengeResult_rejectsBadStateAndReason() external {
        uint64 marketId = _createOpenAndLockMarket();

        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.challengeResult(marketId, bytes32(0));

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Locked,
                SSOTTypes.SportsMarketState.ResultProposed
            )
        );
        sportsHub.challengeResult(marketId, CHALLENGE_REASON);
    }

    function test_finalizeResult_respectsChallengeDelayAndResolvesOnce() external {
        uint64 marketId = _createOpenLockAndProposeResult();
        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.ResultFinalityPending.selector, marketId, block.timestamp, result.finalizesAt
            )
        );
        sportsHub.finalizeResult(marketId);

        vm.warp(result.finalizesAt);
        sportsHub.finalizeResult(marketId);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Resolved));

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Resolved,
                SSOTTypes.SportsMarketState.ResultProposed
            )
        );
        sportsHub.finalizeResult(marketId);
    }

    function _createOpenLockAndProposeResult() internal returns (uint64 marketId) {
        marketId = _createOpenAndLockMarket();
        vm.prank(reporter);
        sportsHub.proposeResult(marketId, WINNING_OUTCOME_ID, RESULT_PAYLOAD_HASH);
    }

    function _createOpenAndLockMarket() internal returns (uint64 marketId) {
        marketId = _createMarket();
        vm.startPrank(gov);
        sportsHub.openMarket(marketId);
        sportsHub.lockMarket(marketId);
        vm.stopPrank();
    }

    function _createMarket() internal returns (uint64 marketId) {
        vm.prank(gov);
        marketId = sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, OUTCOME_COUNT, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );
    }

    function _lockTime() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }

    function _startsAt() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days + 1 hours);
    }
}
