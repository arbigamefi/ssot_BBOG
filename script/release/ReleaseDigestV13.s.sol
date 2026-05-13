// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

/// @notice Computes and signs a deterministic v1.3 release digest for router/pool snapshots.
///
/// Inputs:
/// - SNAPSHOT_PATH (default: deployments/latest-v13.json)
/// - SIGNER_PRIVATE_KEY (optional; fallback to PRIVATE_KEY)
/// - GOV (optional; if set, require signer == GOV)
///
/// Outputs:
/// - deployments/release-latest-v13.json
/// - deployments/release/release-<chain>-<block>-v13.json
contract ReleaseDigestV13 is Script {
    using stdJson for string;

    bytes32 internal constant SCHEMA = keccak256("SSOT_RELEASE_DIGEST_V13");

    function run() external {
        vm.createDir("deployments/release", true);

        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v13.json"));
        string memory snap = _readFileOrDie(snapshotPath);

        uint256 chainId = snap.readUint(".chainId");
        uint256 blockNumber = snap.readUint(".blockNumber");
        uint256 numPools = snap.readUint(".numPools");
        require(numPools >= 1 && numPools <= 32, "numPools out of range");

        bytes32 digest = _digestStatic(snap);
        digest = _digestPools(digest, snap, numPools);

        uint256 pk = vm.envOr("SIGNER_PRIVATE_KEY", uint256(0));
        if (pk == 0) pk = vm.envUint("PRIVATE_KEY");
        address signer = vm.addr(pk);

        address govEnv = vm.envOr("GOV", address(0));
        if (govEnv != address(0)) {
            require(signer == govEnv, "SIGNER_PRIVATE_KEY must correspond to GOV");
        }

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        require(ecrecover(digest, v, r, s) == signer, "bad signature");

        string memory obj = "release";
        string memory json;

        json = vm.serializeString(obj, "schema", "SSOT_RELEASE_DIGEST_V13");
        json = vm.serializeBytes32(obj, "schemaHash", SCHEMA);
        json = vm.serializeString(obj, "snapshotPath", snapshotPath);
        json = vm.serializeUint(obj, "chainId", chainId);
        json = vm.serializeUint(obj, "blockNumber", blockNumber);
        json = vm.serializeAddress(obj, "signer", signer);
        json = vm.serializeBytes32(obj, "digest", digest);
        json = vm.serializeUint(obj, "v", v);
        json = vm.serializeBytes32(obj, "r", r);
        json = vm.serializeBytes32(obj, "s", s);

        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber), "-v13");
        string memory outPath = string.concat("deployments/release/release-", tag, ".json");

        vm.writeJson(json, outPath);
        vm.writeJson(json, "deployments/release-latest-v13.json");

        console2.log("snapshot:", snapshotPath);
        console2.log("digest:", vm.toString(digest));
        console2.log("signer:", signer);
        console2.log("wrote:", outPath);
        console2.log("wrote:", "deployments/release-latest-v13.json");
    }

    function _digestStatic(string memory snap) internal pure returns (bytes32 digest) {
        digest = keccak256(abi.encode(SCHEMA, keccak256(bytes(snap.readString(".architectureVersion")))));

        digest = keccak256(
            abi.encode(
                digest,
                snap.readUint(".chainId"),
                snap.readUint(".blockNumber"),
                snap.readUint(".timestamp"),
                snap.readAddress(".deployer"),
                snap.readAddress(".gov"),
                snap.readAddress(".treasury")
            )
        );

        digest = keccak256(
            abi.encode(
                digest,
                snap.readAddress(".vrfWrapper"),
                snap.readAddress(".adapter"),
                snap.readAddress(".vrfHub"),
                snap.readUint(".requestGasPriceWei")
            )
        );

        digest = keccak256(
            abi.encode(
                digest,
                snap.readAddress(".poolRegistry"),
                snap.readAddress(".settlementRouter"),
                snap.readAddress(".refRegistry"),
                snap.readAddress(".refEngine"),
                snap.readAddress(".gameHub"),
                snap.readAddress(".sportsRiskEngine"),
                snap.readAddress(".sportsHub")
            )
        );

        digest = keccak256(
            abi.encode(
                digest,
                snap.readAddress(".moduleDice"),
                snap.readAddress(".moduleCoinToss"),
                snap.readAddress(".moduleRoulette"),
                snap.readAddress(".moduleKeno"),
                snap.readAddress(".modulePlinko"),
                snap.readAddress(".moduleSlots"),
                snap.readAddress(".moduleBaccarat")
            )
        );

        digest = keccak256(
            abi.encode(
                digest,
                snap.readUint(".refundTimeoutSeconds"),
                snap.readUint(".defaultHouseEdgeBps"),
                snap.readUint(".maxAffiliateDeltaBps"),
                snap.readUint(".refBaseBudgetBps"),
                snap.readUint(".refDeltaBudgetBps"),
                snap.readUint(".refHoldbackBps"),
                snap.readUint(".refLevels")
            )
        );

        digest = keccak256(
            abi.encode(
                digest,
                snap.readUint(".refLevel0Bps"),
                snap.readUint(".refLevel1Bps"),
                snap.readUint(".refLevel2Bps"),
                snap.readUint(".refLevel3Bps"),
                snap.readUint(".refLevel4Bps"),
                snap.readUint(".refLevel5Bps"),
                snap.readUint(".sportsEnabled"),
                snap.readUint(".sportsMaxStake"),
                snap.readUint(".sportsMaxPayout"),
                snap.readUint(".sportsMaxMarketReserved")
            )
        );

        digest = keccak256(
            abi.encode(
                digest,
                snap.readUint(".sportsMaxOutcomeReserved"),
                snap.readUint(".sportsMaxEventReserved"),
                snap.readBytes32(".sportsOddsSignerSetHash"),
                snap.readBytes32(".sportsResultReporterSetHash"),
                snap.readUint(".sportsResultReporterThreshold"),
                snap.readAddress(".sportsOddsSigner"),
                snap.readAddress(".sportsResultReporter"),
                snap.readAddress(".sportsResultChallenger"),
                snap.readAddress(".sportsResultArbitrator"),
                snap.readUint(".numPools")
            )
        );
    }

    function _digestPools(bytes32 digest, string memory snap, uint256 numPools) internal pure returns (bytes32) {
        for (uint256 i = 0; i < numPools; ++i) {
            string memory suffix = vm.toString(i);
            digest = keccak256(
                abi.encode(
                    digest,
                    snap.readUint(string.concat(".poolId_", suffix)),
                    snap.readUint(string.concat(".poolDomain_", suffix)),
                    snap.readAddress(string.concat(".poolAsset_", suffix)),
                    snap.readAddress(string.concat(".poolBank_", suffix)),
                    snap.readUint(string.concat(".poolActive_", suffix))
                )
            );

            digest = keccak256(
                abi.encode(
                    digest,
                    snap.readUint(string.concat(".bankMinLiqBps_", suffix)),
                    snap.readUint(string.concat(".bankMinTurnoverForUnlock_", suffix)),
                    snap.readUint(string.concat(".bankHoldbackVestingSeconds_", suffix)),
                    keccak256(bytes(snap.readString(string.concat(".lpName_", suffix)))),
                    keccak256(bytes(snap.readString(string.concat(".lpSymbol_", suffix)))),
                    snap.readUint(string.concat(".lpDecimals_", suffix))
                )
            );

            digest = keccak256(
                abi.encode(
                    digest,
                    snap.readUint(string.concat(".poolSportsMaxStake_", suffix)),
                    snap.readUint(string.concat(".poolSportsMaxPayout_", suffix)),
                    snap.readUint(string.concat(".poolSportsMaxMarketReserved_", suffix)),
                    snap.readUint(string.concat(".poolSportsMaxOutcomeReserved_", suffix)),
                    snap.readUint(string.concat(".poolSportsMaxEventReserved_", suffix)),
                    snap.readBytes32(string.concat(".poolSportsRiskHash_", suffix))
                )
            );
        }
        return digest;
    }

    function _readFileOrDie(string memory path) internal view returns (string memory) {
        try vm.readFile(path) returns (string memory contents) {
            require(bytes(contents).length != 0, "snapshot file empty");
            return contents;
        } catch {
            revert(string.concat("missing snapshot file: ", path));
        }
    }
}
