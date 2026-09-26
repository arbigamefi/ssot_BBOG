// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {ISettlementRouter} from "./interfaces/ISettlementRouter.sol";
import {ISportsRiskEngine} from "./interfaces/ISportsRiskEngine.sol";
import {ISportsHub} from "./interfaces/ISportsHub.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice SportsHub = sportsbook market lifecycle SSOT.
///         Ticket funding and settlement are deliberately routed through SettlementRouter.
contract SportsHub is ISportsHub, Governable, EIP712, ReentrancyGuard {
    uint64 public constant MIN_RESULT_FINALITY_SECONDS = 10 minutes;
    uint64 public constant DEFAULT_RESULT_CHALLENGE_TIMEOUT_SECONDS = 7 days;
    uint256 public constant MAX_TICKET_BATCH_SIZE = 100;
    bytes32 internal constant ODDS_TICKET_TYPEHASH = keccak256(
        "SportsOddsTicket(bytes32 oddsSignerSetHash,address player,uint256 stake,uint64 marketId,uint64 eventId,uint64 poolId,uint32 outcomeId,uint64 marketVersion,bytes32 marketKey,bytes32 rulebookHash,uint256 oddsWad,uint256 maxStake,uint256 maxPayout,uint64 expiresAt,uint64 nonce,bytes32 riskHash)"
    );
    bytes32 internal constant RESULT_PAYLOAD_TYPEHASH = keccak256(
        "SportsResultPayload(bytes32 reporterSetHash,uint64 marketId,uint64 eventId,uint64 poolId,uint32 winningOutcomeId,uint64 marketVersion,bytes32 marketKey,bytes32 rulebookHash,bytes32 resultSourceHash,bytes32 evidenceHash,uint64 observedAt)"
    );

    address public immutable override settlementRouter;
    address public immutable override poolRegistry;

    address public override riskEngine;
    bytes32 public override oddsSignerSetHash;
    bytes32 public override resultReporterSetHash;
    uint8 public override resultReporterThreshold = 1;
    uint64 public override resultChallengeTimeoutSeconds = DEFAULT_RESULT_CHALLENGE_TIMEOUT_SECONDS;

    uint64 public override nextMarketId = 1;
    uint256 public override nextTicketId = 1;

    mapping(uint64 => SSOTTypes.SportsMarket) internal _markets;
    mapping(uint256 => SSOTTypes.SportsTicket) internal _tickets;
    mapping(uint64 => SSOTTypes.SportsResult) internal _results;

    mapping(address => bool) public oddsSigner;
    mapping(address => bool) public resultReporter;
    mapping(address => bool) public override resultChallenger;
    mapping(address => bool) public override resultArbitrator;
    mapping(bytes32 => bool) public oddsSnapshotUsed;

    mapping(uint64 => uint256) public override marketReserved;
    mapping(uint64 => uint256) public override eventReserved;
    mapping(uint64 => mapping(uint32 => uint256)) public override marketOutcomeReserved;
    mapping(uint64 => mapping(uint64 => uint256)) internal _poolEventReserved;

    constructor(
        address settlementRouter_,
        address riskEngine_,
        address gov_,
        bytes32 oddsSignerSetHash_,
        bytes32 resultReporterSetHash_
    ) Governable(gov_) EIP712("ArbiGameFi SportsHub", "1.3") {
        if (settlementRouter_ == address(0) || riskEngine_ == address(0)) {
            revert Errors.ZeroAddress();
        }
        if (oddsSignerSetHash_ == bytes32(0) || resultReporterSetHash_ == bytes32(0)) {
            revert Errors.InvalidConfig();
        }

        settlementRouter = settlementRouter_;
        poolRegistry = ISettlementRouter(settlementRouter_).poolRegistry();
        riskEngine = riskEngine_;
        oddsSignerSetHash = oddsSignerSetHash_;
        resultReporterSetHash = resultReporterSetHash_;

        emit OddsSignerSetHashSet(bytes32(0), oddsSignerSetHash_);
        emit ResultReporterSetHashSet(bytes32(0), resultReporterSetHash_);
    }

    function setRiskEngine(address riskEngine_) external onlyGov {
        if (riskEngine_ == address(0)) revert Errors.ZeroAddress();
        riskEngine = riskEngine_;
    }

    function setOddsSigner(address signer, bool allowed) external onlyGov {
        if (signer == address(0)) revert Errors.ZeroAddress();
        oddsSigner[signer] = allowed;
        emit OddsSignerSet(signer, allowed);
    }

    function setOddsSignerSetHash(bytes32 newHash) external onlyGov {
        if (newHash == bytes32(0)) revert Errors.InvalidConfig();
        bytes32 oldHash = oddsSignerSetHash;
        oddsSignerSetHash = newHash;
        emit OddsSignerSetHashSet(oldHash, newHash);
    }

    function setResultReporterSetHash(bytes32 newHash) external onlyGov {
        if (newHash == bytes32(0)) revert Errors.InvalidConfig();
        bytes32 oldHash = resultReporterSetHash;
        resultReporterSetHash = newHash;
        emit ResultReporterSetHashSet(oldHash, newHash);
    }

    function setResultReporterThreshold(uint8 newThreshold) external onlyGov {
        if (newThreshold == 0) revert Errors.InvalidConfig();
        uint8 oldThreshold = resultReporterThreshold;
        resultReporterThreshold = newThreshold;
        emit ResultReporterThresholdSet(oldThreshold, newThreshold);
    }

    function setResultChallengeTimeoutSeconds(uint64 newTimeoutSeconds) external onlyGov {
        if (newTimeoutSeconds < MIN_RESULT_FINALITY_SECONDS) revert Errors.InvalidConfig();
        uint64 oldTimeoutSeconds = resultChallengeTimeoutSeconds;
        resultChallengeTimeoutSeconds = newTimeoutSeconds;
        emit ResultChallengeTimeoutSet(oldTimeoutSeconds, newTimeoutSeconds);
    }

    function setResultReporter(address reporter, bool allowed) external onlyGov {
        if (reporter == address(0)) revert Errors.ZeroAddress();
        resultReporter[reporter] = allowed;
        emit ResultReporterSet(reporter, allowed);
    }

    function setResultChallenger(address challenger, bool allowed) external onlyGov {
        if (challenger == address(0)) revert Errors.ZeroAddress();
        resultChallenger[challenger] = allowed;
        emit ResultChallengerSet(challenger, allowed);
    }

    function setResultArbitrator(address arbitrator, bool allowed) external onlyGov {
        if (arbitrator == address(0)) revert Errors.ZeroAddress();
        resultArbitrator[arbitrator] = allowed;
        emit ResultArbitratorSet(arbitrator, allowed);
    }

    function getMarket(uint64 marketId) external view override returns (SSOTTypes.SportsMarket memory) {
        return _requireMarket(marketId);
    }

    function getTicket(uint256 ticketId) external view override returns (SSOTTypes.SportsTicket memory) {
        SSOTTypes.SportsTicket memory ticket = _tickets[ticketId];
        if (ticket.state == SSOTTypes.SportsTicketState.None) revert UnknownTicket(ticketId);
        return ticket;
    }

    function getResult(uint64 marketId) external view override returns (SSOTTypes.SportsResult memory) {
        _requireMarket(marketId);
        return _results[marketId];
    }

    function poolEventReserved(uint64 poolId, uint64 eventId) external view override returns (uint256) {
        return _poolEventReserved[poolId][eventId];
    }

    function hashOddsTicket(SSOTTypes.SportsOddsSnapshot calldata odds, address player, uint256 stake)
        external
        view
        override
        returns (bytes32)
    {
        SSOTTypes.SportsMarket storage market = _requireMarket(odds.marketId);
        return _hashOddsTicket(market, odds, player, stake);
    }

    function hashResultPayload(
        uint64 marketId,
        uint32 winningOutcomeId,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        uint64 observedAt
    ) external view override returns (bytes32) {
        SSOTTypes.SportsMarket storage market = _requireMarket(marketId);
        return _hashResultPayload(market, winningOutcomeId, resultSourceHash, evidenceHash, observedAt);
    }

    function createMarket(
        uint64 eventId,
        uint64 poolId,
        uint32 outcomeCount,
        uint64 startsAt,
        uint64 lockTime,
        uint64 resultFinalitySeconds,
        bytes32 marketKey,
        bytes32 rulebookHash
    ) external override onlyGov returns (uint64 marketId) {
        if (
            eventId == 0 || outcomeCount < 2 || startsAt == 0 || lockTime == 0
                || resultFinalitySeconds < MIN_RESULT_FINALITY_SECONDS || marketKey == bytes32(0)
                || rulebookHash == bytes32(0) || lockTime > startsAt || lockTime <= block.timestamp
        ) {
            revert Errors.InvalidConfig();
        }

        _sportsPool(poolId);

        marketId = nextMarketId;
        nextMarketId = marketId + 1;

        _markets[marketId] = SSOTTypes.SportsMarket({
            marketId: marketId,
            eventId: eventId,
            poolId: poolId,
            outcomeCount: outcomeCount,
            startsAt: startsAt,
            lockTime: lockTime,
            resultFinalitySeconds: resultFinalitySeconds,
            version: 1,
            marketKey: marketKey,
            rulebookHash: rulebookHash,
            state: SSOTTypes.SportsMarketState.Draft
        });

        emit MarketCreated(
            marketId, eventId, poolId, outcomeCount, startsAt, lockTime, resultFinalitySeconds, marketKey, rulebookHash
        );
    }

    function openMarket(uint64 marketId) external override onlyGov {
        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (block.timestamp >= market.lockTime) revert MarketLocked(marketId);
        if (market.state != SSOTTypes.SportsMarketState.Draft && market.state != SSOTTypes.SportsMarketState.Suspended)
        {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Draft);
        }
        _setMarketState(market, SSOTTypes.SportsMarketState.Open);
    }

    function suspendMarket(uint64 marketId, bool suspended) external override onlyGov {
        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (suspended) {
            if (market.state != SSOTTypes.SportsMarketState.Open) {
                revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Open);
            }
            _setMarketState(market, SSOTTypes.SportsMarketState.Suspended);
            return;
        }

        if (block.timestamp >= market.lockTime) revert MarketLocked(marketId);
        if (market.state != SSOTTypes.SportsMarketState.Suspended) {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Suspended);
        }
        _setMarketState(market, SSOTTypes.SportsMarketState.Open);
    }

    function lockMarket(uint64 marketId) external override onlyGov {
        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.Open && market.state != SSOTTypes.SportsMarketState.Suspended) {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Open);
        }
        _setMarketState(market, SSOTTypes.SportsMarketState.Locked);
    }

    function voidMarket(uint64 marketId, bytes32 reasonHash) external override onlyGov {
        if (reasonHash == bytes32(0)) revert Errors.InvalidConfig();

        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (market.state == SSOTTypes.SportsMarketState.Resolved || market.state == SSOTTypes.SportsMarketState.Voided)
        {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Open);
        }
        if (market.state == SSOTTypes.SportsMarketState.Challenged) {
            SSOTTypes.SportsResult storage result = _results[marketId];
            uint256 voidAfter = uint256(result.challengedAt) + uint256(resultChallengeTimeoutSeconds);
            if (block.timestamp < voidAfter) revert ResultChallengePending(marketId);
        }
        _setMarketState(market, SSOTTypes.SportsMarketState.Voided);
        emit MarketVoided(marketId, market.eventId, reasonHash, msg.sender);
    }

    function placeTicket(
        uint64 marketId,
        uint32 outcomeId,
        SSOTTypes.SportsOddsSnapshot calldata odds,
        uint256 stake,
        bytes calldata signature
    ) external override nonReentrant returns (uint256 ticketId) {
        SSOTTypes.SportsMarket storage market = _requireMarket(marketId);
        _requireTicketAcceptingMarket(market);
        _sportsPool(market.poolId);

        if (stake == 0) revert Errors.InsufficientBalance();
        if (
            odds.marketId != marketId || odds.outcomeId != outcomeId || odds.marketVersion != market.version
                || outcomeId >= market.outcomeCount || odds.oddsWad == 0 || odds.maxStake == 0 || odds.maxPayout == 0
        ) {
            revert BadOddsSnapshot(marketId, outcomeId);
        }
        if (odds.expiresAt <= block.timestamp) revert OddsExpired(marketId, odds.expiresAt, block.timestamp);
        if (stake > odds.maxStake) revert BadOddsSnapshot(marketId, outcomeId);

        bytes32 oddsTicketHash = _hashOddsTicket(market, odds, msg.sender, stake);
        if (oddsSnapshotUsed[oddsTicketHash]) revert BadOddsSnapshot(marketId, outcomeId);
        _requireValidOddsSignature(oddsTicketHash, signature);

        ISportsRiskEngine.RiskDecision memory decision = ISportsRiskEngine(riskEngine)
            .checkTicket(
                ISportsRiskEngine.RiskInput({
                    market: market,
                    odds: odds,
                    stake: stake,
                    marketReserved: marketReserved[marketId],
                    outcomeReserved: marketOutcomeReserved[marketId][outcomeId],
                    eventReserved: _poolEventReserved[market.poolId][market.eventId]
                })
            );
        if (
            decision.payout == 0 || decision.reserved == 0 || decision.reserved < decision.payout
                || decision.payout > odds.maxPayout || decision.riskHash != odds.riskHash
        ) {
            revert BadOddsSnapshot(marketId, outcomeId);
        }

        // Sports tickets carry no house-edge allocation (SSOT v1.6 section 8): edge 0 caps PF + XP at zero.
        uint256 positionId = ISettlementRouter(settlementRouter)
            .openPosition(market.poolId, msg.sender, stake, decision.reserved, oddsTicketHash, 0);

        ticketId = nextTicketId;
        nextTicketId = ticketId + 1;

        _tickets[ticketId] = SSOTTypes.SportsTicket({
            ticketId: ticketId,
            positionId: positionId,
            marketId: marketId,
            eventId: market.eventId,
            poolId: market.poolId,
            outcomeId: outcomeId,
            player: msg.sender,
            stake: stake,
            payout: decision.payout,
            reserved: decision.reserved,
            oddsSnapshotHash: oddsTicketHash,
            rulebookHash: market.rulebookHash,
            acceptedAt: uint64(block.timestamp),
            state: SSOTTypes.SportsTicketState.Held
        });

        oddsSnapshotUsed[oddsTicketHash] = true;
        marketReserved[marketId] += decision.reserved;
        marketOutcomeReserved[marketId][outcomeId] += decision.reserved;
        _poolEventReserved[market.poolId][market.eventId] += decision.reserved;
        eventReserved[market.eventId] += decision.reserved;

        emit TicketPlaced(
            ticketId,
            positionId,
            marketId,
            market.eventId,
            market.poolId,
            outcomeId,
            msg.sender,
            stake,
            decision.payout,
            decision.reserved,
            oddsTicketHash,
            market.rulebookHash
        );
    }

    function proposeResult(
        uint64 marketId,
        uint32 winningOutcomeId,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        uint64 observedAt
    ) external override {
        bytes[] memory noSignatures = new bytes[](0);
        _proposeResult(marketId, winningOutcomeId, resultSourceHash, evidenceHash, observedAt, noSignatures);
    }

    function proposeResult(
        uint64 marketId,
        uint32 winningOutcomeId,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        uint64 observedAt,
        bytes[] calldata reporterSignatures
    ) external override {
        _proposeResult(marketId, winningOutcomeId, resultSourceHash, evidenceHash, observedAt, reporterSignatures);
    }

    function _proposeResult(
        uint64 marketId,
        uint32 winningOutcomeId,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        uint64 observedAt,
        bytes[] memory reporterSignatures
    ) internal {
        if (!resultReporter[msg.sender]) revert UnauthorizedReporter(msg.sender);
        if (resultSourceHash == bytes32(0) || evidenceHash == bytes32(0) || observedAt == 0) {
            revert Errors.InvalidConfig();
        }

        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.Locked) {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Locked);
        }
        if (winningOutcomeId >= market.outcomeCount) revert BadOddsSnapshot(marketId, winningOutcomeId);
        if (block.timestamp < market.startsAt || observedAt < market.startsAt || observedAt > block.timestamp) {
            revert Errors.InvalidConfig();
        }

        bytes32 resultPayloadHash =
            _hashResultPayload(market, winningOutcomeId, resultSourceHash, evidenceHash, observedAt);
        uint8 reporterThreshold = resultReporterThreshold;
        uint8 reporterCount = _requireReporterQuorum(resultPayloadHash, msg.sender, reporterSignatures);
        uint64 finalizesAt = uint64(block.timestamp + market.resultFinalitySeconds);
        _results[marketId] = SSOTTypes.SportsResult({
            marketId: marketId,
            eventId: market.eventId,
            poolId: market.poolId,
            winningOutcomeId: winningOutcomeId,
            marketVersion: market.version,
            resultPayloadHash: resultPayloadHash,
            resultSourceHash: resultSourceHash,
            evidenceHash: evidenceHash,
            rulebookHash: market.rulebookHash,
            reporterSetHash: resultReporterSetHash,
            reporterThreshold: reporterThreshold,
            reporterCount: reporterCount,
            proposer: msg.sender,
            observedAt: observedAt,
            proposedAt: uint64(block.timestamp),
            finalizesAt: finalizesAt,
            challenged: false,
            challengeReasonHash: bytes32(0),
            challenger: address(0),
            challengedAt: 0,
            challengeDecision: SSOTTypes.SportsChallengeDecision.None,
            arbitrationDecisionHash: bytes32(0),
            arbitrator: address(0),
            arbitratedAt: 0
        });

        _setMarketState(market, SSOTTypes.SportsMarketState.ResultProposed);
        emit ResultProposed(
            marketId,
            market.eventId,
            winningOutcomeId,
            resultPayloadHash,
            resultSourceHash,
            evidenceHash,
            market.rulebookHash,
            resultReporterSetHash,
            reporterThreshold,
            reporterCount,
            msg.sender,
            observedAt,
            finalizesAt
        );
    }

    function challengeResult(uint64 marketId, bytes32 reasonHash) external override {
        _requireResultChallenger(msg.sender);
        if (reasonHash == bytes32(0)) revert Errors.InvalidConfig();

        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.ResultProposed) {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.ResultProposed);
        }

        SSOTTypes.SportsResult storage result = _results[marketId];
        if (block.timestamp >= result.finalizesAt) {
            revert ResultChallengeWindowClosed(marketId, block.timestamp, result.finalizesAt);
        }
        result.challenged = true;
        result.challengeReasonHash = reasonHash;
        result.challenger = msg.sender;
        result.challengedAt = uint64(block.timestamp);
        _setMarketState(market, SSOTTypes.SportsMarketState.Challenged);
        emit ResultChallenged(marketId, reasonHash, msg.sender);
    }

    function resolveResultChallenge(uint64 marketId, SSOTTypes.SportsChallengeDecision decision, bytes32 decisionHash)
        external
        override
    {
        _requireResultArbitrator(msg.sender);
        if (decision == SSOTTypes.SportsChallengeDecision.None || decisionHash == bytes32(0)) {
            revert Errors.InvalidConfig();
        }

        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.Challenged) {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Challenged);
        }

        SSOTTypes.SportsResult storage result = _results[marketId];
        result.challengeDecision = decision;
        result.arbitrationDecisionHash = decisionHash;
        result.arbitrator = msg.sender;
        result.arbitratedAt = uint64(block.timestamp);

        if (decision == SSOTTypes.SportsChallengeDecision.UpholdResult) {
            _setMarketState(market, SSOTTypes.SportsMarketState.Resolved);
            emit ResultChallengeResolved(marketId, result.resultPayloadHash, decision, decisionHash, msg.sender);
            emit ResultFinalized(marketId, market.eventId, result.winningOutcomeId, result.resultPayloadHash);
            return;
        }

        if (decision == SSOTTypes.SportsChallengeDecision.ReopenResult) {
            _setMarketState(market, SSOTTypes.SportsMarketState.Locked);
            emit ResultChallengeResolved(marketId, result.resultPayloadHash, decision, decisionHash, msg.sender);
            return;
        }

        if (decision == SSOTTypes.SportsChallengeDecision.VoidMarket) {
            _setMarketState(market, SSOTTypes.SportsMarketState.Voided);
            emit ResultChallengeResolved(marketId, result.resultPayloadHash, decision, decisionHash, msg.sender);
            return;
        }

        revert Errors.InvalidConfig();
    }

    function finalizeResult(uint64 marketId) external override {
        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (market.state == SSOTTypes.SportsMarketState.Challenged) revert ResultAlreadyChallenged(marketId);
        if (market.state != SSOTTypes.SportsMarketState.ResultProposed) {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.ResultProposed);
        }

        SSOTTypes.SportsResult storage result = _results[marketId];
        if (result.challenged) revert ResultAlreadyChallenged(marketId);
        if (block.timestamp < result.finalizesAt) {
            revert ResultFinalityPending(marketId, block.timestamp, result.finalizesAt);
        }

        _setMarketState(market, SSOTTypes.SportsMarketState.Resolved);
        emit ResultFinalized(marketId, market.eventId, result.winningOutcomeId, result.resultPayloadHash);
    }

    function settleTicket(uint256 ticketId) external override nonReentrant {
        _settleTicket(ticketId);
    }

    function settleTickets(uint256[] calldata ticketIds) external override nonReentrant {
        _requireBatchSize(ticketIds.length);
        for (uint256 i = 0; i < ticketIds.length; ++i) {
            _settleTicket(ticketIds[i]);
        }
    }

    function refundTicket(uint256 ticketId) external override nonReentrant {
        _refundTicket(ticketId);
    }

    function refundTickets(uint256[] calldata ticketIds) external override nonReentrant {
        _requireBatchSize(ticketIds.length);
        for (uint256 i = 0; i < ticketIds.length; ++i) {
            _refundTicket(ticketIds[i]);
        }
    }

    function voidTicket(uint256 ticketId) external override nonReentrant {
        _voidTicket(ticketId);
    }

    function voidTickets(uint256[] calldata ticketIds) external override nonReentrant {
        _requireBatchSize(ticketIds.length);
        for (uint256 i = 0; i < ticketIds.length; ++i) {
            _voidTicket(ticketIds[i]);
        }
    }

    function _settleTicket(uint256 ticketId) internal {
        SSOTTypes.SportsTicket storage ticket = _requireHeldTicket(ticketId);
        SSOTTypes.SportsMarket storage market = _requireMarket(ticket.marketId);
        if (market.state != SSOTTypes.SportsMarketState.Resolved) {
            revert BadMarketState(ticket.marketId, market.state, SSOTTypes.SportsMarketState.Resolved);
        }

        SSOTTypes.SportsResult storage result = _results[ticket.marketId];
        uint256 payout = ticket.outcomeId == result.winningOutcomeId ? ticket.payout : 0;

        ticket.state = SSOTTypes.SportsTicketState.Settled;
        _releaseExposure(ticket);

        SSOTTypes.XPAward[] memory noAwards = new SSOTTypes.XPAward[](0);
        ISettlementRouter(settlementRouter).settlePosition(ticket.positionId, payout, payout, 0, 0, noAwards);

        emit TicketSettled(ticketId, ticket.positionId, payout);
    }

    function _refundTicket(uint256 ticketId) internal {
        SSOTTypes.SportsTicket storage ticket = _requireHeldTicket(ticketId);
        _requireVoidedMarket(ticket.marketId);

        ticket.state = SSOTTypes.SportsTicketState.Refunded;
        _releaseExposure(ticket);

        ISettlementRouter(settlementRouter).refundPosition(ticket.positionId, ticket.stake);

        emit TicketRefunded(ticketId, ticket.positionId, ticket.stake);
    }

    function _voidTicket(uint256 ticketId) internal {
        SSOTTypes.SportsTicket storage ticket = _requireHeldTicket(ticketId);
        _requireVoidedMarket(ticket.marketId);

        ticket.state = SSOTTypes.SportsTicketState.Voided;
        _releaseExposure(ticket);

        ISettlementRouter(settlementRouter).refundPosition(ticket.positionId, ticket.stake);

        emit TicketVoided(ticketId, ticket.positionId, ticket.stake);
    }

    function _requireMarket(uint64 marketId) internal view returns (SSOTTypes.SportsMarket storage market) {
        market = _markets[marketId];
        if (market.state == SSOTTypes.SportsMarketState.None) revert UnknownMarket(marketId);
    }

    function _requireMutableMarket(uint64 marketId) internal view returns (SSOTTypes.SportsMarket storage market) {
        market = _requireMarket(marketId);
    }

    function _requireTicket(uint256 ticketId) internal view returns (SSOTTypes.SportsTicket storage ticket) {
        ticket = _tickets[ticketId];
        if (ticket.state == SSOTTypes.SportsTicketState.None) revert UnknownTicket(ticketId);
    }

    function _requireHeldTicket(uint256 ticketId) internal view returns (SSOTTypes.SportsTicket storage ticket) {
        ticket = _requireTicket(ticketId);
        if (ticket.state != SSOTTypes.SportsTicketState.Held) {
            revert BadTicketState(ticketId, ticket.state, SSOTTypes.SportsTicketState.Held);
        }
    }

    function _requireBatchSize(uint256 len) internal pure {
        if (len > MAX_TICKET_BATCH_SIZE) revert BatchTooLarge(len, MAX_TICKET_BATCH_SIZE);
    }

    function _requireVoidedMarket(uint64 marketId) internal view {
        SSOTTypes.SportsMarket storage market = _requireMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.Voided) {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Voided);
        }
    }

    function _sportsPool(uint64 poolId) internal view returns (SSOTTypes.Pool memory pool) {
        IPoolRegistry registry = IPoolRegistry(poolRegistry);
        pool = registry.pool(poolId);
        if (pool.domain != SSOTTypes.PoolDomain.Sports) revert BadPoolDomain(poolId, pool.domain);
        if (!registry.isRegisteredHub(address(this))) revert IPoolRegistry.HubNotRegistered(address(this));
        if (!registry.isHubAllowedForPool(poolId, address(this))) {
            revert IPoolRegistry.HubNotAllowedForPool(poolId, address(this));
        }
    }

    function _setMarketState(SSOTTypes.SportsMarket storage market, SSOTTypes.SportsMarketState newState) internal {
        SSOTTypes.SportsMarketState oldState = market.state;
        market.state = newState;
        market.version += 1;
        emit MarketStateSet(market.marketId, oldState, newState);
    }

    function _requireTicketAcceptingMarket(SSOTTypes.SportsMarket storage market) internal view {
        if (market.state == SSOTTypes.SportsMarketState.Suspended) revert MarketSuspended(market.marketId);
        if (
            market.state == SSOTTypes.SportsMarketState.Locked || block.timestamp >= market.lockTime
                || block.timestamp >= market.startsAt
        ) {
            revert MarketLocked(market.marketId);
        }
        if (market.state != SSOTTypes.SportsMarketState.Open) {
            revert BadMarketState(market.marketId, market.state, SSOTTypes.SportsMarketState.Open);
        }
    }

    function _releaseExposure(SSOTTypes.SportsTicket storage ticket) internal {
        uint256 reserved = ticket.reserved;
        marketReserved[ticket.marketId] -= reserved;
        marketOutcomeReserved[ticket.marketId][ticket.outcomeId] -= reserved;
        _poolEventReserved[ticket.poolId][ticket.eventId] -= reserved;
        eventReserved[ticket.eventId] -= reserved;
    }

    function _hashOddsTicket(
        SSOTTypes.SportsMarket storage market,
        SSOTTypes.SportsOddsSnapshot calldata odds,
        address player,
        uint256 stake
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                ODDS_TICKET_TYPEHASH,
                oddsSignerSetHash,
                player,
                stake,
                odds.marketId,
                market.eventId,
                market.poolId,
                odds.outcomeId,
                odds.marketVersion,
                market.marketKey,
                market.rulebookHash,
                odds.oddsWad,
                odds.maxStake,
                odds.maxPayout,
                odds.expiresAt,
                odds.nonce,
                odds.riskHash
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function _hashResultPayload(
        SSOTTypes.SportsMarket storage market,
        uint32 winningOutcomeId,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        uint64 observedAt
    ) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                RESULT_PAYLOAD_TYPEHASH,
                resultReporterSetHash,
                market.marketId,
                market.eventId,
                market.poolId,
                winningOutcomeId,
                market.version,
                market.marketKey,
                market.rulebookHash,
                resultSourceHash,
                evidenceHash,
                observedAt
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function _requireValidOddsSignature(bytes32 oddsTicketHash, bytes calldata signature) internal view {
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecoverCalldata(oddsTicketHash, signature);
        if (err != ECDSA.RecoverError.NoError || !oddsSigner[recovered]) revert BadOddsSignature();
    }

    function _requireResultChallenger(address challenger) internal view {
        if (challenger != governance && !resultChallenger[challenger]) revert UnauthorizedChallenger(challenger);
    }

    function _requireResultArbitrator(address arbitrator) internal view {
        if (arbitrator != governance && !resultArbitrator[arbitrator]) revert UnauthorizedArbitrator(arbitrator);
    }

    function _requireReporterQuorum(bytes32 resultPayloadHash, address proposer, bytes[] memory reporterSignatures)
        internal
        view
        returns (uint8 reporterCount)
    {
        uint8 threshold = resultReporterThreshold;
        if (reporterSignatures.length > type(uint8).max - 1) revert Errors.InvalidConfig();

        reporterCount = 1;
        address[] memory seen = new address[](reporterSignatures.length + 1);
        seen[0] = proposer;

        for (uint256 i = 0; i < reporterSignatures.length; ++i) {
            (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(resultPayloadHash, reporterSignatures[i]);
            if (err != ECDSA.RecoverError.NoError || !resultReporter[recovered]) revert BadResultSignature();

            for (uint256 j = 0; j < reporterCount; ++j) {
                if (seen[j] == recovered) revert DuplicateResultReporter(recovered);
            }

            seen[reporterCount] = recovered;
            ++reporterCount;
        }

        if (reporterCount < threshold) revert ResultReporterQuorumNotMet(threshold, reporterCount);
    }
}
