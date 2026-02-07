// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IReferralEngine} from "./IReferralEngine.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Errors} from "../../libs/Errors.sol";

/// @notice Reference deterministic referral engine.
///
/// This implementation is intentionally simple and auditable:
/// - Base plan: allocate per-level fixed BPS shares of `baseBudget`.
/// - Delta plan: allocate budget proportionally to skyline `incBps`.
/// - Eligibility: if `playerTurnover >= minTurnover`, non-holdback becomes immediate; otherwise locked.
/// - Holdback: fixed `holdbackBps` split into holdback bucket.
/// - Any missing payees and all rounding remainder are returned as `sink`.
contract DefaultReferralEngine is IReferralEngine {
    uint16 internal constant BPS = 10_000;
    uint8 internal constant MAX_SEGMENTS = 6;

    function splitBase(BaseInput calldata input) external pure override returns (Plan memory plan) {
        uint256 budget = input.baseBudget;
        if (budget == 0) {
            plan.payees = new address[](0);
            plan.immediate = new uint256[](0);
            plan.locked = new uint256[](0);
            plan.holdback = new uint256[](0);
            return plan;
        }

        uint8 levels = input.levels;
        if (levels == 0 || levels > 6) revert Errors.InvalidConfig();

        // Upper bound: 5 uplines
        address[] memory payees = new address[](levels > 0 ? (levels - 1) : 0);
        uint256[] memory amounts = new uint256[](payees.length);

        uint256 accounted = 0;

        // L0: player kickback (kept as a separate scalar)
        uint256 kick = Math.mulDiv(budget, uint256(input.levelBps[0]), BPS);
        if (kick > budget) kick = budget;
        plan.playerKick = kick;
        accounted += kick;

        // L1..Lk: uplines
        uint256 idx = 0;
        for (uint8 l = 1; l < levels; ++l) {
            uint256 share = Math.mulDiv(budget, uint256(input.levelBps[l]), BPS);
            if (share == 0) continue;
            accounted += share;

            address p = address(0);
            uint256 u = uint256(l - 1);
            if (u < input.uplines.length) {
                p = input.uplines[u];
            }

            if (p == address(0)) {
                // missing upline => sink
                plan.sink += share;
                continue;
            }

            payees[idx] = p;
            amounts[idx] = share;
            idx++;
        }

        // Trim arrays to idx
        assembly ("memory-safe") {
            mstore(payees, idx)
            mstore(amounts, idx)
        }

        // Rounding remainder goes to sink
        if (accounted < budget) {
            plan.sink += (budget - accounted);
        }

        (plan.payees, plan.immediate, plan.locked, plan.holdback) = _splitAmounts(
            payees,
            amounts,
            input.holdbackBps,
            input.minTurnover,
            input.playerTurnover
        );
    }

    function splitDelta(bytes calldata skyline, DeltaPolicy calldata policy) external pure override returns (Plan memory plan) {
        uint256 budget = policy.deltaBudget;
        if (budget == 0) {
            plan.payees = new address[](0);
            plan.immediate = new uint256[](0);
            plan.locked = new uint256[](0);
            plan.holdback = new uint256[](0);
            return plan;
        }

        if (skyline.length == 0) {
            plan.sink = budget;
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

        if (sumInc == 0) {
            plan.sink = budget;
            plan.payees = new address[](0);
            plan.immediate = new uint256[](0);
            plan.locked = new uint256[](0);
            plan.holdback = new uint256[](0);
            return plan;
        }

        uint256 last = 0;
        for (uint256 i = 0; i < k; ++i) {
            if (inc[i] > 0) last = i;
        }

        uint256[] memory amounts = new uint256[](k);
        uint256 distributed = 0;
        for (uint256 i = 0; i < k; ++i) {
            uint256 share;
            if (i == last) {
                share = budget - distributed;
            } else {
                share = Math.mulDiv(budget, uint256(inc[i]), sumInc);
                distributed += share;
            }

            // missing payee => sink
            if (payees[i] == address(0) || share == 0) {
                plan.sink += share;
                amounts[i] = 0;
            } else {
                amounts[i] = share;
            }
        }

        (plan.payees, plan.immediate, plan.locked, plan.holdback) = _splitAmounts(
            payees,
            amounts,
            policy.holdbackBps,
            policy.minTurnover,
            policy.playerTurnover
        );
    }

    function _splitAmounts(
        address[] memory payees,
        uint256[] memory amounts,
        uint16 holdbackBps,
        uint256 minTurnover,
        uint256 playerTurnover
    ) internal pure returns (address[] memory outPayees, uint256[] memory immediate, uint256[] memory locked, uint256[] memory holdback) {
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
