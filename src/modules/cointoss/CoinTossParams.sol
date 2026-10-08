// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

library CoinTossParams {
    /// @notice params = abi.encode(bool face)
    /// @dev face: false = Heads, true = Tails
    function decode(bytes calldata params) internal pure returns (bool face) {
        face = abi.decode(params, (bool));
    }
}
