// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import {SafeConfigMockV16, DeployHarnessV16} from "../unit/DeploymentV16.t.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {Governable} from "../../src/access/Governable.sol";
import {V16Snapshot} from "../../script/release/V16Snapshot.sol";
import {ReleaseDigestV16} from "../../script/release/ReleaseDigestV16.s.sol";
import {VerifyReleaseV16} from "../../script/release/VerifyReleaseV16.s.sol";
import {GenerateFrontendManifestV16} from "../../script/release/GenerateFrontendManifestV16.s.sol";
import {GenerateGoldenVectorsV16} from "../../script/release/GenerateGoldenVectorsV16.s.sol";
import {GenerateReleaseNotesV16} from "../../script/release/GenerateReleaseNotesV16.s.sol";

/// @dev Local-only import fixture. It executes the real deployment and release scripts.
/// SafeConfigMockV16 checks configuration; this does not exercise Safe quorum signatures.
contract ReleaseImportFixture is Script {
    using stdJson for string;

    function run() external {
        string memory directory = vm.envString("RELEASE_IMPORT_FIXTURE_DIR");
        address bootstrap = vm.addr(0xBEEF);
        // Public test key, remembered only in this simulated local script process.
        address signer = vm.rememberKey(0xA11CE);
        SafeConfigMockV16 safe = new SafeConfigMockV16();
        MockERC20 asset = new MockERC20("Test USD", "TUSD", 6);
        vm.deal(bootstrap, 100 ether);
        vm.setEnv("DEPLOYER", vm.toString(bootstrap));
        vm.setEnv("CHAIN_ID", vm.toString(block.chainid));
        vm.setEnv("GOV", vm.toString(address(safe)));
        vm.setEnv("GUARDIAN", vm.toString(address(77)));
        vm.setEnv("KEEPER_ADDRESS", vm.toString(address(78)));
        vm.setEnv("RELEASE_SIGNER", vm.toString(signer));
        vm.setEnv("SAFE_CODE_HASH", vm.toString(address(safe).codehash));
        vm.setEnv(
            "SAFE_CONTROL_HASH",
            vm.toString(
                keccak256(abi.encode(address(safe), address(safe).codehash, address(0), address(0), bytes32(0)))
            )
        );
        vm.setEnv("SAFE_OWNERS_HASH", vm.toString(keccak256(abi.encode(safe.getOwners(), uint256(2)))));
        vm.setEnv("VRF_WRAPPER", vm.toString(address(asset)));
        vm.setEnv("NUM_POOLS", "1");
        vm.setEnv("POOL_ASSET_0", vm.toString(address(asset)));
        vm.setEnv("POOL_DOMAIN_0", "1");
        vm.setEnv("POOL_ID_0", "1");
        vm.setEnv("SPORTS_DERIVE_ROLE_SET_HASHES", "false");
        vm.setEnv("DEFAULT_HOUSE_EDGE_BPS", "200");
        vm.setEnv("REFUND_TIMEOUT_SECONDS", "3600");
        DeployHarnessV16 deployer = new DeployHarnessV16();
        deployer.run();
        string memory snap = deployer.snapshot();
        V16Snapshot.verify(snap, false);
        vm.dumpState(string.concat(directory, "/pending-alloc.json"));
        address[] memory targets = V16Snapshot.targets(snap);
        for (uint256 i; i < targets.length; ++i) {
            vm.prank(address(safe));
            Governable(targets[i]).acceptGovernance();
        }
        V16Snapshot.verify(snap, true);
        vm.dumpState(string.concat(directory, "/accepted-alloc.json"));
        _writeBundle(directory, snap);
        // A correctly signed but incorrect scale tests live metadata verification,
        // separately from the old-signature digest mismatch control.
        vm.serializeJson("wrong-precision", snap);
        string memory wrong = vm.serializeUint("wrong-precision", "poolLpDecimals_0", 9);
        _writeBundle(string.concat(directory, "/wrong-precision"), wrong);
    }

    function _writeBundle(string memory directory, string memory snap) internal {
        string memory output = string.concat(directory, "/bundle/deployments/");
        vm.createDir(output, true);
        string memory snapshotPath = string.concat(output, "latest-v16.json");
        string memory releasePath = string.concat(output, "release-latest-v16.json");
        vm.writeFile(snapshotPath, snap);
        vm.setEnv("SNAPSHOT_PATH", snapshotPath);
        vm.setEnv("RELEASE_PATH", releasePath);
        vm.setEnv("RELEASE_OUTPUT_PATH", releasePath);
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
