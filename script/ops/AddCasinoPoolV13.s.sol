// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";
import {VmSafe} from "forge-std/Vm.sol";

import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

interface IERC20MetadataAddPoolV13 {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

/// @notice Incrementally adds one casino bankroll pool to an existing v1.3 deployment.
/// @dev This intentionally does not redeploy GameHub, Router, Registry, VRF, modules, or referrals.
///
/// Required env:
///   PRIVATE_KEY
///   ADD_POOL_ID
///   ADD_POOL_ASSET
///
/// Optional env:
///   SNAPSHOT_PATH defaults to deployments/latest-v13.json
///   GOV / POOL_REGISTRY / SETTLEMENT_ROUTER / GAME_HUB override snapshot addresses
///   ADD_BANK_MIN_LIQ_BPS default 1000
///   ADD_BANK_MIN_TURNOVER_FOR_UNLOCK default 20 ether
///   ADD_BANK_HOLDBACK_VESTING_SECONDS default 86400
///   ADD_LP_NAME / ADD_LP_SYMBOL / ADD_LP_DECIMALS
///   VERIFIER_URL overrides chain default in generated verify script
///
/// Example:
///   source .env.base-mainnet-v13-casino
///   ADD_POOL_ID=2 ADD_POOL_ASSET=0x4200000000000000000000000000000000000006 \
///   ADD_LP_NAME="LP WETH Casino" ADD_LP_SYMBOL="lpWETH-C" ADD_LP_DECIMALS=18 \
///   forge script script/ops/AddCasinoPoolV13.s.sol:AddCasinoPoolV13 --rpc-url "$RPC_URL" --broadcast -vvv
contract AddCasinoPoolV13 is Script {
    using stdJson for string;

    string internal constant DEFAULT_SNAPSHOT_PATH = "deployments/latest-v13.json";
    string internal constant OUT_LATEST = "deployments/pool-add-latest-v13.json";
    string internal constant VERIFY_LATEST = "deployments/verify-pool-add-latest-v13.sh";

    struct AddPoolConfig {
        string snapshotPath;
        uint256 privateKey;
        address broadcaster;
        address gov;
        PoolRegistry poolRegistry;
        SettlementRouter router;
        GameHub gameHub;
        uint64 poolId;
        address asset;
        uint16 minLiqBps;
        uint256 minTurnoverForUnlock;
        uint256 holdbackVestingSeconds;
        string lpName;
        string lpSymbol;
        uint8 lpDecimals;
    }

    function run() external {
        AddPoolConfig memory cfg = _readConfig();

        console2.log("snapshot:", cfg.snapshotPath);
        console2.log("broadcaster:", cfg.broadcaster);
        console2.log("gov:", cfg.gov);
        console2.log("poolRegistry:", address(cfg.poolRegistry));
        console2.log("settlementRouter:", address(cfg.router));
        console2.log("gameHub:", address(cfg.gameHub));
        console2.log("poolId:", cfg.poolId);
        console2.log("asset:", cfg.asset);
        console2.log("lpName:", cfg.lpName);
        console2.log("lpSymbol:", cfg.lpSymbol);
        console2.log("lpDecimals:", cfg.lpDecimals);

        _preflight(cfg);

        vm.startBroadcast(cfg.privateKey);
        Bank bank = new Bank(cfg.asset, cfg.gov, cfg.minLiqBps, cfg.lpName, cfg.lpSymbol, cfg.lpDecimals);
        cfg.poolRegistry.registerPool(cfg.poolId, cfg.asset, address(bank), SSOTTypes.PoolDomain.Casino);
        bank.setSettlementRouterOnce(address(cfg.router));
        bank.setMinPlayerTurnoverForUnlock(cfg.minTurnoverForUnlock);
        bank.setHoldbackVestingSeconds(cfg.holdbackVestingSeconds);
        cfg.poolRegistry.setHubAllowedForPool(cfg.poolId, address(cfg.gameHub), true);
        vm.stopBroadcast();

        _postflight(cfg, bank);
        bool wroteArtifacts = _shouldWriteArtifacts();
        if (wroteArtifacts) {
            _writeArtifacts(cfg, bank);
        } else {
            console2.log("Skipping pool-add artifact writes during dry run.");
            console2.log("Set WRITE_DRY_RUN_ARTIFACTS=true to write simulated artifacts intentionally.");
        }

        console2.log("poolBank:", address(bank));
        if (wroteArtifacts) {
            console2.log("wrote:", OUT_LATEST);
            console2.log("wrote:", VERIFY_LATEST);
        }
    }

    function _readConfig() internal view returns (AddPoolConfig memory cfg) {
        cfg.snapshotPath = vm.envOr("SNAPSHOT_PATH", DEFAULT_SNAPSHOT_PATH);
        string memory snap = vm.readFile(cfg.snapshotPath);

        cfg.privateKey = vm.envUint("PRIVATE_KEY");
        cfg.broadcaster = vm.addr(cfg.privateKey);
        cfg.gov = vm.envOr("GOV", address(0));
        if (cfg.gov == address(0)) cfg.gov = snap.readAddress(".gov");

        address poolRegistryAddr = vm.envOr("POOL_REGISTRY", address(0));
        if (poolRegistryAddr == address(0)) poolRegistryAddr = snap.readAddress(".poolRegistry");
        cfg.poolRegistry = PoolRegistry(poolRegistryAddr);

        address routerAddr = vm.envOr("SETTLEMENT_ROUTER", address(0));
        if (routerAddr == address(0)) routerAddr = snap.readAddress(".settlementRouter");
        cfg.router = SettlementRouter(routerAddr);

        address gameHubAddr = vm.envOr("GAME_HUB", address(0));
        if (gameHubAddr == address(0)) gameHubAddr = snap.readAddress(".gameHub");
        cfg.gameHub = GameHub(gameHubAddr);

        cfg.poolId = uint64(vm.envUint("ADD_POOL_ID"));
        cfg.asset = vm.envAddress("ADD_POOL_ASSET");
        cfg.minLiqBps = uint16(vm.envOr("ADD_BANK_MIN_LIQ_BPS", uint256(1000)));
        cfg.minTurnoverForUnlock = vm.envOr("ADD_BANK_MIN_TURNOVER_FOR_UNLOCK", uint256(20 ether));
        cfg.holdbackVestingSeconds = vm.envOr("ADD_BANK_HOLDBACK_VESTING_SECONDS", uint256(86400));

        (string memory assetSymbol, uint8 assetDecimals) = _tryAssetMetadata(cfg.asset);
        cfg.lpName = vm.envOr("ADD_LP_NAME", string.concat("LP ", assetSymbol, " Casino"));
        cfg.lpSymbol = vm.envOr("ADD_LP_SYMBOL", string.concat("lp", assetSymbol, "-C"));
        cfg.lpDecimals = uint8(vm.envOr("ADD_LP_DECIMALS", uint256(assetDecimals)));
    }

    function _preflight(AddPoolConfig memory cfg) internal view {
        require(cfg.broadcaster == cfg.gov, "PRIVATE_KEY is not GOV");
        require(cfg.poolId != 0, "ADD_POOL_ID required");
        require(cfg.asset != address(0), "ADD_POOL_ASSET required");
        require(address(cfg.poolRegistry) != address(0), "PoolRegistry required");
        require(address(cfg.router) != address(0), "SettlementRouter required");
        require(address(cfg.gameHub) != address(0), "GameHub required");
        require(cfg.minLiqBps <= 10_000, "bad minLiqBps");

        require(address(cfg.router.poolRegistry()) == address(cfg.poolRegistry), "router registry mismatch");
        require(cfg.poolRegistry.isRegisteredHub(address(cfg.gameHub)), "GameHub not registered");

        try cfg.poolRegistry.bankFor(cfg.poolId) returns (address) {
            revert("pool already registered");
        } catch {}
    }

    function _postflight(AddPoolConfig memory cfg, Bank bank) internal view {
        require(bank.asset() == cfg.asset, "bank asset mismatch");
        require(bank.settlementRouter() == address(cfg.router), "bank router mismatch");
        require(cfg.poolRegistry.bankFor(cfg.poolId) == address(bank), "registry bank mismatch");
        require(cfg.poolRegistry.assetFor(cfg.poolId) == cfg.asset, "registry asset mismatch");
        require(cfg.poolRegistry.isPoolActive(cfg.poolId), "pool inactive");
        require(cfg.poolRegistry.isHubAllowedForPool(cfg.poolId, address(cfg.gameHub)), "GameHub not allowed");
    }

    function _writeArtifacts(AddPoolConfig memory cfg, Bank bank) internal {
        _safeCreateDir("deployments");

        uint256 chainId = block.chainid;
        uint256 blockNumber = block.number;
        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber), "-v13");
        string memory outTagged = string.concat("deployments/pool-add-", tag, ".json");
        string memory verifyTagged = string.concat("deployments/verify-pool-add-", tag, ".sh");
        (string memory assetSymbol, uint8 assetDecimals) = _tryAssetMetadata(cfg.asset);
        string memory ctorArgs = _bankCtorArgs(cfg);

