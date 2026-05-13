// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Slots parameters.
///
/// Encoding: `abi.encode(uint8 profile)`
/// - profile 0: Classic 3-reel / 8-symbol paytable.
library SlotsParams {
    uint8 internal constant PROFILE_CLASSIC = 0;

    function decode(bytes calldata params) internal pure returns (uint8 profile) {
        profile = abi.decode(params, (uint8));
    }

    function encode(uint8 profile) internal pure returns (bytes memory) {
        return abi.encode(profile);
    }
}
