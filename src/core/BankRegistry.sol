// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";
import {IBank} from "./interfaces/IBank.sol";
import {IBankRegistry} from "./interfaces/IBankRegistry.sol";

/// @notice Governance-controlled registry: asset -> immutable Bank(asset).
///         This contract MUST NOT custody assets.
contract BankRegistry is IBankRegistry, Governable {
    mapping(address => address) internal _bankFor;
    address[] internal _assets;

    event BankRegistered(address indexed asset, address indexed bank);

    constructor(address gov_) Governable(gov_) { }

    function bankFor(address asset) external view override returns (address bank) {
        return _bankFor[asset];
    }

    function isSupported(address asset) external view override returns (bool) {
        return _bankFor[asset] != address(0);
    }

    function assetsLength() external view override returns (uint256) {
        return _assets.length;
    }

    function assetAt(uint256 index) external view override returns (address) {
        return _assets[index];
    }

    function listAssets() external view override returns (address[] memory) {
        return _assets;
    }

    /// @notice Register a new supported asset with its Bank(asset) vault.
    /// @dev One-way mapping: cannot be changed in v1.x to preserve non-retroactive bet routing.
    function registerBank(address asset, address bank) external onlyGov {
        if (asset == address(0) || bank == address(0)) revert Errors.ZeroAddress();
        if (_bankFor[asset] != address(0)) revert Errors.InvalidConfig();

        // sanity: bank.asset() must match the mapping key
        if (IBank(bank).asset() != asset) revert Errors.InvalidConfig();

        _bankFor[asset] = bank;
        _assets.push(asset);

        emit BankRegistered(asset, bank);
    }
}