        string memory obj = "poolAdd";
        string memory json;
        json = vm.serializeString(obj, "schema", "SSOT_CASINO_POOL_ADD_V13");
        json = vm.serializeString(obj, "snapshotPath", cfg.snapshotPath);
        json = vm.serializeUint(obj, "chainId", chainId);
        json = vm.serializeUint(obj, "blockNumber", blockNumber);
        json = vm.serializeUint(obj, "timestamp", block.timestamp);
        json = vm.serializeAddress(obj, "broadcaster", cfg.broadcaster);
        json = vm.serializeAddress(obj, "gov", cfg.gov);
        json = vm.serializeAddress(obj, "poolRegistry", address(cfg.poolRegistry));
        json = vm.serializeAddress(obj, "settlementRouter", address(cfg.router));
        json = vm.serializeAddress(obj, "gameHub", address(cfg.gameHub));
        json = vm.serializeUint(obj, "poolId", cfg.poolId);
        json = vm.serializeUint(obj, "poolDomain", uint256(SSOTTypes.PoolDomain.Casino));
        json = vm.serializeString(obj, "poolDomainLabel", "Casino");
        json = vm.serializeAddress(obj, "poolAsset", cfg.asset);
        json = vm.serializeString(obj, "poolAssetSymbol", assetSymbol);
        json = vm.serializeUint(obj, "poolAssetDecimals", uint256(assetDecimals));
        json = vm.serializeAddress(obj, "poolBank", address(bank));
        json = vm.serializeUint(obj, "poolBankMinLiqBps", cfg.minLiqBps);
        json = vm.serializeUint(obj, "poolBankMinTurnoverForUnlock", cfg.minTurnoverForUnlock);
        json = vm.serializeUint(obj, "poolBankHoldbackVestingSeconds", cfg.holdbackVestingSeconds);
        json = vm.serializeString(obj, "poolLpName", cfg.lpName);
        json = vm.serializeString(obj, "poolLpSymbol", cfg.lpSymbol);
        json = vm.serializeUint(obj, "poolLpDecimals", cfg.lpDecimals);
        json = vm.serializeString(obj, "ctorArgs_bank", ctorArgs);

