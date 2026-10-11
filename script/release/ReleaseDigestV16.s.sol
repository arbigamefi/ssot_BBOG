// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";
import {V16ReleaseDigest} from "./V16ReleaseDigest.sol";

/// @notice Signs a v1.6 release record: the snapshot digest and the governance checkpoint the signer verified.
///
/// Inputs:
/// - SNAPSHOT_PATH (default: deployments/latest-v16.json)
/// - GOVERNANCE_CHECKPOINT_PATH (default: deployments/governance-checkpoint-latest-v16.json), the checkpoint that
///   verify_governance.py wrote for this snapshot, and GOVERNANCE_CHECKPOINT_SHA256, the digest it printed
/// - Foundry unlocked keystore or hardware signer supplied with --account/--ledger
/// - RELEASE_SIGNER (required independent metadata trust anchor; governance is the timelock)
///
/// Outputs:
/// - RELEASE_OUTPUT_PATH (default: deployments/release-latest-v16.json)
contract ReleaseDigestV16 is Script {
    using stdJson for string;

    function run() external {
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v16.json"));
        string memory snap = _readFileOrDie(snapshotPath);
        string memory checkpointPath =
            vm.envOr("GOVERNANCE_CHECKPOINT_PATH", string("deployments/governance-checkpoint-latest-v16.json"));
        V16ReleaseDigest.Checkpoint memory checkpoint = V16ReleaseDigest.readCheckpoint(
            snap, _readFileOrDie(checkpointPath), vm.envBytes32("GOVERNANCE_CHECKPOINT_SHA256")
        );

        bytes32 snapshotDigest = V16ReleaseDigest.snapshotDigest(snap);
        bytes32 digest = V16ReleaseDigest.digest(snapshotDigest, checkpoint);

        address signer = vm.envAddress("RELEASE_SIGNER");
        require(signer == snap.readAddress(".releaseSigner"), "release signer mismatch");
        // Foundry resolves this address only from explicitly supplied unlocked wallets.
        // No raw key is read into the script environment or embedded into traces.
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer, digest);
        require(ecrecover(digest, v, r, s) == signer, "bad signature");

        string memory obj = "release";
        string memory json;

        json = vm.serializeString(obj, "schema", "SSOT_RELEASE_DIGEST_V16");
        json = vm.serializeBytes32(obj, "schemaHash", V16ReleaseDigest.SCHEMA);
        json = vm.serializeString(obj, "snapshotPath", snapshotPath);
        json = vm.serializeUint(obj, "chainId", snap.readUint(".chainId"));
        json = vm.serializeUint(obj, "blockNumber", snap.readUint(".blockNumber"));
        json = vm.serializeBytes32(obj, "snapshotDigest", snapshotDigest);
        json = vm.serializeString(obj, "checkpointPath", checkpointPath);
        json = vm.serializeUint(obj, "checkpointBlockNumber", checkpoint.blockNumber);
        json = vm.serializeBytes32(obj, "checkpointBlockHash", checkpoint.blockHash);
        json = vm.serializeBytes32(obj, "checkpointSha256", checkpoint.sha256);
        json = vm.serializeAddress(obj, "signer", signer);
        json = vm.serializeBytes32(obj, "digest", digest);
        json = vm.serializeUint(obj, "v", v);
        json = vm.serializeBytes32(obj, "r", r);
        json = vm.serializeBytes32(obj, "s", s);

        string memory outputPath = vm.envOr("RELEASE_OUTPUT_PATH", string("deployments/release-latest-v16.json"));
        vm.writeJson(json, outputPath);

        console2.log("snapshot:", snapshotPath);
        console2.log("checkpoint block:", checkpoint.blockNumber);
        console2.log("digest:", vm.toString(digest));
        console2.log("signer:", signer);
        console2.log("wrote:", outputPath);
    }

    function _readFileOrDie(string memory path) internal view returns (string memory) {
        try vm.readFile(path) returns (string memory contents) {
            require(bytes(contents).length != 0, string.concat("file empty: ", path));
            return contents;
        } catch {
            revert(string.concat("missing file: ", path));
        }
    }
}
