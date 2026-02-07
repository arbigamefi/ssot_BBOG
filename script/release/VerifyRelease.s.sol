// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

/// @notice Verifies a release artifact (digest + signature) against a deployment snapshot.
///
/// Environment
/// - RELEASE_PATH (default: deployments/release-latest.json)
/// - SNAPSHOT_PATH (optional override; otherwise uses the snapshotPath stored inside the release json)
contract VerifyRelease is Script {
    using stdJson for string;

    bytes32 internal constant SCHEMA = keccak256("SSOT_RELEASE_DIGEST_V1");

    function run() external {
        string memory releasePath = vm.envOr("RELEASE_PATH", string("deployments/release-latest.json"));
        string memory rel = _readFileOrDie(releasePath);

        string memory snapshotPathFromRel = rel.readString(".snapshotPath");
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", snapshotPathFromRel);
        string memory snap = _readFileOrDie(snapshotPath);

        // --- parse release fields ---
        bytes32 schemaHash = rel.readBytes32(".schemaHash");
        require(schemaHash == SCHEMA, "schema mismatch");

        bytes32 digestExpected = rel.readBytes32(".digest");
        address signerExpected = rel.readAddress(".signer");
        uint256 vRaw = rel.readUint(".v");
        uint8 v = uint8(vRaw);
        bytes32 r = rel.readBytes32(".r");
        bytes32 s = rel.readBytes32(".s");

        // --- parse snapshot fields (same as ReleaseDigest) ---
        uint256 chainId = snap.readUint(".chainId");
        uint256 blockNumber = snap.readUint(".blockNumber");
        address deployer = snap.readAddress(".deployer");
        address gov = snap.readAddress(".gov");
        address treasury = snap.readAddress(".treasury");

        address vrfWrapper = snap.readAddress(".vrfWrapper");
        address adapter = snap.readAddress(".adapter");
        address vrfHub = snap.readAddress(".vrfHub");
        uint256 requestGasPriceWei = snap.readUint(".requestGasPriceWei");

        address bankRegistry = snap.readAddress(".bankRegistry");
        address refRegistry = snap.readAddress(".refRegistry");
        address refEngine = snap.readAddress(".refEngine");
        address hub = snap.readAddress(".hub");

        address moduleDice = snap.readAddress(".moduleDice");
        address moduleCoinToss = snap.readAddress(".moduleCoinToss");
        address moduleRoulette = snap.readAddress(".moduleRoulette");
        address moduleKeno = snap.readAddress(".moduleKeno");

        uint256 refundTimeoutSeconds = snap.readUint(".refundTimeoutSeconds");
        uint256 defaultHouseEdgeBps = snap.readUint(".defaultHouseEdgeBps");
        uint256 maxAffiliateDeltaBps = snap.readUint(".maxAffiliateDeltaBps");

        uint256 refBaseBudgetBps = snap.readUint(".refBaseBudgetBps");
        uint256 refDeltaBudgetBps = snap.readUint(".refDeltaBudgetBps");
        uint256 refHoldbackBps = snap.readUint(".refHoldbackBps");
        uint256 refLevels = snap.readUint(".refLevels");

        uint256 refLevel0Bps = snap.readUint(".refLevel0Bps");
        uint256 refLevel1Bps = snap.readUint(".refLevel1Bps");
        uint256 refLevel2Bps = snap.readUint(".refLevel2Bps");
        uint256 refLevel3Bps = snap.readUint(".refLevel3Bps");
        uint256 refLevel4Bps = snap.readUint(".refLevel4Bps");
        uint256 refLevel5Bps = snap.readUint(".refLevel5Bps");

        uint256 numAssets = snap.readUint(".numAssets");
        require(numAssets >= 1 && numAssets <= 16, "numAssets out of range");

        bytes memory enc = abi.encode(
            SCHEMA,
            chainId,
            blockNumber,
            deployer,
            gov,
            treasury,
            vrfWrapper,
            adapter,
            vrfHub,
            requestGasPriceWei,
            bankRegistry,
            refRegistry,
            refEngine,
            hub,
            moduleDice,
            moduleCoinToss,
            moduleRoulette,
            moduleKeno,
            refundTimeoutSeconds,
            defaultHouseEdgeBps,
            maxAffiliateDeltaBps,
            refBaseBudgetBps,
            refDeltaBudgetBps,
            refHoldbackBps,
            refLevels,
            refLevel0Bps,
            refLevel1Bps,
            refLevel2Bps,
            refLevel3Bps,
            refLevel4Bps,
            refLevel5Bps,
            numAssets
        );

        for (uint256 i = 0; i < numAssets; i++) {
            string memory suffix = vm.toString(i);
            address asset = snap.readAddress(string.concat(".asset_", suffix));
            address bank = snap.readAddress(string.concat(".bank_", suffix));
            uint256 bankMinLiqBps = snap.readUint(string.concat(".bankMinLiqBps_", suffix));
            uint256 bankMinTurnoverForUnlock = snap.readUint(string.concat(".bankMinTurnoverForUnlock_", suffix));
            uint256 bankHoldbackVestingSeconds = snap.readUint(string.concat(".bankHoldbackVestingSeconds_", suffix));
            string memory lpName = snap.readString(string.concat(".lpName_", suffix));
            string memory lpSymbol = snap.readString(string.concat(".lpSymbol_", suffix));
            uint256 lpDecimals = snap.readUint(string.concat(".lpDecimals_", suffix));

            enc = bytes.concat(
                enc,
                abi.encode(
                    asset,
                    bank,
                    bankMinLiqBps,
                    bankMinTurnoverForUnlock,
                    bankHoldbackVestingSeconds,
                    keccak256(bytes(lpName)),
                    keccak256(bytes(lpSymbol)),
                    lpDecimals
                )
            );
        }

        bytes32 digestActual = keccak256(enc);
        require(digestActual == digestExpected, "digest mismatch");

        address recovered = ecrecover(digestActual, v, r, s);
        require(recovered == signerExpected, "signature mismatch");

        console2.log("OK release artifact verified");
        console2.log("release:", releasePath);
        console2.log("snapshot:", snapshotPath);
        console2.log("signer:", signerExpected);
        console2.log("digest:", vm.toString(digestActual));
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
