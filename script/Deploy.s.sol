// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {Bank} from "../src/core/Bank.sol";
import {BankRegistry} from "../src/core/BankRegistry.sol";
import {Hub} from "../src/core/Hub.sol";
import {VRFHub} from "../src/core/VRFHub.sol";

import {ReferralRegistry} from "../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../src/engines/referral/DefaultReferralEngine.sol";

import {CoinTossModule} from "../src/modules/cointoss/CoinTossModule.sol";
import {DiceModule} from "../src/modules/dice/DiceModule.sol";
import {RouletteModule} from "../src/modules/roulette/RouletteModule.sol";
import {KenoModule} from "../src/modules/keno/KenoModule.sol";

import {ChainlinkV2PlusWrapperAdapter} from "../src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol";

interface IERC20MetadataLike {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}


/// @notice Deployment script for Milestone 2.5 (real-network readiness).
///
/// This script assumes the deployer EOA is also the governance address (GOV).
/// You can deploy multiple assets by setting NUM_ASSETS and ASSET_0..ASSET_{n-1}.
///
/// Example:
///   export PRIVATE_KEY=...; export GOV=0x...; export VRF_WRAPPER=0x...
///   export NUM_ASSETS=1; export ASSET_0=0x... (ERC20)
///   forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast -vvv
contract Deploy is Script {
    bytes32 internal constant GAME_DICE = keccak256("DICE");
    bytes32 internal constant GAME_COIN = keccak256("COIN_TOSS");
    bytes32 internal constant GAME_ROULETTE = keccak256("ROULETTE");
    bytes32 internal constant GAME_KENO = keccak256("KENO");

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address gov = vm.envAddress("GOV");
        address deployer = vm.addr(pk);
        require(deployer == gov, "PRIVATE_KEY must correspond to GOV");

        address treasury = vm.envOr("TREASURY", address(0));

        address vrfWrapper = vm.envAddress("VRF_WRAPPER");
        uint256 requestGasPriceWei = vm.envOr("REQUEST_GAS_PRICE_WEI", uint256(0));

        uint256 refundTimeoutSeconds = vm.envOr("REFUND_TIMEOUT_SECONDS", uint256(3600));
        uint16 defaultHouseEdgeBps = uint16(vm.envOr("DEFAULT_HOUSE_EDGE_BPS", uint256(200)));
        uint16 maxAffiliateDeltaBps = uint16(vm.envOr("MAX_AFFILIATE_DELTA_BPS", uint256(0)));

        uint16 baseBudgetBps = uint16(vm.envOr("REF_BASE_BUDGET_BPS", uint256(10_000)));
        uint16 deltaBudgetBps = uint16(vm.envOr("REF_DELTA_BUDGET_BPS", uint256(10_000)));
        uint16 holdbackBps = uint16(vm.envOr("REF_HOLDBACK_BPS", uint256(3000)));

        uint8 levels = uint8(vm.envOr("REF_LEVELS", uint256(2)));
        uint16[6] memory levelBps;
        levelBps[0] = uint16(vm.envOr("REF_LEVEL0_BPS", uint256(0)));
        levelBps[1] = uint16(vm.envOr("REF_LEVEL1_BPS", uint256(10_000)));
        levelBps[2] = uint16(vm.envOr("REF_LEVEL2_BPS", uint256(0)));
        levelBps[3] = uint16(vm.envOr("REF_LEVEL3_BPS", uint256(0)));
        levelBps[4] = uint16(vm.envOr("REF_LEVEL4_BPS", uint256(0)));
        levelBps[5] = uint16(vm.envOr("REF_LEVEL5_BPS", uint256(0)));

        uint256 n = vm.envOr("NUM_ASSETS", uint256(1));
        require(n >= 1 && n <= 16, "NUM_ASSETS out of range");

        vm.startBroadcast(pk);

        // ---- VRF: adapter + hub ----
        ChainlinkV2PlusWrapperAdapter adapter = new ChainlinkV2PlusWrapperAdapter(vrfWrapper, gov);
        VRFHub vrf = new VRFHub(address(adapter), gov);

        adapter.setVRFHub(address(vrf));
        adapter.setRequestGasPriceWei(requestGasPriceWei);
        vrf.setAdapter(address(adapter));

        // ---- Registries ----
        BankRegistry registry = new BankRegistry(gov);
        ReferralRegistry refRegistry = new ReferralRegistry(gov);
        DefaultReferralEngine refEngine = new DefaultReferralEngine();

        // ---- Hub ----
        Hub hub = new Hub(
            address(registry),
            address(vrf),
            address(refRegistry),
            address(refEngine),
            gov,
            refundTimeoutSeconds,
            defaultHouseEdgeBps,
            maxAffiliateDeltaBps,
            baseBudgetBps,
            deltaBudgetBps,
            holdbackBps,
            levelBps,
            levels
        );

        refRegistry.setBinderOnce(address(hub));

        // ---- Banks (per asset) ----
        for (uint256 i = 0; i < n; i++) {
            string memory suffix = vm.toString(i);
            address asset = vm.envAddress(string.concat("ASSET_", suffix));

            uint16 minLiqBps = uint16(vm.envOr(string.concat("BANK_MIN_LIQ_BPS_", suffix), uint256(1000)));
            uint256 minTurnoverForUnlock = vm.envOr(string.concat("BANK_MIN_TURNOVER_FOR_UNLOCK_", suffix), uint256(20 ether));
            uint256 holdbackVestingSeconds = vm.envOr(string.concat("BANK_HOLDBACK_VESTING_SECONDS_", suffix), uint256(86400));

            string memory lpName = vm.envOr(string.concat("LP_NAME_", suffix), string.concat("LP Share #", suffix));
            string memory lpSymbol = vm.envOr(string.concat("LP_SYMBOL_", suffix), string.concat("LP", suffix));
            uint8 lpDecimals = uint8(vm.envOr(string.concat("LP_DECIMALS_", suffix), uint256(18)));

            Bank bank = new Bank(asset, treasury, gov, minLiqBps, lpName, lpSymbol, lpDecimals);
            registry.registerBank(asset, address(bank));

            bank.setHubOnce(address(hub));
            bank.setMinPlayerTurnoverForUnlock(minTurnoverForUnlock);
            bank.setHoldbackVestingSeconds(holdbackVestingSeconds);
        }

        // ---- Game modules ----
        DiceModule dice = new DiceModule();
        CoinTossModule coin = new CoinTossModule();
        RouletteModule roulette = new RouletteModule();
        KenoModule keno = new KenoModule();
        hub.registerGame(GAME_DICE, address(dice));
        hub.registerGame(GAME_COIN, address(coin));
        hub.registerGame(GAME_ROULETTE, address(roulette));
        hub.registerGame(GAME_KENO, address(keno));

        vm.stopBroadcast();

        // ---- Output (console) ----
        console2.log("GOV", gov);
        console2.log("VRF_WRAPPER", vrfWrapper);
        console2.log("adapter", address(adapter));
        console2.log("vrfHub", address(vrf));
        console2.log("bankRegistry", address(registry));
        console2.log("refRegistry", address(refRegistry));
        console2.log("refEngine", address(refEngine));
        console2.log("hub", address(hub));
        console2.log("NUM_ASSETS", n);
        for (uint256 i = 0; i < n; i++) {
            string memory suffix = vm.toString(i);
            address asset = vm.envAddress(string.concat("ASSET_", suffix));
            address bankAddr = registry.bankFor(asset);
            console2.log(string.concat("asset_", suffix), asset);
            console2.log(string.concat("bank_", suffix), bankAddr);
        }

        // ---- Output (artifacts) ----
        _writeArtifacts(
            deployer,
            gov,
            treasury,
            vrfWrapper,
            requestGasPriceWei,
            refundTimeoutSeconds,
            defaultHouseEdgeBps,
            maxAffiliateDeltaBps,
            baseBudgetBps,
            deltaBudgetBps,
            holdbackBps,
            levelBps,
            levels,
            n,
            adapter,
            vrf,
            registry,
            refRegistry,
            refEngine,
            hub,
            dice,
            coin,
            roulette,
            keno
        );
    }

    function _writeArtifacts(
        address deployer,
        address gov,
        address treasury,
        address vrfWrapper,
        uint256 requestGasPriceWei,
        uint256 refundTimeoutSeconds,
        uint16 defaultHouseEdgeBps,
        uint16 maxAffiliateDeltaBps,
        uint16 baseBudgetBps,
        uint16 deltaBudgetBps,
        uint16 holdbackBps,
        uint16[6] memory levelBps,
        uint8 levels,
        uint256 n,
        ChainlinkV2PlusWrapperAdapter adapter,
        VRFHub vrf,
        BankRegistry registry,
        ReferralRegistry refRegistry,
        DefaultReferralEngine refEngine,
        Hub hub,
        DiceModule dice,
        CoinTossModule coin,
        RouletteModule roulette,
        KenoModule keno
    ) internal {
        // Ensure conventional artifact directories exist.
        //
        // Foundry restricts FS writes by default, so this can revert unless
        // `fs_permissions` in foundry.toml allow read-write access.
        //
        // IMPORTANT: Deployment itself has already happened at this point.
        // Artifact writing is best-effort and must never brick a successful
        // on-chain deployment.
        _safeCreateDir("deployments/snapshots");
        _safeCreateDir("deployments/verify");

        // -------- snapshot (JSON) --------
        string memory obj = "ssot";
        string memory json;

        json = vm.serializeUint(obj, "chainId", block.chainid);
        json = vm.serializeUint(obj, "blockNumber", block.number);
        json = vm.serializeUint(obj, "timestamp", block.timestamp);
        json = vm.serializeAddress(obj, "deployer", deployer);
        json = vm.serializeAddress(obj, "gov", gov);
        json = vm.serializeAddress(obj, "treasury", treasury);

        json = vm.serializeAddress(obj, "vrfWrapper", vrfWrapper);
        json = vm.serializeAddress(obj, "adapter", address(adapter));
        json = vm.serializeAddress(obj, "vrfHub", address(vrf));
        json = vm.serializeUint(obj, "requestGasPriceWei", requestGasPriceWei);

        json = vm.serializeAddress(obj, "bankRegistry", address(registry));
        json = vm.serializeAddress(obj, "refRegistry", address(refRegistry));
        json = vm.serializeAddress(obj, "refEngine", address(refEngine));
        json = vm.serializeAddress(obj, "hub", address(hub));

        json = vm.serializeAddress(obj, "moduleDice", address(dice));
        json = vm.serializeAddress(obj, "moduleCoinToss", address(coin));
        json = vm.serializeAddress(obj, "moduleRoulette", address(roulette));
        json = vm.serializeAddress(obj, "moduleKeno", address(keno));

        json = vm.serializeUint(obj, "refundTimeoutSeconds", refundTimeoutSeconds);
        json = vm.serializeUint(obj, "defaultHouseEdgeBps", defaultHouseEdgeBps);
        json = vm.serializeUint(obj, "maxAffiliateDeltaBps", maxAffiliateDeltaBps);
        json = vm.serializeUint(obj, "refBaseBudgetBps", baseBudgetBps);
        json = vm.serializeUint(obj, "refDeltaBudgetBps", deltaBudgetBps);
        json = vm.serializeUint(obj, "refHoldbackBps", holdbackBps);
        json = vm.serializeUint(obj, "refLevels", levels);
        json = vm.serializeUint(obj, "refLevel0Bps", levelBps[0]);
        json = vm.serializeUint(obj, "refLevel1Bps", levelBps[1]);
        json = vm.serializeUint(obj, "refLevel2Bps", levelBps[2]);
        json = vm.serializeUint(obj, "refLevel3Bps", levelBps[3]);
        json = vm.serializeUint(obj, "refLevel4Bps", levelBps[4]);
        json = vm.serializeUint(obj, "refLevel5Bps", levelBps[5]);

        json = vm.serializeUint(obj, "numAssets", n);

        // constructor args (ABI encoded)
        json = vm.serializeString(obj, "ctorArgs_adapter", vm.toString(abi.encode(vrfWrapper, gov)));
        json = vm.serializeString(obj, "ctorArgs_vrfHub", vm.toString(abi.encode(address(adapter), gov)));
        json = vm.serializeString(obj, "ctorArgs_bankRegistry", vm.toString(abi.encode(gov)));
        json = vm.serializeString(obj, "ctorArgs_refRegistry", vm.toString(abi.encode(gov)));
        json = vm.serializeString(obj, "ctorArgs_refEngine", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleDice", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleCoinToss", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleRoulette", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleKeno", "0x");
        json = vm.serializeString(
            obj,
            "ctorArgs_hub",
            vm.toString(
                abi.encode(
                    address(registry),
                    address(vrf),
                    address(refRegistry),
                    address(refEngine),
                    gov,
                    refundTimeoutSeconds,
                    defaultHouseEdgeBps,
                    maxAffiliateDeltaBps,
                    baseBudgetBps,
                    deltaBudgetBps,
                    holdbackBps,
                    levelBps,
                    levels
                )
            )
        );

        // modules: no-arg constructors
        json = vm.serializeString(obj, "ctorArgs_moduleDice", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleCoinToss", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleRoulette", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleKeno", "0x");

        for (uint256 i = 0; i < n; i++) {
            string memory suffix = vm.toString(i);
            address asset = vm.envAddress(string.concat("ASSET_", suffix));
            address bankAddr = registry.bankFor(asset);

            uint16 minLiqBps = uint16(vm.envOr(string.concat("BANK_MIN_LIQ_BPS_", suffix), uint256(1000)));
            uint256 minTurnoverForUnlock = vm.envOr(string.concat("BANK_MIN_TURNOVER_FOR_UNLOCK_", suffix), uint256(20 ether));
            uint256 holdbackVestingSeconds = vm.envOr(string.concat("BANK_HOLDBACK_VESTING_SECONDS_", suffix), uint256(86400));
            string memory lpName = vm.envOr(string.concat("LP_NAME_", suffix), string.concat("LP Share #", suffix));
            string memory lpSymbol = vm.envOr(string.concat("LP_SYMBOL_", suffix), string.concat("LP", suffix));
            uint8 lpDecimals = uint8(vm.envOr(string.concat("LP_DECIMALS_", suffix), uint256(18)));

            json = vm.serializeAddress(obj, string.concat("asset_", suffix), asset);
            (string memory assetSymbol, uint8 assetDecimals) = _tryAssetMetadata(asset);
            json = vm.serializeString(obj, string.concat("assetSymbol_", suffix), assetSymbol);
            json = vm.serializeUint(obj, string.concat("assetDecimals_", suffix), uint256(assetDecimals));
            json = vm.serializeAddress(obj, string.concat("bank_", suffix), bankAddr);
            json = vm.serializeUint(obj, string.concat("bankMinLiqBps_", suffix), minLiqBps);
            json = vm.serializeUint(obj, string.concat("bankMinTurnoverForUnlock_", suffix), minTurnoverForUnlock);
            json = vm.serializeUint(obj, string.concat("bankHoldbackVestingSeconds_", suffix), holdbackVestingSeconds);
            json = vm.serializeString(obj, string.concat("lpName_", suffix), lpName);
            json = vm.serializeString(obj, string.concat("lpSymbol_", suffix), lpSymbol);
            json = vm.serializeUint(obj, string.concat("lpDecimals_", suffix), lpDecimals);

            json = vm.serializeString(
                obj,
                string.concat("ctorArgs_bank_", suffix),
                vm.toString(abi.encode(asset, treasury, gov, minLiqBps, lpName, lpSymbol, lpDecimals))
            );
        }

        string memory tag = string.concat(vm.toString(block.chainid), "-", vm.toString(block.number));
        // Legacy path (kept for backwards compatibility)
        string memory snapPathLegacy = string.concat("deployments/deploy-", tag, ".json");
        // Convention path
        string memory snapPath = string.concat("deployments/snapshots/deploy-", tag, ".json");

        _safeWriteJson(json, snapPathLegacy);
        _safeWriteJson(json, snapPath);
        _safeWriteJson(json, "deployments/latest.json");
        console2.log("Wrote deployment snapshot (legacy):", snapPathLegacy);
        console2.log("Wrote deployment snapshot:", snapPath);
        console2.log("Wrote deployment snapshot:", "deployments/latest.json");

        // -------- verify helper (shell) --------
        string memory verifierUrl = vm.envOr("VERIFIER_URL", string(""));
        if (bytes(verifierUrl).length == 0) {
            verifierUrl = _defaultVerifierUrl(block.chainid);
        }

        // NOTE: Etherscan API V1 has been deprecated across the Etherscan family.
        // We default to the unified API V2 verifier URL, and allow overriding via VERIFIER_URL.
        // Also accept ETHERSCAN_V2_API_KEY (common in multichain setups) as a fallback.
        string memory sh = string.concat(
            "#!/usr/bin/env bash\n",
            "set -euo pipefail\n",
            "# Ensure verification compiles with the same settings as deployment.\n",
            "# Foundry reads the selected profile from $FOUNDRY_PROFILE.\n",
            "export FOUNDRY_PROFILE=\"${FOUNDRY_PROFILE:-default}\"\n",
            // shellcheck disable=SC2154
            "ETHERSCAN_API_KEY=\"${ETHERSCAN_API_KEY:-${ETHERSCAN_V2_API_KEY:-}}\"\n",
            "if [ -z \"$ETHERSCAN_API_KEY\" ]; then echo \"set ETHERSCAN_API_KEY (or ETHERSCAN_V2_API_KEY)\"; exit 1; fi\n",
            "CHAIN_ID=", vm.toString(block.chainid), "\n",
            // Allow overriding VERIFIER_URL externally, otherwise default to V2.
            "VERIFIER_URL=\"${VERIFIER_URL:-", verifierUrl, "}\"\n\n",
            "# Foundry uses --chain (docs) but some older builds accepted --chain-id.\n",
            "CHAIN_FLAG=\"--chain\"\n",
            "if forge verify-contract --help 2>/dev/null | grep -q -- \"--chain-id\"; then CHAIN_FLAG=\"--chain-id\"; fi\n\n",
            "# Pin compilation profile for verification, if supported.\n",
            "PROFILE_FLAG=\"\"\n",
            "if forge verify-contract --help 2>/dev/null | grep -q -- \"--compilation-profile\"; then PROFILE_FLAG=\"--compilation-profile default\"; fi\n\n"
        );

        sh = string.concat(
            sh,
            _verifyLine(address(adapter), "src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol:ChainlinkV2PlusWrapperAdapter", vm.toString(abi.encode(vrfWrapper, gov)), verifierUrl),
            _verifyLine(address(vrf), "src/core/VRFHub.sol:VRFHub", vm.toString(abi.encode(address(adapter), gov)), verifierUrl),
            _verifyLine(address(registry), "src/core/BankRegistry.sol:BankRegistry", vm.toString(abi.encode(gov)), verifierUrl),
            _verifyLine(address(refRegistry), "src/engines/referral/ReferralRegistry.sol:ReferralRegistry", vm.toString(abi.encode(gov)), verifierUrl),
            _verifyLine(address(refEngine), "src/engines/referral/DefaultReferralEngine.sol:DefaultReferralEngine", "0x", verifierUrl),
            _verifyLine(
                address(hub),
                "src/core/Hub.sol:Hub",
                vm.toString(
                    abi.encode(
                        address(registry),
                        address(vrf),
                        address(refRegistry),
                        address(refEngine),
                        gov,
                        refundTimeoutSeconds,
                        defaultHouseEdgeBps,
                        maxAffiliateDeltaBps,
                        baseBudgetBps,
                        deltaBudgetBps,
                        holdbackBps,
                        levelBps,
                        levels
                    )
                ),
                verifierUrl
            )
        );

        for (uint256 i = 0; i < n; i++) {
            string memory suffix = vm.toString(i);
            address asset = vm.envAddress(string.concat("ASSET_", suffix));
            address bankAddr = registry.bankFor(asset);

            uint16 minLiqBps = uint16(vm.envOr(string.concat("BANK_MIN_LIQ_BPS_", suffix), uint256(1000)));
            string memory lpName = vm.envOr(string.concat("LP_NAME_", suffix), string.concat("LP Share #", suffix));
            string memory lpSymbol = vm.envOr(string.concat("LP_SYMBOL_", suffix), string.concat("LP", suffix));
            uint8 lpDecimals = uint8(vm.envOr(string.concat("LP_DECIMALS_", suffix), uint256(18)));
            address treasuryLocal = treasury;

            sh = string.concat(
                sh,
                _verifyLine(
                    bankAddr,
                    "src/core/Bank.sol:Bank",
                    vm.toString(abi.encode(asset, treasuryLocal, gov, minLiqBps, lpName, lpSymbol, lpDecimals)),
                    verifierUrl
                )
            );
        }

        // modules (no-arg constructors)
        sh = string.concat(
            sh,
            _verifyLine(address(dice), "src/modules/dice/DiceModule.sol:DiceModule", "0x", verifierUrl),
            _verifyLine(address(coin), "src/modules/cointoss/CoinTossModule.sol:CoinTossModule", "0x", verifierUrl),
            _verifyLine(address(roulette), "src/modules/roulette/RouletteModule.sol:RouletteModule", "0x", verifierUrl),
            _verifyLine(address(keno), "src/modules/keno/KenoModule.sol:KenoModule", "0x", verifierUrl)
        );

        string memory verifyPathLegacy = string.concat("deployments/verify-", tag, ".sh");
        string memory verifyPath = string.concat("deployments/verify/verify-", tag, ".sh");

        _safeWriteFile(verifyPathLegacy, sh);
        _safeWriteFile(verifyPath, sh);
        _safeWriteFile("deployments/verify-latest.sh", sh);
        console2.log("Wrote verify helper (legacy):", verifyPathLegacy);
        console2.log("Wrote verify helper:", verifyPath);
        console2.log("Wrote verify helper:", "deployments/verify-latest.sh");
    }

    // ------------------------
    // Best-effort FS helpers
    // ------------------------

    function _safeCreateDir(string memory path) internal {
        try vm.createDir(path, true) {
            // ok
        } catch {
            console2.log(string.concat("WARN: cannot create dir (check fs_permissions): ", path));
        }
    }

    function _safeWriteJson(string memory json, string memory path) internal {
        try vm.writeJson(json, path) {
            // ok
        } catch {
            console2.log(string.concat("WARN: cannot write json (check fs_permissions): ", path));
        }
    }

    function _safeWriteFile(string memory path, string memory data) internal {
        try vm.writeFile(path, data) {
            // ok
        } catch {
            console2.log(string.concat("WARN: cannot write file (check fs_permissions): ", path));
        }
    }

    function _defaultVerifierUrl(uint256 chainId) internal pure returns (string memory) {
        // Etherscan API V2 unified endpoint.
        // Ref: https://docs.etherscan.io/contract-verification/verify-with-foundry
        if (chainId == 8453) return "https://api.etherscan.io/v2/api?chainid=8453";
        if (chainId == 84532) return "https://api.etherscan.io/v2/api?chainid=84532";
        if (chainId == 42161) return "https://api.etherscan.io/v2/api?chainid=42161";
        if (chainId == 421614) return "https://api.etherscan.io/v2/api?chainid=421614";
        // Fallback: leave empty and rely on Foundry presets.
        return "";
    }

    function _verifyLine(
        address addr,
        string memory contractId,
        string memory ctorArgs,
        string memory verifierUrl
    ) internal pure returns (string memory) {
        // If verifierUrl is empty, rely on Foundry's chain preset.
        string memory base = string.concat(
            "forge verify-contract ",
            vm.toString(addr),
            " ",
            contractId,
            " $CHAIN_FLAG $CHAIN_ID --watch --verifier etherscan --etherscan-api-key $ETHERSCAN_API_KEY ",
            "$PROFILE_FLAG"
        );

        if (bytes(verifierUrl).length != 0) {
            base = string.concat(base, " --verifier-url $VERIFIER_URL");
        }

        // Many contracts have constructor args; if not, pass 0x and omit the flag.
        if (keccak256(bytes(ctorArgs)) != keccak256(bytes("0x"))) {
            base = string.concat(base, " --constructor-args ", ctorArgs);
        }
        return string.concat(base, "\n");
    }

    function _tryAssetMetadata(address token) internal view returns (string memory sym, uint8 dec) {
        sym = "";
        dec = 18;
        // Best-effort: treat missing implementations as empty / 18.
        try IERC20MetadataLike(token).symbol() returns (string memory s) {
            sym = s;
        } catch {}
        try IERC20MetadataLike(token).decimals() returns (uint8 d) {
            dec = d;
        } catch {}
    }

}
