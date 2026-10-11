// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {LiquidityTree} from "../../src/vendor/azuro-v3/utils/LiquidityTree.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {BankNFTRouterHarness} from "../unit/BankNFTAccounting.t.sol";

/// @notice Independent-audit shadow: the pinned vendor tree driven only through the UPSTREAM limit operations
///         (`_removeLimit` / `_addLimit`, both with the sufficiency preview). The domain leaf is re-derived here
///         from the audit's own reading of ADR-0034 (prefix covers max loss -> cutoff, else last used leaf).
contract AuditShadowTree is LiquidityTree {
    uint256 public previewFired;
    uint256 public mode; // negative controls only: 1 = always prefix domain, 2 = strict '>' threshold

    function setMode(uint256 m) external {
        mode = m;
    }

    constructor() {
        __liquidityTree_init();
    }

    function deposit(uint128 amount) external returns (uint48) {
        return _nodeAddLiquidity(amount);
    }

    function withdraw(uint48 leaf, uint40 percent) external returns (uint128) {
        return _nodeWithdrawPercent(leaf, percent);
    }

    /// Same sequence as upstream `_removeLimit`/`_addLimit`, but records whether the preview fallback fired.
    function limitOp(uint128 amount, uint48 leaf, bool isSub) external returns (bool fired) {
        uint48 lastUsedNode = nextNode - 1;
        if (leaf > lastUsedNode) leaf = lastUsedNode;
        if (isSub && treeNode[1].amount < amount) revert InsufficientTopNodeAmount();
        _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        if (_isNeedUpdateWholeLeaves(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, isSub)) {
            ++previewFired;
            fired = true;
            leaf = lastUsedNode;
            _push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        }
        _pushLazy(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, LIQUIDITYNODES, leaf, amount, isSub, ++updateId);
    }

    /// Audit's own domain rule: brute-force the prefix value as `_push` would leave it (exact replay of the
    /// integer split along the path, no early exits), then compare with maxLoss.
    function domainLeaf(uint48 cutoff, uint128 maxLoss) external view returns (uint48) {
        uint48 last = nextNode - 1;
        if (maxLoss == 0 || cutoff == last) return cutoff;
        if (mode == 1) return cutoff;
        if (mode == 2) return prefixValue(cutoff) > maxLoss ? cutoff : last;
        return prefixValue(cutoff) >= maxLoss ? cutoff : last;
    }

    function prefixValue(uint48 cutoff) public view returns (uint256 capital) {
        uint48 node = 1;
        uint48 start = LIQUIDITYNODES;
        uint48 end = LIQUIDITYLASTNODE;
        uint256 amount = treeNode[1].amount;
        while (node != cutoff) {
            uint48 mid = (start + end) / 2;
            uint256 l = treeNode[node * 2].amount;
            uint256 r = treeNode[node * 2 + 1].amount;
            uint256 left = l + r == 0 ? 0 : amount * l / (l + r);
            if (cutoff <= mid) {
                (node, end, amount) = (node * 2, mid, l == 0 ? 0 : left);
            } else {
                capital += l == 0 ? 0 : left;
                (node, start, amount) = (node * 2 + 1, mid + 1, r == 0 ? 0 : amount - left);
            }
        }
        capital += amount;
    }
}

