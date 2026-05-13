// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governable} from "../../access/Governable.sol";
import {Errors} from "../../libs/Errors.sol";
import {IReferralRegistry} from "./IReferralRegistry.sol";

/// @notice First-touch referral registry with anti-cycle.
///
/// Notes:
/// - v1.0 limits cycle checks to a bounded number of hops (64) for gas safety.
/// - `binder` is intended to be the authorized game hub and is set once.
contract ReferralRegistry is IReferralRegistry, Governable {
    uint8 internal constant MAX_HOPS = 64;

    address public override binder;
    mapping(address => address) private _ref;

    event BinderSet(address indexed binder);
    event ReferrerBound(address indexed player, address indexed referrer);

    constructor(address gov) Governable(gov) {}

    function referrerOf(address player) external view override returns (address) {
        return _ref[player];
    }

    function setBinderOnce(address b) external onlyGov {
        if (b == address(0)) revert Errors.ZeroAddress();
        if (binder != address(0)) revert Errors.InvalidConfig();
        binder = b;
        emit BinderSet(b);
    }

    function bind(address player, address referrer) external override {
        if (msg.sender != player) revert Errors.InvalidConfig();
        _bind(player, referrer);
    }

    function bindFor(address player, address referrer) external override {
        if (msg.sender != binder) revert Errors.InvalidConfig();
        _bind(player, referrer);
    }

    function _bind(address player, address referrer) internal {
        if (player == address(0) || referrer == address(0)) revert Errors.ZeroAddress();
        if (player == referrer) revert Errors.InvalidConfig();
        if (_ref[player] != address(0)) revert Errors.InvalidConfig(); // first-touch immutable

        // anti-cycle: walk up from referrer and ensure we never reach player
        address cur = referrer;
        for (uint8 i = 0; i < MAX_HOPS && cur != address(0); ++i) {
            if (cur == player) revert Errors.InvalidConfig();
            cur = _ref[cur];
        }

        _ref[player] = referrer;
        emit ReferrerBound(player, referrer);
    }
}
