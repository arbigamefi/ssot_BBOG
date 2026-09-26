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

    // --- house-edge allocation constants (SSOT v1.6); no setters exist ---
    function LP_SHARE_BPS() external view returns (uint16);
    function MAX_REFERRAL_BPS() external view returns (uint16);
    function MAX_HOUSE_EDGE_BPS() external view returns (uint16);
    function EDGE_CHANGE_DELAY() external view returns (uint256);

    /// @notice Active base house edge h_b, applied to bets accepted from now on.
    function defaultHouseEdgeBps() external view returns (uint16);
    /// @notice Active cap on the affiliate markup above the base edge. 0 disables markup.
    function maxAffiliateDeltaBps() external view returns (uint16);
    function affiliateHouseEdgeBps(address affiliate) external view returns (uint16);
    function getAffiliateHouseEdge(address affiliate) external view returns (uint16);
    function setAffiliateHouseEdge(uint16 houseEdgeBps) external;

    /// @notice Queued base-edge change; `activatesAt == 0` means none.
    function pendingBaseHouseEdge() external view returns (uint16 bps, uint64 activatesAt);
    function queueBaseHouseEdge(uint16 bps) external;
    function activateBaseHouseEdge() external;
    function cancelBaseHouseEdge() external;

    /// @notice Decreases apply immediately; increases are queued for EDGE_CHANGE_DELAY.
    function setMaxAffiliateDeltaBps(uint16 bps) external;
    /// @notice Queued markup-cap increase; `activatesAt == 0` means none.
    function pendingMaxAffiliateDelta() external view returns (uint16 bps, uint64 activatesAt);
    function activateMaxAffiliateDelta() external;
    function cancelMaxAffiliateDelta() external;

    /// @notice Referral schedules are immutable once created; bets snapshot the active id at acceptance.
    function activeReferralConfigId() external view returns (uint32);

    function createReferralConfig(uint16 l0Bps, uint16 l1Bps, uint16 l2Bps, uint16 holdbackBps)
        external
        returns (uint32 id);

    function setActiveReferralConfig(uint32 id) external;

    function getReferralConfig(uint32 id)
        external
        view
        returns (uint16 l0Bps, uint16 l1Bps, uint16 l2Bps, uint16 holdbackBps);

    function gameModule(bytes32 gameId) external view returns (address);
    function registerGame(bytes32 gameId, address module) external;

    function bindReferrer(address referrer) external;
    function referrerOf(address player) external view returns (address);

    function nextPositionIdHint() external view returns (uint256);
    function getBet(uint256 positionId) external view returns (SSOTTypes.Bet memory);
    function getBetTerminal(uint256 positionId) external view returns (SSOTTypes.BetTerminal memory);
    function getBetParams(uint256 positionId) external view returns (bytes memory);
    function getBetRandomWords(uint256 positionId) external view returns (uint256[] memory);
    function getDeltaSkyline(uint256 positionId) external view returns (bytes memory);
    /// @notice Referral payees snapshotted when the bet was accepted. Zero means none.
    function getBetReferralPayees(uint256 positionId) external view returns (address l1, address l2);

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

    event BaseHouseEdgeQueued(uint16 oldBps, uint16 newBps, uint64 activatesAt);
    event BaseHouseEdgeActivated(uint16 oldBps, uint16 newBps);
    event BaseHouseEdgeChangeCancelled(uint16 activeBps, uint16 cancelledBps);
    event MaxAffiliateDeltaQueued(uint16 oldBps, uint16 newBps, uint64 activatesAt);
    event MaxAffiliateDeltaSet(uint16 oldBps, uint16 newBps);
    event MaxAffiliateDeltaChangeCancelled(uint16 activeBps, uint16 cancelledBps);
    event ReferralConfigCreated(uint32 indexed id, uint16 l0Bps, uint16 l1Bps, uint16 l2Bps, uint16 holdbackBps);
    event ActiveReferralConfigSet(uint32 oldId, uint32 newId);

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

    /// @notice Allocation of the turnover edge for one settled bet (SSOT v1.6 section 7).
    ///         lpRetained + protocolFee + r0 + r1 + r2 + markup == edge.
    event HouseEdgeAllocated(
        uint256 indexed positionId,
        uint256 usedTurnover,
        uint16 effectiveHouseEdgeBps,
        uint256 edge,
        uint256 operatorShare,
        uint256 lpRetained,
        uint256 protocolFee,
        uint256 r0,
        uint256 r1,
        uint256 r2,
        uint256 markup
    );

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
    error NoPendingEdgeChange();
    error EdgeChangeNotReady(uint64 activatesAt);
    error UnknownReferralConfig(uint32 id);
}
