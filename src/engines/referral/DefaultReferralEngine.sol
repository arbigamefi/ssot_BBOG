// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IReferralEngine} from "./IReferralEngine.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Errors} from "../../libs/Errors.sol";
import {HouseEdgeLib} from "../../libs/HouseEdgeLib.sol";

/// @notice Reference deterministic referral engine (SSOT v1.6).
///
/// This implementation is intentionally simple and auditable:
/// - Base plan: L0 (player rakeback), L1 and L2 are fixed bps of the base turnover edge. L0 and L1 require a
///   referrer bound at acceptance; L2 requires that referrer's own referrer. Nothing is paid beyond L2.
/// - Delta plan: the markup budget is split in proportion to skyline `incBps`.
/// - Every share is rounded down. Missing payees and rounding remainders are simply not paid; the hub
///   accrues them as protocol fees.
/// - Eligibility: if `playerTurnover >= minTurnover`, non-holdback becomes immediate; otherwise locked.
/// - Holdback: fixed `holdbackBps` split into holdback bucket. L0 rakeback has no holdback or lock.
contract DefaultReferralEngine is IReferralEngine {
    uint16 internal constant BPS = 10_000;
    uint8 internal constant MAX_SEGMENTS = 6;

    function splitBase(BaseInput calldata input) external pure override returns (Plan memory plan) {
        uint256 rates = uint256(input.l0Bps) + uint256(input.l1Bps) + uint256(input.l2Bps);
        if (rates > HouseEdgeLib.MAX_REFERRAL_BPS) revert Errors.InvalidBps(rates);

        address[] memory payees = new address[](2);
        uint256[] memory amounts = new uint256[](2);

        if (input.l1 != address(0)) {
            plan.playerRakeback = Math.mulDiv(input.baseEdge, uint256(input.l0Bps), BPS);
            payees[0] = input.l1;
            amounts[0] = Math.mulDiv(input.baseEdge, uint256(input.l1Bps), BPS);
            if (input.l2 != address(0)) {
                payees[1] = input.l2;
                amounts[1] = Math.mulDiv(input.baseEdge, uint256(input.l2Bps), BPS);
            }
        }

        (plan.payees, plan.immediate, plan.locked, plan.holdback) =
            _splitAmounts(payees, amounts, input.holdbackBps, input.minTurnover, input.playerTurnover);
    }

    function splitDelta(bytes calldata skyline, DeltaPolicy calldata policy)
        external
        pure
        override
        returns (Plan memory plan)
    {
        uint256 budget = policy.markupBudget;
        if (budget == 0 || skyline.length == 0) {
            plan.payees = new address[](0);
            plan.immediate = new uint256[](0);
            plan.locked = new uint256[](0);
            plan.holdback = new uint256[](0);
            return plan;
        }
        if (skyline.length % 22 != 0) revert Errors.InvalidConfig();
        uint256 k = skyline.length / 22;
        if (k > MAX_SEGMENTS) revert Errors.InvalidConfig();

        address[] memory payees = new address[](k);
        uint16[] memory inc = new uint16[](k);
        uint256 sumInc = 0;

        for (uint256 i = 0; i < k; ++i) {
            (address p, uint16 bps) = _decodeSegment(skyline, i);
            payees[i] = p;
            inc[i] = bps;
            sumInc += uint256(bps);
        }

        uint256[] memory amounts = new uint256[](k);
        if (sumInc > 0) {
            for (uint256 i = 0; i < k; ++i) {
                if (payees[i] == address(0)) continue;
                amounts[i] = Math.mulDiv(budget, uint256(inc[i]), sumInc);
            }
        }

        (plan.payees, plan.immediate, plan.locked, plan.holdback) =
            _splitAmounts(payees, amounts, policy.holdbackBps, policy.minTurnover, policy.playerTurnover);
    }

    function _splitAmounts(
        address[] memory payees,
        uint256[] memory amounts,
        uint16 holdbackBps,
        uint256 minTurnover,
        uint256 playerTurnover
    )
        internal
        pure
        returns (address[] memory outPayees, uint256[] memory immediate, uint256[] memory locked, uint256[] memory holdback)
    {
        if (holdbackBps > BPS) revert Errors.InvalidBps(holdbackBps);
        uint256 n = payees.length;

        outPayees = payees;
        immediate = new uint256[](n);
        locked = new uint256[](n);
        holdback = new uint256[](n);

        bool eligible = (playerTurnover >= minTurnover);
        for (uint256 i = 0; i < n; ++i) {
            uint256 amt = amounts[i];
            if (amt == 0) continue;
            uint256 hb = (holdbackBps == 0) ? 0 : Math.mulDiv(amt, uint256(holdbackBps), BPS);
            if (hb > amt) hb = amt;
            uint256 rest = amt - hb;
            holdback[i] = hb;
            if (eligible) immediate[i] = rest;
            else locked[i] = rest;
        }
    }

    function _decodeSegment(bytes calldata skyline, uint256 index) internal pure returns (address payee, uint16 incBps) {
        uint256 o = index * 22;
        // skyline is calldata: use calldataload with offsets into bytes slice
        assembly ("memory-safe") {
            let word := calldataload(add(skyline.offset, o))
            payee := shr(96, word)
            let word2 := calldataload(add(add(skyline.offset, o), 20))
            incBps := shr(240, word2)
        }
    }
}
