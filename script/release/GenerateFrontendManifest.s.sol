// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import "./JsonReader.sol";
contract GenerateFrontendManifest is Script {
    using stdJson for string;

    JsonReader private jsonReader = new JsonReader();

    string internal constant SNAPSHOT_PATH = "deployments/latest.json";
    string internal constant OUT_LATEST = "deployments/frontend-manifest-latest.json";

    // Game ids are part of the public API surface (frontend relies on them).
    bytes32 internal constant GAME_DICE      = keccak256("DICE");
    bytes32 internal constant GAME_COIN_TOSS = keccak256("COIN_TOSS");
    bytes32 internal constant GAME_ROULETTE  = keccak256("ROULETTE");
    bytes32 internal constant GAME_KENO      = keccak256("KENO");

    function run() external {
        string memory snap = vm.readFile(SNAPSHOT_PATH);

        uint256 chainId = snap.readUint(".chainId");
        uint256 blockNumber = snap.readUint(".blockNumber");

        uint256 numAssets = snap.readUint(".numAssets");

        // Optional: allow CI to inject git SHA for traceability.
        string memory gitSha = vm.envOr("GIT_SHA", string(""));

        // Build JSON fragments. Keep frontend artifacts zero-inference.
        string memory gamesJson = _buildGamesJson(snap);
        string memory assetsJson = _buildAssetsJson(snap, numAssets);
        string memory addressesJson = _buildAddressesJson(snap);

        string memory json = string.concat(
            "{",
                "\"schemaVersion\":1,",
                "\"chainId\":", vm.toString(chainId), ",",
                "\"blockNumber\":", vm.toString(blockNumber), ",",
                "\"gitSha\":\"", _safe(gitSha), "\",",
                "\"generatedAt\":", vm.toString(block.timestamp), ",",
                "\"addresses\":", addressesJson, ",",
                "\"games\":", gamesJson, ",",
                "\"assets\":", assetsJson,
            "}\n"
        );

        // Write latest + tagged for reproducibility.
        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber));
        string memory outTagged = string.concat("deployments/release/frontend-manifest-", tag, ".json");

        vm.writeFile(OUT_LATEST, json);
        vm.writeFile(outTagged, json);

        console2.log("Wrote:", OUT_LATEST);
        console2.log("Wrote:", outTagged);
    }

    function _buildGamesJson(string memory snap) internal view returns (string memory) {
        address moduleDice = snap.readAddress(".moduleDice");
        address moduleCoinToss = snap.readAddress(".moduleCoinToss");
        address moduleRoulette = snap.readAddress(".moduleRoulette");
        address moduleKeno = snap.readAddress(".moduleKeno");

        // Static + explicit list; frontend should not derive gameIds.
        return string.concat(
            "[",
                _gameJson(GAME_DICE, "dice", "Dice", moduleDice, "abi.encode(uint8 cap)"),
                ",",
                _gameJson(GAME_COIN_TOSS, "coin-toss", "Coin Toss", moduleCoinToss, "abi.encode(bool isHeads)"),
                ",",
                _gameJson(GAME_ROULETTE, "roulette", "Roulette", moduleRoulette, "abi.encode(uint40 legacyMask) OR abi.encode(uint8 kind, uint40 payload)"),
                ",",
                _gameJson(GAME_KENO, "keno", "Keno", moduleKeno, "abi.encode(uint40 numbersPacked)"),
            "]"
        );
    }

    function _buildAssetsJson(string memory snap, uint256 numAssets) internal view returns (string memory) {
        string memory out = "[";
        for (uint256 i = 0; i < numAssets; i++) {
            address asset = snap.readAddress(string.concat(".asset_", vm.toString(i)));
            address bank = snap.readAddress(string.concat(".bank_", vm.toString(i)));
            (string memory sym, uint8 dec) = _readAssetMeta(snap, i);

            out = string.concat(
                out,
                (i == 0 ? "" : ","),
                "{",
                    "\"asset\":\"", vm.toString(asset), "\",",
                    "\"bank\":\"", vm.toString(bank), "\",",
                    "\"symbol\":\"", _safe(sym), "\",",
                    "\"decimals\":", vm.toString(uint256(dec)),
                "}"
            );
        }
        return string.concat(out, "]");
    }

    function _buildAddressesJson(string memory snap) internal view returns (string memory) {
        // NOTE: Field names MUST match Deploy.s.sol snapshot keys.
        address gov = snap.readAddress(".gov");
        address hub = snap.readAddress(".hub");
        address vrfHub = snap.readAddress(".vrfHub");
        address bankRegistry = snap.readAddress(".bankRegistry");
        address refRegistry = snap.readAddress(".refRegistry");
        address refEngine = snap.readAddress(".refEngine");
        address adapter = snap.readAddress(".adapter");

        address moduleDice = snap.readAddress(".moduleDice");
        address moduleCoinToss = snap.readAddress(".moduleCoinToss");
        address moduleRoulette = snap.readAddress(".moduleRoulette");
        address moduleKeno = snap.readAddress(".moduleKeno");

        return string.concat(
            "{",
                "\"gov\":\"", vm.toString(gov), "\",",
                "\"hub\":\"", vm.toString(hub), "\",",
                "\"vrfHub\":\"", vm.toString(vrfHub), "\",",
                "\"bankRegistry\":\"", vm.toString(bankRegistry), "\",",
                "\"refRegistry\":\"", vm.toString(refRegistry), "\",",
                "\"refEngine\":\"", vm.toString(refEngine), "\",",
                "\"adapter\":\"", vm.toString(adapter), "\",",
                "\"moduleDice\":\"", vm.toString(moduleDice), "\",",
                "\"moduleCoinToss\":\"", vm.toString(moduleCoinToss), "\",",
                "\"moduleRoulette\":\"", vm.toString(moduleRoulette), "\",",
                "\"moduleKeno\":\"", vm.toString(moduleKeno), "\"",
            "}"
        );
    }

    function _gameJson(bytes32 gameId, string memory slug, string memory label, address module, string memory paramsEncoding)
        internal
        pure
        returns (string memory)
    {
        // NOTE: we assume slug/label/paramsEncoding contain no quotes. Keep them simple.
        return string.concat(
            "{",
                "\"gameId\":\"", _toHex32(gameId), "\",",
                "\"slug\":\"", slug, "\",",
                "\"label\":\"", label, "\",",
                "\"module\":\"", _toHexAddr(module), "\",",
                "\"paramsEncoding\":\"", paramsEncoding, "\"",
            "}"
        );
    }

    
    // Read optional asset metadata from the deployment snapshot. This keeps frontend artifacts
    // deterministic and avoids requiring an RPC during bundle generation.
    function _readAssetMeta(string memory snap, uint256 i) internal view returns (string memory sym, uint8 dec) {
        string memory suffix = vm.toString(i);

        // Defaults if metadata wasn't recorded (should not happen in production deploys).
        sym = "";
        dec = 18;

        // Read from snapshot if present.
        try jsonReader.readString(snap, string.concat(".assetSymbol_", suffix)) returns (string memory s) {
            sym = s;
        } catch {}

        try jsonReader.readUint(snap, string.concat(".assetDecimals_", suffix)) returns (uint256 d) {
            if (d <= type(uint8).max) dec = uint8(d);
        } catch {}
    }

