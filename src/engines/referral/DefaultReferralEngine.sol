// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IReferralEngine} from "./IReferralEngine.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Errors} from "../../libs/Errors.sol";
import {HouseEdgeLib} from "../../libs/HouseEdgeLib.sol";

/// @notice Reference deterministic allocation engine (SSOT v1.6).
///
/// This implementation is intentionally simple and auditable:
/// - LPs retain E - O of the turnover edge E; everything below is paid from the operator share O.
/// - L0 (player rakeback), L1 and L2 are fixed bps of the base turnover edge. L0 and L1 require a referrer
///   bound at acceptance; L2 requires that referrer's own referrer. Nothing is paid beyond L2.
/// - The markup's operator share is split in proportion to skyline `incBps`.
/// - Every share is rounded down. Missing payees and rounding remainders accrue as protocol fees.
/// - Eligibility: if `playerTurnover >= minTurnover`, non-holdback becomes immediate; otherwise locked.
/// - Holdback: fixed `holdbackBps` of each L1, L2 and markup award. L0 rakeback is immediate.
contract DefaultReferralEngine is IReferralEngine {
    uint16 internal constant BPS = 10_000;
    uint8 internal constant MAX_SEGMENTS = 6;
    // 1 (L0) + 2 (L1, L2) + MAX_SEGMENTS (skyline)
    uint256 internal constant MAX_AWARDS = 9;

    bytes32 internal constant REASON_REF_L0 = keccak256("REF_L0");
    bytes32 internal constant REASON_REF_L1 = keccak256("REF_L1");
    bytes32 internal constant REASON_REF_L2 = keccak256("REF_L2");
    bytes32 internal constant REASON_REF_MARKUP = keccak256("REF_MARKUP");

    function allocate(AllocationInput calldata input, bytes calldata skyline)
        external
        pure
        override
        returns (Allocation memory alloc, SSOTTypes.XPAward[] memory awards)
    {
        uint256 rates = uint256(input.l0Bps) + uint256(input.l1Bps) + uint256(input.l2Bps);
        if (rates > HouseEdgeLib.MAX_REFERRAL_BPS) revert Errors.InvalidBps(rates);
        if (input.holdbackBps > BPS) revert Errors.InvalidBps(input.holdbackBps);

        alloc.edge = HouseEdgeLib.turnoverEdge(input.usedTurnover, input.effectiveEdgeBps);
        alloc.operatorShare = HouseEdgeLib.operatorShare(alloc.edge);
        uint256 baseEdge = HouseEdgeLib.turnoverEdge(input.usedTurnover, input.baseEdgeBps);

        SSOTTypes.XPAward[] memory tmp = new SSOTTypes.XPAward[](MAX_AWARDS);
        uint256 n = 0;
        bool eligible = input.playerTurnover >= input.minTurnover;

        if (input.l1 != address(0)) {
            alloc.r0 = Math.mulDiv(baseEdge, uint256(input.l0Bps), BPS);
            if (alloc.r0 > 0) {
                tmp[n++] = SSOTTypes.XPAward({
                    payee: input.player,
                    sourcePlayer: input.player,
                    accrued: alloc.r0,
                    locked: 0,
                    holdback: 0,
                    reason: REASON_REF_L0
                });
            }
            alloc.r1 = Math.mulDiv(baseEdge, uint256(input.l1Bps), BPS);
            n = _push(tmp, n, input.l1, input, alloc.r1, eligible, REASON_REF_L1);
            if (input.l2 != address(0)) {
                alloc.r2 = Math.mulDiv(baseEdge, uint256(input.l2Bps), BPS);
                n = _push(tmp, n, input.l2, input, alloc.r2, eligible, REASON_REF_L2);
            }
        }

        // E >= E_b because h_e >= h_b.
        uint256 markupBudget = HouseEdgeLib.operatorShare(alloc.edge - baseEdge);
        if (markupBudget > 0 && skyline.length > 0) {
            (alloc.markup, n) = _splitMarkup(tmp, n, skyline, markupBudget, input, eligible);
        }

        // Cannot underflow: r0 + r1 + r2 <= floor(E_b / 2) and markup <= floor((E - E_b) / 2), so their sum is at
        // most floor(E / 2) = operatorShare.
        alloc.protocolFee = alloc.operatorShare - alloc.r0 - alloc.r1 - alloc.r2 - alloc.markup;

        awards = new SSOTTypes.XPAward[](n);
        for (uint256 i = 0; i < n; ++i) {
            awards[i] = tmp[i];
        }
    }

    function _splitMarkup(
        SSOTTypes.XPAward[] memory tmp,
        uint256 n,
        bytes calldata skyline,
        uint256 budget,
        AllocationInput calldata input,
        bool eligible
    ) internal pure returns (uint256 paid, uint256) {
        if (skyline.length % 22 != 0) revert Errors.InvalidConfig();
        uint256 k = skyline.length / 22;
        if (k > MAX_SEGMENTS) revert Errors.InvalidConfig();

        uint256 sumInc = 0;
        for (uint256 i = 0; i < k; ++i) {
            (, uint16 inc) = _decodeSegment(skyline, i);
            sumInc += uint256(inc);
        }
        if (sumInc == 0) return (0, n);

        for (uint256 i = 0; i < k; ++i) {
            (address payee, uint16 inc) = _decodeSegment(skyline, i);
            if (payee == address(0)) continue;
            uint256 share = Math.mulDiv(budget, uint256(inc), sumInc);
            paid += share;
            n = _push(tmp, n, payee, input, share, eligible, REASON_REF_MARKUP);
        }
        return (paid, n);
    }

    /// @dev Appends an L1/L2/markup award split into holdback and immediate-or-locked parts.
    function _push(
        SSOTTypes.XPAward[] memory tmp,
        uint256 n,
        address payee,
        AllocationInput calldata input,
        uint256 amount,
        bool eligible,
        bytes32 reason
    ) internal pure returns (uint256) {
        if (amount == 0) return n;
        uint256 hb = input.holdbackBps == 0 ? 0 : Math.mulDiv(amount, uint256(input.holdbackBps), BPS);
        uint256 rest = amount - hb;
        tmp[n] = SSOTTypes.XPAward({
            payee: payee,
            sourcePlayer: input.player,
            accrued: eligible ? rest : 0,
            locked: eligible ? 0 : rest,
            holdback: hb,
            reason: reason
        });
        return n + 1;
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
