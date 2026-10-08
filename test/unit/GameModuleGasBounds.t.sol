// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {RNG} from "../../src/libs/RNG.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {SicBoModule} from "../../src/modules/sicbo/SicBoModule.sol";
import {SlotsModule} from "../../src/modules/slots/SlotsModule.sol";
import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";
import {PlinkoModule} from "../../src/modules/plinko/PlinkoModule.sol";

/// @notice Gas qualification witnesses against real, unmodified modules.
/// @dev These modules are pure: every STATICCALL has fresh callee memory. The
/// meter returns via REVERT to restore the access list, so the next sample is cold
/// as well. Repeated identical inputs must measure identically. vm.cool alone does
/// not provide that property in the pinned Forge runner. Deployments are in setUp.
/// The measured bracket excludes caller ABI construction and cheatcodes. It includes
/// the cold STATICCALL and fixed return copying. Every params payload is the Hub's
/// maximum 64 bytes, including nonzero tails where canonical encoding is 32 bytes.
///
/// Finite parameter/outcome enumeration is explicitly distinguished from seed
/// sampling. Neither a maximum sample nor (25-round gas)/25 proves an upper
/// bound: RNG abi.encodePacked allocations make memory expansion nonlinear.
/// Hub/Router/Bank/Vault/token/referral gas is outside these module-only brackets.
contract GameModuleGasBoundsTest is Test {
    uint256 private constant AMOUNT = 1e6;
    uint256 private constant BET_ID = 1;
    address[8] private modules;

    struct Maximum {
        uint256 gasUsed;
        uint256 seed;
        bytes params;
    }

    event GasWitness(string game, uint32 rounds, uint256 gasUsed, uint256 seed, bytes params);
    event LateStopWitness(string game, uint32 rounds, uint256 gasUsed, uint256 seed, bool gain);

    function setUp() external {
        modules[0] = address(new CoinTossModule());
        modules[1] = address(new DiceModule());
        modules[2] = address(new RouletteModule());
        modules[3] = address(new SicBoModule());
        modules[4] = address(new SlotsModule());
        modules[5] = address(new BaccaratModule());
        modules[6] = address(new KenoModule());
        modules[7] = address(new PlinkoModule());
    }

    function test_coin_allParametersAndBothOutcomes() external {
        uint256[] memory witnesses = _witnesses(0, 2);
        Maximum memory best;
        for (uint256 choice; choice < 2; ++choice) {
            bytes memory params = _padded(abi.encode(choice == 1));
            for (uint256 outcome; outcome < 2; ++outcome) {
                _observe(best, 0, params, witnesses[outcome], 1);
            }
        }
        _report(0, 1, best);
    }

    function test_dice_under99ParametersAnd100Outcomes() external {
        _diceSide(false);
    }

    function test_dice_over99ParametersAnd100Outcomes() external {
        _diceSide(true);
    }

    function _diceSide(bool isOver) private {
        uint256[] memory witnesses = _witnesses(1, 100);
        Maximum memory best;
        for (uint8 target = 1; target < 100; ++target) {
            bytes memory params = abi.encode(isOver, target);
            for (uint256 outcome; outcome < 100; ++outcome) {
                _observe(best, 1, params, witnesses[outcome], 1);
            }
        }
        _report(1, 1, best);
    }

    /// @dev Exhausts all payloads for Straight/Street/Corner/SixLine/Dozen/Column
    /// and all outside kinds; Split uses two endpoint representatives, raw masks
    /// cover all valid popcounts. Does NOT claim all 2^37 masks or 1332 splits.
    function test_roulette_decodeBranchesAndAll37Outcomes() external {
        uint256[] memory witnesses = _witnesses(2, 37);
        (bytes[] memory params, uint256 count) = _rouletteParams();
        Maximum memory best;
        for (uint256 p; p < count; ++p) {
            for (uint256 outcome; outcome < 37; ++outcome) {
                _observe(best, 2, params[p], witnesses[outcome], 1);
            }
        }
        assertEq(count, 132);
        _report(2, 1, best);
    }

    /// @dev There is one (kind,value) per bet, not a list of SicBo selections.
    /// The 35 valid configurations x all 216 ordered dice triples are exhaustive.
    function test_sicbo_all35ParametersAnd216OrderedOutcomes() external {
        uint256[] memory witnesses = _witnesses(3, 216);
        Maximum memory best;
        for (uint256 p; p < 35; ++p) {
            bytes memory params = _sicboParams(p);
            for (uint256 outcome; outcome < 216; ++outcome) {
                _observe(best, 3, params, witnesses[outcome], 1);
            }
        }
        _report(3, 1, best);
    }

    /// @dev Slots has one CLASSIC profile, three reels and one line. All 8^3
    /// ordered symbol outcomes are covered, including every pair comparison.
    function test_slots_all512OrderedOutcomes() external {
        uint256[] memory witnesses = _witnesses(4, 512);
        Maximum memory best;
        for (uint256 outcome; outcome < 512; ++outcome) {
            _observe(best, 4, _padded(abi.encode(uint8(0))), witnesses[outcome], 1);
        }
        _report(4, 1, best);
    }

    /// @dev Baccarat has one side per bet, not a basket. Its control structure
    /// performs 4..6 RNG hashes/hand. This is a 4096-seed sample across all 3 sides,
    /// not enumeration of 13^6 rank sequences or all seeds. An independently
    /// decoded deep banker=6/playerThird=6|7 six-card tie is required as a witness.
    function test_baccarat_playerSampleAndDeepSixCardTie() external {
        _baccaratSide(0);
    }

    function test_baccarat_bankerSampleAndDeepSixCardTie() external {
        _baccaratSide(1);
    }

    function test_baccarat_tieSampleAndDeepSixCardTie() external {
        _baccaratSide(2);
    }

    function _baccaratSide(uint8 side) private {
        Maximum memory best;
        bool deepTie;
        bytes memory params = _padded(abi.encode(side));
        for (uint256 seed; seed < 4096; ++seed) {
            (uint8 cards, bool deep, uint8 outcome) = _baccaratPath(seed);
            assertLe(cards, 6);
            if (deep && outcome == 2 && !deepTie) {
                deepTie = true;
                emit log_named_uint("Baccarat deep six-card tie seed", seed);
            }
            uint256 payout = _observe(best, 5, params, seed, 1);
            assertEq(payout > 0, outcome == side);
        }
        assertTrue(deepTie, "deep six-card tie witness missing");
        _report(5, 1, best);
    }

    /// @dev All 4943 valid 1..5-pick masks at one actual draw cover every legal
    /// (played,matches) payout branch. Seed is chosen to execute all 5 conditional
    /// swaps. Does NOT enumerate all shuffle/seed paths. Source has fixed 15-slot
    /// initialization + 5 draws; no parameter can add picks, draws or loop rounds.
    function test_keno_all4943MasksAtFiveSwapDraw() external {
        uint256 seed;
        uint40 drawn;
        for (; seed < 1000; ++seed) {
            uint256 swaps;
            (drawn, swaps) = _kenoDraw(seed);
            if (swaps == 5) break;
        }
        assertLt(seed, 1000);
        emit log_named_uint("Keno five-swap seed", seed);
        emit log_named_uint("Keno five-match numbers", drawn);
        Maximum memory best;
        uint256 count;
        uint256 coverage;
        for (uint40 numbers = 1; numbers < 32767; ++numbers) {
            uint256 played = _popcount(numbers);
            if (played > 5) continue;
            ++count;
            uint256 matches = _popcount(numbers & drawn);
            coverage |= uint256(1) << (played * 6 + matches);
            _observe(best, 6, _padded(abi.encode(numbers)), seed, 1);
        }
        assertEq(count, 4943);
        assertEq(_popcount(coverage), 20);
        _report(6, 1, best);
    }

    /// @dev Plinko fixes 8 rows; all 3 risks x 9 terminal bucket branches.
    function test_plinko_allRisksAndBuckets() external {
        uint256[] memory witnesses = _witnesses(7, 9);
        Maximum memory best;
        for (uint8 risk; risk < 3; ++risk) {
            for (uint256 bucket; bucket < 9; ++bucket) {
                _observe(best, 7, _padded(abi.encode(risk)), witnesses[bucket], 1);
            }
        }
        _report(7, 1, best);
    }

    /// @dev 64 real seeds per fixed parameter, nonzero gain/loss limits that never
    /// stop. These curves are reproducible samples, NOT a callback qualification.
    function test_multiroundColdGasSamples() external {
        uint32[3] memory counts = [uint32(1), 10, 25];
        for (uint256 game; game < 8; ++game) {
            bytes memory params = _curveParams(game);
            for (uint256 c; c < counts.length; ++c) {
                Maximum memory best;
                for (uint256 seed; seed < 64; ++seed) {
                    _observe(best, game, params, seed, counts[c]);
                }
                _report(game, counts[c], best);
            }
        }
    }

    /// @dev Exhaust all SicBo configs and Baccarat sides over 16 seeds at 25
    /// rounds to avoid treating the single-round heaviest choice as always worst.
    function test_multiroundAlternativeSicboAndBaccaratParameters() external {
        Maximum memory sicbo;
        for (uint256 p; p < 35; ++p) {
            for (uint256 seed; seed < 16; ++seed) {
                _observe(sicbo, 3, _sicboParams(p), seed, 25);
            }
        }
        _report(3, 25, sicbo);
        Maximum memory baccarat;
        for (uint8 side; side < 3; ++side) {
            for (uint256 seed; seed < 64; ++seed) {
                _observe(baccarat, 5, _padded(abi.encode(side)), seed, 25);
            }
        }
        _report(5, 25, baccarat);
    }

    /// @dev Winning frequency can outweigh one-time parameter decoding cost.
    /// Cover every Dice parameter and the same Roulette control-path classes at
    /// 25 rounds over 16 seeds; these remain samples of multi-round RNG sequences.
    function test_multiroundAlternativeDiceAndRouletteParameters() external {
        Maximum memory dice;
        for (uint8 target = 1; target < 100; ++target) {
            for (uint256 side; side < 2; ++side) {
                bytes memory params = abi.encode(side == 1, target);
                for (uint256 seed; seed < 16; ++seed) {
                    _observe(dice, 1, params, seed, 25);
                }
            }
        }
        _report(1, 25, dice);
        (bytes[] memory rouletteParams, uint256 count) = _rouletteParams();
        Maximum memory roulette;
        for (uint256 p; p < count; ++p) {
            for (uint256 seed; seed < 16; ++seed) {
                _observe(roulette, 2, rouletteParams[p], seed, 25);
            }
        }
        _report(2, 25, roulette);
    }

    /// @dev Find a real sequence whose cumulative profit or loss first reaches a
    /// new record on its final (25th) round. Setting that exact threshold therefore
    /// covers a last-round stop without reducing module work or changing payout.
    function test_nonzeroStopThresholdFirstReachedOnLastRound() external {
        for (uint256 game; game < 8; ++game) {
            bytes memory params = _curveParams(game);
            bool found;
            for (uint256 seed; seed < 128 && !found; ++seed) {
                uint256 maxGain;
                uint256 maxLoss;
                uint256 lastPayout;
                for (uint32 n = 1; n <= 25; ++n) {
                    (, uint256 payout, uint256 refund) = _measure(game, params, seed, _spec(n));
                    assertEq(refund, 0);
                    uint256 turnover = AMOUNT * n;
                    uint256 gain = payout > turnover ? payout - turnover : 0;
                    uint256 loss = turnover > payout ? turnover - payout : 0;
                    if (n == 25 && (gain > maxGain || loss > maxLoss)) {
                        SSOTTypes.StakeSpec memory spec = _spec(n);
                        bool gainStop = gain > maxGain;
                        if (gainStop) spec.stopGain = gain;
                        else spec.stopLoss = loss;
                        (uint256 gasUsed, uint256 stoppedPayout, uint256 stoppedRefund) =
                            _measure(game, params, seed, spec);
                        assertEq(stoppedPayout, payout);
                        assertEq(stoppedRefund, 0);
                        // The 24-round prefix must not have reached the threshold.
                        spec.betCount = 24;
                        (, uint256 prefix, uint256 prefixRefund) = _measure(game, params, seed, spec);
                        assertEq(prefix, lastPayout);
                        assertEq(prefixRefund, 0);
                        emit LateStopWitness(_name(game), 25, gasUsed, seed, gainStop);
                        emit log_named_string("last-round stop game", _name(game));
                        emit log_named_uint("last-round stop gas", gasUsed);
                        emit log_named_uint("last-round stop seed", seed);
                        emit log_named_uint("last-round stop threshold", gainStop ? gain : loss);
                        emit log_named_uint("last-round stop is gain", gainStop ? 1 : 0);
                        found = true;
                    }
                    maxGain = gain > maxGain ? gain : maxGain;
                    maxLoss = loss > maxLoss ? loss : maxLoss;
                    lastPayout = payout;
                }
            }
            assertTrue(found, string.concat(_name(game), " missing final-round stop witness"));
        }
    }

    function test_canonicalAnd64ByteTrailingDataHaveSameResolution() external {
        for (uint256 game; game < 8; ++game) {
            bytes memory padded = _curveParams(game);
            assertEq(padded.length, 64);
            IGameModule(modules[game]).validate(padded, _spec(25));
            if (game == 1 || game == 2 || game == 3) continue;
            bytes memory canonical = new bytes(32);
            assembly ("memory-safe") { mstore(add(canonical, 32), mload(add(padded, 32))) }
            (, uint256 paddedPayout, uint256 paddedRefund) = _measure(game, padded, 7, _spec(25));
            (, uint256 canonicalPayout, uint256 canonicalRefund) = _measure(game, canonical, 7, _spec(25));
            assertEq(paddedPayout, canonicalPayout);
            assertEq(paddedRefund, canonicalRefund);
        }
    }

    function test_coldMeterIsStableAcrossRepeatedIdenticalCalls() external {
        for (uint256 game; game < 8; ++game) {
            bytes memory params = _curveParams(game);
            (uint256 first,,) = _measure(game, params, 0, _spec(1));
            for (uint256 i; i < 4; ++i) {
                (uint256 repeated,,) = _measure(game, params, 0, _spec(1));
                assertEq(repeated, first, _name(game));
            }
        }
    }

    function _measure(uint256 game, bytes memory params, uint256 seed, SSOTTypes.StakeSpec memory spec)
        private
        returns (uint256 gasUsed, uint256 payout, uint256 refund)
    {
        uint256[] memory words = new uint256[](1);
        words[0] = seed;
        bytes memory input = abi.encodeCall(IGameModule.resolve, (params, spec, BET_ID, words));
        (bool ok, bytes memory result) =
            address(this).call(abi.encodeCall(this.measureColdModule, (modules[game], input)));
        require(!ok && result.length == 96, "meter must revert its access list");
        return abi.decode(result, (uint256, uint256, uint256));
    }

    /// @dev Reverting only the measurement wrapper preserves the module return
    /// data in the encoded result while rolling back EIP-2929 access-list warmth.
    /// The measured interval ends before this deliberate revert.
    function measureColdModule(address module, bytes memory input)
        external
        returns (uint256 gasUsed, uint256 payout, uint256 refund)
    {
        require(msg.sender == address(this));
        bytes memory output = new bytes(64);
        bool success;
        // Force the caller's return buffer to exist before starting the bracket.
        assembly ("memory-safe") { mstore(add(output, 64), 0) }
        vm.cool(module);
        assembly ("memory-safe") {
            let beforeGas := gas()
            success := staticcall(gas(), module, add(input, 32), mload(input), add(output, 32), 64)
            gasUsed := sub(beforeGas, gas())
        }
        require(success, "module resolve failed");
        (payout, refund) = abi.decode(output, (uint256, uint256));
        bytes memory result = abi.encode(gasUsed, payout, refund);
        assembly ("memory-safe") { revert(add(result, 32), mload(result)) }
    }

    function _observe(Maximum memory best, uint256 game, bytes memory params, uint256 seed, uint32 rounds)
        private
        returns (uint256 payout)
    {
        (uint256 gasUsed, uint256 paid, uint256 refund) = _measure(game, params, seed, _spec(rounds));
        assertEq(refund, 0, "sample did not execute all rounds");
        if (gasUsed > best.gasUsed) {
            best.gasUsed = gasUsed;
            best.seed = seed;
            best.params = params;
        }
        return paid;
    }

    function _spec(uint32 rounds) private pure returns (SSOTTypes.StakeSpec memory) {
        return SSOTTypes.StakeSpec(AMOUNT, rounds, type(uint256).max, type(uint256).max);
    }

    function _padded(bytes memory canonical) private pure returns (bytes memory) {
        if (canonical.length == 64) return canonical;
        require(canonical.length == 32);
        return bytes.concat(canonical, abi.encode(type(uint256).max));
    }

    function _report(uint256 game, uint32 rounds, Maximum memory best) private {
        emit GasWitness(_name(game), rounds, best.gasUsed, best.seed, best.params);
        emit log_named_string("game", _name(game));
        emit log_named_uint("rounds", rounds);
        emit log_named_uint("max sampled cold resolve gas", best.gasUsed);
        emit log_named_uint("seed", best.seed);
        emit log_named_bytes("params", best.params);
    }

    function _curveParams(uint256 game) private pure returns (bytes memory) {
        if (game == 0) return _padded(abi.encode(false));
        if (game == 1) return abi.encode(true, uint8(1));
        if (game == 2) return abi.encode(uint8(11), uint40(0));
        if (game == 3) return abi.encode(uint8(6), uint8(6));
        if (game == 4) return _padded(abi.encode(uint8(0)));
        if (game == 5) return _padded(abi.encode(uint8(1)));
        if (game == 6) return _padded(abi.encode(uint40(31)));
        return _padded(abi.encode(uint8(1)));
    }

    function _name(uint256 game) private pure returns (string memory) {
        if (game == 0) return "CoinToss";
        if (game == 1) return "Dice";
        if (game == 2) return "Roulette";
        if (game == 3) return "SicBo";
        if (game == 4) return "Slots";
        if (game == 5) return "Baccarat";
        if (game == 6) return "Keno";
        return "Plinko";
    }

    function _witnesses(uint256 game, uint256 size) private pure returns (uint256[] memory values) {
        values = new uint256[](size);
        uint256 found;
        for (uint256 seed; seed < 16384 && found < size; ++seed) {
            uint256 key;
            if (game == 0) {
                key = RNG.roll(BET_ID, 0, seed) % 2;
            } else if (game == 1) {
                key = RNG.roll(BET_ID, 0, seed) % 100;
            } else if (game == 2) {
                key = RNG.roll(BET_ID, 0, seed) % 37;
            } else if (game == 7) {
                for (uint256 row; row < 8; ++row) {
                    key += RNG.roll2(BET_ID, 0, row, seed) & 1;
                }
            } else {
                uint256 base = game == 3 ? 6 : 8;
                key = RNG.roll2(BET_ID, 0, 0, seed) % base;
                key += base * (RNG.roll2(BET_ID, 0, 1, seed) % base);
                key += base * base * (RNG.roll2(BET_ID, 0, 2, seed) % base);
            }
            if (values[key] == 0) {
                values[key] = seed + 1;
                ++found;
            }
        }
        require(found == size, "outcome coverage incomplete");
        for (uint256 i; i < size; ++i) {
            --values[i];
        }
    }

    function _sicboParams(uint256 p) private pure returns (bytes memory) {
        if (p < 3) return abi.encode(uint8(p), uint8(0));
        if (p < 9) return abi.encode(uint8(3), uint8(p - 2));
        if (p < 23) return abi.encode(uint8(4), uint8(p - 5));
        if (p < 29) return abi.encode(uint8(5), uint8(p - 22));
        return abi.encode(uint8(6), uint8(p - 28));
    }

    function _rouletteParams() private pure returns (bytes[] memory params, uint256 count) {
        params = new bytes[](132);
        for (uint256 bits = 1; bits < 37; ++bits) {
            params[count++] = abi.encode(uint8(0), uint40((1 << bits) - 1));
        }
        for (uint40 n; n < 37; ++n) {
            params[count++] = abi.encode(uint8(1), n);
        }
        params[count++] = abi.encode(uint8(2), uint40(36 << 6));
        params[count++] = abi.encode(uint8(2), uint40(1 | (2 << 6)));
        for (uint40 n = 1; n <= 34; n += 3) {
            params[count++] = abi.encode(uint8(3), n);
        }
        for (uint40 n = 1; n <= 32; ++n) {
            if (n % 3 != 0) params[count++] = abi.encode(uint8(4), n);
        }
        for (uint40 n = 1; n <= 31; n += 3) {
            params[count++] = abi.encode(uint8(5), n);
        }
        for (uint8 kind = 6; kind <= 7; ++kind) {
            for (uint40 n = 1; n <= 3; ++n) {
                params[count++] = abi.encode(kind, n);
            }
        }
        for (uint8 kind = 8; kind <= 13; ++kind) {
            params[count++] = abi.encode(kind, uint40(0));
        }
    }

    function _kenoDraw(uint256 seed) private pure returns (uint40 drawn, uint256 swaps) {
        uint8[15] memory available;
        for (uint8 i; i < 15; ++i) {
            available[i] = i;
        }
        for (uint256 i; i < 5; ++i) {
            uint256 j = RNG.roll2(BET_ID, 0, i, seed) % (15 - i) + i;
            drawn |= uint40(1) << available[j];
            if (j != i) {
                available[j] = available[i];
                ++swaps;
            }
        }
    }

    function _popcount(uint256 value) private pure returns (uint256 count) {
        for (; value != 0; value &= value - 1) {
            ++count;
        }
    }

    function _card(uint256 seed, uint256 index) private pure returns (uint8) {
        uint8 rank = uint8(RNG.roll2(BET_ID, 0, index, seed) % 13);
        return rank < 9 ? rank + 1 : 0;
    }

    function _baccaratPath(uint256 seed) private pure returns (uint8 cards, bool deep, uint8 outcome) {
        uint8 player = (_card(seed, 0) + _card(seed, 2)) % 10;
        uint8 banker = (_card(seed, 1) + _card(seed, 3)) % 10;
        cards = 4;
        if (player < 8 && banker < 8) {
            bool playerDraws = player <= 5;
            uint8 third;
            if (playerDraws) {
                third = _card(seed, 4);
                player = (player + third) % 10;
                ++cards;
            }
            bool bankerDraws;
            if (!playerDraws) bankerDraws = banker <= 5;
            else if (banker <= 2) bankerDraws = true;
            else if (banker == 3) bankerDraws = third != 8;
            else if (banker == 4) bankerDraws = third >= 2 && third <= 7;
            else if (banker == 5) bankerDraws = third >= 4 && third <= 7;
            else if (banker == 6) bankerDraws = third == 6 || third == 7;
            deep = banker == 6 && playerDraws && bankerDraws;
            if (bankerDraws) {
                banker = (banker + _card(seed, 5)) % 10;
                ++cards;
            }
        }
        outcome = player > banker ? 0 : banker > player ? 1 : 2;
    }
}
