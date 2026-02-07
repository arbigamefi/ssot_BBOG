// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/StdJson.sol";

/// @notice Minimal stdJson wrappers so scripts can try/catch missing fields.
/// @dev Using a dedicated helper contract avoids relying on `this.<fn>` calls
///      from script contracts, which can be fragile across Foundry versions.
contract JsonReader {
    using stdJson for string;

    function readString(string memory json, string memory path) external pure returns (string memory) {
        return json.readString(path);
    }

    function readUint(string memory json, string memory path) external pure returns (uint256) {
        return json.readUint(path);
    }
}
