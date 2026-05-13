// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice Casino-game vertical hub interface for the SettlementRouter architecture.
interface IGameHub {
    function settlementRouter() external view returns (address);
    function vrfHub() external view returns (address);
    function referralRegistry() external view returns (address);
    function referralEngine() external view returns (address);

    function riskInPaused(uint64 poolId) external view returns (bool);
    function refundTimeoutSeconds() external view returns (uint256);

    function defaultHouseEdgeBps() external view returns (uint16);
    function maxAffiliateDeltaBps() external view returns (uint16);
    function affiliateHouseEdgeBps(address affiliate) external view returns (uint16);
    function getAffiliateHouseEdge(address affiliate) external view returns (uint16);
    function setAffiliateHouseEdge(uint16 houseEdgeBps) external;

    function activeReferralConfigId() external view returns (uint32);

    function createReferralConfig(
        uint16 baseBudgetBps,
        uint16 deltaBudgetBps,
        uint16 holdbackBps,
        uint16[6] calldata levelBps,
        uint8 levels
    ) external returns (uint32 id);

    function setActiveReferralConfig(uint32 id) external;

    function getReferralConfig(uint32 id)
        external
        view
        returns (
            uint16 baseBudgetBps,
            uint16 deltaBudgetBps,
            uint16 holdbackBps,
            uint16[6] memory levelBps,
            uint8 levels
        );

    function gameModule(bytes32 gameId) external view returns (address);
    function registerGame(bytes32 gameId, address module) external;

    function bindReferrer(address referrer) external;
    function referrerOf(address player) external view returns (address);

    function nextPositionIdHint() external view returns (uint256);
    function getBet(uint256 positionId) external view returns (SSOTTypes.Bet memory);
    function getBetParams(uint256 positionId) external view returns (bytes memory);
    function getDeltaSkyline(uint256 positionId) external view returns (bytes memory);

    function quoteVRFFee(uint32 betCount) external view returns (uint256 fee, uint32 callbackGasLimit);

    function placeBet(
        bytes32 gameId,
        uint64 poolId,
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        address affiliate,
        uint16 maxHouseEdgeBps
    ) external payable returns (uint256 positionId);

    function onRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
    function finalize(uint256 positionId) external;
    function refund(uint256 positionId) external;

    event AffiliateHouseEdgeSet(address indexed affiliate, uint16 oldBps, uint16 newBps);
    event GameRegistered(bytes32 indexed gameId, address indexed module);
    event ReferrerBound(address indexed player, address indexed referrer);
    event RiskInPausedSet(uint64 indexed poolId, bool paused);
    event RefundTimeoutSet(uint256 seconds_);

    event BetPlaced(
        uint256 indexed positionId,
        bytes32 indexed gameId,
        address indexed player,
        uint64 poolId,
        address asset,
        address bank,
        uint256 stake,
        uint256 reserved,
        uint256 amountPerRoll,
        uint32 betCount,
        uint256 stopGain,
        uint256 stopLoss,
        uint256 vrfFeePaid,
        uint256 vrfFeeCharged,
        uint32 vrfCallbackGasLimit,
        uint256 requestId,
        bytes32 snapshotHash,
        bytes32 paramsHash,
        address pricingAffiliate,
        uint16 baseHouseEdgeBps,
        uint16 effectiveHouseEdgeBps,
        uint16 maxHouseEdgeBps,
        uint32 referralConfigId,
        bytes32 deltaSkylineHash
    );

    event BetRandomReady(uint256 indexed positionId, uint256 indexed requestId, bytes32 randomHash);
    event BetFinalized(
        uint256 indexed positionId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 feeOnPayout,
        uint256 protocolFeeAccrual
    );
    event BetRefunded(uint256 indexed positionId, uint256 refundAmount);

    error RiskInPaused(uint64 poolId);
    error UnknownPool(uint64 poolId);
    error WrongPoolDomain(uint64 poolId, SSOTTypes.PoolDomain domain);
    error UnknownGame(bytes32 gameId);
    error BetNotFound(uint256 positionId);
    error BadState(uint256 positionId, SSOTTypes.BetState got, SSOTTypes.BetState want);
    error RefundNotReady(uint256 positionId, uint256 nowTs, uint256 readyAt);
    error NotVRFHub();
    error InsufficientVRFFee(uint256 paid, uint256 required);
    error HouseEdgeTooLow(uint16 got, uint16 minAllowed);
    error HouseEdgeTooHigh(uint16 got, uint16 maxAllowed);
}
