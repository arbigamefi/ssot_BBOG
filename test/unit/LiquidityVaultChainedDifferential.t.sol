// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {VaultPrefixHarness} from "./LiquidityVaultAllocation.t.sol";

/// Production Vault plus the deposit and withdrawal capital rules without NFTs, cash or cooldown, which do not
/// touch the tree differently. This contract's deployer is the Vault's Bank.
contract ChainedVaultHarness is VaultPrefixHarness {
    constructor(address asset_) VaultPrefixHarness(asset_) {}

    function hDeposit(uint128 amount) external returns (uint48) {
        if (amount == 0) revert IncorrectAmount();
        if (amount > MAX_TREE_CAPITAL - getReserve()) revert CapitalLimit();
        return _nodeAddLiquidity(amount);
    }

    function hWithdraw(uint48 id, uint40 percent) external returns (uint128 assets) {
        if (percent == 0 || percent > ONE) revert IncorrectPercent();
        uint128 free = getReserve() - lockedLiquidity;
        assets = _nodeWithdrawPercent(id, percent);
        if (assets == 0 && percent != ONE) revert ZeroWithdrawal();
        if (assets > free) revert InsufficientFreeCapital();
    }

    /// Compressed empty history: skips leaf ids only, as the gas fixture's slot-0 store does. It moves `nextNode`
    /// forward only, which keeps P3.
    function hJumpTo(uint48 nextId) external {
        require(nextId >= nextNode && nextId <= LIQUIDITYLASTNODE, "jump");
        nextNode = nextId;
    }

    /// P3: value held by nodes whose whole range lies after the last used leaf.
    function unusedSuffixAmount() external view returns (uint128) {
        return nextNode > LIQUIDITYNODES ? _getLeavesAmount(nextNode, LIQUIDITYLASTNODE) : 0;
    }

    /// Both counters and every node on a used leaf's path with its sibling. This is complete (P3''): a non-root
    /// node with no used leaf below it is never written and holds zero, because `_updateUp` writes only used paths
    /// and `_setAmount`/`_changeAmount` touch only positive nodes or the root, whatever leaf or amount the code
    /// under test passes.
    function digest(uint48[] calldata leaves) external view returns (bytes32 d) {
        d = keccak256(abi.encode(nextNode, updateId, treeNode[1].updateId, treeNode[1].amount));
        for (uint256 j; j < leaves.length; ++j) {
            for (uint48 x = leaves[j]; x > 1; x /= 2) {
                Node memory a = treeNode[x];
                Node memory b = treeNode[x ^ 1];
                d = keccak256(abi.encode(d, x, a.updateId, a.amount, b.updateId, b.amount));
            }
        }
    }

    /// Tree invariant I on used paths: a positive internal node has a positive child.
    function noStrandOnPaths(uint48[] calldata leaves) external view returns (bool) {
        for (uint256 j; j < leaves.length; ++j) {
            for (uint48 x = leaves[j] / 2; x != 0; x /= 2) {
                if (treeNode[x].amount != 0 && treeNode[2 * x].amount == 0 && treeNode[2 * x + 1].amount == 0) {
                    return false;
                }
            }
        }
        return true;
    }

    /// NEGATIVE CONTROL ONLY. Mode 1 drops the push for k > 0 (the update counter still advances twice); mode 2 also
    /// skips the preview at k = 0. A differential that cannot tell these from the pinned operation has no power.
    function mutantAllocate(uint48 cutoff, uint128 maxLoss, uint128 amount, bool isSub, uint256 mode) external {
        if (maxLoss == 0 && mode == 1) return _addLimit(amount, cutoff);
        uint48 leaf = domainLeaf(cutoff, maxLoss);
        if (mode == 1) ++updateId;
        else _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        _pushLazy(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, isSub, ++updateId);
    }

    function leafViewSum(uint48[] calldata leaves) external view returns (uint256 sum) {
        for (uint256 j; j < leaves.length; ++j) {
            sum += nodeWithdrawView(leaves[j]);
        }
    }
}

