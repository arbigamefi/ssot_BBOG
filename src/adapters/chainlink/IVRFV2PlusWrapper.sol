// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal interface for Chainlink VRF v2.5+ Wrapper (native payment path).
/// @dev The actual wrapper has more methods; we only use those needed for quoting and requesting.
interface IVRFV2PlusWrapper {
    function estimateRequestPriceNative(uint32 callbackGasLimit, uint32 numWords, uint256 requestGasPriceWei)
        external
        view
        returns (uint256);

    function requestRandomWordsInNative(
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        bytes calldata extraArgs
    ) external payable returns (uint256 requestId);
}
