// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors} from "../libs/Errors.sol";
import {HouseEdgeLib} from "../libs/HouseEdgeLib.sol";
import {IBank} from "./interfaces/IBank.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {ISettlementRouter} from "./interfaces/ISettlementRouter.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";

/// @notice Shared settlement authority between vertical hubs and Bank pools.
///         This contract owns position authorization but does not custody funds.
///
/// SSOT v1.6: every position records the house edge it was opened with, and settlement may accrue at most the
/// operator share of that edge as protocol fees plus XP. The Router enforces this from its own record, so no
/// authorized hub can take the LP share of the edge (ADR-0032).
contract SettlementRouter is ISettlementRouter {
    address public immutable override poolRegistry;
    uint256 public override nextPositionId = 1;

    mapping(uint256 => SSOTTypes.Position) internal _positions;

    constructor(address poolRegistry_) {
        if (poolRegistry_ == address(0)) revert Errors.ZeroAddress();
        poolRegistry = poolRegistry_;
    }

    function getPosition(uint256 positionId) external view returns (SSOTTypes.Position memory) {
        _requirePosition(positionId);
        return _positions[positionId];
    }

    function openPosition(
        uint64 poolId,
        address player,
        uint256 stake,
        uint256 reserved,
        bytes32 snapshotHash,
        uint16 edgeBps
    ) external returns (uint256 positionId) {
        if (player == address(0)) revert Errors.ZeroAddress();
        if (stake == 0 || reserved == 0) revert Errors.InsufficientBalance();
        if (edgeBps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS) revert EdgeTooHigh(edgeBps, HouseEdgeLib.MAX_HOUSE_EDGE_BPS);

        IPoolRegistry registry = IPoolRegistry(poolRegistry);
        if (!registry.isRegisteredHub(msg.sender)) revert IPoolRegistry.HubNotRegistered(msg.sender);
        if (!registry.isHubAllowedForPool(poolId, msg.sender)) {
            revert IPoolRegistry.HubNotAllowedForPool(poolId, msg.sender);
        }

        SSOTTypes.Pool memory p = registry.pool(poolId);
        if (!p.active) revert IPoolRegistry.PoolInactive(poolId);

        positionId = nextPositionId;
        nextPositionId = positionId + 1;

        _positions[positionId] = SSOTTypes.Position({
            positionId: positionId,
            ownerHub: msg.sender,
            poolId: poolId,
            asset: p.asset,
            bank: p.bank,
            player: player,
            stake: stake,
            reserved: reserved,
            snapshotHash: snapshotHash,
            edgeBps: edgeBps,
            state: SSOTTypes.PositionState.Held
        });

        IBank(p.bank).holdBet(positionId, player, stake, reserved, snapshotHash);

        emit PositionOpened(
            positionId, msg.sender, poolId, player, p.asset, p.bank, stake, reserved, snapshotHash, edgeBps
        );
    }

    function allocationCap(uint256 positionId, uint256 refundAmount) external view returns (uint256) {
        SSOTTypes.Position storage pos = _requirePosition(positionId);
        if (refundAmount > pos.stake) revert RefundTooLarge(positionId, refundAmount, pos.stake);
        return _allocationCap(pos, refundAmount);
    }

    function settlePosition(
        uint256 positionId,
        uint256 payoutGross,
        uint256 payoutNet,
        uint256 refundAmount,
        uint256 protocolFeeAccrual,
        SSOTTypes.XPAward[] calldata xpAwards
    ) external {
        SSOTTypes.Position storage pos = _requireOwnerHeldPosition(positionId);
        if (payoutNet > payoutGross) revert PayoutNetTooLarge(positionId, payoutNet, payoutGross);
        if (refundAmount > pos.stake) revert RefundTooLarge(positionId, refundAmount, pos.stake);
        uint256 need = payoutGross + refundAmount;
        if (need > pos.reserved) revert ReservedTooSmall(positionId, pos.reserved, need);

        uint256 allocated = protocolFeeAccrual;
        uint256 n = xpAwards.length;
        for (uint256 i = 0; i < n; ++i) {
            SSOTTypes.XPAward calldata a = xpAwards[i];
            allocated += a.accrued + a.locked + a.holdback;
        }
        uint256 cap = _allocationCap(pos, refundAmount);
        if (allocated > cap) revert AllocationExceedsCap(positionId, allocated, cap);

        pos.state = SSOTTypes.PositionState.Settled;

        IBank(pos.bank).settleBet(positionId, payoutGross, payoutNet, refundAmount, protocolFeeAccrual, xpAwards);

        emit PositionSettled(
            positionId, msg.sender, pos.poolId, payoutGross, payoutNet, refundAmount, protocolFeeAccrual
        );
    }

    function refundPosition(uint256 positionId, uint256 refundAmount) external {
        SSOTTypes.Position storage pos = _requireOwnerHeldPosition(positionId);
        if (refundAmount > pos.stake) revert RefundTooLarge(positionId, refundAmount, pos.stake);

        pos.state = SSOTTypes.PositionState.Refunded;

        IBank(pos.bank).refundBet(positionId, refundAmount);

        emit PositionRefunded(positionId, msg.sender, pos.poolId, refundAmount);
    }

    function _allocationCap(SSOTTypes.Position storage pos, uint256 refundAmount) internal view returns (uint256) {
        return HouseEdgeLib.operatorShare(HouseEdgeLib.turnoverEdge(pos.stake - refundAmount, pos.edgeBps));
    }

    function _requirePosition(uint256 positionId) internal view returns (SSOTTypes.Position storage pos) {
        pos = _positions[positionId];
        if (pos.state == SSOTTypes.PositionState.None) revert UnknownPosition(positionId);
    }

    function _requireOwnerHeldPosition(uint256 positionId) internal view returns (SSOTTypes.Position storage pos) {
        pos = _requirePosition(positionId);
        if (msg.sender != pos.ownerHub) revert NotOwnerHub(positionId, msg.sender, pos.ownerHub);
        if (pos.state != SSOTTypes.PositionState.Held) {
            revert BadPositionState(positionId, pos.state, SSOTTypes.PositionState.Held);
        }
    }
}
