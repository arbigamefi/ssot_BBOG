// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Plinko parameters.
///
/// Encoding: `abi.encode(uint8 risk)`
/// - risk 0: Low
/// - risk 1: Medium
/// - risk 2: High
library PlinkoParams {
    uint8 internal constant RISK_LOW = 0;
    uint8 internal constant RISK_MEDIUM = 1;
    uint8 internal constant RISK_HIGH = 2;

    function decode(bytes calldata params) internal pure returns (uint8 risk) {
        risk = abi.decode(params, (uint8));
    }

    function encode(uint8 risk) internal pure returns (bytes memory) {
        return abi.encode(risk);
    }
}
