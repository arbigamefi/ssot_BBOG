// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SSOTTypes} from "./SSOTTypes.sol";

/// @notice Registry for bankroll pools.
///         A poolId, not an asset alone, is the protocol risk/accounting domain.
interface IPoolRegistry {
    function registerPool(uint64 poolId, address asset, address bank, SSOTTypes.PoolDomain domain) external;
    function setPoolActive(uint64 poolId, bool active) external;
    function setHubRegistered(address hub, bool registered) external;
    function setHubAllowedForPool(uint64 poolId, address hub, bool allowed) external;

    function pool(uint64 poolId) external view returns (SSOTTypes.Pool memory);
    function poolCount() external view returns (uint256);
    function poolIdAt(uint256 index) external view returns (uint64);
    function listPoolIds() external view returns (uint64[] memory);

    function assetFor(uint64 poolId) external view returns (address asset);
    function bankFor(uint64 poolId) external view returns (address bank);
    function domainFor(uint64 poolId) external view returns (SSOTTypes.PoolDomain domain);
    function isPoolActive(uint64 poolId) external view returns (bool);
    function isRegisteredHub(address hub) external view returns (bool);
    function isHubAllowedForPool(uint64 poolId, address hub) external view returns (bool);

    event PoolRegistered(
        uint64 indexed poolId, address indexed asset, address indexed bank, SSOTTypes.PoolDomain domain
    );
    event PoolActiveSet(uint64 indexed poolId, bool active);
    event HubRegistered(address indexed hub, bool registered);
    event HubAllowedForPoolSet(uint64 indexed poolId, address indexed hub, bool allowed);

    error UnknownPool(uint64 poolId);
    error PoolAlreadyRegistered(uint64 poolId);
    error BankAlreadyRegistered(address bank, uint64 poolId);
    error HubNotRegistered(address hub);
    error HubNotAllowedForPool(uint64 poolId, address hub);
    error PoolInactive(uint64 poolId);
}
