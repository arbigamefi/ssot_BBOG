// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {DeployV16} from "../../script/DeployV16.s.sol";
import {V16Batches} from "../../script/release/V16Batches.sol";
import {V16Snapshot} from "../../script/release/V16Snapshot.sol";
import {GovernanceTimelock} from "../../src/access/GovernanceTimelock.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {SafeConfigMockV16} from "./SafeConfigMockV16.sol";

contract DeployHarnessV16 is DeployV16 {
    string public snapshot;

    function _shouldWriteArtifacts() internal pure override returns (bool) {
        return true;
    }

    function _logDeployment(DeployConfig memory, PoolConfig[] memory, Deployed memory, string memory)
        internal
        pure
        override
    {}

    function _writeArtifacts(string memory snap) internal override {
        snapshot = snap;
    }
}

/// @dev Sets the deployment environment for one Safe, one guardian multisig and the mock token and VRF wrapper.
///      Foundry environment variables are process-wide, outside EVM snapshots, so suites that change them run with
///      --threads 1 and reset them per case.
library ReleaseV16Env {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function configure(
        address deployer,
        SafeConfigMockV16 safe,
        SafeConfigMockV16 guardian,
        address asset,
        address wrapper,
        address signer,
        uint256 pools
    ) internal {
        vm.setEnv("DEPLOYER", vm.toString(deployer));
        vm.setEnv("CHAIN_ID", vm.toString(block.chainid));
        vm.setEnv("GOV", vm.toString(address(safe)));
        vm.setEnv("SAFE_CODE_HASH", vm.toString(address(safe).codehash));
        vm.setEnv("SAFE_CONTROL_HASH", vm.toString(safe.controlHash()));
        vm.setEnv("SAFE_OWNERS_HASH", vm.toString(safe.ownersHash()));
        vm.setEnv("GUARDIAN", vm.toString(address(guardian)));
        vm.setEnv("GUARDIAN_CODE_HASH", vm.toString(address(guardian).codehash));
        vm.setEnv("GUARDIAN_CONTROL_HASH", vm.toString(guardian.controlHash()));
        vm.setEnv("GUARDIAN_OWNERS_HASH", vm.toString(guardian.ownersHash()));
        vm.setEnv("KEEPER_ADDRESS", vm.toString(address(78)));
        vm.setEnv("RELEASE_SIGNER", vm.toString(signer));
        vm.setEnv("VRF_WRAPPER", vm.toString(wrapper));
        (string[8] memory games,) = V16Batches.games();
        for (uint256 i; i < games.length; ++i) {
            vm.setEnv(string.concat("GAME_MAX_BET_COUNT_", games[i]), "25");
            vm.setEnv(string.concat("GAME_CALLBACK_GAS_LIMIT_", games[i]), "2447746");
        }
        vm.setEnv("NUM_POOLS", vm.toString(pools));
        uint256[3] memory ids = [uint256(1), 3, 4];
        for (uint256 i; i < 3; ++i) {
            string memory suffix = vm.toString(i);
            vm.setEnv(string.concat("BANK_MIN_BET_AMOUNT_", suffix), "10000");
            vm.setEnv(string.concat("POOL_ASSET_", suffix), vm.toString(asset));
            vm.setEnv(string.concat("POOL_ID_", suffix), vm.toString(ids[i]));
            vm.setEnv(string.concat("BANK_RISK_RESERVE_BPS_", suffix), "6000");
            vm.setEnv(string.concat("BANK_WITHDRAWAL_BUFFER_BPS_", suffix), "1000");
            vm.setEnv(string.concat("BANK_MIN_TURNOVER_FOR_UNLOCK_", suffix), "20000000");
            vm.setEnv(string.concat("BANK_HOLDBACK_VESTING_SECONDS_", suffix), "86400");
        }
        vm.setEnv("DEFAULT_HOUSE_EDGE_BPS", "200");
        vm.setEnv("REFUND_TIMEOUT_SECONDS", "3600");
        vm.setEnv("WRITE_DRY_RUN_ARTIFACTS", "false");
    }
}

/// @notice A v1.6 deployment through the real deployment script, and the release's timelock operations as the Safe,
///         the guardian and anyone else send them (ADR-0037 §9).
abstract contract ReleaseV16Fixture is Test {
    using stdJson for string;

    DeployHarnessV16 internal deployer;
    SafeConfigMockV16 internal safe;
    SafeConfigMockV16 internal guardianSafe;
    MockERC20 internal asset;
    MockVRFV2PlusWrapper internal wrapper;
    address internal deployerKey;
    address internal executor = address(0xE3EC);

    function _setUpRelease() internal {
        deployerKey = vm.addr(0xBEEF);
        vm.deal(deployerKey, 100 ether);
        safe = new SafeConfigMockV16(11);
        guardianSafe = new SafeConfigMockV16(21);
        asset = new MockERC20("Test USD", "TUSD", 6);
        wrapper = new MockVRFV2PlusWrapper();
        deployer = new DeployHarnessV16();
        _configureEnv();
    }

    function _configureEnv() internal virtual {
        ReleaseV16Env.configure(deployerKey, safe, guardianSafe, address(asset), address(wrapper), address(79), 2);
    }

    function _deploy() internal returns (string memory snap) {
        deployer.run();
        snap = deployer.snapshot();
    }

    function _timelock(string memory snap) internal pure returns (GovernanceTimelock) {
        return GovernanceTimelock(payable(snap.readAddress(".governanceTimelock")));
    }

    function _schedule(string memory snap, V16Batches.Batch memory b) internal {
        GovernanceTimelock timelock = _timelock(snap);
        uint256 delay = timelock.getMinDelay();
        vm.prank(address(safe));
        timelock.scheduleBatch(b.targets, b.values, b.payloads, b.predecessor, b.salt, delay);
    }

    function _execute(string memory snap, V16Batches.Batch memory b) internal {
        vm.prank(executor);
        _timelock(snap).executeBatch(b.targets, b.values, b.payloads, b.predecessor, b.salt);
    }

    function _scheduleAndExecute(string memory snap, V16Batches.Batch memory b) internal {
        _schedule(snap, b);
        vm.warp(block.timestamp + _timelock(snap).getMinDelay());
        _execute(snap, b);
    }

    function _wire(string memory snap) internal {
        _scheduleAndExecute(snap, V16Batches.wiring(snap));
    }

    function _activate(string memory snap) internal {
        _scheduleAndExecute(snap, V16Batches.activation(snap));
    }

    /// One governance call through the timelock, as an operation the release does not declare.
    function _govCall(string memory snap, address target, bytes memory data, bytes32 salt) internal {
        V16Batches.Batch memory b;
        b.targets = new address[](1);
        b.values = new uint256[](1);
        b.payloads = new bytes[](1);
        b.targets[0] = target;
        b.payloads[0] = data;
        b.salt = salt;
        _scheduleAndExecute(snap, b);
    }
}

contract SnapshotVerifierV16 {
    function verify(string memory snap, V16Snapshot.Mode mode) external view {
        V16Snapshot.verify(snap, mode);
    }
}