        _safeWriteJson(json, OUT_LATEST);
        _safeWriteJson(json, outTagged);

        string memory verifyScript = _verifyScript(address(bank), ctorArgs);
        _safeWriteFile(VERIFY_LATEST, verifyScript);
        _safeWriteFile(verifyTagged, verifyScript);
    }

    function _shouldWriteArtifacts() internal view returns (bool) {
        return vm.isContext(VmSafe.ForgeContext.ScriptBroadcast) || vm.envOr("WRITE_DRY_RUN_ARTIFACTS", false);
    }

    function _bankCtorArgs(AddPoolConfig memory cfg) internal pure returns (string memory) {
        return vm.toString(abi.encode(cfg.asset, cfg.gov, cfg.minLiqBps, cfg.lpName, cfg.lpSymbol, cfg.lpDecimals));
    }

    function _verifyScript(address bank, string memory ctorArgs) internal view returns (string memory) {
        string memory verifierUrl = vm.envOr("VERIFIER_URL", string(""));
        if (bytes(verifierUrl).length == 0) verifierUrl = _defaultVerifierUrl(block.chainid);

        string memory sh = "#!/usr/bin/env bash\n";
        sh = string.concat(sh, "set -euo pipefail\n");
        sh = string.concat(sh, "export FOUNDRY_PROFILE=\"${FOUNDRY_PROFILE:-default}\"\n");
        sh = string.concat(
            sh,
            "forge verify-contract --chain-id ",
            vm.toString(block.chainid),
            " --watch --constructor-args ",
            ctorArgs,
            " --etherscan-api-key \"$ETHERSCAN_V2_API_KEY\""
        );
        if (bytes(verifierUrl).length != 0) {
            sh = string.concat(sh, " --verifier-url \"", verifierUrl, "\"");
        }
        sh = string.concat(sh, " ", vm.toString(bank), " src/core/Bank.sol:Bank\n");
        return sh;
    }

    function _tryAssetMetadata(address asset) internal view returns (string memory symbol, uint8 decimals) {
        symbol = "ASSET";
        decimals = 18;
        try IERC20MetadataAddPoolV13(asset).symbol() returns (string memory s) {
            if (bytes(s).length != 0) symbol = s;
        } catch {}
        try IERC20MetadataAddPoolV13(asset).decimals() returns (uint8 d) {
            decimals = d;
        } catch {}
    }

    function _safeCreateDir(string memory path) internal {
        try vm.createDir(path, true) {}
        catch {
            console2.log(string.concat("WARN: cannot create dir (check fs_permissions): ", path));
        }
    }

    function _safeWriteJson(string memory json, string memory path) internal {
        try vm.writeJson(json, path) {}
        catch {
            console2.log(string.concat("WARN: cannot write json (check fs_permissions): ", path));
        }
    }

    function _safeWriteFile(string memory path, string memory data) internal {
        try vm.writeFile(path, data) {}
        catch {
            console2.log(string.concat("WARN: cannot write file (check fs_permissions): ", path));
        }
    }

    function _defaultVerifierUrl(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "https://api.etherscan.io/v2/api?chainid=8453";
        if (chainId == 84532) return "https://api.etherscan.io/v2/api?chainid=84532";
        if (chainId == 42161) return "https://api.etherscan.io/v2/api?chainid=42161";
        if (chainId == 421614) return "https://api.etherscan.io/v2/api?chainid=421614";
        return "";
    }
}
