// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library DiceParams {
    /// @notice Decode dice params (cap in [1..99]).
    function decode(bytes calldata params) internal pure returns (uint8 cap) {
        cap = abi.decode(params, (uint8));
    }
}
