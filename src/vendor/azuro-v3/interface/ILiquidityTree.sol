// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.28;

interface ILiquidityTree {
    function nodeWithdrawView(
        uint48 leaf
    ) external view returns (uint128 withdrawAmount);
}
