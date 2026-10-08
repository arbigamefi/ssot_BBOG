// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {CasinoParameterDomain, IGameModule, SSOTTypes} from "../utils/CasinoParameterDomain.sol";

/// M4, a premise of the first-callback certificate (docs/audit/m4-resolve-census-2026-10-08.md): for every bet
/// GameHub admits, the module's `resolve` returns without reverting, and its result passes GameHub's post-resolve
/// checks (`refund <= stake`, `payoutGross <= reserved`, `payoutGross + refund <= reserved`). A deterministic
/// failure there would leave the result unbookable and the pool's LP cash fenced for good.
///
/// The census document proves this from the admission facts; this test is the mechanical companion:
///   - sweep: every admitted parameter value of every module (the complete domain) resolves at the floor stake;
///   - grid: the parameter classes that resolve's arithmetic distinguishes, at the floor stake, the official
///     minimum, and the largest stake Bank admits (reserved <= 2^108 - 1), for 1 and 25 rounds, with every
///     stop configuration and several random words, including the ones that force early stops.
contract CallbackDomainM4Test is CasinoParameterDomain {
    uint256 internal constant MAX_TREE_CAPITAL = (uint256(1) << 108) - 1;
    uint256 internal constant OFFICIAL_MIN_BET = 10_000;

    uint256 internal sweepResolved;
    uint256 internal gridResolved;
    uint256 internal earlyStops;

    function setUp() public {
        _deployModules();
    }

    /// Resolve exactly as GameHub._finalize does and apply its checks.
    function _resolveChecked(uint256 module, bytes memory params, SSOTTypes.StakeSpec memory spec, uint256 word)
        internal
        returns (uint256 gross, uint256 refund)
    {
        (bool ok, uint256 reserved) = _admit(modules[module], params, spec);
        assertTrue(ok, "grid point is not admitted");
        uint256 stake = spec.amountPerRoll * spec.betCount;
        assertLe(reserved, MAX_TREE_CAPITAL, "grid point exceeds the Bank capital bound");
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        (gross, refund) = modules[module].resolve(params, spec, 7_777_777, words); // must not revert
        assertLe(refund, stake, "refund > stake");
        assertLe(gross, reserved, "payoutGross > reserved");
        assertLe(refund, reserved - gross, "payoutGross + refund > reserved");
        assertEq(refund % spec.amountPerRoll, 0, "refund is a whole number of unused rounds");
    }

    function _onAdmitted(uint256 module, bytes memory params, uint256) internal override {
        _resolveChecked(module, params, _floorSpec(), uint256(keccak256(abi.encode("m4-sweep", params))));
        ++sweepResolved;
    }

    /// Representatives of the parameter classes resolve's arithmetic distinguishes (factor or denominator class).
    function _gridParams(uint256 module) internal pure returns (bytes[] memory ps) {
        if (module == 0) {
            ps = new bytes[](4);
            ps[0] = abi.encode(false, uint8(99)); // denominator 99: the binding k
            ps[1] = abi.encode(true, uint8(1)); // denominator 99
            ps[2] = abi.encode(false, uint8(1)); // denominator 1: the largest per-round payout
            ps[3] = abi.encode(true, uint8(99)); // denominator 1
        } else if (module == 1) {
            ps = new bytes[](2);
            ps[0] = abi.encode(false);
            ps[1] = abi.encode(true);
        } else if (module == 2) {
            ps = new bytes[](38);
            for (uint256 pc = 1; pc <= 36; ++pc) {
                ps[pc - 1] = abi.encode(uint8(0), uint40((uint256(1) << pc) - 1));
            }
            ps[36] = abi.encode(uint8(8), uint40(0)); // Red: 18 numbers through the typed path
            ps[37] = abi.encode(uint8(1), uint40(36)); // Straight 36: the highest number
        } else if (module == 3) {
            ps = new bytes[](10);
            for (uint256 played = 1; played <= 5; ++played) {
                ps[played - 1] = abi.encode(uint40((uint256(1) << played) - 1)); // numbers 0..played-1
                ps[4 + played] = abi.encode(uint40(((uint256(1) << played) - 1) << (15 - played))); // top numbers
            }
        } else if (module == 4) {
            ps = new bytes[](3);
            for (uint256 risk; risk < 3; ++risk) {
                ps[risk] = abi.encode(uint8(risk));
            }
        } else if (module == 5) {
            ps = new bytes[](35);
            uint256 i;
            for (uint256 kind; kind < 3; ++kind) {
                ps[i++] = abi.encode(uint8(kind), uint8(0));
            }
            for (uint256 face = 1; face <= 6; ++face) {
                ps[i++] = abi.encode(uint8(3), uint8(face));
                ps[i++] = abi.encode(uint8(5), uint8(face));
                ps[i++] = abi.encode(uint8(6), uint8(face));
            }
            for (uint256 total = 4; total <= 17; ++total) {
                ps[i++] = abi.encode(uint8(4), uint8(total));
            }
        } else if (module == 6) {
            ps = new bytes[](1);
            ps[0] = abi.encode(uint8(0));
        } else {
            ps = new bytes[](3);
            for (uint256 side; side < 3; ++side) {
                ps[side] = abi.encode(uint8(side));
            }
        }
    }

    /// Largest per-round amount Bank can admit for these params at 25 rounds: reserved(25 rounds) <= 2^108 - 1.
    function _maxAmount(IGameModule m, bytes memory params) internal view returns (uint256 amount) {
        (, uint256 unit) = _admit(m, params, SSOTTypes.StakeSpec(OFFICIAL_MIN_BET, 1, 0, 0));
        amount = MAX_TREE_CAPITAL / 25 * OFFICIAL_MIN_BET / unit;
        for (;;) {
            (bool ok, uint256 reserved) = _admit(m, params, SSOTTypes.StakeSpec(amount, 25, 0, 0));
            if (ok && reserved <= MAX_TREE_CAPITAL) return amount;
            amount -= amount / 1000 + 1;
        }
    }

    function _grid(uint256 module) internal {
        bytes[] memory ps = _gridParams(module);
        uint256[3] memory words = [uint256(0), type(uint256).max, uint256(keccak256("m4-grid"))];
        for (uint256 p; p < ps.length; ++p) {
            uint256[3] memory amounts = [uint256(FLOOR_STAKE), OFFICIAL_MIN_BET, _maxAmount(modules[module], ps[p])];
            for (uint256 a; a < 3; ++a) {
                for (uint32 n = 1; n <= 25; n += 24) {
                    // Stops: none; gain 1 (stop after the first winning round); loss 1 (after the first losing
                    // round); both at one round's stake.
                    uint256[2][4] memory stops = [
                        [type(uint256).max, type(uint256).max],
                        [uint256(1), type(uint256).max],
                        [type(uint256).max, uint256(1)],
                        [amounts[a], amounts[a]]
                    ];
                    for (uint256 s; s < 4; ++s) {
                        for (uint256 w; w < 3; ++w) {
                            uint256 fmp = _mark();
                            (, uint256 refund) = _resolveChecked(
                                module, ps[p], SSOTTypes.StakeSpec(amounts[a], n, stops[s][0], stops[s][1]), words[w]
                            );
                            _release(fmp);
                            if (refund != 0) ++earlyStops;
                            ++gridResolved;
                        }
                    }
                }
            }
        }
    }

    function _run(uint256 module) internal {
        sweepResolved = 0;
        gridResolved = 0;
        earlyStops = 0;
        _enumerate(module);
        assertEq(sweepResolved, _expectedAdmitted(module), "every admitted parameter value resolved");
        _grid(module);
        emit log_named_string("module", MODULE_NAMES[module]);
        emit log_named_uint("  admitted parameter values resolved at the floor", sweepResolved);
        emit log_named_uint("  grid points resolved (params x stake x rounds x stops x words)", gridResolved);
        emit log_named_uint("  grid points that stopped early (refund > 0)", earlyStops);
        if (module != 6) assertGt(earlyStops, 0, "the stop grid must exercise refunds");
    }

    function test_dice() public {
        _run(0);
    }

    function test_coinToss() public {
        _run(1);
    }

    function test_roulette() public {
        _run(2);
    }

    function test_keno() public {
        _run(3);
    }

    function test_plinko() public {
        _run(4);
    }

    function test_sicBo() public {
        _run(5);
    }

    function test_slots() public {
        _run(6);
    }

    function test_baccarat() public {
        _run(7);
    }

    /// The decode and range checks in resolve are the same as in validate: a parameter that validate rejects is
    /// rejected by resolve for the same reason, so admission and resolution agree on the whole domain.
    function _onRejected(uint256 module, bytes memory params) internal override {
        uint256[] memory words = new uint256[](1);
        try modules[module].resolve(params, _floorSpec(), 1, words) {
            // Admission can reject for reasons resolve does not re-check only through maxPayout's reserved == 0,
            // which cannot happen at a positive stake with factors above 1x.
            fail("resolve accepted a parameter value that admission rejected");
        } catch {}
    }
}
