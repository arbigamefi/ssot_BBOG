// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice Sportsbook vertical hub interface for the SettlementRouter architecture.
///         The MVP scope is pre-match, single-leg, fixed-odds tickets.
interface ISportsHub {
    function settlementRouter() external view returns (address);
    function poolRegistry() external view returns (address);
    function riskEngine() external view returns (address);
    function oddsSignerSetHash() external view returns (bytes32);
    function resultReporterSetHash() external view returns (bytes32);
    function resultReporterThreshold() external view returns (uint8);
    function resultChallenger(address challenger) external view returns (bool);
    function resultArbitrator(address arbitrator) external view returns (bool);

    function nextMarketId() external view returns (uint64);
    function nextTicketId() external view returns (uint256);

    function getMarket(uint64 marketId) external view returns (SSOTTypes.SportsMarket memory);
    function getTicket(uint256 ticketId) external view returns (SSOTTypes.SportsTicket memory);
    function getResult(uint64 marketId) external view returns (SSOTTypes.SportsResult memory);

    function marketOutcomeReserved(uint64 marketId, uint32 outcomeId) external view returns (uint256);
    function marketReserved(uint64 marketId) external view returns (uint256);
    function eventReserved(uint64 eventId) external view returns (uint256);
    function poolEventReserved(uint64 poolId, uint64 eventId) external view returns (uint256);

    function createMarket(
        uint64 eventId,
        uint64 poolId,
        uint32 outcomeCount,
        uint64 startsAt,
        uint64 lockTime,
        uint64 resultFinalitySeconds,
        bytes32 marketKey,
        bytes32 rulebookHash
    ) external returns (uint64 marketId);

    function openMarket(uint64 marketId) external;
    function suspendMarket(uint64 marketId, bool suspended) external;
    function lockMarket(uint64 marketId) external;
    function voidMarket(uint64 marketId) external;

    function placeTicket(
        uint64 marketId,
        uint32 outcomeId,
        SSOTTypes.SportsOddsSnapshot calldata odds,
        uint256 stake,
        bytes calldata signature
    ) external returns (uint256 ticketId);

    function hashOddsTicket(SSOTTypes.SportsOddsSnapshot calldata odds, address player, uint256 stake)
        external
        view
        returns (bytes32);
    function hashResultPayload(
        uint64 marketId,
        uint32 winningOutcomeId,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        uint64 observedAt
    ) external view returns (bytes32);

    function proposeResult(
        uint64 marketId,
        uint32 winningOutcomeId,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        uint64 observedAt
    ) external;
    function proposeResult(
        uint64 marketId,
        uint32 winningOutcomeId,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        uint64 observedAt,
        bytes[] calldata reporterSignatures
    ) external;
    function challengeResult(uint64 marketId, bytes32 reasonHash) external;
    function resolveResultChallenge(uint64 marketId, SSOTTypes.SportsChallengeDecision decision, bytes32 decisionHash)
        external;
    function finalizeResult(uint64 marketId) external;

    function settleTicket(uint256 ticketId) external;
    function refundTicket(uint256 ticketId) external;
    function voidTicket(uint256 ticketId) external;

    event MarketCreated(
        uint64 indexed marketId,
        uint64 indexed eventId,
        uint64 indexed poolId,
        uint32 outcomeCount,
        uint64 startsAt,
        uint64 lockTime,
        uint64 resultFinalitySeconds,
        bytes32 marketKey,
        bytes32 rulebookHash
    );
    event MarketStateSet(
        uint64 indexed marketId, SSOTTypes.SportsMarketState oldState, SSOTTypes.SportsMarketState newState
    );
    event OddsSignerSetHashSet(bytes32 oldHash, bytes32 newHash);
    event OddsSignerSet(address indexed signer, bool allowed);
    event ResultReporterSetHashSet(bytes32 oldHash, bytes32 newHash);
    event ResultReporterThresholdSet(uint8 oldThreshold, uint8 newThreshold);
    event ResultReporterSet(address indexed reporter, bool allowed);
    event ResultChallengerSet(address indexed challenger, bool allowed);
    event ResultArbitratorSet(address indexed arbitrator, bool allowed);
    event TicketPlaced(
        uint256 indexed ticketId,
        uint256 indexed positionId,
        uint64 indexed marketId,
        uint64 eventId,
        uint64 poolId,
        uint32 outcomeId,
        address player,
        uint256 stake,
        uint256 payout,
        uint256 reserved,
        bytes32 oddsSnapshotHash,
        bytes32 rulebookHash
    );
    event ResultProposed(
        uint64 indexed marketId,
        uint64 indexed eventId,
        uint32 winningOutcomeId,
        bytes32 resultPayloadHash,
        bytes32 resultSourceHash,
        bytes32 evidenceHash,
        bytes32 rulebookHash,
        bytes32 reporterSetHash,
        uint8 reporterThreshold,
        uint8 reporterCount,
        address proposer,
        uint64 observedAt,
        uint64 finalizesAt
    );
    event ResultChallenged(uint64 indexed marketId, bytes32 reasonHash, address challenger);
    event ResultChallengeResolved(
        uint64 indexed marketId,
        bytes32 indexed resultPayloadHash,
        SSOTTypes.SportsChallengeDecision decision,
        bytes32 decisionHash,
        address arbitrator
    );
    event ResultFinalized(
        uint64 indexed marketId, uint64 indexed eventId, uint32 winningOutcomeId, bytes32 resultPayloadHash
    );
    event TicketSettled(uint256 indexed ticketId, uint256 indexed positionId, uint256 payout);
    event TicketRefunded(uint256 indexed ticketId, uint256 indexed positionId, uint256 refundAmount);
    event TicketVoided(uint256 indexed ticketId, uint256 indexed positionId, uint256 refundAmount);

    error UnknownMarket(uint64 marketId);
    error UnknownTicket(uint256 ticketId);
    error BadMarketState(uint64 marketId, SSOTTypes.SportsMarketState got, SSOTTypes.SportsMarketState want);
    error BadTicketState(uint256 ticketId, SSOTTypes.SportsTicketState got, SSOTTypes.SportsTicketState want);
    error MarketLocked(uint64 marketId);
    error MarketSuspended(uint64 marketId);
    error OddsExpired(uint64 marketId, uint64 expiresAt, uint256 nowTs);
    error BadOddsSnapshot(uint64 marketId, uint32 outcomeId);
    error BadOddsSignature();
    error BadPoolDomain(uint64 poolId, SSOTTypes.PoolDomain domain);
    error ResultFinalityPending(uint64 marketId, uint256 nowTs, uint256 finalizesAt);
    error ResultChallengeWindowClosed(uint64 marketId, uint256 nowTs, uint256 finalizesAt);
    error ResultAlreadyChallenged(uint64 marketId);
    error ResultChallengePending(uint64 marketId);
    error UnauthorizedReporter(address reporter);
    error UnauthorizedChallenger(address challenger);
    error UnauthorizedArbitrator(address arbitrator);
    error BadResultSignature();
    error DuplicateResultReporter(address reporter);
    error ResultReporterQuorumNotMet(uint8 threshold, uint8 got);
}
