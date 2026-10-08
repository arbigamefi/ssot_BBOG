// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import {LiquidityVault} from "../../src/core/LiquidityVault.sol";

/// Test-only reference: the original full-prefix query, preserved verbatim.
abstract contract VaultPrefixReference is LiquidityVault {
    constructor(address asset_, address bank_) LiquidityVault(asset_, bank_) {}

    /// @dev Capital of leaves [LIQUIDITYNODES, cutoff] after the tree's own push to `cutoff`, without writing it:
    ///      replays the split rule of `_getPushView` down the cutoff's path and adds each left sibling it passes.
    function _prefixCapital(uint48 cutoff) internal view returns (uint256 capital) {
        uint48 node = 1;
        uint48 start = LIQUIDITYNODES;
        uint48 end = LIQUIDITYLASTNODE;
        uint256 amount = treeNode[1].amount;
        while (end != cutoff) {
            uint48 mid = (start + end) / 2;
            uint256 l = treeNode[node * 2].amount;
            uint256 r = treeNode[node * 2 + 1].amount;
            uint256 left = l == 0 ? 0 : amount * l / (l + r);
            if (cutoff <= mid) {
                (node, end, amount) = (node * 2, mid, left);
            } else {
                capital += left;
                (node, start, amount) = (node * 2 + 1, mid + 1, r == 0 ? 0 : amount - left);
            }
        }
        return capital + amount;
    }
}
