// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice Casino-game vertical hub interface for the SettlementRouter architecture.
interface IGameHub {
    function settlementRouter() external view returns (address);
    function vrfHub() external view returns (address);
    function referralRegistry() external view returns (address);
    function referralEngine() external view returns (address);

    function riskInPaused(uint64 poolId) external view returns (bool);
    function refundTimeoutSeconds() external view returns (uint256);
    function MAX_REFUND_TIMEOUT_SECONDS() external view returns (uint256);
    function MIN_REFUND_TIMEOUT_SECONDS() external view returns (uint256);

    // --- house-edge allocation constants (SSOT v1.6); no setters exist ---
    function LP_SHARE_BPS() external view returns (uint16);
    function MAX_REFERRAL_BPS() external view returns (uint16);
    function MAX_HOUSE_EDGE_BPS() external view returns (uint16);
    function EDGE_CHANGE_DELAY() external view returns (uint256);

    /// @notice Active house edge, applied to bets accepted from now on.
    function defaultHouseEdgeBps() external view returns (uint16);
    /// @notice Queued house-edge change; activatesAt == 0 means none.
    function pendingEdgeChange() external view returns (uint16 bps, uint64 activatesAt);
    /// @notice Governance queues a house-edge change for EDGE_CHANGE_DELAY.
    function queueEdgeChange(uint16 bps) external;
    /// @notice Anyone may apply the queued change after its delay.
    function activateEdgeChange() external;
    /// @notice Governance discards the queued change.
    function cancelEdgeChange() external;

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
    function MAX_BET_COUNT() external view returns (uint32);
    function gameMaxBetCount(bytes32 gameId) external view returns (uint32);
    function gameCallbackGasLimit(bytes32 gameId) external view returns (uint32);
    function betModule(uint256 positionId) external view returns (address);
    /// @notice Register one explicitly qualified workload envelope. No implicit default gas or round count.
    function registerGame(bytes32 gameId, address module, uint32 maxBetCount, uint32 callbackGasLimit) external;
    /// @notice True once the game is disabled: it takes no new bets or quotes. There is no re-enable.
    function gameDisabled(bytes32 gameId) external view returns (bool);
    /// @notice Stop new bets on one game for good; its accepted bets settle, refund or void unchanged.
    function disableGame(bytes32 gameId) external;

    function bindReferrer(address referrer) external;
    function referrerOf(address player) external view returns (address);

    function nextPositionIdHint() external view returns (uint256);
    function getBet(uint256 positionId) external view returns (SSOTTypes.Bet memory);
    function getBetTerminal(uint256 positionId) external view returns (SSOTTypes.BetTerminal memory);
    function getBetParams(uint256 positionId) external view returns (bytes memory);
    /// @notice Canonical received word, including failed Hub delivery and terminal bets; empty before receipt/cancelled.
    function getBetRandomWords(uint256 positionId) external view returns (uint256[] memory);
    /// @notice Referral payees snapshotted when the bet was accepted. Zero means none.
    function getBetReferralPayees(uint256 positionId) external view returns (address l1, address l2);

    function quoteVRFFee(bytes32 gameId, uint32 betCount, uint256 gasPriceBudget)
        external
        view
        returns (uint256 fee, uint32 callbackGasLimit);

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

    // ---- void of results that can never be booked (ADR-0037 §7) ----
    function VOID_DELAY() external view returns (uint256);
    function PUBLIC_VOID_DELAY() external view returns (uint256);
    function VOID_SETTLEMENT_GAS() external view returns (uint256);
    function VOID_RESERVE_GAS() external view returns (uint256);
    function VOID_CALL_OVERHEAD() external view returns (uint256);
    /// @notice Latest void window of a Bank: bets requested at or before it may be voided 24 hours after request.
    function voidCohortEnd(address bank) external view returns (uint64);
    /// @notice Governance, the sentinel or the pool Bank's guardian opens a window while a result is unbooked.
    function openVoidWindow(uint64 poolId) external;
    /// @notice Anyone, once eligible: settles the bet if its settlement now succeeds, otherwise voids it.
    function voidBet(uint256 positionId) external returns (bool voided);

    event GameRegistered(bytes32 indexed gameId, address indexed module, uint32 maxBetCount, uint32 callbackGasLimit);
    event GameDisabled(bytes32 indexed gameId, address indexed caller);
    event VoidWindowOpened(uint64 indexed poolId, address indexed bank, uint64 cohortEnd, address indexed caller);
    event BetVoided(
        uint256 indexed positionId, address indexed caller, uint256 stake, bytes32 settlementErrorPrefix
    );
    event ReferrerBound(address indexed player, address indexed referrer);
    event RefundTimeoutSet(uint256 seconds_);

    event EdgeChangeQueued(uint16 oldBps, uint16 newBps, uint64 activatesAt);
    event EdgeChangeApplied(uint16 oldBps, uint16 newBps);
    event EdgeChangeCancelled(uint16 activeBps, uint16 cancelledBps);
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
        address referrerL1,
        address referrerL2,
        uint16 houseEdgeBps,
        uint16 maxHouseEdgeBps,
        uint32 referralConfigId,
        uint64 refundDeadline
    );

    event BetRandomReady(uint256 indexed positionId, uint256 indexed requestId, bytes32 randomHash);
    event CallbackSettlementFailed(uint256 indexed positionId, bytes32 errorPrefix);
    event BetFinalized(
        uint256 indexed positionId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 feeOnPayout,
        uint256 protocolFeeAccrual
    );
    event BetRefunded(uint256 indexed positionId, uint256 refundAmount);

    /// @notice Allocation of the turnover edge for one settled bet (SSOT v1.6 section 7).
    ///         lpRetained + protocolFee + r0 + r1 + r2 == edge.
    event HouseEdgeAllocated(
        uint256 indexed positionId,
        uint256 usedTurnover,
        uint16 houseEdgeBps,
        uint256 edge,
        uint256 operatorShare,
        uint256 lpRetained,
        uint256 protocolFee,
        uint256 r0,
        uint256 r1,
        uint256 r2
    );

    error RiskInPaused(uint64 poolId);
    error UnknownPool(uint64 poolId);
    error UnknownGame(bytes32 gameId);
    error GameIsDisabled(bytes32 gameId);
    error NoUnbookedResult(address bank);
    error VoidNotEligible(uint256 positionId, uint256 nowTs, uint256 eligibleAt);
    error VoidGasTooLow(uint256 gasLeft, uint256 required);
    error BetNotFound(uint256 positionId);
    error BadState(uint256 positionId, SSOTTypes.BetState got, SSOTTypes.BetState want);
    error RefundNotReady(uint256 positionId, uint256 nowTs, uint256 readyAt);
    error InvalidRefundTimeout(uint256 seconds_);
    error NotVRFHub();
    error NotSelf();
    error InvalidRandomReceipt();
    error InvalidModuleResult();
    error InsufficientVRFFee(uint256 paid, uint256 required);
    error HouseEdgeTooHigh(uint16 got, uint16 maxAllowed);
    error NoPendingEdgeChange();
    error EdgeChangeNotReady(uint64 activatesAt);
    error UnknownReferralConfig(uint32 id);
}
