// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice The Bank's share-price curve, restated independently for tests.
library BankCurve {
    /// @dev Virtual assets and shares of one thousandth of a token, one base unit below three decimals.
    function virtualOffset(uint8 decimals) internal pure returns (uint256) {
        return decimals > 3 ? 10 ** (decimals - 3) : 1;
    }

    /// @dev Whole real-supply entitlement G(x) = min(S(x + V) / (S + V), x).
    function realEquity(uint256 supply, uint256 nav, uint256 v) internal pure returns (uint256) {
        return Math.min(Math.mulDiv(supply, nav + v, supply + v), nav);
    }
}
