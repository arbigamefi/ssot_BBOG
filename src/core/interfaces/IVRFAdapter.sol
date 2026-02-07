// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Adapter interface for integrating external VRF providers (e.g. Chainlink wrappers).
/// @dev VRFHub forwards the charged fee to the adapter and uses the provider's requestId.
interface IVRFAdapter {
    /// @notice Address that will call back into VRFHub with random words (provider / wrapper).
    function coordinator() external view returns (address);

    /// @notice Quote request price in native token.
    function quoteNative(uint32 callbackGasLimit, uint16 requestConfirmations, uint32 numWords)
        external
        view
        returns (uint256 feeWei);

    /// @notice Perform request and charge fee in native token.
    /// @return requestId provider request id
    /// @return charged amount charged (<= msg.value)
    function requestRandomWordsInNative(uint32 callbackGasLimit, uint16 requestConfirmations, uint32 numWords)
        external
        payable
        returns (uint256 requestId, uint256 charged);
}
