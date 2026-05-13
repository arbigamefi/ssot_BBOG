// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Keno parameters.
///
/// Encoding: `abi.encode(uint40 numbersBitmask)`
/// - bit i set => number i is selected (0-indexed)
/// - Pool size N = 40 (valid bits [0..39])
/// - Draw size M = 10
/// - Player may select up to 10 numbers
library KenoParams {
    uint8 internal constant BIGGEST_NUMBER = 40; // N
    uint8 internal constant DRAW_COUNT = 10; // M
    uint8 internal constant MAX_NUMBERS_PLAYED = 10;

    function decode(bytes calldata params) internal pure returns (uint40 numbers) {
        numbers = abi.decode(params, (uint40));
    }

    function encode(uint40 numbers) internal pure returns (bytes memory) {
        return abi.encode(numbers);
    }
}
