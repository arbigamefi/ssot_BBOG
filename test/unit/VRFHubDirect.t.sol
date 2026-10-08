// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol";

/// @dev Controlled authority fixture isolates the production VRFHub from Bank/game integration tests.
contract VrfPositionFixture {
    mapping(uint256 => SSOTTypes.Position) private positions;
    mapping(address => address) public settlementConsumer;
    uint256 public nextId = 1;
    bool public rejectReads;

    function bind(address bank, address consumer) external {
        settlementConsumer[bank] = consumer;
    }

    function setRejectReads(bool value) external {
        rejectReads = value;
    }

    function create(address hub, address bank, address player) external returns (uint256 id) {
        id = nextId++;
        positions[id] = SSOTTypes.Position(
            id, hub, 1, address(1), bank, player, 1e6, 2e6, keccak256(abi.encode(id)), 200, SSOTTypes.PositionState.Held
        );
    }

    function getPosition(uint256 id) external view returns (SSOTTypes.Position memory) {
        require(!rejectReads, "router read failure");
        return positions[id];
    }

    function terminal(uint256 id, SSOTTypes.PositionState state) external {
        require(msg.sender == positions[id].ownerHub, "owning hub");
        require(positions[id].state == SSOTTypes.PositionState.Held, "already terminal");
        positions[id].state = state;
    }
}

contract VrfOwningHubFixture {
    enum Mode {
        Complete,
        Defer,
        Reject,
        ExhaustGas,
        ReturnBomb,
        RevertAfterAck,
        Reenter
    }
    VRFHub public immutable vrf;
    VrfPositionFixture public immutable router;
    Mode public mode;
    uint256 public lastSeed;
    uint256 public deliveries;
    bool public reentrySucceeded;

    constructor(VRFHub vrf_, VrfPositionFixture router_) {
        vrf = vrf_;
        router = router_;
    }

    function setMode(Mode value) external {
        mode = value;
    }

    function request(uint256 position, uint32 gasLimit) external payable returns (uint256 id, uint256 charged) {
        return vrf.requestRandomWords{value: msg.value}(position, gasLimit, 3);
    }

    function acknowledge(uint256 id) external {
        vrf.acknowledge(id);
    }

    function refund(uint256 id) external {
        uint256 position = vrf.getRequest(id).betId;
        router.terminal(position, SSOTTypes.PositionState.Refunded);
        vrf.cancel(id);
    }

    function onRandomWords(uint256 id, uint256[] calldata words) external {
        require(msg.sender == address(vrf) && words.length == 1, "VRF only");
        if (mode == Mode.Reject) revert("delivery rejected");
        if (mode == Mode.ExhaustGas) assembly { for {} 1 {} {} }
        if (mode == Mode.ReturnBomb) {
            assembly {
                mstore(0, 0xdeadbeef)
                revert(0, 65536)
            }
        }
        lastSeed = words[0];
        ++deliveries;
        if (mode == Mode.Defer) return;
        if (mode == Mode.Reenter) {
            (reentrySucceeded,) = address(vrf).call(abi.encodeCall(vrf.retry, (id)));
            require(!reentrySucceeded, "retry reentrancy");
        }
        uint256 position = vrf.getRequest(id).betId;
        router.terminal(position, SSOTTypes.PositionState.Settled);
        vrf.acknowledge(id);
        if (mode == Mode.RevertAfterAck) revert("whole hub child fails");
    }
}

contract VrfFeeReceiver {
    enum Mode {
        Accept,
        Reject,
        ExhaustGas,
        Reenter
    }
    VRFHub public immutable vrf;
    Mode public mode;
    bool public reentrySucceeded;
    uint256 public reentryAttempts;

    constructor(VRFHub vrf_) {
        vrf = vrf_;
    }

    function setMode(Mode value) external {
        mode = value;
    }

    function claim() external returns (uint256) {
        return vrf.claimRefund();
    }

    receive() external payable {
        if (mode == Mode.Reject) revert("no refund");
        if (mode == Mode.ExhaustGas) assembly { for {} 1 {} {} }
        if (mode == Mode.Reenter) {
            ++reentryAttempts;
            (reentrySucceeded,) = address(vrf).call(abi.encodeCall(vrf.claimRefund, ()));
        }
    }
}

