// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice Shared settlement authority between vertical hubs and Bank pools.
///         The router owns settlement authorization; vertical hubs own domain lifecycle.
interface ISettlementRouter {
    function poolRegistry() external view returns (address);
    function nextPositionId() external view returns (uint256);
    function getPosition(uint256 positionId) external view returns (SSOTTypes.Position memory);

    /// @notice Open a position. `edgeBps` is the house edge the hub prices the position with; casino hubs pass
    ///         the effective edge and sports hubs pass 0. It bounds what the position may later accrue.
    function openPosition(
        uint64 poolId,
        address player,
        uint256 stake,
        uint256 reserved,
        bytes32 snapshotHash,
        uint16 edgeBps
    ) external returns (uint256 positionId);

    /// @notice The most that settling `positionId` with `refundAmount` may accrue as protocol fees plus XP:
    ///         floor(floor((stake - refundAmount) * edgeBps / 10000) * (10000 - LP_SHARE_BPS) / 10000).
    function allocationCap(uint256 positionId, uint256 refundAmount) external view returns (uint256);

    function settlePosition(
        uint256 positionId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 refundAmount,
        uint256 protocolFeeAccrual,
        SSOTTypes.XPAward[] calldata xpAwards
    ) external;

    function refundPosition(uint256 positionId, uint256 refundAmount) external;

    event PositionOpened(
        uint256 indexed positionId,
        address indexed ownerHub,
        uint64 indexed poolId,
        address player,
        address asset,
        address bank,
        uint256 stake,
        uint256 reserved,
        bytes32 snapshotHash,
        uint16 edgeBps
    );

    event PositionSettled(
        uint256 indexed positionId,
        address indexed ownerHub,
        uint64 indexed poolId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 refundAmount,
        uint256 protocolFeeAccrual
    );

    event PositionRefunded(
        uint256 indexed positionId, address indexed ownerHub, uint64 indexed poolId, uint256 refundAmount
    );

    error UnknownPosition(uint256 positionId);
    error BadPositionState(uint256 positionId, SSOTTypes.PositionState got, SSOTTypes.PositionState want);
    error NotOwnerHub(uint256 positionId, address caller, address ownerHub);
    error ReservedTooSmall(uint256 positionId, uint256 reserved, uint256 need);
    error RefundTooLarge(uint256 positionId, uint256 refundAmount, uint256 stake);
    error PayoutNetTooLarge(uint256 positionId, uint256 payoutNet, uint256 payoutGross);
    error EdgeTooHigh(uint16 edgeBps, uint16 maxEdgeBps);
    error AllocationExceedsCap(uint256 positionId, uint256 allocated, uint256 cap);
}
