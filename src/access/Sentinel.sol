// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Governable} from "./Governable.sol";
import {Errors} from "../libs/Errors.sol";

/// @notice The risk-reducing role (ADR-0037 §2). The sentinel, the Safe at launch, acts without the timelock but
///         can only decline or stop risk: it cannot admit, loosen a parameter or transfer funds.
abstract contract Sentinel is Governable {
    address public sentinel;

    event SentinelSet(address indexed sentinel);

    /// @dev msg.sender is never zero, so a zero sentinel disables the role.
    modifier onlyGovOrSentinel() {
        if (msg.sender != governance && msg.sender != sentinel) revert Errors.Unauthorized();
        _;
    }

    function setSentinel(address sentinel_) external onlyGov {
        sentinel = sentinel_;
        emit SentinelSet(sentinel_);
    }
}
