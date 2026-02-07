// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Test helper: a contract that can toggle whether it accepts native token.
/// @dev Used to force VRF overpay refund failures (so VRFHub credits can be exercised).
contract ToggleReceiver {
    bool public accept;

    function setAccept(bool v) external {
        accept = v;
    }

    receive() external payable {
        require(accept, "REJECT_ETH");
    }
}
