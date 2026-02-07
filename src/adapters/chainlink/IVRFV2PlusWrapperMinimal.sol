// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal subset of the Chainlink VRF v2.5+ wrapper used by this repo.
/// @dev We intentionally keep this interface tiny to avoid dependency path fragility.
interface IVRFV2PlusWrapperMinimal {
    function lastRequestId() external view returns (uint256);

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
