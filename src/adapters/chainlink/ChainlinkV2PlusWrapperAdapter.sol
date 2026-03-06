// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governable} from "../../access/Governable.sol";
import {Errors} from "../../libs/Errors.sol";
import {IVRFAdapter} from "../../core/interfaces/IVRFAdapter.sol";
import {IVRFV2PlusWrapper} from "./IVRFV2PlusWrapper.sol";
import {VRFExtraArgs} from "./VRFExtraArgs.sol";

/// @notice Adapter that proxies VRF requests to Chainlink VRF v2.5+ Wrapper using native token payment.
///
/// Callback flow:
/// - VRFHub forwards `requiredFee` to this adapter, which issues the wrapper request.
/// - Chainlink wrapper calls back into this adapter (as the consumer).
/// - Adapter forwards random words to VRFHub.fulfillRandomWords(...).
///
/// This contract is intentionally small and deterministic:
/// - Quote uses wrapper.estimateRequestPriceNative(...) with a configured `requestGasPriceWei`.
/// - Request forwards the exact charged fee to the wrapper and returns the wrapper requestId.
/// - The coordinator for VRFHub gating is THIS adapter contract.
contract ChainlinkV2PlusWrapperAdapter is IVRFAdapter, Governable {
    error InsufficientFee(uint256 provided, uint256 required);

    IVRFV2PlusWrapper public immutable wrapper;

    /// @notice VRFHub that should receive forwarded fulfill calls.
    address public vrfHub;

    /// @notice Gas price used for wrapper native fee estimates.
    uint256 public requestGasPriceWei;


    event VRFHubSet(address indexed vrfHub);

    constructor(address wrapper_, address gov_) Governable(gov_) {
        if (wrapper_ == address(0)) revert Errors.ZeroAddress();
        wrapper = IVRFV2PlusWrapper(wrapper_);
        requestGasPriceWei = 0;
    }

    function coordinator() external view override returns (address) {
        return address(this);
    }

    function setVRFHub(address vrfHub_) external onlyGov {
        if (vrfHub_ == address(0)) revert Errors.ZeroAddress();
        vrfHub = vrfHub_;
        emit VRFHubSet(vrfHub_);
    }

    /// @notice Governance hook: set the request gas price used in wrapper estimates.
    /// @dev For local tests keep at 0 for deterministic pricing.
    function setRequestGasPriceWei(uint256 weiPerGas) external onlyGov {
        requestGasPriceWei = weiPerGas;
    }

    function quoteNative(uint32 callbackGasLimit, uint16 /*requestConfirmations*/, uint32 numWords)
        external
        view
        override
        returns (uint256 feeWei)
    {
        feeWei = wrapper.estimateRequestPriceNative(callbackGasLimit, numWords, requestGasPriceWei);
    }

    function requestRandomWordsInNative(uint32 callbackGasLimit, uint16 requestConfirmations, uint32 numWords)
        external
        payable
        override
        returns (uint256 requestId, uint256 charged)
    {
        charged = wrapper.estimateRequestPriceNative(callbackGasLimit, numWords, requestGasPriceWei);
        if (msg.value < charged) revert InsufficientFee(msg.value, charged);

        // Encode nativePayment=true. We keep the encoding minimal to avoid large deps.
        bytes memory extraArgs = VRFExtraArgs.encodeNativePayment();

        requestId = wrapper.requestRandomWordsInNative{value: charged}(
            callbackGasLimit,
            requestConfirmations,
            numWords,
            extraArgs
        );
        // Note: overpayment is not refunded here; VRFHub handles overpay refund to the payer.
    }

    /// @notice Callback entrypoint from wrapper. Best-effort forward to VRFHub.
    /// @dev MUST NOT revert.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(wrapper)) {
            return;
        }
        address hub = vrfHub;
        if (hub == address(0)) {
            return;
        }
        // Best-effort forward; VRFHub itself is fulfill-never-revert.
        (bool ok, ) = hub.call(abi.encodeWithSelector(bytes4(keccak256("fulfillRandomWords(uint256,uint256[])")), requestId, randomWords));
        ok; // ignore
    }

    receive() external payable {}
}
