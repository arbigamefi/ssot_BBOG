// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {StatefulSystemDiff} from "./StatefulSystemDiff.t.sol";
import {MockVRFV2PlusWrapper} from "src/mocks/MockVRFV2PlusWrapper.sol";
import {ChainlinkV2PlusWrapperAdapter} from "src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol";
import {SSOTTypes} from "src/core/interfaces/SSOTTypes.sol";
import {ToggleReceiver} from "../utils/ToggleReceiver.sol";

/// @notice Runs the same stateful system diff but with VRFHub configured to use a wrapper adapter.
/// @dev Kept as a light smoke (lower runs) to avoid large runtime overhead.
contract StatefulSystemDiffAdapter is StatefulSystemDiff {
    MockVRFV2PlusWrapper internal wrapper;
    ChainlinkV2PlusWrapperAdapter internal adapter;
    ToggleReceiver internal toggle;

    function _configureVRFAdapter(address gov) internal override returns (address coordinatorOut) {
        wrapper = new MockVRFV2PlusWrapper();
        adapter = new ChainlinkV2PlusWrapperAdapter(address(wrapper), gov);
        coordinatorOut = address(adapter);
        // vrf is constructed after this hook; we will set adapter in the base after vrf exists.
    }

    function _postConfigureVRFAdapter(
        address /*gov*/
    )
        internal
        override
    {
        // set deterministic request gas price for wrapper estimates
        adapter.setRequestGasPriceWei(0);
        adapter.setVRFHub(address(vrf));
        vrf.setAdapter(address(adapter));
    }

    function _postPlayersSetup() internal override {
        // Add a refund-failing receiver to exercise VRFHub refundCredit paths.
        toggle = new ToggleReceiver();
        toggle.setAccept(false);
        address p = address(toggle);
        players.push(p);
        vm.deal(p, 100 ether);
        assetA.mint(p, 2_000 ether);
        assetB.mint(p, 2_000 ether);
        vm.startPrank(p);
        assetA.approve(address(bankA), type(uint256).max);
        assetB.approve(address(bankB), type(uint256).max);
        vm.stopPrank();
    }

    function _vrfOverpayWei(
        address player,
        uint32,
        /*betCount*/
        uint256 feeCharged
    )
        internal
        view
        override
        returns (uint256)
    {
        // Ensure some overpay is attempted, and force refund failure for `toggle`.
        if (player == address(toggle)) {
            // Keep overpay small and deterministic.
            uint256 v = feeCharged / 5;
            if (v > 0.01 ether) v = 0.01 ether;
            if (v == 0) v = 1;
            return v;
        }
        // Occasionally overpay for EOAs too (best-effort refund should succeed).
        if ((_loopState & 7) == 0) {
            uint256 v = feeCharged / 20;
            if (v > 0.005 ether) v = 0.005 ether;
            if (v == 0) v = 1;
            return v;
        }
        return 0;
    }

    function _fulfill(uint256 requestId, uint256[] memory randomWords) internal override {
        wrapper.fulfillTo(address(adapter), requestId, randomWords);
    }

    function testFuzz_stateful_system_diff_adapter(uint256 seed) public {
        // reduce steps/runs for adapter path
        _runStateful(seed, 32);

        _assertAdapterEthAccounting();

        // Optional: claim refundCredit under paused risk-in to validate debt-out liveness for VRF credits.
        if (address(toggle) != address(0)) {
            uint256 credit = vrf.refundCreditOf(address(toggle));
            if (credit > 0) {
                vm.startPrank(gov);
                bankA.setRiskInPaused(true);
                bankB.setRiskInPaused(true);
                vm.stopPrank();

                toggle.setAccept(true);
                vm.prank(address(toggle));
                vrf.claimRefund();
                assertEq(vrf.refundCreditOf(address(toggle)), 0, "toggle.credit.zero");
                assertEq(address(vrf).balance, 0, "vrf.balance.after.claim");
            }
        }
    }

    function _assertAdapterEthAccounting() internal view {
        // Wrapper should collect exactly sum of charged VRF fees for all placed bets.
        uint256 sumCharged = 0;
        uint256 sumOverpayToggle = 0;

        uint256 n = hub.nextBetId();
        for (uint256 betId = 1; betId < n; betId++) {
            SSOTTypes.Bet memory b = hub.getBet(betId);
            sumCharged += b.vrfFeeCharged;
            if (address(toggle) != address(0) && b.player == address(toggle) && b.vrfFeePaid > b.vrfFeeCharged) {
                sumOverpayToggle += (b.vrfFeePaid - b.vrfFeeCharged);
            }
        }

        assertEq(address(wrapper).balance, sumCharged, "wrapper.balance");
        assertEq(address(adapter).balance, 0, "adapter.balance");
        assertEq(address(hub).balance, 0, "hub.balance");

        // VRFHub should retain only failed refund credits in adapter mode.
        uint256 sumCredit = 0;
        for (uint256 i = 0; i < players.length; i++) {
            sumCredit += vrf.refundCreditOf(players[i]);
        }
        assertEq(address(vrf).balance, sumCredit, "vrf.balance.sumCredit");

        // The toggle receiver rejects ETH, so its credit should match its accumulated overpay.
        if (address(toggle) != address(0)) {
            assertEq(vrf.refundCreditOf(address(toggle)), sumOverpayToggle, "toggle.credit.matches");
        }
    }
}
