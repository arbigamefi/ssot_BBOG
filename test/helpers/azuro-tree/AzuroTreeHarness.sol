// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import {LiquidityTree} from "../../../src/vendor/azuro-v3/utils/LiquidityTree.sol";
import {FixedMath} from "../../../src/vendor/azuro-v3/libraries/FixedMath.sol";

/// @dev Exposes the pinned vendor tree with its documented range-query and unused-suffix patches.
///      No production authorization, NFT or custody claim.
contract AzuroTreeHarness is LiquidityTree {
    constructor() {
        __liquidityTree_init();
    }

    function deposit(uint128 amount) external returns (uint48) {
        return _nodeAddLiquidity(amount);
    }

    function withdraw(uint48 leaf, uint40 percent) external returns (uint128) {
        return _nodeWithdrawPercent(leaf, percent);
    }

    function profit(uint128 amount, uint48 cutoff) external {
        _addLimit(amount, cutoff);
    }

    function loss(uint128 amount, uint48 cutoff) external {
        _removeLimit(amount, cutoff);
    }

    function reserve() external view returns (uint128) {
        return treeNode[1].amount;
    }

    /// @dev Read every raw storage node reachable from the allocated contiguous leaf interval.
    ///      Does not push or otherwise refresh stale nodes before observing their amount.
    function largestStoredNode(uint48 lastLeaf) external view returns (uint128 largest, uint48 atNode) {
        uint48 first = LIQUIDITYNODES;
        uint48 last = lastLeaf;
        while (first != 0) {
            for (uint48 node = first; node <= last; ++node) {
                if (treeNode[node].amount > largest) {
                    largest = treeNode[node].amount;
                    atNode = node;
                }
            }
            first >>= 1;
            last >>= 1;
        }
    }

    // Boundary injection only: tests distinguish these states from reachable production history.
    // Every caller moves nextNode forward only, which keeps P3' (no value after the last used leaf).
    function forceNextNode(uint48 value) external {
        nextNode = value;
    }

    function forceUpdateId(uint64 value) external {
        updateId = value;
    }

    function scaledProduct(uint256 amount, uint256 nodeAmount, uint256 divisor) external pure returns (uint256) {
        return FixedMath.div(amount * nodeAmount, divisor);
    }
}
