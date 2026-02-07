// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {VRFHub} from "../../src/core/VRFHub.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {ToggleReceiver} from "../utils/ToggleReceiver.sol";

contract VRFFeeCreditClaim is Test {
    VRFHub internal vrf;
    address internal gov = address(0xA11CE);

    function setUp() external {
        vrf = new VRFHub(address(this), gov);
        // Make quotes deterministic for this test.
        vm.prank(gov);
        vrf.setFeeParams(1e14, 0, 0, 0);
        vm.deal(address(this), 100 ether);
    }

    function test_vrf_refundCredit_claimable_when_refund_fails() external {
        ToggleReceiver t = new ToggleReceiver();
        t.setAccept(false);

        uint32 cbGas = 100_000;
        uint16 conf = 3;
        uint32 words = 1;

        uint256 required = vrf.quote(cbGas, conf, words);
        uint256 overpay = 123_456;

        // Call request directly to isolate VRFHub refund-credit behavior.
        vrf.requestRandomWords{value: required + overpay}(address(0xBEEF), 1, cbGas, conf, words, address(t));

        assertEq(vrf.refundCreditOf(address(t)), overpay, "credit recorded");
        uint256 balBefore = address(t).balance;

        // Now allow receiving ETH and claim.
        t.setAccept(true);
        vm.prank(address(t));
        vrf.claimRefund();

        assertEq(vrf.refundCreditOf(address(t)), 0, "credit cleared");
        assertEq(address(t).balance, balBefore + overpay, "eth received");
    }

    function test_vrf_refundCredit_failed_claim_preserves_credit() external {
        ToggleReceiver t = new ToggleReceiver();
        t.setAccept(false);

        uint32 cbGas = 100_000;
        uint16 conf = 3;
        uint32 words = 1;

        uint256 required = vrf.quote(cbGas, conf, words);
        uint256 overpay = 777;

        vrf.requestRandomWords{value: required + overpay}(address(0xBEEF), 1, cbGas, conf, words, address(t));

        assertEq(vrf.refundCreditOf(address(t)), overpay, "credit recorded");

        vm.prank(address(t));
        vm.expectRevert(Errors.TransferFailed.selector);
        vrf.claimRefund();

        assertEq(vrf.refundCreditOf(address(t)), overpay, "credit preserved");
    }
}
