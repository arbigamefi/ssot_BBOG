// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice Shared settlement authority between vertical hubs and Bank pools.
///         The router owns settlement authorization; vertical hubs own domain lifecycle.
interface ISettlementRouter {
    function poolRegistry() external view returns (address);
    function nextPositionId() external view returns (uint256);
    function getPosition(uint256 positionId) external view returns (SSOTTypes.Position memory);

    function openPosition(uint64 poolId, address player, uint256 stake, uint256 reserved, bytes32 snapshotHash)
        external
        returns (uint256 positionId);

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
        bytes32 snapshotHash
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
}
