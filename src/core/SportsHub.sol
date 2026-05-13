// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {ISettlementRouter} from "./interfaces/ISettlementRouter.sol";
import {ISportsHub} from "./interfaces/ISportsHub.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";

/// @notice SportsHub = sportsbook market lifecycle SSOT.
///         Ticket funding and settlement are deliberately routed through SettlementRouter.
contract SportsHub is ISportsHub, Governable {
    address public immutable override settlementRouter;
    address public immutable override poolRegistry;

    address public override riskEngine;
    bytes32 public override oddsSignerSetHash;
    bytes32 public override resultReporterSetHash;

    uint64 public override nextMarketId = 1;
    uint256 public override nextTicketId = 1;

    mapping(uint64 => SSOTTypes.SportsMarket) internal _markets;
    mapping(uint256 => SSOTTypes.SportsTicket) internal _tickets;
    mapping(uint64 => SSOTTypes.SportsResult) internal _results;

    mapping(uint64 => uint256) public override marketReserved;
    mapping(uint64 => uint256) public override eventReserved;
    mapping(uint64 => mapping(uint32 => uint256)) public override marketOutcomeReserved;

    constructor(
        address settlementRouter_,
        address riskEngine_,
        address gov_,
        bytes32 oddsSignerSetHash_,
        bytes32 resultReporterSetHash_
    ) Governable(gov_) {
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
            eventId == 0 || outcomeCount < 2 || startsAt == 0 || lockTime == 0 || resultFinalitySeconds == 0
                || marketKey == bytes32(0) || rulebookHash == bytes32(0) || lockTime > startsAt
                || lockTime <= block.timestamp
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

    function voidMarket(uint64 marketId) external override onlyGov {
        SSOTTypes.SportsMarket storage market = _requireMutableMarket(marketId);
        if (market.state == SSOTTypes.SportsMarketState.Resolved || market.state == SSOTTypes.SportsMarketState.Voided)
        {
            revert BadMarketState(marketId, market.state, SSOTTypes.SportsMarketState.Open);
        }
        _setMarketState(market, SSOTTypes.SportsMarketState.Voided);
    }

    function placeTicket(
        uint64 marketId,
        uint32 outcomeId,
        SSOTTypes.SportsOddsSnapshot calldata odds,
        uint256 stake,
        bytes calldata signature
    ) external view override returns (uint256) {
        stake;
        signature;

        SSOTTypes.SportsMarket storage market = _requireMarket(marketId);
        _requireTicketAcceptingMarket(market);
        if (
            odds.marketId != marketId || odds.outcomeId != outcomeId || odds.marketVersion != market.version
                || outcomeId >= market.outcomeCount
        ) {
            revert BadOddsSnapshot(marketId, outcomeId);
        }
        if (odds.expiresAt <= block.timestamp) revert OddsExpired(marketId, odds.expiresAt, block.timestamp);

        revert Errors.InvalidConfig();
    }

    function proposeResult(uint64 marketId, uint32 winningOutcomeId, bytes32 resultPayloadHash) external pure override {
        marketId;
        winningOutcomeId;
        resultPayloadHash;
        revert Errors.InvalidConfig();
    }

    function challengeResult(uint64 marketId, bytes32 reasonHash) external pure override {
        marketId;
        reasonHash;
        revert Errors.InvalidConfig();
    }

    function finalizeResult(uint64 marketId) external pure override {
        marketId;
        revert Errors.InvalidConfig();
    }

    function settleTicket(uint256 ticketId) external view override {
        _requireTicket(ticketId);
        revert Errors.InvalidConfig();
    }

    function refundTicket(uint256 ticketId) external view override {
        _requireTicket(ticketId);
        revert Errors.InvalidConfig();
    }

    function voidTicket(uint256 ticketId) external view override {
        _requireTicket(ticketId);
        revert Errors.InvalidConfig();
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
}
