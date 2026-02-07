// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Canonical multi-roll stop logic (ADR-0013, ADR-0027).
///
/// Stop conditions (evaluated after each roll):
/// - stopGain > 0 and profitSoFar >= stopGain
/// - stopLoss > 0 and lossSoFar >= stopLoss
///
/// where profitSoFar = payoutGrossSoFar - usedTurnover (if positive)
///       lossSoFar   = usedTurnover - payoutGrossSoFar (if positive)
library StopLogic {
    function shouldStop(
        uint256 stopGain,
        uint256 stopLoss,
        uint256 usedTurnover,
        uint256 payoutGrossSoFar
    ) internal pure returns (bool) {
        if (stopGain > 0) {
            if (payoutGrossSoFar >= usedTurnover) {
                if (payoutGrossSoFar - usedTurnover >= stopGain) return true;
            }
        }
        if (stopLoss > 0) {
            if (usedTurnover >= payoutGrossSoFar) {
                if (usedTurnover - payoutGrossSoFar >= stopLoss) return true;
            }
        }
        return false;
    }
}
