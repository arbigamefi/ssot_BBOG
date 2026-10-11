// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

interface IVRFHub {
    enum RequestState {
        None,
        Awaiting,
        Received,
        Terminal,
        Cancelled,
        Voided
    }

    struct RequestInfo {
        address bank;
        address hub;
        uint256 betId;
        address payer;
        uint256 feePaid;
        uint256 feeCharged;
        uint256 seed;
        RequestState state;
    }

    function settlementRouter() external view returns (address);
    function wrapper() external view returns (address);
    function MAX_CALLBACK_GAS() external view returns (uint32);
    function getRequest(uint256 requestId) external view returns (RequestInfo memory);
    function requestIdForPosition(uint256 positionId) external view returns (uint256);
    function unbookedResultCount(address bank) external view returns (uint256);

    /// @notice Explicit gas-price budget for one native word; execution uses actual tx.gasprice.
    function quote(uint32 callbackGasLimit, uint256 gasPriceBudget) external view returns (uint256);
    function requestRandomWords(uint256 positionId, uint32 callbackGasLimit, uint16 confirmations)
        external
        payable
        returns (uint256 requestId, uint256 feeCharged);

    /// @notice Redeliver the first recorded seed. Failure keeps the received result available.
    function retry(uint256 requestId) external returns (bool settled);
    /// @notice Owning Hub calls after complete Router/Bank/Vault accounting in its atomic settlement call.
    function acknowledge(uint256 requestId) external;
    /// @notice Owning Hub calls after Router refund; only an unreceived request may be cancelled.
    function cancel(uint256 requestId) external;
    /// @notice Owning Hub calls after the Router voided the position; excludes acknowledge (ADR-0037 §7.4).
    function acknowledgeVoid(uint256 requestId) external;

    function refundCreditOf(address payer) external view returns (uint256);
    function totalRefundCredit() external view returns (uint256);
    function claimRefund() external returns (uint256 amount);

    event Requested(uint256 indexed requestId, address indexed hub, uint256 indexed betId, address bank);
    event ResultReceived(uint256 indexed requestId, address indexed bank, uint256 seed);
    event ResultAcknowledged(uint256 indexed requestId, address indexed bank);
    event RequestCancelled(uint256 indexed requestId);
    event ResultVoided(uint256 indexed requestId, address indexed bank);
    event ResponseIgnored(uint256 indexed requestId, RequestState state);
    /// @dev Failure data is limited to its first 32 bytes; delivered does not imply the Hub settled.
    event CallbackAttempt(uint256 indexed requestId, bool delivered, RequestState state, bytes32 failurePrefix);
    event VRFFeeCharged(
        uint256 indexed requestId,
        address indexed payer,
        uint256 paid,
        uint256 charged,
        uint256 refundDue,
        bool refundSucceeded
    );
    event VRFFeeRefundClaimed(address indexed payer, uint256 amount);

    error NotOwningHub();
    error InvalidRequestBinding(uint256 positionId);
    error PositionAlreadyRequested(uint256 positionId);
    error InvalidRequestId(uint256 requestId);
    error InvalidRequestState(uint256 requestId, RequestState state);
    error InvalidCallbackGas(uint32 callbackGasLimit);
    error InvalidConfirmations();
    error InvalidWrapperCharge();
    error InvalidTerminalPosition(uint256 positionId);
    error InsufficientVRFFee(uint256 paid, uint256 required);
}
