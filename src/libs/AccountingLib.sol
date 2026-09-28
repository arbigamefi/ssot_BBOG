// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors} from "./Errors.sol";

library AccountingLib {
    function nav(uint256 B, uint256 PF, uint256 XP) internal pure returns (uint256) {
        uint256 liabilities = PF + XP; // checked: reverts on overflow
        if (B < liabilities) revert Errors.InsufficientBalance();
        unchecked {
            return B - liabilities; // safe: B >= liabilities verified above
        }
    }

    function buffer(uint256 NAV, uint256 bps) internal pure returns (uint256) {
        if (bps > 10_000) revert Errors.InvalidBps(bps);
        return (NAV * bps) / 10_000;
    }
}
