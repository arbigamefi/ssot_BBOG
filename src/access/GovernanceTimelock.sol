// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @notice Governance of the protocol (ADR-0037 §2): OpenZeppelin TimelockController 5.5 with no admin besides
///         itself, cancellers separate from the proposers, and a delay that can be raised but never set below
///         72 hours. Release values: delay 259,200 s, proposers [Safe], cancellers [guardian], executors
///         [address(0)], so anyone executes a ready operation.
/// @dev The parent grants each proposer PROPOSER_ROLE and CANCELLER_ROLE and DEFAULT_ADMIN_ROLE only to this
///      contract, so role changes and delay changes are operations of the timelock itself.
contract GovernanceTimelock is TimelockController {
    uint256 public constant MIN_DELAY = 259_200;

    error InvalidTimelockConfig();
    error DelayBelowMinimum(uint256 newDelay);

    constructor(uint256 minDelay, address[] memory proposers, address[] memory cancellers, address[] memory executors)
        TimelockController(minDelay, proposers, executors, address(0))
    {
        if (minDelay < MIN_DELAY) revert InvalidTimelockConfig();
        for (uint256 i; i < proposers.length; ++i) {
            if (proposers[i] == address(0)) revert InvalidTimelockConfig();
        }
        for (uint256 i; i < cancellers.length; ++i) {
            address canceller = cancellers[i];
            if (canceller == address(0) || hasRole(PROPOSER_ROLE, canceller)) revert InvalidTimelockConfig();
            _grantRole(CANCELLER_ROLE, canceller);
        }
    }

    /// @notice A new delay applies only to operations scheduled afterwards.
    function updateDelay(uint256 newDelay) public override {
        if (newDelay < MIN_DELAY) revert DelayBelowMinimum(newDelay);
        super.updateDelay(newDelay);
    }
}
