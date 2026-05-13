// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";

/// @notice Generates Markdown release notes for v1.3 router/pool deployment snapshots.
contract GenerateReleaseNotesV13 is Script {
    using stdJson for string;

    function run() external {
        vm.createDir("deployments/release", true);

        string memory releasePath = vm.envOr("RELEASE_PATH", string("deployments/release-latest-v13.json"));
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v13.json"));
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

        if (bytes(tagName).length == 0) {
            tagName = string.concat("chain-", vm.toString(chainId), "-", vm.toString(blockNumber), "-v13");
        }

        string memory md = _header(tagName, chainId, blockNumber, snap);
        md = string.concat(md, _releaseLock(digest, signer, v, r, s, snapshotPath, releasePath));
        md = string.concat(md, _coreContracts(snap));
        md = string.concat(md, _gameModules(snap));
        md = string.concat(md, _keyParameters(snap));
        md = string.concat(md, _pools(snap));
        md = string.concat(
            md,
            "\n## Verification\n\n",
            "- Verify release lock locally (offline): `make release-verify-v13`\n",
            "- Generate v1.3 frontend manifest: `make release-frontend-manifest-v13`\n",
            "- Generate v1.3 golden vectors: `make release-golden-vectors-v13`\n",
            "- Package artifacts: `make release-package-v13`\n"
        );

        string memory outLatest = "deployments/release-notes-latest-v13.md";
        string memory out = string.concat(
            "deployments/release/release-notes-", vm.toString(chainId), "-", vm.toString(blockNumber), "-v13.md"
        );
        vm.writeFile(outLatest, md);
        vm.writeFile(out, md);
    }

    function _header(string memory tagName, uint256 chainId, uint256 blockNumber, string memory snap)
        internal
        pure
        returns (string memory)
    {
        return string.concat(
            "# ",
            tagName,
            "\n\n",
            "**Architecture**: `",
            snap.readString(".architectureVersion"),
            "`\n\n",
            "**Chain**: ",
            vm.toString(chainId),
            "\n\n",
            "**Deployed at block**: ",
            vm.toString(blockNumber),
            "\n\n",
            "**Timestamp**: ",
            vm.toString(snap.readUint(".timestamp")),
            "\n\n"
        );
    }

    function _releaseLock(
        bytes32 digest,
        address signer,
        uint256 v,
        bytes32 r,
        bytes32 s,
        string memory snapshotPath,
        string memory releasePath
    ) internal pure returns (string memory) {
        return string.concat(
            "## Release lock (v1.3 params digest)\n\n",
            "- **Digest**: `",
            vm.toString(digest),
            "`\n",
            "- **Signer**: `",
            vm.toString(signer),
            "`\n",
            "- **Signature**: v=",
            vm.toString(v),
            ", r=`",
            vm.toString(r),
            "`, s=`",
            vm.toString(s),
            "`\n\n",
            "Artifacts:\n",
            "- Snapshot: `",
            snapshotPath,
            "`\n",
            "- Release lock: `",
            releasePath,
            "`\n\n"
        );
    }

    function _coreContracts(string memory snap) internal pure returns (string memory) {
        return string.concat(
            "## Core contracts\n\n",
            "- GOV: `",
            vm.toString(snap.readAddress(".gov")),
            "`\n",
            "- Treasury: `",
            vm.toString(snap.readAddress(".treasury")),
            "`\n",
            "- VRF Wrapper: `",
            vm.toString(snap.readAddress(".vrfWrapper")),
            "`\n",
            "- Adapter: `",
            vm.toString(snap.readAddress(".adapter")),
            "`\n",
            "- VRFHub: `",
            vm.toString(snap.readAddress(".vrfHub")),
            "`\n",
            "- PoolRegistry: `",
            vm.toString(snap.readAddress(".poolRegistry")),
            "`\n",
            "- SettlementRouter: `",
            vm.toString(snap.readAddress(".settlementRouter")),
            "`\n",
            "- GameHub: `",
            vm.toString(snap.readAddress(".gameHub")),
            "`\n",
            "- SportsRiskEngine: `",
            vm.toString(snap.readAddress(".sportsRiskEngine")),
            "`\n",
            "- SportsHub: `",
            vm.toString(snap.readAddress(".sportsHub")),
            "`\n",
            "- ReferralRegistry: `",
            vm.toString(snap.readAddress(".refRegistry")),
            "`\n",
            "- ReferralEngine: `",
            vm.toString(snap.readAddress(".refEngine")),
            "`\n\n"
        );
    }

    function _gameModules(string memory snap) internal pure returns (string memory) {
        return string.concat(
            "## Game modules\n\n",
            "- Dice: `",
            vm.toString(snap.readAddress(".moduleDice")),
            "`\n",
            "- CoinToss: `",
            vm.toString(snap.readAddress(".moduleCoinToss")),
            "`\n",
            "- Roulette: `",
            vm.toString(snap.readAddress(".moduleRoulette")),
            "`\n",
            "- Keno: `",
            vm.toString(snap.readAddress(".moduleKeno")),
            "`\n\n"
        );
    }

    function _keyParameters(string memory snap) internal pure returns (string memory) {
        return string.concat(
            "## Key parameters\n\n",
            "- refundTimeoutSeconds: ",
            vm.toString(snap.readUint(".refundTimeoutSeconds")),
            "\n",
            "- defaultHouseEdgeBps: ",
            vm.toString(snap.readUint(".defaultHouseEdgeBps")),
            "\n",
            "- maxAffiliateDeltaBps: ",
            vm.toString(snap.readUint(".maxAffiliateDeltaBps")),
            "\n",
            "- sportsEnabled: ",
            snap.readUint(".sportsEnabled") == 0 ? "false" : "true",
            "\n",
            "- sportsRiskCaps(raw asset units): maxStake=",
            vm.toString(snap.readUint(".sportsMaxStake")),
            ", maxPayout=",
            vm.toString(snap.readUint(".sportsMaxPayout")),
            ", maxMarketReserved=",
            vm.toString(snap.readUint(".sportsMaxMarketReserved")),
            ", maxOutcomeReserved=",
            vm.toString(snap.readUint(".sportsMaxOutcomeReserved")),
            ", maxEventReserved=",
            vm.toString(snap.readUint(".sportsMaxEventReserved")),
            "\n",
            "- sportsOddsSignerSetHash: `",
            vm.toString(snap.readBytes32(".sportsOddsSignerSetHash")),
            "`\n",
            "- sportsResultReporterSetHash: `",
            vm.toString(snap.readBytes32(".sportsResultReporterSetHash")),
            "`",
            "\n\n"
        );
    }

    function _pools(string memory snap) internal pure returns (string memory md) {
        uint256 numPools = snap.readUint(".numPools");
        md = "## Pools\n\n";
        for (uint256 i = 0; i < numPools; i++) {
            string memory suffix = vm.toString(i);
            md = string.concat(
                md,
                "- pool_",
                suffix,
                ": id=",
                vm.toString(snap.readUint(string.concat(".poolId_", suffix))),
                ", domain=",
                _domainLabel(snap.readUint(string.concat(".poolDomain_", suffix))),
                ", asset=`",
                vm.toString(snap.readAddress(string.concat(".poolAsset_", suffix))),
                "`, bank=`",
                vm.toString(snap.readAddress(string.concat(".poolBank_", suffix))),
                "`, active=",
                snap.readUint(string.concat(".poolActive_", suffix)) == 0 ? "false" : "true",
                "\n"
            );
        }
    }

    function _domainLabel(uint256 domainId) internal pure returns (string memory) {
        if (domainId == 1) return "Casino";
        if (domainId == 2) return "Sports";
        if (domainId == 3) return "Future";
        return "Unknown";
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
