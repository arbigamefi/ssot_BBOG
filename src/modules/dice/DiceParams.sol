// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library DiceParams {
    /// @notice Decode dice params.
    /// @dev `isOver == true` wins when rolled > target; otherwise wins when rolled <= target.
    function decode(bytes calldata params) internal pure returns (bool isOver, uint8 target) {
        (isOver, target) = abi.decode(params, (bool, uint8));
    }
}
