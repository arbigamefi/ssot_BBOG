// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import {V15Snapshot} from "./V15Snapshot.sol";
import {Governable} from "../../src/access/Governable.sol";

/// @notice Read-only preparation. Import the output into the Safe transaction builder.
/// Already accepted targets are omitted, so a partially executed batch can be resumed.
contract PrepareSafeAcceptanceV15 is Script {
    using stdJson for string;

    function run() external {
        string memory snap = vm.readFile(vm.envString("SNAPSHOT_PATH"));
        V15Snapshot.verify(snap, false);
        address safe = snap.readAddress(".gov");
        address[] memory list = V15Snapshot.targets(snap);
        string memory txs;
        for (uint256 i; i < list.length; ++i) {
            if (Governable(list[i]).governance() == safe) continue;
            txs = string.concat(
                txs,
                bytes(txs).length == 0 ? "" : ",",
                '{"to":"',
                vm.toString(list[i]),
                '","value":"0","data":"',
                vm.toString(abi.encodeCall(Governable.acceptGovernance, ())),
                '"}'
            );
        }
        string memory json = string.concat(
            '{"version":"1.0","chainId":"',
            vm.toString(block.chainid),
            '","createdAt":',
            vm.toString(block.timestamp * 1000),
            ',"meta":{"name":"v1.5 governance acceptance","createdFromSafeAddress":"',
            vm.toString(safe),
            '"},"transactions":[',
            txs,
            "]}"
        );
        vm.writeFile(vm.envString("SAFE_BATCH_PATH"), json);
    }
}
