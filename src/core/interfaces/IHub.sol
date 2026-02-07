// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice Hub = bet lifecycle SSOT + pricing/referral orchestration.
///
/// v1.1 principles:
/// - player = msg.sender (no delegated betting)
/// - multi-asset: each bet binds to exactly one ERC20 asset and therefore exactly one Bank(asset)
/// - risk-in pause blocks only new bets; finalize/refund remain permissionless
/// - pricing and referral config are snapshotted per bet (non-retroactive)
interface IHub {
    // ---- wiring ----
    function bankRegistry() external view returns (address);
    function bankFor(address asset) external view returns (address);
    function vrfHub() external view returns (address);
    function referralRegistry() external view returns (address);
    function referralEngine() external view returns (address);

    // ---- pause + params ----
    function riskInPaused(address asset) external view returns (bool);
    function refundTimeoutSeconds() external view returns (uint256);

    // ---- pricing ----
    function defaultHouseEdgeBps() external view returns (uint16);
    function maxAffiliateDeltaBps() external view returns (uint16);
    function affiliateHouseEdgeBps(address affiliate) external view returns (uint16);
    function getAffiliateHouseEdge(address affiliate) external view returns (uint16);
    function setAffiliateHouseEdge(uint16 houseEdgeBps) external;

    event AffiliateHouseEdgeSet(address indexed affiliate, uint16 oldBps, uint16 newBps);

    // ---- referral config snapshots ----
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

    // ---- game registry ----
    function gameModule(bytes32 gameId) external view returns (address);
    function registerGame(bytes32 gameId, address module) external;
    event GameRegistered(bytes32 indexed gameId, address indexed module);

    // ---- referral registry ----
    function bindReferrer(address referrer) external;
    function referrerOf(address player) external view returns (address);
    event ReferrerBound(address indexed player, address indexed referrer);

    // ---- bet registry ----
    function nextBetId() external view returns (uint256);
    function getBet(uint256 betId) external view returns (SSOTTypes.Bet memory);
    /// @notice Returns the raw game params bytes that were snapshotted at placeBet.
    /// @dev Params are not considered secret; exposing them simplifies auditing, indexing, and diff testing.
    function getBetParams(uint256 betId) external view returns (bytes memory);
    function getDeltaSkyline(uint256 betId) external view returns (bytes memory);

    /// @notice Quote the required native-token VRF fee for a given betCount.
    /// @dev Mirrors the callback gas scaling policy used in placeBet.
    function quoteVRFFee(uint32 betCount) external view returns (uint256 fee, uint32 callbackGasLimit);

    // ---- user entry (Risk-In) ----
    function placeBet(
        bytes32 gameId,
        address asset,
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        address affiliate,
        uint16 maxHouseEdgeBps
    ) external payable returns (uint256 betId);

    // ---- VRF callback (only VRFHub) ----
    function onRandomWords(uint256 requestId, uint256[] calldata randomWords) external;

    // ---- liveness paths (Debt-Out, ANYONE) ----
    function finalize(uint256 betId) external;
    function refund(uint256 betId) external;

    // ---- events ----
    event BetPlaced(
        uint256 indexed betId,
        bytes32 indexed gameId,
        address indexed player,
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

    event BetRandomReady(uint256 indexed betId, uint256 indexed requestId, bytes32 randomHash);

    event BetFinalized(
        uint256 indexed betId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 feeOnPayout,
        uint256 protocolFeeAccrual
    );

    event BetRefunded(uint256 indexed betId, uint256 refundAmount);

    event RiskInPausedSet(address indexed asset, bool paused);
    event RefundTimeoutSet(uint256 seconds_);

    // ---- errors ----
    error RiskInPaused(address asset);
    error UnknownAsset(address asset);
    error UnknownGame(bytes32 gameId);
    error BetNotFound(uint256 betId);
    error BadState(uint256 betId, SSOTTypes.BetState got, SSOTTypes.BetState want);
    error RefundNotReady(uint256 betId, uint256 nowTs, uint256 readyAt);
    error NotVRFHub();

    error InsufficientVRFFee(uint256 paid, uint256 required);

    error HouseEdgeTooLow(uint16 got, uint16 minAllowed);
    error HouseEdgeTooHigh(uint16 got, uint16 maxAllowed);
}