contract VRFHubDirectTest is Test {
    address private constant BANK_A = address(0xBA01);
    address private constant BANK_B = address(0xBA02);
    address private constant PLAYER = address(0xCA11);
    uint32 private constant CALLBACK_GAS = 2_400_000;
    VrfPositionFixture private router;
    MockVRFV2PlusWrapper private wrapper;
    VRFHub private vrf;
    VrfOwningHubFixture private hub;
    VrfFeeReceiver private receiver;

    function setUp() external {
        router = new VrfPositionFixture();
        wrapper = new MockVRFV2PlusWrapper();
        vrf = new VRFHub(address(wrapper), address(router));
        hub = new VrfOwningHubFixture(vrf, router);
        receiver = new VrfFeeReceiver(vrf);
        router.bind(BANK_A, address(vrf));
        router.bind(BANK_B, address(vrf));
        vm.txGasPrice(2 gwei);
        vm.deal(address(this), 100 ether);
    }

    function test_directWrapperChargesActualGasPriceAndRefundsBudget() external {
        uint256 position = router.create(address(hub), BANK_A, PLAYER);
        uint256 quote = vrf.quote(CALLBACK_GAS, 10 gwei);
        uint256 required = wrapper.calculateRequestPriceNative(CALLBACK_GAS, 1);
        (uint256 id, uint256 charged) = hub.request{value: quote}(position, CALLBACK_GAS);
        assertEq(charged, required);
        assertLt(charged, quote);
        assertEq(address(wrapper).balance, required);
        assertEq(PLAYER.balance, quote - required);
        assertEq(address(vrf).balance, 0);
        assertEq(vrf.totalRefundCredit(), 0);
        IVRFHub.RequestInfo memory r = vrf.getRequest(id);
        assertEq(r.bank, BANK_A);
        assertEq(r.hub, address(hub));
        assertEq(r.payer, PLAYER);
        assertEq(r.betId, position);
        assertEq(r.feePaid, quote);
        assertEq(r.feeCharged, charged);
        assertEq(uint256(r.state), uint256(IVRFHub.RequestState.Awaiting));
        assertEq(vrf.requestIdForPosition(position), id);
        assertEq(address(vrf.i_vrfV2PlusWrapper()), address(wrapper));
    }

    function test_requestMustOwnHeldPositionAndCanonicalBankBinding() external {
        uint256 position = router.create(address(hub), BANK_A, PLAYER);
        uint256 fee = _fee();
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestBinding.selector, position));
        vrf.requestRandomWords{value: fee}(position, CALLBACK_GAS, 3);
        router.bind(BANK_A, address(0));
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestBinding.selector, position));
        hub.request{value: fee}(position, CALLBACK_GAS);
        router.bind(BANK_A, address(vrf));
        vm.prank(address(hub));
        router.terminal(position, SSOTTypes.PositionState.Settled);
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestBinding.selector, position));
        hub.request{value: fee}(position, CALLBACK_GAS);
        assertEq(wrapper.lastRequestId(), 0);
    }

    function test_oneRequestPerPositionAndNoProviderIdReuseOrZero() external {
        uint256 first = router.create(address(hub), BANK_A, PLAYER);
        uint256 fee = _fee();
        (uint256 id,) = hub.request{value: fee}(first, CALLBACK_GAS);
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.PositionAlreadyRequested.selector, first));
        hub.request{value: fee}(first, CALLBACK_GAS);
        uint256 second = router.create(address(hub), BANK_A, PLAYER);
        wrapper.forceRequestId(true, id);
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestId.selector, id));
        hub.request{value: fee}(second, CALLBACK_GAS);
        wrapper.forceRequestId(true, 0);
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestId.selector, 0));
        hub.request{value: fee}(second, CALLBACK_GAS);
        assertEq(vrf.requestIdForPosition(second), 0);
        assertEq(address(wrapper).balance, fee);
        assertEq(vrf.getRequest(id).betId, first);
    }

    function test_nativeCreditSurvivesRejectedAndExhaustedRefundsAndClaims() external {
        receiver.setMode(VrfFeeReceiver.Mode.Reject);
        _request(BANK_A, address(receiver), 0.1 ether);
        assertEq(vrf.refundCreditOf(address(receiver)), 0.1 ether);
        assertEq(vrf.totalRefundCredit(), 0.1 ether);
        vm.expectRevert(Errors.TransferFailed.selector);
        receiver.claim();
        assertEq(vrf.totalRefundCredit(), 0.1 ether);
        receiver.setMode(VrfFeeReceiver.Mode.ExhaustGas);
        _request(BANK_A, address(receiver), 0.2 ether);
        assertEq(vrf.refundCreditOf(address(receiver)), 0.3 ether);
        assertEq(vrf.totalRefundCredit(), 0.3 ether);
        assertEq(address(vrf).balance, 0.3 ether);
        receiver.setMode(VrfFeeReceiver.Mode.Reenter);
        assertEq(receiver.claim(), 0.3 ether);
        assertFalse(receiver.reentrySucceeded());
        assertEq(receiver.reentryAttempts(), 1);
        assertEq(address(receiver).balance, 0.3 ether);
        assertEq(vrf.totalRefundCredit(), 0);
        assertEq(vrf.refundCreditOf(address(receiver)), 0);
        assertEq(receiver.claim(), 0);
    }

    function test_underpaymentCannotConsumeExistingCreditsAndLeavesNoRequest() external {
        receiver.setMode(VrfFeeReceiver.Mode.Reject);
        _request(BANK_A, address(receiver), 1 ether);
        uint256 position = router.create(address(hub), BANK_A, PLAYER);
        uint256 fee = _fee();
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InsufficientVRFFee.selector, fee - 1, fee));
        hub.request{value: fee - 1}(position, CALLBACK_GAS);
        assertEq(vrf.requestIdForPosition(position), 0);
        assertEq(wrapper.lastRequestId(), 1);
        assertEq(address(vrf).balance, 1 ether);
        assertEq(vrf.totalRefundCredit(), 1 ether);
        vm.deal(address(vrf), 2 ether); // unrelated native funding cannot be treated as earned fees.
        receiver.setMode(VrfFeeReceiver.Mode.Accept);
        assertEq(receiver.claim(), 1 ether);
        assertEq(address(vrf).balance, 1 ether);
        assertEq(vrf.totalRefundCredit(), 0);
    }

    function test_rawCallbackRejectsNonWrapper() external {
        uint256 id = _request(BANK_A, PLAYER, 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                VRFV2PlusWrapperConsumerBase.OnlyVRFWrapperCanFulfill.selector, address(this), address(wrapper)
            )
        );
        vrf.rawFulfillRandomWords(id, _words(123));
        assertEq(uint256(vrf.getRequest(id).state), uint256(IVRFHub.RequestState.Awaiting));
    }

    function test_zeroSeedPersistsWhenWholeHubDeliveryFailsAndPermissionlessRetryUsesIt() external {
        uint256 id = _request(BANK_A, PLAYER, 0);
        hub.setMode(VrfOwningHubFixture.Mode.Reject);
        assertTrue(wrapper.fulfillTo(address(vrf), id, _words(0)));
        _assertReceived(id, BANK_A, 0);
        assertEq(hub.deliveries(), 0);
        hub.setMode(VrfOwningHubFixture.Mode.Complete);
        vm.prank(address(0x7777));
        assertTrue(vrf.retry(id));
        assertEq(hub.lastSeed(), 0);
        _assertTerminal(id, BANK_A);
        assertTrue(wrapper.repeatFulfillment(id, _words(999)));
        assertEq(vrf.getRequest(id).seed, 0);
        assertEq(hub.deliveries(), 1);
    }

    function test_receivedButNotSettledCallbackKeepsCountUntilSameSeedRetry() external {
        hub.setMode(VrfOwningHubFixture.Mode.Defer);
        uint256 first = _request(BANK_A, PLAYER, 0);
        uint256 second = _request(BANK_A, PLAYER, 0);
        uint256 otherBank = _request(BANK_B, PLAYER, 0);
        assertTrue(wrapper.fulfillTo(address(vrf), first, _words(123)));
        assertTrue(wrapper.fulfillTo(address(vrf), second, _words(456)));
        assertTrue(wrapper.fulfillTo(address(vrf), otherBank, _words(789)));
        assertEq(vrf.unbookedResultCount(BANK_A), 2);
        assertEq(vrf.unbookedResultCount(BANK_B), 1);
        assertTrue(wrapper.repeatFulfillment(first, _words(111)));
        assertEq(vrf.getRequest(first).seed, 123);
        assertEq(vrf.unbookedResultCount(BANK_A), 2);
        hub.setMode(VrfOwningHubFixture.Mode.Complete);
        assertTrue(vrf.retry(second));
        assertEq(hub.lastSeed(), 456);
        assertEq(vrf.unbookedResultCount(BANK_A), 1);
        assertTrue(vrf.retry(first));
        assertEq(vrf.unbookedResultCount(BANK_A), 0);
        assertEq(vrf.unbookedResultCount(BANK_B), 1);
    }

    function test_downstreamGasExhaustionAndLargeRevertDataPreserveSeed() external {
        uint256 id = _request(BANK_A, PLAYER, 0);
        hub.setMode(VrfOwningHubFixture.Mode.ExhaustGas);
        assertTrue(wrapper.fulfillTo(address(vrf), id, _words(123)));
        _assertReceived(id, BANK_A, 123);
        hub.setMode(VrfOwningHubFixture.Mode.ReturnBomb);
        vm.recordLogs();
        assertFalse(vrf.retry(id));
        _assertReceived(id, BANK_A, 123);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 topic = keccak256("CallbackAttempt(uint256,bool,uint8,bytes32)");
        bool found;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(vrf) && logs[i].topics[0] == topic) {
                assertEq(logs[i].data.length, 96);
                found = true;
            }
        }
        assertTrue(found, "bounded failure diagnostic");
        hub.setMode(VrfOwningHubFixture.Mode.Complete);
        assertTrue(vrf.retry(id));
        _assertTerminal(id, BANK_A);
    }

    function test_ackInsideOuterGuardSucceedsButRetryReentryFails() external {
        uint256 id = _request(BANK_A, PLAYER, 0);
        hub.setMode(VrfOwningHubFixture.Mode.Reenter);
        assertTrue(wrapper.fulfillTo(address(vrf), id, _words(123)));
        assertFalse(hub.reentrySucceeded());
        _assertTerminal(id, BANK_A);
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestState.selector, id, IVRFHub.RequestState.Terminal));
        hub.acknowledge(id);
        assertEq(vrf.unbookedResultCount(BANK_A), 0);
    }

    function test_revertAfterAckRollsBackHubAndRouterButRetainsOuterReceipt() external {
        uint256 id = _request(BANK_A, PLAYER, 0);
        hub.setMode(VrfOwningHubFixture.Mode.RevertAfterAck);
        assertTrue(wrapper.fulfillTo(address(vrf), id, _words(123)));
        _assertReceived(id, BANK_A, 123);
        assertEq(hub.deliveries(), 0);
        assertEq(uint256(router.getPosition(vrf.getRequest(id).betId).state), uint256(SSOTTypes.PositionState.Held));
        hub.setMode(VrfOwningHubFixture.Mode.Complete);
        assertTrue(vrf.retry(id));
        _assertTerminal(id, BANK_A);
    }

    function test_ackRequiresOwningHubAndRouterSettled() external {
        uint256 id = _request(BANK_A, PLAYER, 0);
        hub.setMode(VrfOwningHubFixture.Mode.Defer);
        assertTrue(wrapper.fulfillTo(address(vrf), id, _words(123)));
        vm.expectRevert(IVRFHub.NotOwningHub.selector);
        vrf.acknowledge(id);
        uint256 position = vrf.getRequest(id).betId;
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidTerminalPosition.selector, position));
        hub.acknowledge(id);
        _assertReceived(id, BANK_A, 123);
    }

    function test_cancelOnlyBeforeReceiptAndAfterAtomicRefund() external {
        uint256 id = _request(BANK_A, PLAYER, 0);
        vm.expectRevert(IVRFHub.NotOwningHub.selector);
        vrf.cancel(id);
        hub.refund(id);
        assertEq(uint256(vrf.getRequest(id).state), uint256(IVRFHub.RequestState.Cancelled));
        assertTrue(wrapper.fulfillTo(address(vrf), id, _words(999)));
        assertEq(vrf.getRequest(id).seed, 0);
        assertEq(vrf.unbookedResultCount(BANK_A), 0);
        uint256 received = _request(BANK_A, PLAYER, 0);
        hub.setMode(VrfOwningHubFixture.Mode.Reject);
        assertTrue(wrapper.fulfillTo(address(vrf), received, _words(123)));
        vm.expectRevert(
            abi.encodeWithSelector(IVRFHub.InvalidRequestState.selector, received, IVRFHub.RequestState.Received)
        );
        hub.refund(received);
        assertEq(
            uint256(router.getPosition(vrf.getRequest(received).betId).state), uint256(SSOTTypes.PositionState.Held)
        );
        _assertReceived(received, BANK_A, 123);
    }

    function test_malformedResponseCannotCreateOrOverwriteAReceivedWord() external {
        uint256 id = _request(BANK_A, PLAYER, 0);
        assertTrue(wrapper.fulfillTo(address(vrf), id, new uint256[](0)));
        assertEq(uint256(vrf.getRequest(id).state), uint256(IVRFHub.RequestState.Awaiting));
        assertEq(vrf.unbookedResultCount(BANK_A), 0);
        assertTrue(wrapper.repeatFulfillment(id, new uint256[](2)));
        assertEq(uint256(vrf.getRequest(id).state), uint256(IVRFHub.RequestState.Awaiting));
        hub.setMode(VrfOwningHubFixture.Mode.Defer);
        assertTrue(wrapper.repeatFulfillment(id, _words(123)));
        assertTrue(wrapper.repeatFulfillment(id, new uint256[](2)));
        _assertReceived(id, BANK_A, 123);
    }

    function test_configuredCallbackBudgetBoundsAreEnforced() external {
        uint32[2] memory invalid = [uint32(199_999), uint32(2_447_747)];
        uint256 position = router.create(address(hub), BANK_A, PLAYER);
        for (uint256 i; i < invalid.length; ++i) {
            vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidCallbackGas.selector, invalid[i]));
            vrf.quote(invalid[i], 1 gwei);
            vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidCallbackGas.selector, invalid[i]));
            hub.request{value: 1 ether}(position, invalid[i]);
        }
        uint256 fee = wrapper.calculateRequestPriceNative(200_000, 1);
        (uint256 id,) = hub.request{value: fee}(position, 200_000);
        hub.setMode(VrfOwningHubFixture.Mode.ExhaustGas);
        assertTrue(wrapper.fulfillTo(address(vrf), id, _words(123)));
        _assertReceived(id, BANK_A, 123);
    }

    function testFuzz_feeConservationAcrossAcceptedRequests(uint64[8] memory excess, uint8 rejects) external {
        receiver.setMode(VrfFeeReceiver.Mode.Reject);
        uint256 credits;
        uint256 returned;
        uint256 fee = _fee();
        for (uint256 i; i < excess.length; ++i) {
            uint256 extra = bound(uint256(excess[i]), 0, 1 ether);
            bool reject = rejects & (uint8(1) << uint8(i)) != 0;
            _request(BANK_A, reject ? address(receiver) : PLAYER, extra);
            if (reject) credits += extra;
            else returned += extra;
            assertEq(vrf.totalRefundCredit(), credits);
            assertEq(address(vrf).balance, credits);
        }
        assertEq(PLAYER.balance, returned);
        assertEq(address(wrapper).balance, 8 * fee);
        receiver.setMode(VrfFeeReceiver.Mode.Accept);
        assertEq(receiver.claim(), credits);
        assertEq(vrf.totalRefundCredit(), 0);
    }

    function _request(address bank, address payer, uint256 excess) private returns (uint256 id) {
        uint256 position = router.create(address(hub), bank, payer);
        (id,) = hub.request{value: _fee() + excess}(position, CALLBACK_GAS);
    }

    function _fee() private view returns (uint256) {
        return wrapper.calculateRequestPriceNative(CALLBACK_GAS, 1);
    }

    function _words(uint256 word) private pure returns (uint256[] memory words) {
        words = new uint256[](1);
        words[0] = word;
    }

    function _assertReceived(uint256 id, address bank, uint256 seed) private view {
        IVRFHub.RequestInfo memory r = vrf.getRequest(id);
        assertEq(uint256(r.state), uint256(IVRFHub.RequestState.Received));
        assertEq(r.seed, seed);
        assertEq(vrf.unbookedResultCount(bank), 1);
    }

    function _assertTerminal(uint256 id, address bank) private view {
        assertEq(uint256(vrf.getRequest(id).state), uint256(IVRFHub.RequestState.Terminal));
        assertEq(vrf.unbookedResultCount(bank), 0);
    }
}
