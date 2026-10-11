// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import {DeployHarnessV16, ReleaseV16Env, SafeConfigMockV16} from "../utils/ReleaseV16Fixture.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {GovernanceTimelock} from "../../src/access/GovernanceTimelock.sol";
import {V16Batches} from "../../script/release/V16Batches.sol";
import {V16Snapshot} from "../../script/release/V16Snapshot.sol";
import {ReleaseDigestV16} from "../../script/release/ReleaseDigestV16.s.sol";
import {VerifyReleaseV16} from "../../script/release/VerifyReleaseV16.s.sol";
import {GenerateFrontendManifestV16} from "../../script/release/GenerateFrontendManifestV16.s.sol";
import {GenerateGoldenVectorsV16} from "../../script/release/GenerateGoldenVectorsV16.s.sol";
import {GenerateReleaseNotesV16} from "../../script/release/GenerateReleaseNotesV16.s.sol";

/// @dev Local-only release fixture. It executes the real deployment, the timelock wiring and the release scripts on a
///      loopback node, in the phases test/fixtures/release-import-fixture.sh drives (the node's clock has to move 72
///      hours between scheduling and execution, which a single script run cannot do):
///
///      deploy  mocks for the Safe, the guardian, the token and the VRF wrapper; the v1.6 deployment; the Safe
///              schedules the wiring. Writes <dir>/snapshot.json.
///      wire    anyone executes the wiring; the chain must then be in the pre-launch release state.
///      bundle  signs the release record over the snapshot and the governance checkpoint the driver verified
///              (GOVERNANCE_CHECKPOINT_PATH, GOVERNANCE_CHECKPOINT_SHA256) and writes the bundle, plus a correctly
///              signed bundle with a wrong asset precision.
///
///      SafeConfigMockV16 checks configuration; this does not exercise Safe quorum signatures.
contract ReleaseImportFixture is Script {
    using stdJson for string;

    uint256 internal constant FIXTURE_KEY = 0xBEEF;
    uint256 internal constant SIGNER_KEY = 0xA11CE;

    function run() external {
        string memory directory = vm.envString("RELEASE_IMPORT_FIXTURE_DIR");
        bytes32 phase = keccak256(bytes(vm.envString("RELEASE_IMPORT_PHASE")));
        if (phase == keccak256("deploy")) return _deploy(directory);
        string memory snap = vm.readFile(string.concat(directory, "/snapshot.json"));
        if (phase == keccak256("wire")) return _wire(snap);
        require(phase == keccak256("bundle"), "RELEASE_IMPORT_PHASE must be deploy, wire or bundle");
        _writeBundle(directory, snap);
        // A correctly signed but incorrect scale tests live metadata verification,
        // separately from the old-signature digest mismatch control.
        vm.serializeJson("wrong-precision", snap);
        string memory wrong = vm.serializeUint("wrong-precision", "poolAssetDecimals_0", 9);
        _writeBundle(string.concat(directory, "/wrong-precision"), wrong);
    }

    function _deploy(string memory directory) internal {
        address operator = vm.addr(FIXTURE_KEY);
        // Public test key, remembered only in this simulated local script process.
        address signer = vm.rememberKey(SIGNER_KEY);
        // The driver broadcasts these transactions to its own empty loopback node, preserving creation blocks and
        // authorization logs for the verifier.
        vm.startBroadcast(operator);
        SafeConfigMockV16 safe = new SafeConfigMockV16(11);
        SafeConfigMockV16 guardian = new SafeConfigMockV16(21);
        MockERC20 asset = new MockERC20("Test USD", "TUSD", 6);
        MockVRFV2PlusWrapper wrapper = new MockVRFV2PlusWrapper();
        vm.stopBroadcast();
        ReleaseV16Env.configure(operator, safe, guardian, address(asset), address(wrapper), signer, 1);
        DeployHarnessV16 deployer = new DeployHarnessV16();
        deployer.run();
        string memory snap = deployer.snapshot();
        V16Snapshot.verify(snap, V16Snapshot.Mode.Deployed);
        GovernanceTimelock timelock = GovernanceTimelock(payable(snap.readAddress(".governanceTimelock")));
        V16Batches.Batch memory w = V16Batches.wiring(snap);
        vm.startBroadcast(operator);
        safe.exec(
            address(timelock),
            abi.encodeCall(
                timelock.scheduleBatch, (w.targets, w.values, w.payloads, w.predecessor, w.salt, timelock.getMinDelay())
            )
        );
        vm.stopBroadcast();
        vm.writeFile(string.concat(directory, "/snapshot.json"), snap);
    }

    function _wire(string memory snap) internal {
        GovernanceTimelock timelock = GovernanceTimelock(payable(snap.readAddress(".governanceTimelock")));
        V16Batches.Batch memory w = V16Batches.wiring(snap);
        vm.startBroadcast(vm.addr(FIXTURE_KEY));
        timelock.executeBatch(w.targets, w.values, w.payloads, w.predecessor, w.salt);
        vm.stopBroadcast();
        V16Snapshot.verify(snap, V16Snapshot.Mode.Release);
    }

    function _writeBundle(string memory directory, string memory snap) internal {
        vm.rememberKey(SIGNER_KEY);
        string memory output = string.concat(directory, "/bundle/deployments/");
        vm.createDir(output, true);
        string memory snapshotPath = string.concat(output, "latest-v16.json");
        string memory releasePath = string.concat(output, "release-latest-v16.json");
        string memory checkpointPath = string.concat(output, "governance-checkpoint-latest-v16.json");
        vm.writeFile(snapshotPath, snap);
        vm.writeFile(checkpointPath, vm.readFile(vm.envString("GOVERNANCE_CHECKPOINT_PATH")));
        vm.setEnv("SNAPSHOT_PATH", snapshotPath);
        vm.setEnv("RELEASE_PATH", releasePath);
        vm.setEnv("RELEASE_OUTPUT_PATH", releasePath);
        vm.setEnv("GOVERNANCE_CHECKPOINT_PATH", checkpointPath);
        vm.setEnv("RELEASE_SIGNER", vm.toString(snap.readAddress(".releaseSigner")));
        vm.setEnv("FRONTEND_MANIFEST_OUTPUT_PATH", string.concat(output, "frontend-manifest-latest-v16.json"));
        vm.setEnv("VECTORS_OUTPUT_PATH", string.concat(output, "golden-vectors-latest-v16.json"));
        vm.setEnv("NOTES_OUTPUT_PATH", string.concat(output, "release-notes-latest-v16.md"));
        new ReleaseDigestV16().run();
        new VerifyReleaseV16().run();
        new GenerateFrontendManifestV16().run();
        new GenerateGoldenVectorsV16().run();
        new GenerateReleaseNotesV16().run();
    }
}
