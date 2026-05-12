// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVRFHub} from "./interfaces/IVRFHub.sol";
import {IVRFAdapter} from "./interfaces/IVRFAdapter.sol";
import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";

/// @notice Minimal VRFHub with charged-fee semantics (refactored parity).
///
/// Design goals:
/// - fulfillRandomWords MUST NEVER revert (soft-ignore / try-catch).
/// - requestRandomWords is payable and charges a deterministic fee quote.
/// - Overpayment is refunded best-effort; if refund transfer fails, user can later claim.
/// - No privileged "withdraw" for oracle fees (no backdoor).
///
/// Adapter mode:
/// - If `adapter` is configured, VRFHub forwards the charged fee to the adapter which
///   performs the provider request and returns the provider requestId.
/// - VRFHub still enforces liveness and bookkeeping; fulfill stays `coordinator`-gated.
contract VRFHub is IVRFHub, Governable {
    /// @notice Address permitted to call fulfill (provider / wrapper).
    address public immutable coordinator;

    /// @notice Optional adapter used to issue requests to external providers.
    IVRFAdapter public adapter;

    /// @notice Internal request nonce (used only when adapter is unset).
    uint256 public nextRequestId = 1;

    // Fee model (native token) used when adapter is unset:
    // fee = baseFeeWei + callbackGasLimit*gasPriceWei + numWords*wordFeeWei + confirmations*confirmationsFeeWei
    uint256 public baseFeeWei;
    uint256 public gasPriceWei;
    uint256 public wordFeeWei;
    uint256 public confirmationsFeeWei;

    mapping(uint256 => RequestInfo) internal requests;
    mapping(address => uint256) internal _refundCredit;

    event AdapterSet(address indexed adapter);

    event Fulfilled(uint256 indexed requestId, address indexed hub, uint256 indexed betId, bytes32 randomHash);
    event Ignored(uint256 indexed requestId);
    event HubCallbackFailed(uint256 indexed requestId, bytes revertData);

    constructor(address coordinator_, address gov_) Governable(gov_) {
        coordinator = coordinator_;
        // conservative defaults for tests / local usage
        baseFeeWei = 1e14; // 0.0001 ETH
        gasPriceWei = 1e9; // 1 gwei
        wordFeeWei = 0;
        confirmationsFeeWei = 0;
    }

    // -------------------------
    // Governance
    // -------------------------

    function setAdapter(address adapter_) external onlyGov {
        if (adapter_ == address(0)) {
            adapter = IVRFAdapter(address(0));
            emit AdapterSet(address(0));
            return;
        }
        // Adapter must be wired to the same coordinator that calls back into VRFHub.
        if (IVRFAdapter(adapter_).coordinator() != coordinator) revert Errors.InvalidConfig();
        adapter = IVRFAdapter(adapter_);
        emit AdapterSet(adapter_);
    }

    function setFeeParams(uint256 baseFeeWei_, uint256 gasPriceWei_, uint256 wordFeeWei_, uint256 confirmationsFeeWei_)
        external
        onlyGov
    {
        // No strict bounds here; invariants and UI should enforce sanity.
        baseFeeWei = baseFeeWei_;
        gasPriceWei = gasPriceWei_;
        wordFeeWei = wordFeeWei_;
        confirmationsFeeWei = confirmationsFeeWei_;
    }

    // -------------------------
    // Views
    // -------------------------

    function getRequest(uint256 requestId) external view override returns (RequestInfo memory) {
        return requests[requestId];
    }

    function refundCreditOf(address payer) external view override returns (uint256 amount) {
        return _refundCredit[payer];
    }

    function quote(uint32 callbackGasLimit, uint16 requestConfirmations, uint32 numWords)
        public
        view
        override
        returns (uint256 fee)
    {
        if (address(adapter) != address(0)) {
            return adapter.quoteNative(callbackGasLimit, requestConfirmations, numWords);
        }
        // fee = base + gas + words + confirmations
        fee = baseFeeWei
            + (uint256(callbackGasLimit) * gasPriceWei)
            + (uint256(numWords) * wordFeeWei)
            + (uint256(requestConfirmations) * confirmationsFeeWei);
    }

    // -------------------------
    // Fee + request
    // -------------------------

    function requestRandomWords(
        address hub,
        uint256 betId,
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        address payer
    ) external payable override returns (uint256 requestId, uint256 feeCharged) {
        if (payer == address(0)) revert Errors.ZeroAddress();

        uint256 required = quote(callbackGasLimit, requestConfirmations, numWords);
        if (msg.value < required) revert InsufficientVRFFee(msg.value, required);

        uint256 refundDue = msg.value - required;
        bool refundOk = true;

        if (refundDue != 0) {
            (refundOk, ) = payable(payer).call{value: refundDue}("");
            if (!refundOk) {
                _refundCredit[payer] += refundDue;
            }
        }

        if (address(adapter) != address(0)) {
            // Forward the charged fee to the adapter/provider.
            (requestId, feeCharged) = adapter.requestRandomWordsInNative{value: required}(
                callbackGasLimit, requestConfirmations, numWords
            );
            // Defensive: enforce charged == required (adapter should be pure proxy).
            if (feeCharged != required) revert Errors.InvalidConfig();
        } else {
            // Internal/test mode: use a disjoint requestId namespace to avoid collisions with provider ids.
            requestId = (uint256(1) << 255) | nextRequestId++;
            feeCharged = required;
        }

        requests[requestId] = RequestInfo({
            hub: hub,
            betId: betId,
            payer: payer,
            feePaid: msg.value,
            feeCharged: feeCharged,
            active: true
        });

        emit VRFFeeCharged(requestId, payer, msg.value, feeCharged, refundDue, refundOk);
        emit Requested(requestId, hub, betId);
    }

    function claimRefund() external override returns (uint256 amount) {
        amount = _refundCredit[msg.sender];
        if (amount == 0) return 0;
        _refundCredit[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) {
            _refundCredit[msg.sender] = amount;
            revert Errors.TransferFailed();
        }
        emit VRFFeeRefundClaimed(msg.sender, amount);
    }

    function detach(uint256 requestId) external override {
        RequestInfo storage r = requests[requestId];
        if (r.hub != msg.sender) revert NotOwningHub();
        address hub = r.hub;
        uint256 betId = r.betId;
        bool wasActive = r.active;
        delete requests[requestId];
        if (wasActive) emit Detached(requestId, hub, betId);
    }

    // -------------------------
    // Fulfill
    // -------------------------

    /// @notice Called by coordinator/provider. MUST NOT revert.
    /// @dev For Chainlink wrappers this may be invoked via `rawFulfillRandomWords`.
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) public {
        if (msg.sender != coordinator) {
            emit Ignored(requestId);
            return;
        }
        RequestInfo storage r = requests[requestId];
        if (r.hub == address(0) || !r.active) {
            emit Ignored(requestId);
            return;
        }
        address hub = r.hub;
        uint256 betId = r.betId;

        // single-use: deactivate on first attempt
        r.active = false;

        bytes32 rh = keccak256(abi.encode(randomWords));

        try HubLike(hub).onRandomWords(requestId, randomWords) {
            emit Fulfilled(requestId, hub, betId, rh);
        } catch (bytes memory err) {
            emit HubCallbackFailed(requestId, err);
        }
    }

    /// @notice Chainlink-compatible callback entry (wrapper/coordinator calls this).
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        fulfillRandomWords(requestId, randomWords);
    }

    receive() external payable {}
}

interface HubLike {
    function onRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}
