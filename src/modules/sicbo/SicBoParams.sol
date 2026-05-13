// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Sic Bo parameters.
///
/// Encoding: `abi.encode(uint8 kind, uint8 value)`
/// - kind 0: Small, value must be 0
/// - kind 1: Big, value must be 0
/// - kind 2: Any Triple, value must be 0
/// - kind 3: Specific Triple, value is face 1..6
/// - kind 4: Exact Total, value is total 4..17
/// - kind 5: Specific Double, value is face 1..6
/// - kind 6: Single Face, value is face 1..6
library SicBoParams {
    uint8 internal constant KIND_SMALL = 0;
    uint8 internal constant KIND_BIG = 1;
    uint8 internal constant KIND_ANY_TRIPLE = 2;
    uint8 internal constant KIND_SPECIFIC_TRIPLE = 3;
    uint8 internal constant KIND_TOTAL = 4;
    uint8 internal constant KIND_SPECIFIC_DOUBLE = 5;
    uint8 internal constant KIND_SINGLE_FACE = 6;

    function decode(bytes calldata params) internal pure returns (uint8 kind, uint8 value) {
        (kind, value) = abi.decode(params, (uint8, uint8));
    }

    function encode(uint8 kind, uint8 value) internal pure returns (bytes memory) {
        return abi.encode(kind, value);
    }
}