/// Chained differential for the k > 0 allocation without the vendor preview (ADR-0034 amendment 2026-10-07).
/// Production-shaped histories run on the production Vault and are never rolled back. Before every settlement the
/// pinned limit operation runs on the same state inside a snapshot, and the production result must leave the same
/// tree. Every step asserts invariant I, root == sum of used leaves, P3 and cash cover. Prefixes are shaped to
/// k - 1, k, k + 1 and 0 before settling. A window of 8 or 32 leaves stands in for a small tree. The window lies at
/// the start, the end (leaf space runs out) or a random point of the 40-level tree, so the production source,
/// compiled into the test harness, is what runs.
contract LiquidityVaultChainedDifferentialTest is Test {
    uint48 internal constant FIRST = uint48(1) << 40;
    uint48 internal constant LAST = FIRST * 2 - 1;
    uint40 internal constant ONE = 1e12;

    struct Pos {
        uint48 cutoff;
        uint128 k;
        bool open;
    }

    struct Coverage {
        uint256 settleK0;
        uint256 k0PreviewFallback;
        uint256 latestCutoff;
        uint256 prefixDomain;
        uint256 wholeDomain;
        uint256 prefixEqualsK;
        uint256 lossEqualsK;
        uint256 lossEqualsPrefix;
        uint256 protocolCapital;
        uint256 shaped;
        uint256 mutantDetected;
    }

    BlacklistToken internal tok;
    ChainedVaultHarness internal h;
    uint48[] internal used;
    Pos[] internal pos;
    uint256 internal window;
    uint256 internal mutant; // nonzero only in the negative controls
    Coverage internal cov;

    function _rand(uint256 seed, uint256 i, string memory tag) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, i, tag)));
    }

    function _fresh(uint256 seed, uint256 window_) internal {
        tok = new BlacklistToken();
        h = new ChainedVaultHarness(address(tok));
        tok.mint(address(this), type(uint128).max);
        tok.approve(address(h), type(uint256).max);
        delete used;
        delete pos;
        window = window_;
        uint256 place = _rand(seed, 0, "place") % 3;
        if (window_ == 0) {
            if (place != 0) h.hJumpTo(uint48(FIRST + _rand(seed, 0, "start") % (uint256(LAST) - FIRST)));
        } else if (place == 1) {
            h.hJumpTo(uint48(LAST - window_ + 1));
        } else if (place == 2) {
            h.hJumpTo(uint48(FIRST + _rand(seed, 0, "start") % (uint256(FIRST) - window_)));
        }
    }

    function _check() internal view {
        assertTrue(h.noStrandOnPaths(used), "invariant I broken");
        assertEq(h.leafViewSum(used), h.getReserve(), "root not fully held by used leaves");
        assertEq(h.unusedSuffixAmount(), 0, "value after the last used leaf (P3)");
        assertGe(tok.balanceOf(address(h)), h.getReserve(), "cash below root");
    }

    function _amt(uint256 r) internal view returns (uint128) {
        uint256 b = r % 10;
        uint256 x = r >> 8;
        if (window != 0 && b >= 6) b %= 6; // dense windows favour small amounts and zero-share splits
        if (b == 0) return 1;
        if (b == 1) return uint128(2 + x % 3);
        if (b == 2) return uint128(1 + x % 20);
        if (b == 3) return uint128(1 + x % 1000);
        if (b == 4) return uint128(1 + x % 1e6);
        if (b == 5) return uint128(1e6 * (1 + x % 10_000));
        if (b == 6) return uint128(1 + x % 1e18);
        if (b == 7) return uint128(1e15 * (1 + x % 1e6)); // late large deposits
        if (b == 8) return uint128(1 + x % 1e30);
        return uint128(1 + x % (uint256(1) << 100));
    }

    function _pct(uint256 r) internal pure returns (uint40) {
        uint256 b = r % 8;
        uint256 x = r >> 8;
        if (b == 0) return ONE;
        if (b == 1) return ONE - 1;
        if (b == 2) return 1;
        if (b == 3) return uint40(ONE - x % 1000);
        if (b == 4) return ONE / 2;
        return uint40(1 + x % ONE);
    }

    function _deposit(uint128 a) internal {
        if (window != 0 && used.length == window) return;
        try h.hDeposit(a) returns (uint48 id) {
            used.push(id);
            tok.mint(address(h), a);
        } catch {}
    }

    function _opDeposit(uint256 seed, uint256 i) internal {
        if (window == 0 && _rand(seed, i, "jump?") % 4 == 0) {
            uint48 next = h.nextNode();
            if (next < LAST - 2) {
                uint256 room = uint256(LAST) - next;
                uint256 kind = _rand(seed, i, "jk") % 3;
                uint256 target = next + _rand(seed, i, "jf") % (room / 2);
                if (kind != 0) {
                    // At or just before a 2^j boundary, so later paths diverge high in the tree.
                    uint256 j = 1 + _rand(seed, i, "jj") % 39;
                    uint256 boundary = FIRST + (((uint256(next) - FIRST >> j) + 1) << j);
                    target = kind == 1 ? boundary : boundary - 1;
                }
                if (target >= next && target <= LAST) h.hJumpTo(uint48(target));
            }
        }
        _deposit(_amt(_rand(seed, i, "dep")));
    }

    function _opWithdraw(uint256 seed, uint256 i) internal {
        if (used.length == 0) return;
        try h.hWithdraw(used[_rand(seed, i, "wl") % used.length], _pct(_rand(seed, i, "wp"))) {} catch {}
    }

    function _open(uint128 k) internal returns (bool) {
        uint48 cutoff = h.nextNode() - 1;
        try h.lockLiquidity(k) {
            pos.push(Pos(cutoff, k, true));
            return true;
        } catch {
            return false;
        }
    }

    function _opOpen(uint256 seed, uint256 i) internal {
        if (used.length == 0) return;
        uint128 root = h.getReserve();
        uint128 locked = h.lockedLiquidity();
        uint128 free = root > locked ? root - locked : 0;
        uint256 b = _rand(seed, i, "kb") % 8;
        uint128 k;
        if (b == 0) k = 0;
        else if (b == 1) k = 1;
        else if (b == 2) k = free;
        else if (b == 3) k = free / 2;
        else if (b == 5) k = uint128(1 + _rand(seed, i, "kr") % 5);
        else k = free == 0 ? 0 : uint128(1 + _rand(seed, i, "kr") % free);
        _open(k);
    }

    /// Settles one position chained. The pinned limit operation on the same state, inside a snapshot, is the
    /// reference for the production result.
    function _settle(uint256 idx, uint256 seed, uint256 i) internal {
        Pos storage p = pos[idx];
        uint48 last = h.nextNode() - 1;
        uint256 kind = _rand(seed, i, "sk") % 10;
        uint256 prefix = h.prefixCapital(p.cutoff);
        uint128 stake;
        uint128 cost;
        uint128 amount;
        bool isSub;
        if (p.k != 0 && kind < 5) {
            uint256 lb = _rand(seed, i, "lb") % 6;
            if (lb == 0) amount = p.k;
            else if (lb == 1) amount = p.k > 1 ? p.k - 1 : 1;
            else if (lb == 2) amount = 1;
            else if (lb == 3 && prefix != 0 && prefix <= p.k) amount = uint128(prefix);
            else amount = uint128(1 + _rand(seed, i, "lr") % p.k);
            isSub = true;
            (stake, cost) = (1, 1 + amount);
            if (amount == p.k) ++cov.lossEqualsK;
            if (amount == prefix) ++cov.lossEqualsPrefix;
        } else if (kind < 9) {
            amount = _amt(_rand(seed, i, "pa"));
            uint256 room = h.MAX_TREE_CAPITAL() - h.getReserve();
            if (amount > room) amount = uint128(room);
            (stake, cost) = (amount, 0);
        } else {
            (stake, cost) = (7, 7);
        }
        uint128 root = h.getReserve();
        bool treeOp = stake != cost && (isSub || root != 0);
        bytes32 expected = h.digest(used);
        if (treeOp) {
            uint48 leaf = h.domainLeaf(p.cutoff, p.k);
            if (p.k == 0) {
                ++cov.settleK0;
            } else {
                if (p.cutoff == last) ++cov.latestCutoff;
                else if (leaf == p.cutoff) ++cov.prefixDomain;
                else ++cov.wholeDomain;
                if (prefix == p.k) ++cov.prefixEqualsK;
                uint256 domainCapital = h.prefixCapital(leaf);
                assertGe(domainCapital, p.k, "selected domain holds less than k");
                if (leaf == last) assertEq(domainCapital, root, "whole-pool domain differs from the root");
            }
            // A snapshot revert also restores this contract's storage, so counters move only outside snapshots.
            uint256 snap = vm.snapshotState();
            bool fallback_ = h.previewAfterPush(leaf, amount, isSub);
            assertTrue(vm.revertToState(snap));
            if (p.k != 0) assertFalse(fallback_, "k > 0 preview asked for a fallback");
            else if (fallback_) ++cov.k0PreviewFallback; // k == 0 keeps the pinned operation and its own fallback
            snap = vm.snapshotState();
            if (mutant == 0) h.vendorAllocate(p.cutoff, p.k, amount, isSub);
            else h.mutantAllocate(p.cutoff, p.k, amount, isSub, mutant);
            expected = h.digest(used);
            assertTrue(vm.revertToState(snap));
        }
        uint128 protocolCapital = h.applySettlement(p.cutoff, p.k, stake, cost);
        bytes32 produced = h.digest(used);
        if (mutant == 0) assertEq(produced, expected, "settlement differs from the pinned limit operation");
        else if (produced != expected) ++cov.mutantDetected;
        uint128 booked = !isSub && stake > cost && root == 0 ? stake - cost : 0;
        assertEq(protocolCapital, booked, "protocol capital");
        if (booked != 0) ++cov.protocolCapital;
        p.open = false;
    }

    function _opSettle(uint256 seed, uint256 i) internal {
        uint256 len = pos.length;
        if (len == 0) return;
        uint256 start = _rand(seed, i, "ps") % len;
        for (uint256 j; j < len; ++j) {
            uint256 idx = (start + j) % len;
            if (pos[idx].open) {
                _settle(idx, seed, i);
                return;
            }
        }
    }

    /// Withdraws prefix leaves in id order until the position's prefix capital equals `target`.
    function _shapeTo(uint256 idx, uint256 target) internal {
        uint48 cutoff = pos[idx].cutoff;
        uint256 c = h.prefixCapital(cutoff);
        for (uint256 j; j < used.length && c > target; ++j) {
            uint48 leaf = used[j];
            if (leaf > cutoff) break;
            uint256 v = h.nodeWithdrawView(leaf);
            if (v == 0) continue;
            uint256 d = c - target;
            uint40 pct;
            if (v <= d) {
                pct = ONE;
            } else {
                uint256 lo = (d * ONE + v - 1) / v;
                uint256 hi = ((d + 1) * ONE - 1) / v;
                if (lo == 0 || lo > hi || lo > ONE) continue;
                pct = uint40(lo);
            }
            try h.hWithdraw(leaf, pct) {}
            catch {
                return;
            }
            c = h.prefixCapital(cutoff);
            _check();
        }
        if (c == target) ++cov.shaped;
    }

    function _target(uint256 seed, uint256 i, uint128 k) internal pure returns (uint256) {
        uint256 t = _rand(seed, i, "sd") % 10;
        if (k == 0) return t < 5 ? 0 : t;
        if (t < 4) return uint256(k) - 1;
        if (t < 6) return k;
        if (t < 8) return uint256(k) + 1;
        if (t < 9) return 0;
        return _rand(seed, i, "sr") % k;
    }

    function _opShape(uint256 seed, uint256 i) internal {
        if (pos.length == 0) return;
        uint256 idx = _rand(seed, i, "sh") % pos.length;
        if (!pos[idx].open || pos[idx].cutoff == h.nextNode() - 1) return;
        _shapeTo(idx, _target(seed, i, pos[idx].k));
    }

    /// Opens a position, adds a later (often large) deposit, shapes the prefix near k, then settles it.
    function _opMacro(uint256 seed, uint256 i) internal {
        if (h.getReserve() == h.lockedLiquidity()) _opDeposit(seed, i + 7_000_000);
        if (h.getReserve() == h.lockedLiquidity()) return;
        uint128 free = h.getReserve() - h.lockedLiquidity();
        uint256 kb = _rand(seed, i, "mk") % 6;
        uint128 k = kb == 0 ? 0 : kb == 1 ? 1 : kb == 2 ? free : uint128(1 + _rand(seed, i, "mkr") % free);
        if (!_open(k)) return;
        uint256 idx = pos.length - 1;
        _check();
        _deposit(
            _rand(seed, i, "ml") % 2 == 0
                ? uint128(1e18 * (1 + _rand(seed, i, "mla") % 1e9))
                : _amt(_rand(seed, i, "mlb"))
        );
        _check();
        _shapeTo(idx, _target(seed, i, k));
        if (pos[idx].open) _settle(idx, seed, i);
    }

    function _run(uint256 seed, uint256 window_, uint256 steps) internal {
        _fresh(seed, window_);
        for (uint256 i = 1; i <= steps; ++i) {
            uint256 r = _rand(seed, i, "op") % 100;
            if (r < 18) _opDeposit(seed, i);
            else if (r < 32) _opWithdraw(seed, i);
            else if (r < 48) _opOpen(seed, i);
            else if (r < 73) _opSettle(seed, i);
            else if (r < 83) _opShape(seed, i);
            else _opMacro(seed, i);
            _check();
        }
        for (uint256 j; j < pos.length; ++j) {
            if (pos[j].open) {
                _settle(j, seed, steps + 1 + j);
                _check();
            }
        }
        assertEq(h.lockedLiquidity(), 0);
    }

    function testFuzz_window8Chained(uint256 seed) public {
        _run(seed, 8, 60);
    }

    function testFuzz_window32Chained(uint256 seed) public {
        _run(seed, 32, 90);
    }

    /// forge-config: pr.fuzz.runs = 32
    function testFuzz_fullDepthChained(uint256 seed) public {
        _run(seed, 0, 70);
    }

    /// The generator must keep reaching every boundary the equivalence argument distinguishes.
    function test_generatorReachesEveryBoundary() public {
        for (uint256 seed; seed < 10; ++seed) {
            _run(seed, 8, 60);
        }
        emit log_named_uint("k = 0 tree settlements", cov.settleK0);
        emit log_named_uint("k = 0 vendor preview fallback taken", cov.k0PreviewFallback);
        emit log_named_uint("k > 0 latest-cutoff domain", cov.latestCutoff);
        emit log_named_uint("k > 0 prefix domain", cov.prefixDomain);
        emit log_named_uint("k > 0 whole-pool domain", cov.wholeDomain);
        emit log_named_uint("prefix capital == k", cov.prefixEqualsK);
        emit log_named_uint("loss == k", cov.lossEqualsK);
        emit log_named_uint("loss == prefix capital", cov.lossEqualsPrefix);
        emit log_named_uint("profit booked as protocol capital", cov.protocolCapital);
        emit log_named_uint("prefix shaped to its target", cov.shaped);
        assertGt(cov.settleK0, 0);
        assertGt(cov.k0PreviewFallback, 0);
        assertGt(cov.protocolCapital, 0);
        assertGt(cov.latestCutoff, 0);
        assertGt(cov.prefixDomain, 0);
        assertGt(cov.wholeDomain, 0);
        assertGt(cov.prefixEqualsK, 0);
        assertGt(cov.lossEqualsK, 0);
        assertGt(cov.lossEqualsPrefix, 0);
        assertGt(cov.shaped, 0);
    }

    /// Negative control: a reference without the push must be told apart within a few chained histories.
    function test_negativeControlDroppedPushIsDetected() public {
        mutant = 1;
        for (uint256 seed; seed < 4 && cov.mutantDetected == 0; ++seed) {
            _run(seed, 8, 60);
        }
        emit log_named_uint("settlements telling the dropped push apart", cov.mutantDetected);
        assertGt(cov.mutantDetected, 0, "the chained differential cannot see a dropped push");
    }

    /// Negative control: skipping the preview at k = 0 changes the empty-prefix profit, which the pinned operation
    /// sends to the whole pool.
    function test_negativeControlK0PreviewSkipIsDetected() public {
        mutant = 2;
        _fresh(0, 8);
        _deposit(1_000);
        _deposit(3_000);
        h.hWithdraw(used[0], ONE); // the first leaf is empty: a cutoff there has an empty prefix
        uint48 cutoff = used[0];
        h.lockLiquidity(0);
        pos.push(Pos(cutoff, 0, true));
        _deposit(5_000);
        bytes32 before = h.digest(used);
        uint256 snap = vm.snapshotState();
        h.mutantAllocate(cutoff, 0, 7, false, 2);
        bytes32 mutated = h.digest(used);
        assertTrue(vm.revertToState(snap));
        h.applySettlement(cutoff, 0, 7, 0);
        assertTrue(h.digest(used) != before);
        assertTrue(h.digest(used) != mutated, "the differential cannot see a skipped k = 0 preview");
    }
}
