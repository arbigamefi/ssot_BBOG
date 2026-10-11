// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @dev Test double for an address the registry admits as a hub: it reports `governance` with no transfer pending,
///      which PoolRegistry requires of every admitted hub and Bank (ADR-0037 §3). Tests etch its runtime onto the
///      EOA they prank as the hub.
contract GovernedStub {
    address public immutable governance;
    address public constant pendingGovernance = address(0);

    constructor(address governance_) {
        governance = governance_;
    }
}
