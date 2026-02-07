// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Canonical RNG expansion for multi-roll (SSOT.v1.1).
///
/// seed := randomWords[0]
/// domain := "SSOT_RNG_V1"
/// r[i] := keccak256(domain, betId, i, seed)
/// r[i,j] := keccak256(domain, betId, i, j, seed)
library RNG {
    bytes internal constant DOMAIN = "SSOT_RNG_V1";

    function roll(uint256 betId, uint256 i, uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(DOMAIN, betId, i, seed)));
    }

    function roll2(uint256 betId, uint256 i, uint256 j, uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(DOMAIN, betId, i, j, seed)));
    }
}
