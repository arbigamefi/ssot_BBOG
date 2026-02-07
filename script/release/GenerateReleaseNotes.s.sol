// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";

/// @notice Generates a human-friendly Markdown release notes file.
///
/// Goals
/// - Include the canonical release digest ("params digest") in the notes.
/// - Be offline/verifiable: all content is derived from the JSON artifacts.
///
/// Inputs (env)
/// - RELEASE_PATH (default: deployments/release-latest.json)
/// - SNAPSHOT_PATH (default: deployments/latest.json)
/// - TAG_NAME (optional; e.g. v1.12.3)
///
/// Outputs
/// - deployments/release-notes-latest.md
/// - deployments/release/release-notes-<chainId>-<block>.md
contract GenerateReleaseNotes is Script {
    using stdJson for string;

    function run() external {
        vm.createDir("deployments/release", true);

        string memory releasePath = vm.envOr("RELEASE_PATH", string("deployments/release-latest.json"));
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest.json"));
        string memory tagName = vm.envOr("TAG_NAME", string(""));

        string memory rel = _readFileOrDie(releasePath);
        string memory snap = _readFileOrDie(snapshotPath);

        uint256 chainId = rel.readUint(".chainId");
        uint256 blockNumber = rel.readUint(".blockNumber");
        address signer = rel.readAddress(".signer");
        bytes32 digest = rel.readBytes32(".digest");
        uint256 v = rel.readUint(".v");
        bytes32 r = rel.readBytes32(".r");
        bytes32 s = rel.readBytes32(".s");

        uint256 timestamp = snap.readUint(".timestamp");
        address gov = snap.readAddress(".gov");
        address treasury = snap.readAddress(".treasury");
        address vrfWrapper = snap.readAddress(".vrfWrapper");
        address adapter = snap.readAddress(".adapter");
        address vrfHub = snap.readAddress(".vrfHub");
        address hub = snap.readAddress(".hub");

        address bankRegistry = snap.readAddress(".bankRegistry");
        address refRegistry = snap.readAddress(".refRegistry");

        address moduleDice = snap.readAddress(".moduleDice");
        address moduleCoinToss = snap.readAddress(".moduleCoinToss");
        address moduleRoulette = snap.readAddress(".moduleRoulette");
        address moduleKeno = snap.readAddress(".moduleKeno");

        uint256 refundTimeoutSeconds = snap.readUint(".refundTimeoutSeconds");
        uint256 defaultHouseEdgeBps = snap.readUint(".defaultHouseEdgeBps");
        uint256 maxAffiliateDeltaBps = snap.readUint(".maxAffiliateDeltaBps");

        uint256 numAssets = snap.readUint(".numAssets");

        if (bytes(tagName).length == 0) {
            tagName = string.concat("chain-", vm.toString(chainId), "-", vm.toString(blockNumber));
        }

        string memory md;
        md = string.concat(
            "# ",
            tagName,
            "\n\n",
            "**Chain**: ", vm.toString(chainId), "\n\n",
            "**Deployed at block**: ", vm.toString(blockNumber), "\n\n",
            "**Timestamp**: ", vm.toString(timestamp), "\n\n",
            "## Release lock (params digest)\n\n",
            "- **Digest**: `", vm.toString(digest), "`\n",
            "- **Signer**: `", vm.toString(signer), "`\n",
            "- **Signature**: v=", vm.toString(v), ", r=`", vm.toString(r), "`, s=`", vm.toString(s), "`\n\n",
            "Artifacts:\n",
            "- Snapshot: `", snapshotPath, "`\n",
            "- Release lock: `", releasePath, "`\n\n"
        );

        md = string.concat(
            md,
            "## Core contracts\n\n",
            "- GOV: `", vm.toString(gov), "`\n",
            "- Treasury: `", vm.toString(treasury), "`\n",
            "- VRF Wrapper: `", vm.toString(vrfWrapper), "`\n",
            "- Adapter: `", vm.toString(adapter), "`\n",
            "- VRFHub: `", vm.toString(vrfHub), "`\n",
            "- Hub: `", vm.toString(hub), "`\n",
            "- BankRegistry: `", vm.toString(bankRegistry), "`\n",
            "- ReferralRegistry: `", vm.toString(refRegistry), "`\n\n"
        );

        md = string.concat(
            md,
            "## Game modules\n\n",
            "- Dice: `", vm.toString(moduleDice), "`\n",
            "- CoinToss: `", vm.toString(moduleCoinToss), "`\n",
            "- Roulette: `", vm.toString(moduleRoulette), "`\n",
            "- Keno: `", vm.toString(moduleKeno), "`\n\n"
        );

        md = string.concat(
            md,
            "## Key parameters\n\n",
            "- refundTimeoutSeconds: ", vm.toString(refundTimeoutSeconds), "\n",
            "- defaultHouseEdgeBps: ", vm.toString(defaultHouseEdgeBps), "\n",
            "- maxAffiliateDeltaBps: ", vm.toString(maxAffiliateDeltaBps), "\n\n"
        );

        md = string.concat(md, "## Assets & banks\n\n");
        for (uint256 i = 0; i < numAssets; i++) {
            string memory suffix = vm.toString(i);
            address asset = snap.readAddress(string.concat(".asset_", suffix));
            address bank = snap.readAddress(string.concat(".bank_", suffix));
            md = string.concat(
                md,
                // NOTE: keep release notes ASCII-only to avoid Solidity string-literal unicode parsing issues
                "- asset_", suffix, ": `", vm.toString(asset), "`  -> bank_", suffix, ": `", vm.toString(bank), "`\n"
            );
        }

        md = string.concat(
            md,
            "\n## Verification\n\n",
            "- Verify release lock locally (offline): `make release-verify`\n",
            "- Verify contracts on explorer: `make verify` (requires ETHERSCAN_API_KEY)\n",
            "- Package artifacts: `make release-package`\n"
        );

        string memory outLatest = "deployments/release-notes-latest.md";
        string memory out = string.concat("deployments/release/release-notes-", vm.toString(chainId), "-", vm.toString(blockNumber), ".md");
        vm.writeFile(outLatest, md);
        vm.writeFile(out, md);
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
