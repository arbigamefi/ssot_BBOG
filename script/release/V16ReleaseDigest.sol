// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/StdJson.sol";

/// @notice The v1.6 release digest, shared by signing (ReleaseDigestV16) and verification (VerifyReleaseV16).
///
///         `snapshotDigest` covers every value of the deployment snapshot that release verification relies on: the
///         authority (timelock, its delay, Safe, guardian and their pinned configurations, keeper, signer, deployer),
///         both timelock operation ids, every runtime code hash, address, game admission, parameter and pool.
///         `digest`, the value that is signed, adds the governance checkpoint the signer verified: the block, its hash
///         and the SHA-256 of the replayed authorization state (script/release/verify_governance.py), so later
///         verifications can replay from that block instead of from deployment.
library V16ReleaseDigest {
    using stdJson for string;

    VmSafe private constant vm = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 internal constant SCHEMA = keccak256("SSOT_RELEASE_DIGEST_V16");
    bytes32 internal constant RECORD_SCHEMA = keccak256("SSOT_RELEASE_RECORD_V16");

    struct Checkpoint {
        uint256 blockNumber;
        bytes32 blockHash;
        bytes32 sha256;
    }

    function digest(bytes32 snapshotDigest_, Checkpoint memory checkpoint) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(RECORD_SCHEMA, snapshotDigest_, checkpoint.blockNumber, checkpoint.blockHash, checkpoint.sha256)
        );
    }

    /// The checkpoint file written by verify_governance.py (GOVERNANCE_CHECKPOINT_OUT) for this snapshot. Its SHA-256
    /// is over the canonical JSON document, which the Python verifier recomputes; here the file must belong to the
    /// snapshot's history and name the block the record signs.
    function readCheckpoint(string memory snap, string memory file, bytes32 sha)
        internal
        pure
        returns (Checkpoint memory checkpoint)
    {
        require(sha != bytes32(0), "checkpoint SHA-256 required");
        require(
            keccak256(bytes(file.readString(".schema"))) == keccak256("ARBIGAMEFI_GOVERNANCE_CHECKPOINT_V2"),
            "unsupported governance checkpoint"
        );
        require(
            file.readUint(".chainId") == snap.readUint(".chainId")
                && file.readUint(".historyStart") == snap.readUint(".blockNumber")
                && file.readAddress(".governanceTimelock") == snap.readAddress(".governanceTimelock")
                && file.readAddress(".poolRegistry") == snap.readAddress(".poolRegistry")
                && file.readAddress(".gameHub") == snap.readAddress(".gameHub"),
            "checkpoint belongs to another release"
        );
        checkpoint.blockNumber = file.readUint(".blockNumber");
        checkpoint.blockHash = file.readBytes32(".blockHash");
        require(checkpoint.blockNumber >= snap.readUint(".blockNumber"), "checkpoint before the release history");
        checkpoint.sha256 = sha;
    }

    function snapshotDigest(string memory snap) internal pure returns (bytes32 d) {
        require(
            keccak256(bytes(snap.readString(".architectureVersion"))) == keccak256("v1.6-nft-liquidity"),
            "not a v1.6 snapshot"
        );
        uint256 numPools = snap.readUint(".numPools");
        require(numPools >= 1 && numPools <= 32, "numPools out of range");
        d = keccak256(abi.encode(SCHEMA, keccak256(bytes(snap.readString(".architectureVersion")))));
        d = keccak256(
            abi.encode(
                d,
                snap.readAddress(".governanceTimelock"),
                snap.readUint(".timelockMinDelay"),
                snap.readAddress(".gov"),
                snap.readBytes32(".safeOwnersHash"),
                snap.readBytes32(".safeCodeHash"),
                snap.readBytes32(".safeControlHash")
            )
        );
        d = keccak256(
            abi.encode(
                d,
                snap.readAddress(".guardian"),
                snap.readBytes32(".guardianOwnersHash"),
                snap.readBytes32(".guardianCodeHash"),
                snap.readBytes32(".guardianControlHash"),
                snap.readAddress(".keeper"),
                snap.readAddress(".releaseSigner")
            )
        );
        d = keccak256(
            abi.encode(d, snap.readBytes32(".wiringOperationId"), snap.readBytes32(".activationOperationId"))
        );

        string[15] memory codeKeys = [
            string("governanceTimelock"),
            "vrfHub",
            "poolRegistry",
            "settlementRouter",
            "refRegistry",
            "refEngine",
            "gameHub",
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
            d = keccak256(abi.encode(d, snap.readBytes32(string.concat(".codeHash_", codeKeys[i]))));
        }
        d = keccak256(
            abi.encode(
                d,
                snap.readUint(".chainId"),
                snap.readUint(".blockNumber"),
                snap.readUint(".timestamp"),
                snap.readAddress(".deployer"),
                snap.readAddress(".treasury")
            )
        );

        d = keccak256(abi.encode(d, snap.readAddress(".vrfWrapper"), snap.readAddress(".vrfHub")));

        d = keccak256(
            abi.encode(
                d,
                snap.readAddress(".poolRegistry"),
                snap.readAddress(".settlementRouter"),
                snap.readAddress(".refRegistry"),
                snap.readAddress(".refEngine"),
                snap.readAddress(".gameHub")
            )
        );

        d = keccak256(
            abi.encode(
                d,
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

        d = keccak256(
            abi.encode(
                d,
                snap.readUint(".refundTimeoutSeconds"),
                snap.readUint(".defaultHouseEdgeBps"),
                snap.readUint(".lpShareBps"),
                snap.readUint(".refL0Bps"),
                snap.readUint(".refL1Bps"),
                snap.readUint(".refL2Bps"),
                snap.readUint(".refHoldbackBps"),
                numPools
            )
        );
        string[8] memory games =
            [string("DICE"), "COIN_TOSS", "ROULETTE", "KENO", "PLINKO", "SIC_BO", "SLOTS", "BACCARAT"];
        for (uint256 g; g < games.length; ++g) {
            d = keccak256(
                abi.encode(
                    d,
                    snap.readUint(string.concat(".gameMaxBetCount_", games[g])),
                    snap.readUint(string.concat(".gameCallbackGasLimit_", games[g]))
                )
            );
        }
        for (uint256 i = 0; i < numPools; ++i) {
            d = _pool(d, snap, vm.toString(i));
        }
    }

    function _pool(bytes32 d, string memory snap, string memory suffix) private pure returns (bytes32) {
        d = keccak256(
            abi.encode(
                d,
                snap.readUint(string.concat(".poolId_", suffix)),
                snap.readUint(string.concat(".poolDomain_", suffix)),
                snap.readAddress(string.concat(".poolAsset_", suffix)),
                snap.readAddress(string.concat(".poolBank_", suffix)),
                snap.readBytes32(string.concat(".codeHash_poolBank_", suffix)),
                snap.readAddress(string.concat(".poolVault_", suffix)),
                snap.readBytes32(string.concat(".codeHash_poolVault_", suffix))
            )
        );
        return keccak256(
            abi.encode(
                d,
                snap.readUint(string.concat(".poolBankRiskReserveBps_", suffix)),
                snap.readUint(string.concat(".poolBankMinBetAmount_", suffix)),
                snap.readUint(string.concat(".poolBankWithdrawalBufferBps_", suffix)),
                snap.readUint(string.concat(".poolBankMinTurnoverForUnlock_", suffix)),
                snap.readUint(string.concat(".poolBankHoldbackVestingSeconds_", suffix)),
                snap.readUint(string.concat(".poolAssetDecimals_", suffix)),
                keccak256(bytes(snap.readString(string.concat(".poolAssetSymbol_", suffix))))
            )
        );
    }
}
