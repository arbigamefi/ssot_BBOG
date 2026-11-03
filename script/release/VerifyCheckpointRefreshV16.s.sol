// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";
import {V16ReleaseDigest} from "./V16ReleaseDigest.sol";

/// @notice Verifies a governance checkpoint refresh against the release record it names: the record's digest, chain
///         and block, a checkpoint of the record's snapshot later than the record's own, the signature and the trusted
///         signer, who must be the record's. Run it after VerifyReleaseV16 has accepted the record. The checkpoint
///         file's SHA-256 over its canonical JSON is checked by verify_governance.py when it replays from it.
contract VerifyCheckpointRefreshV16 is Script {
    using stdJson for string;

    function run() external view {
        string memory rel = _readFileOrDie(vm.envOr("RELEASE_PATH", string("deployments/release-latest-v16.json")));
        string memory snap = _readFileOrDie(vm.envOr("SNAPSHOT_PATH", rel.readString(".snapshotPath")));
        string memory refreshPath =
            vm.envOr("CHECKPOINT_REFRESH_PATH", string("deployments/governance-checkpoint-refresh-latest-v16.json"));
        string memory refresh = _readFileOrDie(refreshPath);
        string memory checkpointPath = vm.envOr("REFRESHED_CHECKPOINT_PATH", refresh.readString(".checkpointPath"));

        require(refresh.readBytes32(".schemaHash") == V16ReleaseDigest.REFRESH_SCHEMA, "refresh schema mismatch");
        bytes32 releaseDigest = rel.readBytes32(".digest");
        require(
            refresh.readBytes32(".releaseDigest") == releaseDigest
                && refresh.readUint(".chainId") == rel.readUint(".chainId")
                && refresh.readUint(".blockNumber") == rel.readUint(".blockNumber"),
            "refresh belongs to another release"
        );
        V16ReleaseDigest.Checkpoint memory checkpoint = V16ReleaseDigest.readCheckpoint(
            snap, _readFileOrDie(checkpointPath), refresh.readBytes32(".checkpointSha256")
        );
        require(
            checkpoint.blockNumber == refresh.readUint(".checkpointBlockNumber")
                && checkpoint.blockHash == refresh.readBytes32(".checkpointBlockHash"),
            "checkpoint differs from the refresh"
        );
        require(checkpoint.blockNumber > rel.readUint(".checkpointBlockNumber"), "refresh not after the record");

        bytes32 digest = V16ReleaseDigest.refreshDigest(releaseDigest, checkpoint);
        require(digest == refresh.readBytes32(".digest"), "refresh digest mismatch");
        address signer = refresh.readAddress(".signer");
        require(signer != address(0), "zero signer");
        require(
            ecrecover(digest, uint8(refresh.readUint(".v")), refresh.readBytes32(".r"), refresh.readBytes32(".s"))
                == signer,
            "signature mismatch"
        );
        require(signer == rel.readAddress(".signer") && signer == snap.readAddress(".releaseSigner"), "signer mismatch");
        require(signer == vm.envAddress("RELEASE_SIGNER"), "release signer not trusted");

        console2.log("OK v1.6 checkpoint refresh verified");
        console2.log("refresh:", refreshPath);
        console2.log("checkpoint:", checkpointPath);
        console2.log("checkpoint block:", checkpoint.blockNumber);
        console2.log("checkpoint sha256:", vm.toString(checkpoint.sha256));
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
