// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

/// @notice Computes and signs a deterministic v1.5 release digest for router/pool snapshots.
///
/// Inputs:
/// - SNAPSHOT_PATH (default: deployments/latest-v15.json)
/// - Foundry unlocked keystore or hardware signer supplied with --account/--ledger
/// - RELEASE_SIGNER (required independent metadata trust anchor; governance is the Safe)
///
/// Outputs:
/// - deployments/release-latest-v15.json
/// - deployments/release/release-<chain>-<block>-v15.json
contract ReleaseDigestV15 is Script {
    using stdJson for string;

    bytes32 internal constant SCHEMA = keccak256("SSOT_RELEASE_DIGEST_V15");

    function run() external {
        vm.createDir("deployments/release", true);

        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v15.json"));
        string memory snap = _readFileOrDie(snapshotPath);

        uint256 chainId = snap.readUint(".chainId");
        uint256 blockNumber = snap.readUint(".blockNumber");
        uint256 numPools = snap.readUint(".numPools");
        require(numPools >= 1 && numPools <= 32, "numPools out of range");

        bytes32 digest = _digestStatic(snap);
        digest = _digestPools(digest, snap, numPools);

        address signer = vm.envAddress("RELEASE_SIGNER");
        require(signer == snap.readAddress(".releaseSigner"), "release signer mismatch");
        // Foundry resolves this address only from explicitly supplied unlocked wallets.
        // No raw key is read into the script environment or embedded into traces.
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signer, digest);
        require(ecrecover(digest, v, r, s) == signer, "bad signature");

        string memory obj = "release";
        string memory json;

        json = vm.serializeString(obj, "schema", "SSOT_RELEASE_DIGEST_V15");
        json = vm.serializeBytes32(obj, "schemaHash", SCHEMA);
        json = vm.serializeString(obj, "snapshotPath", snapshotPath);
        json = vm.serializeUint(obj, "chainId", chainId);
        json = vm.serializeUint(obj, "blockNumber", blockNumber);
        json = vm.serializeAddress(obj, "signer", signer);
        json = vm.serializeBytes32(obj, "digest", digest);
        json = vm.serializeUint(obj, "v", v);
        json = vm.serializeBytes32(obj, "r", r);
        json = vm.serializeBytes32(obj, "s", s);

        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber), "-v15");
        string memory outPath = string.concat("deployments/release/release-", tag, ".json");

        vm.writeJson(json, outPath);
        vm.writeJson(json, "deployments/release-latest-v15.json");

        console2.log("snapshot:", snapshotPath);
        console2.log("digest:", vm.toString(digest));
        console2.log("signer:", signer);
        console2.log("wrote:", outPath);
        console2.log("wrote:", "deployments/release-latest-v15.json");
    }

    function _digestStatic(string memory snap) internal pure returns (bytes32 digest) {
        require(
            keccak256(bytes(snap.readString(".architectureVersion"))) == keccak256("v1.5-safe-governance"),
            "not a v1.5 snapshot"
        );
        digest = keccak256(abi.encode(SCHEMA, keccak256(bytes(snap.readString(".architectureVersion")))));
        digest = keccak256(
            abi.encode(
                digest,
                snap.readAddress(".bootstrapGovernance"),
                snap.readAddress(".guardian"),
                snap.readAddress(".keeper"),
                snap.readAddress(".releaseSigner"),
                snap.readBytes32(".safeOwnersHash"),
                snap.readBytes32(".safeCodeHash"),
                snap.readBytes32(".safeControlHash"),
                snap.readBool(".initialRiskInPaused"),
                keccak256(bytes(snap.readString(".bootstrapStatus")))
            )
        );

        string[17] memory codeKeys = [
            string("adapter"),
            "vrfHub",
            "poolRegistry",
            "settlementRouter",
            "refRegistry",
            "refEngine",
            "gameHub",
            "sportsRiskEngine",
            "sportsHub",
            "moduleDice",
            "moduleCoinToss",
            "moduleRoulette",
            "moduleKeno",
            "modulePlinko",
            "moduleSicBo",
            "moduleSlots",
            "moduleBaccarat"
        ];
        for (uint256 i; i < codeKeys.length; ++i) {
            digest = keccak256(abi.encode(digest, snap.readBytes32(string.concat(".codeHash_", codeKeys[i]))));
        }
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
                snap.readAddress(".moduleSicBo"),
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
                snap.readUint(".lpShareBps"),
                snap.readUint(".refL0Bps"),
                snap.readUint(".refL1Bps"),
                snap.readUint(".refL2Bps")
            )
        );

        digest = keccak256(
            abi.encode(
                digest,
                snap.readUint(".refHoldbackBps"),
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
                snap.readUint(".sportsResultChallengeTimeoutSeconds"),
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
                    snap.readBytes32(string.concat(".codeHash_poolBank_", suffix)),
                    snap.readUint(string.concat(".poolActive_", suffix))
                )
            );

            digest = keccak256(
                abi.encode(
                    digest,
                    snap.readUint(string.concat(".poolBankMinLiqBps_", suffix)),
                    snap.readUint(string.concat(".poolBankRiskReserveBps_", suffix)),
                    snap.readUint(string.concat(".poolBankWithdrawalBufferBps_", suffix)),
                    snap.readUint(string.concat(".poolBankMinTurnoverForUnlock_", suffix)),
                    snap.readUint(string.concat(".poolBankHoldbackVestingSeconds_", suffix)),
                    keccak256(bytes(snap.readString(string.concat(".poolLpName_", suffix)))),
                    keccak256(bytes(snap.readString(string.concat(".poolLpSymbol_", suffix)))),
                    snap.readUint(string.concat(".poolLpDecimals_", suffix))
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
