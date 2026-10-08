// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Errors} from "./Errors.sol";

library AccountingLib {
    function buffer(uint256 capital, uint256 bps) internal pure returns (uint256) {
        if (bps > 10_000) revert Errors.InvalidBps(bps);
        return (capital * bps) / 10_000;
    }
}
