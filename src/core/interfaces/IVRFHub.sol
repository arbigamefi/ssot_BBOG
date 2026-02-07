// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVRFHub {
    struct RequestInfo {
        address hub;
        uint256 betId;
        /// @notice EOA that paid the VRF fee for this request (player == receiver in SSOT).
        address payer;
        /// @notice Native token amount provided for the request.
        uint256 feePaid;
        /// @notice Native token amount charged for the request (<= feePaid).
        uint256 feeCharged;
        bool active;
    }

    function getRequest(uint256 requestId) external view returns (RequestInfo memory);

    /// @notice Deterministic quote for a VRF request in native token.
    function quote(uint32 callbackGasLimit, uint16 requestConfirmations, uint32 numWords)
        external
        view
        returns (uint256 fee);

    /// @notice Request VRF. Caller provides native token. Overpayment is refunded best-effort.
    function requestRandomWords(
        address hub,
        uint256 betId,
        uint32 callbackGasLimit,
        uint16 requestConfirmations,
        uint32 numWords,
        address payer
    ) external payable returns (uint256 requestId, uint256 feeCharged);

    /// @notice Claim accumulated refund credit (best-effort refunds that failed to transfer).
    function claimRefund() external returns (uint256 amount);

    function refundCreditOf(address payer) external view returns (uint256 amount);

    function detach(uint256 requestId) external;

    event Requested(uint256 indexed requestId, address indexed hub, uint256 indexed betId);
    event Detached(uint256 indexed requestId, address indexed hub, uint256 indexed betId);

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

    error InsufficientVRFFee(uint256 paid, uint256 required);
}
