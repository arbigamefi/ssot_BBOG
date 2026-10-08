// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

library Errors {
    error ZeroAddress();
    error InvalidBps(uint256 bps);
    error InvalidConfig();
    error TransferFailed();
    error Unauthorized();
    error InsufficientBalance();
}
