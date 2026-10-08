// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IReferralEngine} from "./IReferralEngine.sol";
import {SSOTTypes} from "../../core/interfaces/SSOTTypes.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Errors} from "../../libs/Errors.sol";
import {HouseEdgeLib} from "../../libs/HouseEdgeLib.sol";

/// @notice Reference deterministic allocation engine (SSOT v1.6).
///
/// This implementation is intentionally simple and auditable:
/// - LPs retain E - O of the turnover edge E; everything below is paid from the operator share O.
/// - L0 (player rakeback), L1 and L2 are fixed bps of the turnover edge. L0 and L1 require a referrer
///   bound at acceptance; L2 requires that referrer's own referrer. Nothing is paid beyond L2.
/// - Every share is rounded down. Missing payees and rounding remainders accrue as protocol fees.
/// - Eligibility: if `playerTurnover >= minTurnover`, non-holdback becomes immediate; otherwise locked.
/// - Holdback: fixed `holdbackBps` of each L1 and L2 award. L0 rakeback is immediate.
contract DefaultReferralEngine is IReferralEngine {
    uint16 internal constant BPS = 10_000;
    uint256 internal constant MAX_AWARDS = 3; // L0, L1, L2

    bytes32 internal constant REASON_REF_L0 = keccak256("REF_L0");
    bytes32 internal constant REASON_REF_L1 = keccak256("REF_L1");
    bytes32 internal constant REASON_REF_L2 = keccak256("REF_L2");

    function allocate(AllocationInput calldata input)
        external
        pure
        override
        returns (Allocation memory alloc, SSOTTypes.XPAward[] memory awards)
    {
        uint256 rates = uint256(input.l0Bps) + uint256(input.l1Bps) + uint256(input.l2Bps);
        if (rates > HouseEdgeLib.MAX_REFERRAL_BPS) revert Errors.InvalidBps(rates);
        if (input.holdbackBps > BPS) revert Errors.InvalidBps(input.holdbackBps);

        alloc.edge = HouseEdgeLib.turnoverEdge(input.usedTurnover, input.houseEdgeBps);
        alloc.operatorShare = HouseEdgeLib.operatorShare(alloc.edge);

        SSOTTypes.XPAward[] memory tmp = new SSOTTypes.XPAward[](MAX_AWARDS);
        uint256 n = 0;
        bool eligible = input.playerTurnover >= input.minTurnover;

        if (input.l1 != address(0)) {
            alloc.r0 = Math.mulDiv(alloc.edge, uint256(input.l0Bps), BPS);
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
            alloc.r1 = Math.mulDiv(alloc.edge, uint256(input.l1Bps), BPS);
            n = _push(tmp, n, input.l1, input, alloc.r1, eligible, REASON_REF_L1);
            if (input.l2 != address(0)) {
                alloc.r2 = Math.mulDiv(alloc.edge, uint256(input.l2Bps), BPS);
                n = _push(tmp, n, input.l2, input, alloc.r2, eligible, REASON_REF_L2);
            }
        }

        // The three rates total at most 35% of E, below the operator half; each reward rounds down.
        alloc.protocolFee = alloc.operatorShare - alloc.r0 - alloc.r1 - alloc.r2;

        awards = new SSOTTypes.XPAward[](n);
        for (uint256 i = 0; i < n; ++i) {
            awards[i] = tmp[i];
        }
    }

    /// @dev Appends an L1/L2 award split into holdback and immediate-or-locked parts.
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
}
