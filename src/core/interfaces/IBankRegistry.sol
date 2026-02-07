// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Registry mapping supported ERC20 assets to their immutable Bank(asset) vault.
///         The registry itself is not a custodian and MUST NOT hold user funds.
interface IBankRegistry {
    function bankFor(address asset) external view returns (address bank);
    function isSupported(address asset) external view returns (bool);
    function assetsLength() external view returns (uint256);
    function assetAt(uint256 index) external view returns (address);
    function listAssets() external view returns (address[] memory);
}
