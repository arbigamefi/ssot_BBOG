// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

/// @notice Verifies a v1.5 release digest + signature against a router/pool snapshot.
contract VerifyReleaseV15 is Script {
    using stdJson for string;

    bytes32 internal constant SCHEMA = keccak256("SSOT_RELEASE_DIGEST_V15");

    function run() external view {
        string memory releasePath = vm.envOr("RELEASE_PATH", string("deployments/release-latest-v15.json"));
        string memory rel = _readFileOrDie(releasePath);

        string memory snapshotPathFromRel = rel.readString(".snapshotPath");
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", snapshotPathFromRel);
        string memory snap = _readFileOrDie(snapshotPath);

        bytes32 schemaHash = rel.readBytes32(".schemaHash");
        require(schemaHash == SCHEMA, "schema mismatch");

        bytes32 digestExpected = rel.readBytes32(".digest");
        address signerExpected = rel.readAddress(".signer");
        uint8 v = uint8(rel.readUint(".v"));
        bytes32 r = rel.readBytes32(".r");
        bytes32 s = rel.readBytes32(".s");

        uint256 numPools = snap.readUint(".numPools");
        require(numPools >= 1 && numPools <= 32, "numPools out of range");

        bytes32 digestActual = _digestStatic(snap);
        digestActual = _digestPools(digestActual, snap, numPools);
        require(digestActual == digestExpected, "digest mismatch");

        address recovered = ecrecover(digestActual, v, r, s);
        require(signerExpected != address(0), "zero signer");
        require(recovered == signerExpected, "signature mismatch");
        require(signerExpected == snap.readAddress(".releaseSigner"), "snapshot signer mismatch");
        require(signerExpected == vm.envAddress("RELEASE_SIGNER"), "release signer not trusted");
        require(rel.readUint(".chainId") == snap.readUint(".chainId"), "release chain mismatch");
        require(rel.readUint(".blockNumber") == snap.readUint(".blockNumber"), "release block mismatch");

        console2.log("OK v1.5 release artifact verified");
        console2.log("release:", releasePath);
        console2.log("snapshot:", snapshotPath);
        console2.log("signer:", signerExpected);
        console2.log("digest:", vm.toString(digestActual));
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
            require(bytes(contents).length != 0, "file empty");
            return contents;
        } catch {
            revert(string.concat("missing file: ", path));
        }
    }
}
