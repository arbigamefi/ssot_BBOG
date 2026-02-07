// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVRFV2PlusWrapper} from "../adapters/chainlink/IVRFV2PlusWrapper.sol";

/// @notice Minimal mock of Chainlink VRF v2.5+ wrapper (native request path) for local tests.
/// @dev Pricing is deterministic and configurable.
contract MockVRFV2PlusWrapper is IVRFV2PlusWrapper {
    uint256 public lastRequestId;

    uint256 public baseFeeWei = 1e14; // 0.0001 ETH
    uint256 public overheadGas = 50_000;
    uint256 public wordFeeWei = 0;

    struct Req {
        address consumer;
        uint32 callbackGasLimit;
        uint16 requestConfirmations;
        uint32 numWords;
        bool active;
    }

    mapping(uint256 => Req) public reqs;

    event WrapperRequested(uint256 indexed requestId, address indexed consumer, uint256 paid);

    function setPricing(uint256 baseFeeWei_, uint256 overheadGas_, uint256 wordFeeWei_) external {
        baseFeeWei = baseFeeWei_;
        overheadGas = overheadGas_;
        wordFeeWei = wordFeeWei_;
    }

    function estimateRequestPriceNative(uint32 callbackGasLimit, uint32 numWords, uint256 requestGasPriceWei)
        external
        view
        override
        returns (uint256)
    {
        return baseFeeWei
            + (uint256(callbackGasLimit) + overheadGas) * requestGasPriceWei
            + uint256(numWords) * wordFeeWei;
    }

    function requestRandomWordsInNative(
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        bytes calldata /*extraArgs*/
    ) external payable override returns (uint256 requestId) {
        // In this mock, we accept any msg.value; the adapter is responsible for enforcing exact charge.
        requestId = ++lastRequestId;
        reqs[requestId] = Req({
            consumer: msg.sender,
            callbackGasLimit: callbackGasLimit,
            requestConfirmations: requestConfirmations,
            numWords: numWords,
            active: true
        });
        emit WrapperRequested(requestId, msg.sender, msg.value);
    }

    /// @notice Test helper to simulate a wrapper callback.
    function fulfillTo(address consumer, uint256 requestId, uint256[] calldata randomWords) external {
        Req storage r = reqs[requestId];
        if (!r.active) return;
        r.active = false;
        // Wrapper calls consumer.rawFulfillRandomWords(...)
        (bool ok, ) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
        ok; // ignore
    }

    receive() external payable {}
}
