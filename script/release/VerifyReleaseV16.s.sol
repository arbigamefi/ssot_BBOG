// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";
import {V16ReleaseDigest} from "./V16ReleaseDigest.sol";

/// @notice Verifies a v1.6 release record against its snapshot and governance checkpoint: both digests, the
///         signature and the trusted signer. The checkpoint file's SHA-256 over its canonical JSON is checked by the
///         Python release tools that read it (validate_frontend_artifacts.py, verify_governance.py).
contract VerifyReleaseV16 is Script {
    using stdJson for string;

    function run() external view {
        string memory releasePath = vm.envOr("RELEASE_PATH", string("deployments/release-latest-v16.json"));
        string memory rel = _readFileOrDie(releasePath);

        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", rel.readString(".snapshotPath"));
        string memory snap = _readFileOrDie(snapshotPath);
        string memory checkpointPath = vm.envOr("GOVERNANCE_CHECKPOINT_PATH", rel.readString(".checkpointPath"));

        require(rel.readBytes32(".schemaHash") == V16ReleaseDigest.SCHEMA, "schema mismatch");
        V16ReleaseDigest.Checkpoint memory checkpoint = V16ReleaseDigest.readCheckpoint(
            snap, _readFileOrDie(checkpointPath), rel.readBytes32(".checkpointSha256")
        );
        require(
            checkpoint.blockNumber == rel.readUint(".checkpointBlockNumber")
                && checkpoint.blockHash == rel.readBytes32(".checkpointBlockHash"),
            "checkpoint differs from the release record"
        );

        bytes32 snapshotDigest = V16ReleaseDigest.snapshotDigest(snap);
        require(snapshotDigest == rel.readBytes32(".snapshotDigest"), "digest mismatch");
        bytes32 digest = V16ReleaseDigest.digest(snapshotDigest, checkpoint);
        require(digest == rel.readBytes32(".digest"), "digest mismatch");

        address signer = rel.readAddress(".signer");
        require(signer != address(0), "zero signer");
        require(
            ecrecover(digest, uint8(rel.readUint(".v")), rel.readBytes32(".r"), rel.readBytes32(".s")) == signer,
            "signature mismatch"
        );
        require(signer == snap.readAddress(".releaseSigner"), "snapshot signer mismatch");
        require(signer == vm.envAddress("RELEASE_SIGNER"), "release signer not trusted");
        require(rel.readUint(".chainId") == snap.readUint(".chainId"), "release chain mismatch");
        require(rel.readUint(".blockNumber") == snap.readUint(".blockNumber"), "release block mismatch");

        console2.log("OK v1.6 release artifact verified");
        console2.log("release:", releasePath);
        console2.log("snapshot:", snapshotPath);
        console2.log("checkpoint:", checkpointPath);
        console2.log("signer:", signer);
        console2.log("digest:", vm.toString(digest));
    }

    function _readFileOrDie(string memory path) internal view returns (string memory) {
        try vm.readFile(path) returns (string memory contents) {
            require(bytes(contents).length != 0, "file empty");
            return contents;
        } catch {
            revert(string.concat("missing file: ", path));
        }
    }
}
