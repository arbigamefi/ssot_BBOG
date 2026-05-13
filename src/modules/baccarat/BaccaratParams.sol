// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Baccarat parameters.
///
/// Encoding: `abi.encode(uint8 side)`
/// - side 0: Player
/// - side 1: Banker
/// - side 2: Tie
library BaccaratParams {
    uint8 internal constant SIDE_PLAYER = 0;
    uint8 internal constant SIDE_BANKER = 1;
    uint8 internal constant SIDE_TIE = 2;

    function decode(bytes calldata params) internal pure returns (uint8 side) {
        side = abi.decode(params, (uint8));
    }

    function encode(uint8 side) internal pure returns (bytes memory) {
        return abi.encode(side);
    }
}
