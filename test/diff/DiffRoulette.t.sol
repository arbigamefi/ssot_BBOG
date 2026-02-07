// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {StopLogic} from "../../src/libs/StopLogic.sol";

/// @notice Reference-model diff tests (ADR-0009).
///         Compares roulette module.resolve(...) against an independent reference model
///         for raw-bitmask params.
contract DiffRoulette is Test {
    RouletteModule internal mod;

    bytes internal constant DOMAIN = "SSOT_RNG_V1";
    uint256 internal constant MODULO = 37;

    function setUp() external {
        mod = new RouletteModule();
    }

    function testFuzz_diff_roulette_rawbitmask(
        uint40 rawMask,
        uint256 amountPerRoll,
        uint32 betCount,
        uint256 stopGain,
        uint256 stopLoss,
        uint256 betId,
        uint256 seed
    ) external {
        // constrain mask to 37 bits
        uint40 all = (uint40(1) << 37) - 1;
        uint40 numbers = rawMask & all;
        if (numbers == 0) numbers = 1;
        if (numbers == all) numbers = all - 1;

        amountPerRoll = bound(amountPerRoll, 1e12, 10 ether);
        betCount = uint32(bound(uint256(betCount), 1, 50));

        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: amountPerRoll,
            betCount: betCount,
            stopGain: 0,
            stopLoss: 0
        });

        uint256 stake = amountPerRoll * uint256(betCount);
        stopGain = bound(stopGain, 0, stake * 4);
        stopLoss = bound(stopLoss, 0, stake * 4);
        spec.stopGain = stopGain;
        spec.stopLoss = stopLoss;

        bytes memory params = abi.encode(numbers);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;

        (uint256 gotPayout, uint256 gotRefund) = mod.resolve(params, spec, betId, rw);
        (uint256 expPayout, uint256 expRefund) = _refResolve(numbers, spec, betId, seed);

        assertEq(gotPayout, expPayout, "payout mismatch");
        assertEq(gotRefund, expRefund, "refund mismatch");
    }

    // ------------------
    // Reference model
    // ------------------

    function _refResolve(
        uint40 numbers,
        SSOTTypes.StakeSpec memory spec,
        uint256 betId,
        uint256 seed
    ) internal pure returns (uint256 payoutGross, uint256 refundAmount) {
        uint256 pc = _popcount37(numbers);
        require(pc > 0, "pc=0");

        uint256 amount = spec.amountPerRoll;
        uint32 n = spec.betCount;
        uint256 stake = amount * uint256(n);

        uint256 used = 0;
        uint256 payout = 0;
        for (uint32 i = 0; i < n; i++) {
            used += amount;

            uint256 r = _refRoll(betId, uint256(i), seed);
            uint256 rolled = r % MODULO;
            if (((uint256(1) << rolled) & uint256(numbers)) != 0) {
                payout += (amount * MODULO) / pc;
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

    function _popcount37(uint40 x) internal pure returns (uint256 c) {
        // independent simple popcount (0..36)
        for (uint8 i = 0; i < 37; i++) {
            if (((x >> i) & 1) == 1) c++;
        }
    }
}
