// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IVRFHub} from "./interfaces/IVRFHub.sol";
import {ISettlementRouter} from "./interfaces/ISettlementRouter.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {Errors} from "../libs/Errors.sol";

/// @notice Direct wrapper consumer. A received seed persists before fallible game accounting.
/// @dev No provider switch, administrator, fee sweep or replacement-randomness path.
contract VRFHub is IVRFHub, VRFV2PlusWrapperConsumerBase, ReentrancyGuard {
    /// @dev Base Sepolia block 47638466: c+c/63+1+13400 <= 2500000. Requalify before release.
    uint32 public constant override MAX_CALLBACK_GAS = 2_447_746;
    uint32 public constant MIN_CALLBACK_GAS_LIMIT = 200_000;
    uint256 public constant CALLBACK_COMPLETION_GAS = 45_000;
    uint256 public constant EXCESS_REFUND_GAS = 30_000;
    uint256 private constant REFUND_BOOKING_GAS = 65_000;
    uint256 private constant CALL_OVERHEAD_GAS = 10_000;

    address public immutable override settlementRouter;
    mapping(uint256 => RequestInfo) private _requests;
    mapping(uint256 => uint256) public override requestIdForPosition;
    mapping(address => uint256) public override unbookedResultCount;
    mapping(address => uint256) private _refundCredit;
    uint256 public override totalRefundCredit;

    constructor(address wrapper_, address settlementRouter_) VRFV2PlusWrapperConsumerBase(wrapper_) {
        if (wrapper_.code.length == 0 || settlementRouter_.code.length == 0) revert Errors.InvalidConfig();
        settlementRouter = settlementRouter_;
    }

    function wrapper() external view override returns (address) {
        return address(i_vrfV2PlusWrapper);
    }

    function getRequest(uint256 requestId) external view override returns (RequestInfo memory) {
        return _requests[requestId];
    }

    function refundCreditOf(address payer) external view override returns (uint256) {
        return _refundCredit[payer];
    }

    function quote(uint32 callbackGasLimit, uint256 gasPriceBudget) external view override returns (uint256) {
        _checkCallbackGas(callbackGasLimit);
        return i_vrfV2PlusWrapper.estimateRequestPriceNative(callbackGasLimit, 1, gasPriceBudget);
    }

    function requestRandomWords(uint256 positionId, uint32 callbackGasLimit, uint16 confirmations)
        external
        payable
        override
        nonReentrant
        returns (uint256 requestId, uint256 feeCharged)
    {
        _checkCallbackGas(callbackGasLimit);
        if (confirmations == 0) revert InvalidConfirmations();
        ISettlementRouter router = ISettlementRouter(settlementRouter);
        SSOTTypes.Position memory pos = router.getPosition(positionId);
        if (
            pos.positionId != positionId || pos.ownerHub != msg.sender || pos.state != SSOTTypes.PositionState.Held
                || pos.player == address(0) || pos.bank == address(0)
                || router.settlementConsumer(pos.bank) != address(this)
        ) {
            revert InvalidRequestBinding(positionId);
        }
        if (requestIdForPosition[positionId] != 0) revert PositionAlreadyRequested(positionId);

        // An insufficient new budget may not spend old refund credits through the helper.
        uint256 required = i_vrfV2PlusWrapper.calculateRequestPriceNative(callbackGasLimit, 1);
        if (msg.value < required) revert InsufficientVRFFee(msg.value, required);
        (requestId, feeCharged) = requestRandomnessPayInNative(
            callbackGasLimit,
            confirmations,
            1,
            VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}))
        );
        if (feeCharged != required) revert InvalidWrapperCharge();
        if (requestId == 0 || _requests[requestId].state != RequestState.None) revert InvalidRequestId(requestId);
        requestIdForPosition[positionId] = requestId;
        _requests[requestId] = RequestInfo({
            bank: pos.bank,
            hub: msg.sender,
            betId: positionId,
            payer: pos.player,
            feePaid: msg.value,
            feeCharged: feeCharged,
            seed: 0,
            state: RequestState.Awaiting
        });
        uint256 refundDue = msg.value - feeCharged;
        bool refunded = true;
        if (refundDue != 0) {
            refunded = _returnExcess(pos.player, refundDue);
            if (!refunded) {
                _refundCredit[pos.player] += refundDue;
                totalRefundCredit += refundDue;
            }
        }
        emit Requested(requestId, msg.sender, positionId, pos.bank);
        emit VRFFeeCharged(requestId, pos.player, msg.value, feeCharged, refundDue, refunded);
    }

    function claimRefund() external override nonReentrant returns (uint256 amount) {
        amount = _refundCredit[msg.sender];
        if (amount == 0) return 0;
        _refundCredit[msg.sender] = 0;
        totalRefundCredit -= amount;
        bool ok;
        address payer = msg.sender;
        assembly ("memory-safe") { ok := call(gas(), payer, amount, 0, 0, 0, 0) }
        if (!ok) revert Errors.TransferFailed();
        emit VRFFeeRefundClaimed(payer, amount);
    }

    /// @dev The inherited raw entry authenticates the immutable wrapper before reaching this hook.
    function fulfillRandomWords(uint256 requestId, uint256[] memory words) internal override nonReentrant {
        RequestInfo storage r = _requests[requestId];
        if (r.state != RequestState.Awaiting || words.length != 1) {
            emit ResponseIgnored(requestId, r.state);
            return;
        }
        r.seed = words[0];
        r.state = RequestState.Received;
        ++unbookedResultCount[r.bank];
        emit ResultReceived(requestId, r.bank, words[0]);
        _deliver(requestId, r);
    }

    function retry(uint256 requestId) external override nonReentrant returns (bool settled) {
        RequestInfo storage r = _requests[requestId];
        if (r.state != RequestState.Received) revert InvalidRequestState(requestId, r.state);
        _deliver(requestId, r);
        return r.state == RequestState.Terminal;
    }

    /// @dev Callable from the guarded callback/retry. Owning Hub includes this inside its atomic child,
    /// after Router/Bank/Vault accounting; failure rolls that child back, leaving the outer seed intact.
    function acknowledge(uint256 requestId) external override {
        RequestInfo storage r = _requests[requestId];
        if (msg.sender != r.hub) revert NotOwningHub();
        if (r.state != RequestState.Received) revert InvalidRequestState(requestId, r.state);
        _requireTerminalPosition(r, SSOTTypes.PositionState.Settled);
        r.state = RequestState.Terminal;
        --unbookedResultCount[r.bank];
        emit ResultAcknowledged(requestId, r.bank);
    }

    function cancel(uint256 requestId) external override {
        RequestInfo storage r = _requests[requestId];
        if (msg.sender != r.hub) revert NotOwningHub();
        if (r.state != RequestState.Awaiting) revert InvalidRequestState(requestId, r.state);
        _requireTerminalPosition(r, SSOTTypes.PositionState.Refunded);
        r.state = RequestState.Cancelled;
        emit RequestCancelled(requestId);
    }

    /// @dev Owning Hub calls inside its void, after the Router voided the position. Excludes acknowledge: both need
    ///      a Received request and each leaves it terminal.
    function acknowledgeVoid(uint256 requestId) external override {
        RequestInfo storage r = _requests[requestId];
        if (msg.sender != r.hub) revert NotOwningHub();
        if (r.state != RequestState.Received) revert InvalidRequestState(requestId, r.state);
        _requireTerminalPosition(r, SSOTTypes.PositionState.Voided);
        r.state = RequestState.Voided;
        --unbookedResultCount[r.bank];
        emit ResultVoided(requestId, r.bank);
    }

    function _requireTerminalPosition(RequestInfo storage r, SSOTTypes.PositionState terminal) private view {
        SSOTTypes.Position memory pos = ISettlementRouter(settlementRouter).getPosition(r.betId);
        if (pos.state != terminal || pos.ownerHub != r.hub || pos.bank != r.bank || pos.player != r.payer) {
            revert InvalidTerminalPosition(r.betId);
        }
    }

    function _deliver(uint256 requestId, RequestInfo storage r) private {
        uint256[] memory words = new uint256[](1);
        words[0] = r.seed;
        bytes memory data = abi.encodeCall(IRandomWordsReceiver.onRandomWords, (requestId, words));
        address hub = r.hub;
        uint256 remaining = gasleft();
        bool delivered;
        bytes32 failurePrefix;
        if (remaining > CALLBACK_COMPLETION_GAS + CALL_OVERHEAD_GAS) {
            uint256 budget = remaining - CALLBACK_COMPLETION_GAS - CALL_OVERHEAD_GAS;
            assembly ("memory-safe") {
                delivered := call(budget, hub, 0, add(data, 32), mload(data), 0, 0)
                if iszero(delivered) {
                    let scratch := mload(0x40)
                    mstore(scratch, 0)
                    let size := returndatasize()
                    if gt(size, 32) { size := 32 }
                    returndatacopy(scratch, 0, size)
                    failurePrefix := mload(scratch)
                }
            }
        }
        emit CallbackAttempt(requestId, delivered, r.state, failurePrefix);
    }

    function _returnExcess(address payer, uint256 amount) private returns (bool ok) {
        uint256 remaining = gasleft();
        if (remaining <= REFUND_BOOKING_GAS + CALL_OVERHEAD_GAS) return false;
        uint256 budget = remaining - REFUND_BOOKING_GAS - CALL_OVERHEAD_GAS;
        if (budget > EXCESS_REFUND_GAS) budget = EXCESS_REFUND_GAS;
        assembly ("memory-safe") { ok := call(budget, payer, amount, 0, 0, 0, 0) }
    }

    function _checkCallbackGas(uint32 callbackGasLimit) private pure {
        if (callbackGasLimit < MIN_CALLBACK_GAS_LIMIT || callbackGasLimit > MAX_CALLBACK_GAS) {
            revert InvalidCallbackGas(callbackGasLimit);
        }
    }
}

    interface IRandomWordsReceiver {
        function onRandomWords(uint256 requestId, uint256[] calldata words) external;
    }
