// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {V15Snapshot} from "./V15Snapshot.sol";

contract VerifyGovernanceV15 is Script {
    function run() external view {
        V15Snapshot.verify(vm.readFile(vm.envString("SNAPSHOT_PATH")), true);
    }
}
