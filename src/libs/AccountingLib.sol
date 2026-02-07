// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors} from "./Errors.sol";

library AccountingLib {
    function nav(uint256 B, uint256 PF, uint256 XP) internal pure returns (uint256) {
        unchecked {
            if (B < PF + XP) revert Errors.InsufficientBalance();
            return B - PF - XP;
        }
    }

    function minLiq(uint256 NAV, uint256 minLiquidityBps) internal pure returns (uint256) {
        if (minLiquidityBps > 10_000) revert Errors.InvalidBps(minLiquidityBps);
        return (NAV * minLiquidityBps) / 10_000;
    }
}
