// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import "./JsonReader.sol";

contract GenerateFrontendManifestV13 is Script {
    using stdJson for string;

    JsonReader private jsonReader = new JsonReader();

    string internal constant DEFAULT_SNAPSHOT_PATH = "deployments/latest-v13.json";
    string internal constant OUT_LATEST = "deployments/frontend-manifest-latest-v13.json";

    bytes32 internal constant GAME_DICE = keccak256("DICE");
    bytes32 internal constant GAME_COIN_TOSS = keccak256("COIN_TOSS");
    bytes32 internal constant GAME_ROULETTE = keccak256("ROULETTE");
    bytes32 internal constant GAME_KENO = keccak256("KENO");
    bytes32 internal constant GAME_SLOTS = keccak256("SLOTS");
    bytes32 internal constant GAME_BACCARAT = keccak256("BACCARAT");

    uint256 internal constant DOMAIN_CASINO = 1;
    uint256 internal constant DOMAIN_SPORTS = 2;
    uint256 internal constant DOMAIN_FUTURE = 3;

    function run() external {
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", DEFAULT_SNAPSHOT_PATH);
        string memory snap = vm.readFile(snapshotPath);

        uint256 chainId = snap.readUint(".chainId");
        uint256 blockNumber = snap.readUint(".blockNumber");
        uint256 numPools = snap.readUint(".numPools");
        require(numPools >= 1 && numPools <= 32, "numPools out of range");

        string memory gitSha = vm.envOr("GIT_SHA", string(""));

        string memory json = string.concat(
            "{",
            "\"schemaVersion\":2,",
            "\"architectureVersion\":\"",
            _safe(snap.readString(".architectureVersion")),
            "\",",
            "\"chainId\":",
            vm.toString(chainId),
            ",",
            "\"blockNumber\":",
            vm.toString(blockNumber),
            ",",
            "\"gitSha\":\"",
            _safe(gitSha),
            "\",",
            "\"generatedAt\":",
            vm.toString(block.timestamp),
            ",",
            "\"addresses\":",
            _buildAddressesJson(snap),
            ",",
            "\"sports\":",
            _buildSportsJson(snap),
            ",",
            "\"games\":",
            _buildGamesJson(snap),
            ",",
            "\"pools\":",
            _buildPoolsJson(snap, numPools),
            "}\n"
        );

        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber), "-v13");
        string memory outTagged = string.concat("deployments/release/frontend-manifest-", tag, ".json");

        vm.writeFile(OUT_LATEST, json);
        vm.writeFile(outTagged, json);

        console2.log("snapshot:", snapshotPath);
        console2.log("Wrote:", OUT_LATEST);
        console2.log("Wrote:", outTagged);
    }

    function _buildAddressesJson(string memory snap) internal pure returns (string memory) {
        address gov = snap.readAddress(".gov");
        address gameHub = snap.readAddress(".gameHub");
        address settlementRouter = snap.readAddress(".settlementRouter");
        address poolRegistry = snap.readAddress(".poolRegistry");
        address vrfHub = snap.readAddress(".vrfHub");
        address refRegistry = snap.readAddress(".refRegistry");
        address refEngine = snap.readAddress(".refEngine");
        address adapter = snap.readAddress(".adapter");
        address sportsRiskEngine = snap.readAddress(".sportsRiskEngine");
        address sportsHub = snap.readAddress(".sportsHub");

        address moduleDice = snap.readAddress(".moduleDice");
        address moduleCoinToss = snap.readAddress(".moduleCoinToss");
        address moduleRoulette = snap.readAddress(".moduleRoulette");
        address moduleKeno = snap.readAddress(".moduleKeno");
        address moduleSlots = snap.readAddress(".moduleSlots");
        address moduleBaccarat = snap.readAddress(".moduleBaccarat");

        return string.concat(
            "{",
            "\"gov\":\"",
            vm.toString(gov),
            "\",",
            "\"gameHub\":\"",
            vm.toString(gameHub),
            "\",",
            "\"sportsRiskEngine\":\"",
            vm.toString(sportsRiskEngine),
            "\",",
            "\"sportsHub\":\"",
            vm.toString(sportsHub),
            "\",",
            "\"settlementRouter\":\"",
            vm.toString(settlementRouter),
            "\",",
            "\"poolRegistry\":\"",
            vm.toString(poolRegistry),
            "\",",
            "\"vrfHub\":\"",
            vm.toString(vrfHub),
            "\",",
            "\"refRegistry\":\"",
            vm.toString(refRegistry),
            "\",",
            "\"refEngine\":\"",
            vm.toString(refEngine),
            "\",",
            "\"adapter\":\"",
            vm.toString(adapter),
            "\",",
            "\"moduleDice\":\"",
            vm.toString(moduleDice),
            "\",",
            "\"moduleCoinToss\":\"",
            vm.toString(moduleCoinToss),
            "\",",
            "\"moduleRoulette\":\"",
            vm.toString(moduleRoulette),
            "\",",
            "\"moduleKeno\":\"",
            vm.toString(moduleKeno),
            "\",",
            "\"moduleSlots\":\"",
            vm.toString(moduleSlots),
            "\",",
            "\"moduleBaccarat\":\"",
            vm.toString(moduleBaccarat),
            "\"",
            "}"
        );
    }

    function _buildSportsJson(string memory snap) internal pure returns (string memory) {
        uint256 enabled = snap.readUint(".sportsEnabled");
        return string.concat(
            "{",
            "\"enabled\":",
            enabled == 0 ? "false" : "true",
            ",",
            "\"riskEngine\":\"",
            vm.toString(snap.readAddress(".sportsRiskEngine")),
            "\",",
            "\"hub\":\"",
            vm.toString(snap.readAddress(".sportsHub")),
            "\",",
            "\"oddsSignerSetHash\":\"",
            vm.toString(snap.readBytes32(".sportsOddsSignerSetHash")),
            "\",",
            "\"resultReporterSetHash\":\"",
            vm.toString(snap.readBytes32(".sportsResultReporterSetHash")),
            "\",",
            "\"resultReporterThreshold\":\"",
            vm.toString(snap.readUint(".sportsResultReporterThreshold")),
            "\",",
            "\"resultChallenger\":\"",
            vm.toString(snap.readAddress(".sportsResultChallenger")),
            "\",",
            "\"resultArbitrator\":\"",
            vm.toString(snap.readAddress(".sportsResultArbitrator")),
            "\",",
            "\"maxStake\":\"",
            vm.toString(snap.readUint(".sportsMaxStake")),
            "\",",
            "\"maxPayout\":\"",
            vm.toString(snap.readUint(".sportsMaxPayout")),
            "\",",
            "\"maxMarketReserved\":\"",
            vm.toString(snap.readUint(".sportsMaxMarketReserved")),
            "\",",
            "\"maxOutcomeReserved\":\"",
            vm.toString(snap.readUint(".sportsMaxOutcomeReserved")),
            "\",",
            "\"maxEventReserved\":\"",
            vm.toString(snap.readUint(".sportsMaxEventReserved")),
            "\"",
            "}"
        );
    }

    function _buildGamesJson(string memory snap) internal pure returns (string memory) {
        address moduleDice = snap.readAddress(".moduleDice");
        address moduleCoinToss = snap.readAddress(".moduleCoinToss");
        address moduleRoulette = snap.readAddress(".moduleRoulette");
        address moduleKeno = snap.readAddress(".moduleKeno");
        address moduleSlots = snap.readAddress(".moduleSlots");
        address moduleBaccarat = snap.readAddress(".moduleBaccarat");

        return string.concat(
            "[",
            _gameJson(GAME_DICE, "dice", "Dice", moduleDice, "abi.encode(uint8 cap)"),
            ",",
            _gameJson(GAME_COIN_TOSS, "coin-toss", "Coin Toss", moduleCoinToss, "abi.encode(bool isHeads)"),
            ",",
            _gameJson(GAME_ROULETTE, "roulette", "Roulette", moduleRoulette, "abi.encode(uint8 kind, uint40 payload)"),
            ",",
            _gameJson(GAME_KENO, "keno", "Keno", moduleKeno, "abi.encode(uint40 numbersPacked)"),
            ",",
            _gameJson(GAME_SLOTS, "slots", "Slots", moduleSlots, "abi.encode(uint8 profile)"),
            ",",
            _gameJson(GAME_BACCARAT, "baccarat", "Baccarat", moduleBaccarat, "abi.encode(uint8 side)"),
            "]"
        );
    }

    function _buildPoolsJson(string memory snap, uint256 numPools) internal view returns (string memory) {
        string memory out = "[";
        for (uint256 i = 0; i < numPools; i++) {
            out = string.concat(out, (i == 0 ? "" : ","), _poolJson(snap, i));
        }
        return string.concat(out, "]");
    }

    function _poolJson(string memory snap, uint256 i) internal view returns (string memory) {
        string memory suffix = vm.toString(i);
        uint256 domainId = snap.readUint(string.concat(".poolDomain_", suffix));
        uint256 activeRaw = snap.readUint(string.concat(".poolActive_", suffix));
        (string memory sym, uint8 dec) = _readAssetMeta(snap, i);

        return string.concat(
            "{",
            "\"poolId\":",
            vm.toString(snap.readUint(string.concat(".poolId_", suffix))),
            ",",
            "\"domainId\":",
            vm.toString(domainId),
            ",",
            "\"domain\":\"",
            _domainLabel(domainId),
            "\",",
            "\"active\":",
            activeRaw == 0 ? "false" : "true",
            ",",
            "\"asset\":\"",
            vm.toString(snap.readAddress(string.concat(".poolAsset_", suffix))),
            "\",",
            "\"bank\":\"",
            vm.toString(snap.readAddress(string.concat(".poolBank_", suffix))),
            "\",",
            "\"symbol\":\"",
            _safe(sym),
            "\",",
            "\"decimals\":",
            vm.toString(uint256(dec)),
            ",",
            "\"sportsRisk\":",
            _poolSportsRiskJson(snap, suffix, domainId),
            "}"
        );
    }

    function _poolSportsRiskJson(string memory snap, string memory suffix, uint256 domainId)
        internal
        pure
        returns (string memory)
    {
        if (domainId != DOMAIN_SPORTS) return "null";

        return string.concat(
            "{",
            "\"maxStake\":\"",
            vm.toString(snap.readUint(string.concat(".poolSportsMaxStake_", suffix))),
            "\",",
            "\"maxPayout\":\"",
            vm.toString(snap.readUint(string.concat(".poolSportsMaxPayout_", suffix))),
            "\",",
            "\"maxMarketReserved\":\"",
            vm.toString(snap.readUint(string.concat(".poolSportsMaxMarketReserved_", suffix))),
            "\",",
            "\"maxOutcomeReserved\":\"",
            vm.toString(snap.readUint(string.concat(".poolSportsMaxOutcomeReserved_", suffix))),
            "\",",
            "\"maxEventReserved\":\"",
            vm.toString(snap.readUint(string.concat(".poolSportsMaxEventReserved_", suffix))),
            "\",",
            "\"riskHash\":\"",
            vm.toString(snap.readBytes32(string.concat(".poolSportsRiskHash_", suffix))),
            "\"",
            "}"
        );
    }

    function _gameJson(
        bytes32 gameId,
        string memory slug,
        string memory label,
        address module,
        string memory paramsEncoding
    ) internal pure returns (string memory) {
        return string.concat(
            "{",
            "\"gameId\":\"",
            _toHex32(gameId),
            "\",",
            "\"slug\":\"",
            slug,
            "\",",
            "\"label\":\"",
            label,
            "\",",
            "\"module\":\"",
            _toHexAddr(module),
            "\",",
            "\"paramsEncoding\":\"",
            paramsEncoding,
            "\"",
            "}"
        );
    }

    function _readAssetMeta(string memory snap, uint256 i) internal view returns (string memory sym, uint8 dec) {
        string memory suffix = vm.toString(i);
        sym = "";
        dec = 18;

        try jsonReader.readString(snap, string.concat(".assetSymbol_", suffix)) returns (string memory s) {
            sym = s;
        } catch {}

        try jsonReader.readUint(snap, string.concat(".assetDecimals_", suffix)) returns (uint256 d) {
            if (d <= type(uint8).max) dec = uint8(d);
        } catch {}
    }

    function _domainLabel(uint256 domainId) internal pure returns (string memory) {
        if (domainId == DOMAIN_CASINO) return "Casino";
        if (domainId == DOMAIN_SPORTS) return "Sports";
        if (domainId == DOMAIN_FUTURE) return "Future";
        return "Unknown";
    }

    function _safe(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == '"') b[i] = "'";
        }
        return string(b);
    }

    function _toHexAddr(address a) internal pure returns (string memory) {
        return _toHex(abi.encodePacked(bytes20(a)));
    }

    function _toHex32(bytes32 x) internal pure returns (string memory) {
        return _toHex(abi.encodePacked(x));
    }

    function _toHex(bytes memory data) internal pure returns (string memory) {
        bytes16 HEX = 0x30313233343536373839616263646566;
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
