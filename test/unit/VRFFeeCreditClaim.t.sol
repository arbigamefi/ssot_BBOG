// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {ToggleReceiver} from "../utils/ToggleReceiver.sol";

/// @dev Request authorization is explicit; this fixture isolates fee custody from settlement accounting.
contract VRFFeeCreditClaim is Test {
    VRFHub internal vrf;
    MockVRFV2PlusWrapper internal wrapper;
    address internal payer;
    uint256 internal currentPosition;

    function setUp() external {
        wrapper = new MockVRFV2PlusWrapper();
        vrf = new VRFHub(address(wrapper), address(this));
        vm.deal(address(this), 100 ether);
    }

    function settlementConsumer(address) external view returns (address) {
        return address(vrf);
    }

    function getPosition(uint256 id) external view returns (SSOTTypes.Position memory p) {
        require(id == currentPosition, "position");
        p.positionId = id;
        p.ownerHub = address(this);
        p.bank = address(0xB);
        p.player = payer;
        p.state = SSOTTypes.PositionState.Held;
    }

    function _request(address receiver, uint256 overpay) internal returns (uint256 fee) {
        payer = receiver;
        currentPosition++;
        fee = vrf.quote(500_000, tx.gasprice);
        vrf.requestRandomWords{value: fee + overpay}(currentPosition, 500_000, 3);
    }

    function test_vrf_refundCredit_claimable_when_refund_fails() external {
        ToggleReceiver t = new ToggleReceiver();
        t.setAccept(false);
        _request(address(t), 123_456);
        assertEq(vrf.refundCreditOf(address(t)), 123_456);
        assertEq(vrf.totalRefundCredit(), 123_456);
        uint256 beforeBalance = address(t).balance;
        t.setAccept(true);
        vm.prank(address(t));
        vrf.claimRefund();
        assertEq(vrf.refundCreditOf(address(t)), 0);
        assertEq(vrf.totalRefundCredit(), 0);
        assertEq(address(t).balance, beforeBalance + 123_456);
    }

    function test_vrf_refundCredit_failed_claim_preserves_credit() external {
        ToggleReceiver t = new ToggleReceiver();
        t.setAccept(false);
        _request(address(t), 777);
        vm.prank(address(t));
        vm.expectRevert(Errors.TransferFailed.selector);
        vrf.claimRefund();
        assertEq(vrf.refundCreditOf(address(t)), 777);
        assertEq(vrf.totalRefundCredit(), 777);
    }

    function test_existingCreditCannotSubsidizeAnUnderfundedRequest() external {
        ToggleReceiver t = new ToggleReceiver();
        t.setAccept(false);
        uint256 fee = _request(address(t), 777);
        currentPosition++;
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InsufficientVRFFee.selector, fee - 1, fee));
        vrf.requestRandomWords{value: fee - 1}(currentPosition, 500_000, 3);
        assertEq(vrf.refundCreditOf(address(t)), 777);
        assertEq(address(vrf).balance, 777);
    }
}
