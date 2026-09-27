// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {V16Snapshot} from "./V16Snapshot.sol";

contract VerifyGovernanceV16 is Script {
    function run() external view {
        V16Snapshot.verify(vm.readFile(vm.envString("SNAPSHOT_PATH")), true);
    }
}
