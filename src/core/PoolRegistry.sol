// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";
import {IBank} from "./interfaces/IBank.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";

/// @notice Governance-controlled registry for bankroll pools.
///         poolId is the protocol risk/accounting domain; this contract does not custody funds.
contract PoolRegistry is IPoolRegistry, Governable {
    mapping(uint64 => SSOTTypes.Pool) internal _pools;
    uint64[] internal _poolIds;

    mapping(address => uint64) internal _poolIdForBank;
    mapping(address => bool) internal _registeredHubs;
    mapping(uint64 => mapping(address => bool)) internal _hubAllowedForPool;

    constructor(address gov_) Governable(gov_) {}

    function registerPool(uint64 poolId, address asset, address bank, SSOTTypes.PoolDomain domain) external onlyGov {
        if (poolId == 0) revert Errors.InvalidConfig();
        if (asset == address(0) || bank == address(0)) revert Errors.ZeroAddress();
        if (domain == SSOTTypes.PoolDomain.Unknown) revert Errors.InvalidConfig();
        if (_pools[poolId].bank != address(0)) revert PoolAlreadyRegistered(poolId);

        uint64 existingPoolId = _poolIdForBank[bank];
        if (existingPoolId != 0) revert BankAlreadyRegistered(bank, existingPoolId);
        if (IBank(bank).asset() != asset) revert Errors.InvalidConfig();

        _pools[poolId] = SSOTTypes.Pool({asset: asset, bank: bank, domain: domain, active: true});
        _poolIds.push(poolId);
        _poolIdForBank[bank] = poolId;

        emit PoolRegistered(poolId, asset, bank, domain);
    }

    function setPoolActive(uint64 poolId, bool active) external onlyGov {
        _requirePool(poolId);
        _pools[poolId].active = active;
        emit PoolActiveSet(poolId, active);
    }

    function setHubRegistered(address hub, bool registered) external onlyGov {
        if (hub == address(0)) revert Errors.ZeroAddress();
        _registeredHubs[hub] = registered;
        emit HubRegistered(hub, registered);
    }

    function setHubAllowedForPool(uint64 poolId, address hub, bool allowed) external onlyGov {
        _requirePool(poolId);
        if (!_registeredHubs[hub]) revert HubNotRegistered(hub);
        _hubAllowedForPool[poolId][hub] = allowed;
        emit HubAllowedForPoolSet(poolId, hub, allowed);
    }

    function pool(uint64 poolId) external view returns (SSOTTypes.Pool memory) {
        _requirePool(poolId);
        return _pools[poolId];
    }

    function poolCount() external view returns (uint256) {
        return _poolIds.length;
    }

    function poolIdAt(uint256 index) external view returns (uint64) {
        return _poolIds[index];
    }

    function listPoolIds() external view returns (uint64[] memory) {
        return _poolIds;
    }

    function assetFor(uint64 poolId) external view returns (address asset) {
        _requirePool(poolId);
        return _pools[poolId].asset;
    }

    function bankFor(uint64 poolId) external view returns (address bank) {
        _requirePool(poolId);
        return _pools[poolId].bank;
    }

    function domainFor(uint64 poolId) external view returns (SSOTTypes.PoolDomain domain) {
        _requirePool(poolId);
        return _pools[poolId].domain;
    }

    function isPoolActive(uint64 poolId) external view returns (bool) {
        _requirePool(poolId);
        return _pools[poolId].active;
    }

    function isRegisteredHub(address hub) external view returns (bool) {
        return _registeredHubs[hub];
    }

    function isHubAllowedForPool(uint64 poolId, address hub) external view returns (bool) {
        _requirePool(poolId);
        return _hubAllowedForPool[poolId][hub];
    }

    function _requirePool(uint64 poolId) internal view {
        if (_pools[poolId].bank == address(0)) revert UnknownPool(poolId);
    }
}
