// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import {V16Snapshot} from "./V16Snapshot.sol";

/// @notice The state checks of release verification at the frozen block (script/release/verify_governance.py runs
///         this on a fork). GOVERNANCE_VERIFY_MODE: `release` (default) for the pre-launch release state that signing
///         and the Release Gate require, `live` for a deployed release as the frontend import checks it.
contract VerifyGovernanceV16 is Script {
    function run() external view {
        V16Snapshot.verify(vm.readFile(vm.envString("SNAPSHOT_PATH")), mode(vm.envOr("GOVERNANCE_VERIFY_MODE", string("release"))));
    }

    function mode(string memory name) public pure returns (V16Snapshot.Mode) {
        if (keccak256(bytes(name)) == keccak256("release")) return V16Snapshot.Mode.Release;
        if (keccak256(bytes(name)) == keccak256("live")) return V16Snapshot.Mode.Live;
        revert("GOVERNANCE_VERIFY_MODE must be release or live");
    }
}
