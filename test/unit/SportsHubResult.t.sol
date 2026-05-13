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
    uint256 internal reporter2Key = 0xBEEF2;
    uint256 internal reporter3Key = 0xBEEF3;
    address internal reporter2;
    address internal reporter3;
    address internal challenger = address(0xCAFE);
    address internal arbitrator = address(0xA12B);
    address internal riskEngine = address(0x5151);

    bytes32 internal constant ODDS_SET_HASH = keccak256("ODDS_SET");
    bytes32 internal constant REPORTER_SET_HASH = keccak256("REPORTER_SET");
    bytes32 internal constant MARKET_KEY = keccak256("NBA:LAL:BOS:ML");
    bytes32 internal constant RULEBOOK_HASH = keccak256("SPORTS_RULEBOOK_V1");
    bytes32 internal constant RESULT_SOURCE_HASH = keccak256("NBA_FINAL_SCORE_PROVIDER");
    bytes32 internal constant RESULT_EVIDENCE_HASH = keccak256("LAL_WIN_EVIDENCE");
    bytes32 internal constant CHALLENGE_REASON = keccak256("SCORE_DISPUTE");
    bytes32 internal constant ARBITRATION_DECISION = keccak256("ARBITRATION_DECISION");
    bytes32 internal constant VOID_REASON = keccak256("EVENT_CANCELLED");

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
        reporter2 = vm.addr(reporter2Key);
        reporter3 = vm.addr(reporter3Key);

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
        sportsHub.setResultReporter(reporter2, true);
        sportsHub.setResultReporter(reporter3, true);
        sportsHub.setResultChallenger(challenger, true);
        sportsHub.setResultArbitrator(arbitrator, true);
        vm.stopPrank();
    }

    function test_setResultReporter_governanceOnly() external {
        vm.expectRevert(Errors.Unauthorized.selector);
        sportsHub.setResultReporter(address(0x1234), true);

        vm.prank(gov);
        vm.expectRevert(Errors.ZeroAddress.selector);
        sportsHub.setResultReporter(address(0), true);
    }

    function test_setResultReporterThreshold_governanceOnly() external {
        assertEq(sportsHub.resultReporterThreshold(), 1);

        vm.expectRevert(Errors.Unauthorized.selector);
        sportsHub.setResultReporterThreshold(2);

        vm.prank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.setResultReporterThreshold(0);

        vm.prank(gov);
        sportsHub.setResultReporterThreshold(2);
        assertEq(sportsHub.resultReporterThreshold(), 2);
    }

    function test_setResultChallengeRoles_governanceOnly() external {
        address role = address(0x1234);

        vm.expectRevert(Errors.Unauthorized.selector);
        sportsHub.setResultChallenger(role, true);

        vm.prank(gov);
        vm.expectRevert(Errors.ZeroAddress.selector);
        sportsHub.setResultChallenger(address(0), true);

        vm.prank(gov);
        sportsHub.setResultChallenger(role, true);
        assertTrue(sportsHub.resultChallenger(role));

        vm.expectRevert(Errors.Unauthorized.selector);
        sportsHub.setResultArbitrator(role, true);

        vm.prank(gov);
        vm.expectRevert(Errors.ZeroAddress.selector);
        sportsHub.setResultArbitrator(address(0), true);

        vm.prank(gov);
        sportsHub.setResultArbitrator(role, true);
        assertTrue(sportsHub.resultArbitrator(role));
    }

    function test_proposeResult_successBindsFinalityPayloadAndReporterSet() external {
        uint64 marketId = _createOpenAndLockMarket();
        SSOTTypes.SportsMarket memory preProposalMarket = sportsHub.getMarket(marketId);
        vm.warp(preProposalMarket.startsAt);
        uint64 observedAt = uint64(block.timestamp);
        bytes32 expectedPayloadHash = sportsHub.hashResultPayload(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, observedAt
        );

        vm.prank(reporter);
        sportsHub.proposeResult(marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, observedAt);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.ResultProposed));
        assertEq(market.version, 4);

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        assertEq(result.marketId, marketId);
        assertEq(result.eventId, EVENT_ID);
        assertEq(result.poolId, SPORTS_POOL_ID);
        assertEq(result.winningOutcomeId, WINNING_OUTCOME_ID);
        assertEq(result.marketVersion, preProposalMarket.version);
        assertEq(result.resultPayloadHash, expectedPayloadHash);
        assertEq(result.resultSourceHash, RESULT_SOURCE_HASH);
        assertEq(result.evidenceHash, RESULT_EVIDENCE_HASH);
        assertEq(result.rulebookHash, RULEBOOK_HASH);
        assertEq(result.reporterSetHash, REPORTER_SET_HASH);
        assertEq(result.reporterThreshold, 1);
        assertEq(result.reporterCount, 1);
        assertEq(result.proposer, reporter);
        assertEq(result.observedAt, observedAt);
        assertEq(result.proposedAt, block.timestamp);
        assertEq(result.finalizesAt, block.timestamp + FINALITY);
        assertFalse(result.challenged);
        assertEq(result.challengeReasonHash, bytes32(0));
        assertEq(result.challenger, address(0));
        assertEq(result.challengedAt, 0);
        assertEq(uint256(result.challengeDecision), uint256(SSOTTypes.SportsChallengeDecision.None));
        assertEq(result.arbitrationDecisionHash, bytes32(0));
        assertEq(result.arbitrator, address(0));
        assertEq(result.arbitratedAt, 0);
    }

    function test_proposeResult_rejectsUnauthorizedReporterBadStateAndBadPayload() external {
        uint64 marketId = _createMarket();

        vm.expectRevert(abi.encodeWithSelector(ISportsHub.UnauthorizedReporter.selector, address(this)));
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp)
        );

        vm.prank(reporter);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Draft,
                SSOTTypes.SportsMarketState.Locked
            )
        );
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp)
        );

        vm.startPrank(gov);
        sportsHub.openMarket(marketId);
        sportsHub.lockMarket(marketId);
        vm.stopPrank();
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        vm.warp(market.startsAt);

        vm.prank(reporter);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.proposeResult(marketId, WINNING_OUTCOME_ID, bytes32(0), RESULT_EVIDENCE_HASH, uint64(block.timestamp));

        vm.prank(reporter);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.BadOddsSnapshot.selector, marketId, OUTCOME_COUNT));
        sportsHub.proposeResult(
            marketId, OUTCOME_COUNT, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp)
        );
    }

    function test_proposeResult_rejectsPrematureAndInvalidObservedAt() external {
        uint64 marketId = _createOpenAndLockMarket();
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);

        vm.prank(reporter);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp)
        );

        vm.warp(market.startsAt);

        vm.prank(reporter);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, market.startsAt - 1
        );

        vm.prank(reporter);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp + 1)
        );
    }

    function test_proposeResult_successWithReporterQuorumSignatures() external {
        vm.prank(gov);
        sportsHub.setResultReporterThreshold(2);

        uint64 marketId = _createOpenAndLockMarket();
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        vm.warp(market.startsAt);
        uint64 observedAt = uint64(block.timestamp);
        bytes32 resultPayloadHash = sportsHub.hashResultPayload(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, observedAt
        );

        bytes[] memory reporterSignatures = new bytes[](1);
        reporterSignatures[0] = _signResult(resultPayloadHash, reporter2Key);

        vm.prank(reporter);
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, observedAt, reporterSignatures
        );

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        assertEq(result.resultPayloadHash, resultPayloadHash);
        assertEq(result.reporterThreshold, 2);
        assertEq(result.reporterCount, 2);
        assertEq(result.proposer, reporter);
    }

    function test_proposeResult_rejectsMissingBadAndDuplicateReporterQuorumSignatures() external {
        vm.prank(gov);
        sportsHub.setResultReporterThreshold(2);

        uint64 marketId = _createOpenAndLockMarket();
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        vm.warp(market.startsAt);
        uint64 observedAt = uint64(block.timestamp);
        bytes32 resultPayloadHash = sportsHub.hashResultPayload(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, observedAt
        );

        vm.prank(reporter);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.ResultReporterQuorumNotMet.selector, 2, 1));
        sportsHub.proposeResult(marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, observedAt);

        bytes[] memory badSignatures = new bytes[](1);
        badSignatures[0] = _signResult(resultPayloadHash, 0xBAD);

        vm.prank(reporter);
        vm.expectRevert(ISportsHub.BadResultSignature.selector);
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, observedAt, badSignatures
        );

        bytes[] memory duplicateSignatures = new bytes[](2);
        duplicateSignatures[0] = _signResult(resultPayloadHash, reporter2Key);
        duplicateSignatures[1] = duplicateSignatures[0];

        vm.prank(reporter);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.DuplicateResultReporter.selector, reporter2));
        sportsHub.proposeResult(
            marketId, WINNING_OUTCOME_ID, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, observedAt, duplicateSignatures
        );
    }

    function test_challengeResult_blocksFinalizationAndCanBeVoided() external {
        uint64 marketId = _createOpenLockAndProposeResult();

        vm.prank(challenger);
        sportsHub.challengeResult(marketId, CHALLENGE_REASON);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Challenged));

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        assertTrue(result.challenged);
        assertEq(result.challengeReasonHash, CHALLENGE_REASON);
        assertEq(result.challenger, challenger);
        assertEq(result.challengedAt, block.timestamp);

        vm.warp(result.finalizesAt);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.ResultAlreadyChallenged.selector, marketId));
        sportsHub.finalizeResult(marketId);

        vm.prank(gov);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.ResultChallengePending.selector, marketId));
        sportsHub.voidMarket(marketId, VOID_REASON);

        vm.prank(arbitrator);
        sportsHub.resolveResultChallenge(marketId, SSOTTypes.SportsChallengeDecision.VoidMarket, ARBITRATION_DECISION);
        market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Voided));

        result = sportsHub.getResult(marketId);
        assertEq(uint256(result.challengeDecision), uint256(SSOTTypes.SportsChallengeDecision.VoidMarket));
        assertEq(result.arbitrationDecisionHash, ARBITRATION_DECISION);
        assertEq(result.arbitrator, arbitrator);
        assertEq(result.arbitratedAt, block.timestamp);
    }

    function test_challengeResult_rejectsBadStateAndReason() external {
        uint64 marketId = _createOpenAndLockMarket();

        vm.expectRevert(abi.encodeWithSelector(ISportsHub.UnauthorizedChallenger.selector, address(this)));
        sportsHub.challengeResult(marketId, CHALLENGE_REASON);

        vm.prank(challenger);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.challengeResult(marketId, bytes32(0));

        vm.prank(challenger);
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

    function test_challengeResult_rejectsAfterFinalityWindowCloses() external {
        uint64 marketId = _createOpenLockAndProposeResult();
        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);

        vm.warp(result.finalizesAt);

        vm.prank(challenger);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.ResultChallengeWindowClosed.selector, marketId, block.timestamp, result.finalizesAt
            )
        );
        sportsHub.challengeResult(marketId, CHALLENGE_REASON);

        sportsHub.finalizeResult(marketId);
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Resolved));
    }

    function test_resolveResultChallenge_upholdsResultAndFinalizes() external {
        uint64 marketId = _createOpenLockAndProposeResult();
        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);

        vm.prank(challenger);
        sportsHub.challengeResult(marketId, CHALLENGE_REASON);

        vm.prank(arbitrator);
        sportsHub.resolveResultChallenge(marketId, SSOTTypes.SportsChallengeDecision.UpholdResult, ARBITRATION_DECISION);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Resolved));

        SSOTTypes.SportsResult memory resolved = sportsHub.getResult(marketId);
        assertEq(resolved.resultPayloadHash, result.resultPayloadHash);
        assertEq(uint256(resolved.challengeDecision), uint256(SSOTTypes.SportsChallengeDecision.UpholdResult));
        assertEq(resolved.arbitrationDecisionHash, ARBITRATION_DECISION);
        assertEq(resolved.arbitrator, arbitrator);
        assertEq(resolved.arbitratedAt, block.timestamp);
    }

    function test_resolveResultChallenge_reopensForNewQuorumResult() external {
        uint64 marketId = _createOpenLockAndProposeResult();
        SSOTTypes.SportsResult memory oldResult = sportsHub.getResult(marketId);

        vm.prank(challenger);
        sportsHub.challengeResult(marketId, CHALLENGE_REASON);

        vm.prank(arbitrator);
        sportsHub.resolveResultChallenge(marketId, SSOTTypes.SportsChallengeDecision.ReopenResult, ARBITRATION_DECISION);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Locked));
        assertEq(
            uint256(sportsHub.getResult(marketId).challengeDecision),
            uint256(SSOTTypes.SportsChallengeDecision.ReopenResult)
        );

        vm.warp(block.timestamp + 1);
        vm.prank(reporter);
        sportsHub.proposeResult(
            marketId, 0, keccak256("CORRECTED_SOURCE"), keccak256("CORRECTED_EVIDENCE"), uint64(block.timestamp)
        );

        SSOTTypes.SportsResult memory newResult = sportsHub.getResult(marketId);
        assertFalse(newResult.challenged);
        assertEq(newResult.winningOutcomeId, 0);
        assertTrue(newResult.resultPayloadHash != oldResult.resultPayloadHash);
        assertEq(uint256(newResult.challengeDecision), uint256(SSOTTypes.SportsChallengeDecision.None));
    }

    function test_resolveResultChallenge_rejectsUnauthorizedBadDecisionAndBadState() external {
        uint64 marketId = _createOpenLockAndProposeResult();

        vm.expectRevert(abi.encodeWithSelector(ISportsHub.UnauthorizedArbitrator.selector, address(this)));
        sportsHub.resolveResultChallenge(marketId, SSOTTypes.SportsChallengeDecision.UpholdResult, ARBITRATION_DECISION);

        vm.prank(arbitrator);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.ResultProposed,
                SSOTTypes.SportsMarketState.Challenged
            )
        );
        sportsHub.resolveResultChallenge(marketId, SSOTTypes.SportsChallengeDecision.UpholdResult, ARBITRATION_DECISION);

        vm.prank(challenger);
        sportsHub.challengeResult(marketId, CHALLENGE_REASON);

        vm.prank(arbitrator);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.resolveResultChallenge(marketId, SSOTTypes.SportsChallengeDecision.None, ARBITRATION_DECISION);

        vm.prank(arbitrator);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.resolveResultChallenge(marketId, SSOTTypes.SportsChallengeDecision.UpholdResult, bytes32(0));
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
        _proposeResult(marketId, WINNING_OUTCOME_ID);
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

    function _proposeResult(uint64 marketId, uint32 winningOutcomeId) internal {
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        if (block.timestamp < market.startsAt) vm.warp(market.startsAt);

        vm.prank(reporter);
        sportsHub.proposeResult(
            marketId, winningOutcomeId, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp)
        );
    }

    function _signResult(bytes32 resultPayloadHash, uint256 key) internal pure returns (bytes memory signature) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, resultPayloadHash);
        signature = abi.encodePacked(r, s, v);
    }

    function _lockTime() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }

    function _startsAt() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days + 1 hours);
    }
}
