// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IVRFV2PlusWrapper} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFV2PlusWrapper.sol";
import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/// @notice Test provider implementing the pinned wrapper interface and exact-gas consumer delivery.
/// @dev Native prices are deliberately synthetic; production consumes the wrapper's own quotes.
contract MockVRFV2PlusWrapper is IVRFV2PlusWrapper {
    struct Req {
        address consumer;
        uint32 callbackGasLimit;
        uint16 requestConfirmations;
        uint32 numWords;
        bool active;
    }
    uint256 public override lastRequestId;
    uint256 public baseFeeWei = 1e14;
    uint256 public overheadGas = 50_000;
    uint256 public wordFeeWei;
    uint32 public coordinatorMaxGas = 2_500_000;
    uint32 public wrapperGasOverhead = 13_400;
    bool private _forceRequestId;
    uint256 private _forcedRequestId;
    mapping(uint256 => Req) public reqs;

    event WrapperRequested(uint256 indexed requestId, address indexed consumer, uint256 paid);
    event WrapperDelivered(uint256 indexed requestId, address indexed consumer, bool success);

    /// @dev A fixed nonzero address, never called: the consumer base stores it in an immutable at construction, and
    ///      the certified-runtime tests must be able to tell that slot from a zero placeholder (fix review I-1).
    function link() external pure override returns (address) {
        return address(uint160(uint256(keccak256("MockVRFV2PlusWrapper.link"))));
    }

    function linkNativeFeed() external pure override returns (address) {
        return address(0);
    }

    function calculateRequestPrice(uint32, uint32) external pure override returns (uint256) {
        revert("native only mock");
    }

    function estimateRequestPrice(uint32, uint32, uint256) external pure override returns (uint256) {
        revert("native only mock");
    }

    function setPricing(uint256 baseFee, uint256 overhead, uint256 wordFee) external {
        baseFeeWei = baseFee;
        overheadGas = overhead;
        wordFeeWei = wordFee;
    }

    function setGasConfig(uint32 coordinatorLimit, uint32 wrapperOverhead) external {
        coordinatorMaxGas = coordinatorLimit;
        wrapperGasOverhead = wrapperOverhead;
    }

    /// @dev Adversarial provider control: prove zero/reused IDs roll the whole request back.
    function forceRequestId(bool enabled, uint256 value) external {
        _forceRequestId = enabled;
        _forcedRequestId = value;
    }

    function estimateRequestPriceNative(uint32 gasLimit, uint32 numWords, uint256 gasPrice)
        external
        view
        override
        returns (uint256)
    {
        return baseFeeWei + (uint256(gasLimit) + overheadGas) * gasPrice + uint256(numWords) * wordFeeWei;
    }

    function calculateRequestPriceNative(uint32 gasLimit, uint32 numWords) public view override returns (uint256) {
        return baseFeeWei + (uint256(gasLimit) + overheadGas) * tx.gasprice + uint256(numWords) * wordFeeWei;
    }

    function requestRandomWordsInNative(
        uint32 gasLimit,
        uint16 confirmations,
        uint32 numWords,
        bytes calldata extraArgs
    ) external payable override returns (uint256 requestId) {
        require(msg.value == calculateRequestPriceNative(gasLimit, numWords), "native fee");
        require(gasLimit > 0 && confirmations > 0 && numWords > 0, "request config");
        require(uint256(gasLimit) + gasLimit / 63 + 1 + wrapperGasOverhead <= coordinatorMaxGas, "coordinator gas");
        require(
            keccak256(extraArgs)
                == keccak256(VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}))),
            "native payment args"
        );
        requestId = _forceRequestId ? _forcedRequestId : lastRequestId + 1;
        lastRequestId = requestId;
        reqs[requestId] = Req(msg.sender, gasLimit, confirmations, numWords, true);
        emit WrapperRequested(requestId, msg.sender, msg.value);
    }

    function fulfillTo(address consumer, uint256 requestId, uint256[] calldata words) external returns (bool success) {
        Req storage r = reqs[requestId];
        require(r.consumer == consumer && consumer != address(0), "consumer binding");
        if (!r.active) return true;
        r.active = false;
        return _deliver(consumer, requestId, r.callbackGasLimit, words);
    }

    /// @dev Explicit duplicate/provider-corruption test path, still using inherited consumer authentication.
    function repeatFulfillment(uint256 requestId, uint256[] calldata words) external returns (bool success) {
        Req storage r = reqs[requestId];
        require(r.consumer != address(0), "unknown request");
        return _deliver(r.consumer, requestId, r.callbackGasLimit, words);
    }

    function _deliver(address consumer, uint256 requestId, uint32 gasLimit, uint256[] calldata words)
        private
        returns (bool success)
    {
        bytes memory data = abi.encodeWithSelector(
            VRFV2PlusWrapperConsumerBase.rawFulfillRandomWords.selector, requestId, words
        );
        assembly ("memory-safe") {
            let g := gas()
            if lt(g, 5000) { revert(0, 0) }
            g := sub(g, 5000)
            if iszero(gt(sub(g, div(g, 64)), gasLimit)) { revert(0, 0) }
            if iszero(extcodesize(consumer)) { revert(0, 0) }
            success := call(gasLimit, consumer, 0, add(data, 32), mload(data), 0, 0)
        }
        emit WrapperDelivered(requestId, consumer, success);
    }
}
