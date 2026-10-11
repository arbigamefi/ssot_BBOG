// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

/// The vault's public tree view.
interface ITreeView {
    function treeNode(uint48 node) external view returns (uint64 updateId, uint128 amount);
}

/// @notice Test-only: the tree's push split rule along one cutoff's path, read through a vault's public `treeNode`
///         view, for tests that hold a deployed vault (the fork qualification's full-predicate witness).
///         `VaultPrefixReference._prefixCapital` keeps the original internal helper verbatim; the prefix-capital
///         fuzz test in LiquidityVaultAllocation.t.sol requires the two to agree on random histories.
library PrefixPath {
    /// The state before one split: the capital of the left siblings passed so far and the current node's amount.
    struct Step {
        uint256 capital;
        uint256 amount;
    }

    /// Every split from the root down to `cutoff`, and the state after the last one: the prefix capital of leaves
    /// [firstLeaf, cutoff] is `capital + amount`.
    function walk(ITreeView vault, uint48 firstLeaf, uint48 cutoff)
        internal
        view
        returns (Step[] memory steps, uint256 capital, uint256 amount)
    {
        uint48 start = firstLeaf;
        uint48 end = 2 * firstLeaf - 1;
        // The path depends on the cutoff alone.
        uint256 count;
        (uint48 s, uint48 e) = (start, end);
        for (; e != cutoff; ++count) {
            uint48 mid = (s + e) / 2;
            if (cutoff <= mid) e = mid;
            else s = mid + 1;
        }
        steps = new Step[](count);
        uint48 node = 1;
        (, uint128 root) = vault.treeNode(1);
        amount = root;
        for (uint256 i; end != cutoff; ++i) {
            steps[i] = Step(capital, amount);
            uint48 mid = (start + end) / 2;
            (, uint128 l) = vault.treeNode(node * 2);
            (, uint128 r) = vault.treeNode(node * 2 + 1);
            uint256 left = l == 0 ? 0 : amount * l / (uint256(l) + r);
            if (cutoff <= mid) {
                (node, end, amount) = (node * 2, mid, left);
            } else {
                capital += left;
                (node, start, amount) = (node * 2 + 1, mid + 1, r == 0 ? 0 : amount - left);
            }
        }
    }

    function prefixCapital(ITreeView vault, uint48 firstLeaf, uint48 cutoff) internal view returns (uint256) {
        (, uint256 capital, uint256 amount) = walk(vault, firstLeaf, cutoff);
        return capital + amount;
    }
}
