// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";
import {V16ReleaseDigest} from "./V16ReleaseDigest.sol";

/// @notice Signs a governance checkpoint refresh for a signed v1.6 release record: a later checkpoint that
///         verify_governance.py wrote in live mode, replayed from the record's checkpoint or an earlier refresh. The
///         record is not changed. Run it through script/release/repackage_release_v16.sh, which verifies the record and
///         replays first.
///
/// Inputs:
/// - RELEASE_PATH (default: deployments/release-latest-v16.json), verified by VerifyReleaseV16 before this runs
/// - SNAPSHOT_PATH (default: the record's snapshotPath)
/// - REFRESHED_CHECKPOINT_PATH (default: deployments/governance-checkpoint-refreshed-latest-v16.json) and
///   REFRESHED_CHECKPOINT_SHA256, the digest verify_governance.py printed for it
/// - Foundry unlocked keystore or hardware signer supplied with --account/--ledger; RELEASE_SIGNER, the record's signer
///
/// Output: CHECKPOINT_REFRESH_PATH (default: deployments/governance-checkpoint-refresh-latest-v16.json)
contract SignCheckpointRefreshV16 is Script {
    using stdJson for string;

    function run() external {
        string memory rel = _readFileOrDie(vm.envOr("RELEASE_PATH", string("deployments/release-latest-v16.json")));
        string memory snap = _readFileOrDie(vm.envOr("SNAPSHOT_PATH", rel.readString(".snapshotPath")));
        string memory checkpointPath = vm.envOr(
            "REFRESHED_CHECKPOINT_PATH", string("deployments/governance-checkpoint-refreshed-latest-v16.json")
        );
        V16ReleaseDigest.Checkpoint memory checkpoint = V16ReleaseDigest.readCheckpoint(
            snap, _readFileOrDie(checkpointPath), vm.envBytes32("REFRESHED_CHECKPOINT_SHA256")
        );
        require(checkpoint.blockNumber > rel.readUint(".checkpointBlockNumber"), "refresh not after the record");

        address signer = vm.envAddress("RELEASE_SIGNER");
        require(signer == rel.readAddress(".signer") && signer == snap.readAddress(".releaseSigner"), "signer mismatch");
        bytes32 releaseDigest = rel.readBytes32(".digest");
        bytes32 digest = V16ReleaseDigest.refreshDigest(releaseDigest, checkpoint);
        // Foundry resolves this address only from explicitly supplied unlocked wallets.
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer, digest);
        require(ecrecover(digest, v, r, s) == signer, "bad signature");

        string memory obj = "refresh";
        string memory json;
        json = vm.serializeString(obj, "schema", "SSOT_GOVERNANCE_CHECKPOINT_REFRESH_V16");
        json = vm.serializeBytes32(obj, "schemaHash", V16ReleaseDigest.REFRESH_SCHEMA);
        json = vm.serializeUint(obj, "chainId", rel.readUint(".chainId"));
        json = vm.serializeUint(obj, "blockNumber", rel.readUint(".blockNumber"));
        json = vm.serializeBytes32(obj, "releaseDigest", releaseDigest);
        json = vm.serializeString(obj, "checkpointPath", checkpointPath);
        json = vm.serializeUint(obj, "checkpointBlockNumber", checkpoint.blockNumber);
        json = vm.serializeBytes32(obj, "checkpointBlockHash", checkpoint.blockHash);
        json = vm.serializeBytes32(obj, "checkpointSha256", checkpoint.sha256);
        json = vm.serializeAddress(obj, "signer", signer);
        json = vm.serializeBytes32(obj, "digest", digest);
        json = vm.serializeUint(obj, "v", v);
        json = vm.serializeBytes32(obj, "r", r);
        json = vm.serializeBytes32(obj, "s", s);

        string memory outputPath =
            vm.envOr("CHECKPOINT_REFRESH_PATH", string("deployments/governance-checkpoint-refresh-latest-v16.json"));
        vm.writeJson(json, outputPath);

        console2.log("release digest:", vm.toString(releaseDigest));
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