contract AuditTreeDifferentialTest is Test {
    uint48 internal constant FIRST = uint48(1) << 40;
    uint40 internal constant ONE = 1e12;

    BlacklistToken internal token;
    Bank internal bank;
    LiquidityVault internal vault;
    BankNFTRouterHarness internal router;
    AuditShadowTree internal shadow;

    struct Pos {
        uint256 id;
        uint256 stake;
        uint256 reserved;
        uint48 cutoff;
        bool open;
    }

    Pos[] internal positions;
    uint48[] internal leaves;
    mapping(uint48 => bool) internal live;
    uint256 internal nextId = 1;
    uint256 internal rng;
    uint256 internal skipChecks; // positions settled by the Vault with k > 0 (preview skipped)
    uint256 internal profitCapital;

    function setUp() public {
        token = new BlacklistToken();
        router = new BankNFTRouterHarness();
        bank = new Bank(address(token), address(this), 0, 6, 1);
        vault = LiquidityVault(bank.vault());
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(router));
        shadow = new AuditShadowTree();
        token.mint(address(this), type(uint128).max);
        token.approve(address(vault), type(uint256).max);
        token.approve(address(bank), type(uint256).max);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }

    function _r() internal returns (uint256) {
        rng = uint256(keccak256(abi.encode(rng)));
        return rng;
    }

    /// Dust-heavy amount generator: 1..3 units, small, medium, large.
    function _amt() internal returns (uint128) {
        uint256 c = _r() % 6;
        if (c == 0) return uint128(1 + _r() % 3);
        if (c == 1) return uint128(1 + _r() % 1000);
        if (c == 2) return uint128(1 + _r() % 1e6);
        if (c == 3) return uint128(1e6 + _r() % 1e9);
        if (c == 4) return uint128(1e9 + _r() % 1e12);
        return uint128(1 + _r() % 1e15);
    }

    function _deposit() internal {
        uint128 a = _amt();
        uint48 id = vault.addDeposit(a);
        uint48 sid = shadow.deposit(a);
        assertEq(id, sid, "leaf id");
        leaves.push(id);
        live[id] = true;
    }

    function _withdraw() internal {
        if (leaves.length == 0) return;
        uint48 id = leaves[_r() % leaves.length];
        if (!live[id]) return;
        uint256 c = _r() % 4;
        uint40 pct = c == 0 ? ONE : c == 1 ? ONE - 1 : c == 2 ? 1 : uint40(1 + _r() % ONE);
        vm.warp(block.timestamp + 1 days);
        try vault.withdrawDeposit(id, pct) returns (uint128 got) {
            uint128 sgot = shadow.withdraw(id, pct);
            assertEq(got, sgot, "withdraw amount");
            if (pct == ONE) live[id] = false;
        } catch {}
    }

    function _open() internal {
        uint256 root = vault.getReserve();
        uint256 free = root - vault.lockedLiquidity();
        if (free == 0 || positions.length > 100) return;
        uint256 stake = 1 + _r() % 1e9;
        uint256 k = _r() % 8 == 0 ? 0 : 1 + _r() % free; // occasional k = 0 exercises the upstream path
        if (k > free) return;
        uint256 id = nextId++;
        try router.open(bank, id, address(uint160(0x5000 + id)), stake, stake + k, address(this)) {
            positions.push(Pos(id, stake, stake + k, vault.getLastDepositId(), true));
        } catch {}
    }

    function _settle() internal {
        if (positions.length == 0) return;
        Pos storage p = positions[_r() % positions.length];
        if (!p.open) return;
        uint256 c = _r() % 5;
        uint256 cost = c == 0 ? 0 : c == 1 ? p.reserved : c == 2 ? p.stake : _r() % (p.reserved + 1);
        uint128 maxLoss = uint128(p.reserved - p.stake);
        uint128 rootBefore = vault.getReserve();
        uint48 leaf = shadow.domainLeaf(p.cutoff, maxLoss);
        router.finish(bank, p.id, cost, cost, 0, 0, new SSOTTypes.XPAward[](0));
        p.open = false;
        if (cost > p.stake) {
            bool fired = shadow.limitOp(uint128(cost - p.stake), leaf, true);
            assertFalse(fired, "k>0 loss: pinned preview would have fallen back");
            ++skipChecks;
        } else if (p.stake > cost) {
            if (rootBefore == 0) {
                profitCapital += p.stake - cost;
            } else {
                bool fired = shadow.limitOp(uint128(p.stake - cost), maxLoss == 0 ? p.cutoff : leaf, false);
                if (maxLoss != 0) {
                    assertFalse(fired, "k>0 profit: pinned preview would have fallen back");
                    ++skipChecks;
                }
            }
        }
    }

    uint256 internal step;

    function _compare() internal {
        ++step;
        (, uint128 vr) = vault.treeNode(1);
        (, uint128 sr) = shadow.treeNode(1);
        assertEq(vr, sr, "root");
        assertEq(vault.nextNode(), shadow.nextNode(), "nextNode");
        assertEq(vault.updateId(), shadow.updateId(), "updateId");
        uint256 sum;
        for (uint256 j; j < leaves.length; ++j) {
            uint48 leaf = leaves[j];
            uint128 v = vault.nodeWithdrawView(leaf);
            assertEq(v, shadow.nodeWithdrawView(leaf), "leaf view");
            sum += v;
            // full path equality, and tree invariant I on the production tree (every 8th step: gas)
            if (step % 8 != 0) continue;
            for (uint48 x = leaf; x > 1; x /= 2) {
                (uint64 vu, uint128 va) = vault.treeNode(x);
                (uint64 su, uint128 sa) = shadow.treeNode(x);
                assertEq(va, sa, "node amount");
                assertEq(vu, su, "node updateId");
                uint48 parent = x / 2;
                (, uint128 pa) = vault.treeNode(parent);
                (, uint128 l) = vault.treeNode(parent * 2);
                (, uint128 r) = vault.treeNode(parent * 2 + 1);
                if (pa != 0) assertTrue(l != 0 || r != 0, "invariant I");
            }
        }
        assertLe(sum, vr, "leaf views exceed root");
        // P3': nothing after the last used leaf
        assertTrue(bank.getSSOT().accountingValid, "SSOT accounting");
    }

    function _run(uint256 seed, uint256 steps) internal {
        rng = seed;
        for (uint256 i; i < 3; ++i) _deposit();
        for (uint256 i; i < steps; ++i) {
            uint256 op = _r() % 10;
            if (op < 2) _deposit();
            else if (op < 4) _withdraw();
            else if (op < 7) _open();
            else _settle();
            _compare();
        }
    }

    function runExternal(uint256 seed, uint256 steps) external {
        _run(seed, steps);
    }

    /// Negative controls: a differential that cannot see a wrong domain rule has no power.
    function test_negativeControl_alwaysPrefixDomainIsDetected() public {
        // Eight 160-step runs exceed Foundry 1.8's 2^30 per-test gas limit; gas is not what this control measures.
        vm.pauseGasMetering();
        shadow.setMode(1);
        uint256 detected;
        for (uint256 s; s < 8; ++s) {
            try this.runExternal(uint256(keccak256(abi.encode("neg1", s))), 160) {} catch { ++detected; }
        }
        emit log_named_uint("mode 1 detected in runs (of 8)", detected);
        assertGt(detected, 0, "negative control 1 not detected");
    }

    function testFuzz_auditDifferential(uint256 seed) public {
        _run(seed, 48);
    }

    function test_auditDifferentialLong0() public {
        _run(uint256(keccak256("audit-long-0")), 160);
        emit log_named_uint("k>0 settlements cross-checked", skipChecks);
    }

    function test_auditDifferentialLong1() public {
        _run(uint256(keccak256("audit-long-1")), 160);
        emit log_named_uint("k>0 settlements cross-checked", skipChecks);
    }

    function test_auditDifferentialLong2() public {
        _run(uint256(keccak256("audit-long-2")), 160);
        emit log_named_uint("k>0 settlements cross-checked", skipChecks);
    }
}