function _safe(string memory s) internal pure returns (string memory) {
        // Minimal escaping: strip quotes to keep JSON valid. (Symbols are usually safe anyway.)
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == '"') b[i] = "'";
        }
        return string(b);
    }

    function _toHexAddr(address a) internal pure returns (string memory) {
        // forge's vm.toString(address) is not pure, so we provide a pure formatter for embedding.
        // But since this is a script (not deployed), using vm.toString is fine elsewhere.
        // Here we keep it simple by returning an empty string in pure contexts is not acceptable,
        // so we avoid vm usage by re-encoding ourselves.
        return _toHex20(bytes20(a));
    }

    function _toHex32(bytes32 x) internal pure returns (string memory) {
        return _toHex(abi.encodePacked(x));
    }

    function _toHex20(bytes20 x) internal pure returns (string memory) {
        return _toHex(abi.encodePacked(x));
    }

    function _toHex(bytes memory data) internal pure returns (string memory) {
        bytes16 HEX = 0x30313233343536373839616263646566; // "0123456789abcdef"
        bytes memory out = new bytes(2 + data.length * 2);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            out[2 + i * 2] = HEX[uint8(data[i] >> 4)];
            out[3 + i * 2] = HEX[uint8(data[i] & 0x0f)];
        }
        return string(out);
    }
}
