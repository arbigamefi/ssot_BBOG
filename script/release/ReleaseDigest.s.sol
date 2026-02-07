// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

/// @notice Computes and signs a deterministic "release digest" for a deployment snapshot.
///
/// Rationale
/// - The deployment snapshot JSON (deployments/deploy-<chain>-<block>.json) is the human/audit artifact.
/// - This script produces a canonical digest derived from parsed snapshot fields (order-stable, whitespace-independent).
/// - The digest can be signed (using a private key) to make the deployment parameters tamper-evident.
///
/// Outputs
/// - deployments/release-<chain>-<block>.json
/// - deployments/release-latest.json
///
/// Environment
/// - SNAPSHOT_PATH (default: deployments/latest.json)
/// - SIGNER_PRIVATE_KEY (optional; fallback to PRIVATE_KEY)
/// - GOV (optional; if set, require signer == GOV)
contract ReleaseDigest is Script {
    using stdJson for string;

    bytes32 internal constant SCHEMA = keccak256("SSOT_RELEASE_DIGEST_V1");

    function run() external {
        vm.createDir("deployments/release", true);

        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest.json"));
        string memory snap = _readFileOrDie(snapshotPath);

        // --- parse required fields ---
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

        // --- build canonical digest ---
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

        bytes32 digest = keccak256(enc);

        // --- sign digest ---
        uint256 pk = vm.envOr("SIGNER_PRIVATE_KEY", uint256(0));
        if (pk == 0) pk = vm.envUint("PRIVATE_KEY");
        address signer = vm.addr(pk);

        // optional: enforce signer == GOV
        address govEnv = vm.envOr("GOV", address(0));
        if (govEnv != address(0)) {
            require(signer == govEnv, "SIGNER_PRIVATE_KEY must correspond to GOV");
        }

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        address recovered = ecrecover(digest, v, r, s);
        require(recovered == signer, "bad signature");

        // --- write release json ---
        string memory obj = "release";
        string memory json;

        json = vm.serializeString(obj, "schema", "SSOT_RELEASE_DIGEST_V1");
        json = vm.serializeBytes32(obj, "schemaHash", SCHEMA);
        json = vm.serializeString(obj, "snapshotPath", snapshotPath);
        json = vm.serializeUint(obj, "chainId", chainId);
        json = vm.serializeUint(obj, "blockNumber", blockNumber);
        json = vm.serializeAddress(obj, "signer", signer);
        json = vm.serializeBytes32(obj, "digest", digest);
        json = vm.serializeUint(obj, "v", v);
        json = vm.serializeBytes32(obj, "r", r);
        json = vm.serializeBytes32(obj, "s", s);

        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber));
        // Legacy path (kept for backwards compatibility)
        string memory outPathLegacy = string.concat("deployments/release-", tag, ".json");
        // Convention path
        string memory outPath = string.concat("deployments/release/release-", tag, ".json");

        vm.writeJson(json, outPathLegacy);
        vm.writeJson(json, outPath);
        vm.writeJson(json, "deployments/release-latest.json");

        console2.log("snapshot:", snapshotPath);
        console2.log("digest:", vm.toString(digest));
        console2.log("signer:", signer);
        console2.log("wrote (legacy):", outPathLegacy);
        console2.log("wrote:", outPath);
        console2.log("wrote:", "deployments/release-latest.json");
    }

    function _readFileOrDie(string memory path) internal view returns (string memory) {
        // vm.readFile reverts if missing.
        try vm.readFile(path) returns (string memory contents) {
            require(bytes(contents).length != 0, "snapshot file empty");
            return contents;
        } catch {
            revert(string.concat("missing snapshot file: ", path));
        }
    }
}
