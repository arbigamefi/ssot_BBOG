// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal extraArgs encoder compatible with Chainlink VRF v2.5+ wrapper.
/// @dev We avoid importing full chainlink libraries to keep the repo self-contained.
library VRFExtraArgs {
    // This tag is used by the official VRFV2PlusClient for ExtraArgsV1.
    bytes4 internal constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));

    struct ExtraArgsV1 {
        bool nativePayment;
    }

    function encodeNativePayment() internal pure returns (bytes memory) {
        return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, ExtraArgsV1({nativePayment: true}));
    }
}
