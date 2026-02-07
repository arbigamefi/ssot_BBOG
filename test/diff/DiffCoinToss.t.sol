// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {StopLogic} from "../../src/libs/StopLogic.sol";

/// @notice Reference-model diff tests (ADR-0009).
///         Compares module.resolve(...) against an independent reference model.
contract DiffCoinToss is Test {
    CoinTossModule internal mod;

    bytes internal constant DOMAIN = "SSOT_RNG_V1";

    function setUp() external {
        mod = new CoinTossModule();
    }

    function testFuzz_diff_cointoss(
        bool isTails,
        uint256 amountPerRoll,
        uint32 betCount,
        uint256 stopGain,
        uint256 stopLoss,
        uint256 betId,
        uint256 seed
    ) external {
        amountPerRoll = bound(amountPerRoll, 1e12, 10 ether);
        betCount = uint32(bound(uint256(betCount), 1, 50));

        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: amountPerRoll,
            betCount: betCount,
            stopGain: 0,
            stopLoss: 0
        });

        uint256 stake = amountPerRoll * uint256(betCount);
        // keep stop bounds reasonable and within stake-scale
        stopGain = bound(stopGain, 0, stake * 4);
        stopLoss = bound(stopLoss, 0, stake * 4);
        spec.stopGain = stopGain;
        spec.stopLoss = stopLoss;

        bytes memory params = abi.encode(isTails);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;

        (uint256 gotPayout, uint256 gotRefund) = mod.resolve(params, spec, betId, rw);
        (uint256 expPayout, uint256 expRefund) = _refResolve(isTails, spec, betId, seed);

        assertEq(gotPayout, expPayout, "payout mismatch");
        assertEq(gotRefund, expRefund, "refund mismatch");
    }

    // ------------------
    // Reference model
    // ------------------

    function _refResolve(
        bool isTails,
        SSOTTypes.StakeSpec memory spec,
        uint256 betId,
        uint256 seed
    ) internal pure returns (uint256 payoutGross, uint256 refundAmount) {
        uint256 amount = spec.amountPerRoll;
        uint32 n = spec.betCount;
        uint256 stake = amount * uint256(n);

        uint256 used = 0;
        uint256 payout = 0;

        for (uint32 i = 0; i < n; i++) {
            used += amount;

            uint256 r = _refRoll(betId, uint256(i), seed);
            bool rolledTails = (r % 2) == 1;
            if (rolledTails == isTails) {
                payout += 2 * amount;
            }

            if (StopLogic.shouldStop(spec.stopGain, spec.stopLoss, used, payout)) {
                break;
            }
        }

        payoutGross = payout;
        refundAmount = stake - used;
    }

    function _refRoll(uint256 betId, uint256 i, uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(DOMAIN, betId, i, seed)));
    }
}
