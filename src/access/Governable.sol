// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors} from "../libs/Errors.sol";

abstract contract Governable {
    address public governance;
    address public pendingGovernance;

    event GovernanceTransferStarted(address indexed oldGov, address indexed newGov);
    event GovernanceTransferred(address indexed oldGov, address indexed newGov);

    modifier onlyGov() {
        if (msg.sender != governance) revert Errors.InsufficientBalance();
        _;
    }

    constructor(address gov_) {
        if (gov_ == address(0)) revert Errors.ZeroAddress();
        governance = gov_;
        emit GovernanceTransferred(address(0), gov_);
    }

    function transferGovernance(address newGov) external onlyGov {
        if (newGov == address(0)) revert Errors.ZeroAddress();
        pendingGovernance = newGov;
        emit GovernanceTransferStarted(governance, newGov);
    }

    function acceptGovernance() external {
        address newGov = pendingGovernance;
        if (msg.sender != newGov) revert Errors.InsufficientBalance();
        address old = governance;
        governance = newGov;
        pendingGovernance = address(0);
        emit GovernanceTransferred(old, newGov);
    }
}
