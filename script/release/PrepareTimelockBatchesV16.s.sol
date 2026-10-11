// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {GovernanceTimelock} from "../../src/access/GovernanceTimelock.sol";
import {V16Batches} from "./V16Batches.sol";
import {V16Snapshot} from "./V16Snapshot.sol";

/// @notice Read-only preparation of the release's two timelock operations (ADR-0037 §9, decision D1) on a fork of the
///         deployed chain (RPC_URL):
///
///         1. checks the deployment as release verification does, at the operations' current on-chain state;
///         2. rehearses what is left with the actual addresses: the Safe schedules, the delay passes, anyone executes.
///            The wired system must pass the release check (pools inactive, LPs may deposit) and the activated one
///            the live check;
///         3. writes one Safe Transaction Builder file per operation, each a single `scheduleBatch` call on the
///            timelock, and one JSON with every call, both operation ids and states, and the `executeBatch` calldata
///            that anyone sends once an operation is ready.
///
///         Publish the operations file when the Safe schedules the wiring, for the 72-hour review. The activation
///         names the wiring as its predecessor, so it can never execute first; the release schedules it only after
///         the wiring has executed and LPs could deposit (ADR-0037 §9 step 3).
///
/// Inputs: SNAPSHOT_PATH. Outputs (defaults under deployments/): SAFE_WIRING_BATCH_PATH, SAFE_ACTIVATION_BATCH_PATH,
/// TIMELOCK_OPERATIONS_PATH.
contract PrepareTimelockBatchesV16 is Script {
    using stdJson for string;

    function run() external {
        string memory snap = vm.readFile(vm.envString("SNAPSHOT_PATH"));
        GovernanceTimelock timelock = GovernanceTimelock(payable(snap.readAddress(".governanceTimelock")));
        address safe = snap.readAddress(".gov");
        V16Batches.Batch memory wiring = V16Batches.wiring(snap);
        V16Batches.Batch memory activation = V16Batches.activation(snap);
        bytes32 wiringId = V16Batches.id(wiring);
        bytes32 activationId = V16Batches.id(activation);
        string memory wiringState = _state(timelock, wiringId);
        string memory activationState = _state(timelock, activationId);

        if (!timelock.isOperationDone(activationId)) {
            V16Snapshot.verify(
                snap, timelock.isOperationDone(wiringId) ? V16Snapshot.Mode.Release : V16Snapshot.Mode.Deployed
            );
            _advance(timelock, safe, wiring);
            V16Snapshot.verify(snap, V16Snapshot.Mode.Release);
            _advance(timelock, safe, activation);
        }
        V16Snapshot.verify(snap, V16Snapshot.Mode.Live);
        console2.log("OK rehearsal: wiring passes the release check, activation passes the live check");

        string memory chain = vm.toString(block.chainid);
        string memory wiringPath = vm.envOr("SAFE_WIRING_BATCH_PATH", string("deployments/safe-schedule-wiring-v16.json"));
        string memory activationPath =
            vm.envOr("SAFE_ACTIVATION_BATCH_PATH", string("deployments/safe-schedule-activation-v16.json"));
        string memory operationsPath =
            vm.envOr("TIMELOCK_OPERATIONS_PATH", string("deployments/timelock-operations-v16.json"));
        vm.writeFile(wiringPath, _safeBatch(chain, safe, address(timelock), "v1.6 wiring (ADR-0037 D1)", _schedule(timelock, wiring)));
        vm.writeFile(
            activationPath,
            _safeBatch(chain, safe, address(timelock), "v1.6 activation (ADR-0037 D1)", _schedule(timelock, activation))
        );
        vm.writeFile(
            operationsPath,
            string.concat(
                '{"chainId":',
                chain,
                ',"timelock":"',
                vm.toString(address(timelock)),
                '","minDelay":',
                vm.toString(timelock.getMinDelay()),
                ',"operations":[',
                _operation(snap, "wiring", wiringState, timelock, wiring),
                ",",
                _operation(snap, "activation", activationState, timelock, activation),
                "]}\n"
            )
        );
        console2.log("wiring", vm.toString(wiringId), wiringState);
        console2.log("activation", vm.toString(activationId), activationState);
        console2.log("wrote:", wiringPath);
        console2.log("wrote:", activationPath);
        console2.log("wrote:", operationsPath);
    }

    /// Moves an operation through what is left of schedule, delay and execution.
    function _advance(GovernanceTimelock timelock, address safe, V16Batches.Batch memory b) internal {
        bytes32 operation = V16Batches.id(b);
        TimelockController.OperationState state = timelock.getOperationState(operation);
        if (state == TimelockController.OperationState.Done) return;
        if (state == TimelockController.OperationState.Unset) {
            uint256 delay = timelock.getMinDelay(); // read first: vm.prank applies to the next call
            vm.prank(safe);
            timelock.scheduleBatch(b.targets, b.values, b.payloads, b.predecessor, b.salt, delay);
        }
        if (timelock.getTimestamp(operation) > block.timestamp) vm.warp(timelock.getTimestamp(operation));
        timelock.executeBatch(b.targets, b.values, b.payloads, b.predecessor, b.salt);
    }

    function _schedule(GovernanceTimelock timelock, V16Batches.Batch memory b) internal view returns (bytes memory) {
        return abi.encodeCall(
            TimelockController.scheduleBatch,
            (b.targets, b.values, b.payloads, b.predecessor, b.salt, timelock.getMinDelay())
        );
    }

    function _execute(V16Batches.Batch memory b) internal pure returns (bytes memory) {
        return abi.encodeCall(TimelockController.executeBatch, (b.targets, b.values, b.payloads, b.predecessor, b.salt));
    }

    function _state(GovernanceTimelock timelock, bytes32 operation) internal view returns (string memory) {
        TimelockController.OperationState state = timelock.getOperationState(operation);
        if (state == TimelockController.OperationState.Unset) return "unset";
        if (state == TimelockController.OperationState.Waiting) return "waiting";
        if (state == TimelockController.OperationState.Ready) return "ready";
        return "done";
    }

    function _safeBatch(string memory chain, address safe, address to, string memory name, bytes memory data)
        internal
        view
        returns (string memory)
    {
        return string.concat(
            '{"version":"1.0","chainId":"',
            chain,
            '","createdAt":',
            vm.toString(block.timestamp * 1000),
            ',"meta":{"name":"',
            name,
            '","createdFromSafeAddress":"',
            vm.toString(safe),
            '"},"transactions":[{"to":"',
            vm.toString(to),
            '","value":"0","data":"',
            vm.toString(data),
            '"}]}\n'
        );
    }

    function _operation(
        string memory snap,
        string memory name,
        string memory state,
        GovernanceTimelock timelock,
        V16Batches.Batch memory b
    ) internal view returns (string memory json) {
        string memory calls;
        for (uint256 i; i < b.targets.length; ++i) {
            calls = string.concat(
                calls,
                i == 0 ? "" : ",",
                '{"target":"',
                vm.toString(b.targets[i]),
                '","contract":"',
                _contractName(snap, b.targets[i]),
                '","function":"',
                _signature(bytes4(b.payloads[i])),
                '","value":"0","data":"',
                vm.toString(b.payloads[i]),
                '"}'
            );
        }
        json = string.concat(
            '{"name":"',
            name,
            '","id":"',
            vm.toString(V16Batches.id(b)),
            '","state":"',
            state,
            '","predecessor":"',
            vm.toString(b.predecessor),
            '","salt":"',
            vm.toString(b.salt),
            '","delay":',
            vm.toString(timelock.getMinDelay()),
            ',"scheduleCalldata":"',
            vm.toString(_schedule(timelock, b)),
            '","executeCalldata":"',
            vm.toString(_execute(b)),
            '","calls":[',
            calls,
            "]}"
        );
    }

    function _contractName(string memory snap, address target) internal pure returns (string memory) {
        if (target == snap.readAddress(".poolRegistry")) return "PoolRegistry";
        if (target == snap.readAddress(".gameHub")) return "GameHub";
        if (target == snap.readAddress(".refRegistry")) return "ReferralRegistry";
        uint256 pools = snap.readUint(".numPools");
        for (uint256 i; i < pools; ++i) {
            string memory suffix = vm.toString(i);
            if (target == snap.readAddress(string.concat(".poolBank_", suffix))) {
                return string.concat("Bank (pool ", vm.toString(snap.readUint(string.concat(".poolId_", suffix))), ")");
            }
        }
        revert("call target outside the release");
    }

    function _signature(bytes4 selector) internal pure returns (string memory) {
        string[12] memory names = [
            string("setBinderOnce(address)"),
            "setSettlementRouterOnce(address)",
            "setRandomnessConsumerOnce(address)",
            "setGuardian(address)",
            "setSentinel(address)",
            "setWithdrawalBufferBps(uint256)",
            "setMinPlayerTurnoverForUnlock(uint256)",
            "setHoldbackVestingSeconds(uint256)",
            "registerPool(uint64,address,address,uint8)",
            "setHubRegistered(address,bool)",
            "setHubAllowedForPool(uint64,address,bool)",
            "registerGame(bytes32,address,uint32,uint32)"
        ];
        for (uint256 i; i < names.length; ++i) {
            if (bytes4(keccak256(bytes(names[i]))) == selector) return names[i];
        }
        if (selector == bytes4(keccak256("setPoolActive(uint64,bool)"))) return "setPoolActive(uint64,bool)";
        revert("call outside the release batches");
    }
}
