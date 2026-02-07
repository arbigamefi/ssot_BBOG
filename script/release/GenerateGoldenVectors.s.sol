// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import "./JsonReader.sol";

import { IHub } from "src/core/interfaces/IHub.sol";
import { SSOTTypes } from "src/core/interfaces/SSOTTypes.sol";

import { RouletteParams } from "src/modules/roulette/RouletteParams.sol";
import { KenoParams } from "src/modules/keno/KenoParams.sol";

contract GenerateGoldenVectors is Script {
    using stdJson for string;

    JsonReader private jsonReader = new JsonReader();

    string internal constant SNAPSHOT_PATH = "deployments/latest.json";
    string internal constant OUT_LATEST = "deployments/golden-vectors-latest.json";

    bytes32 internal constant GAME_DICE      = keccak256("DICE");
    bytes32 internal constant GAME_COIN_TOSS = keccak256("COIN_TOSS");
    bytes32 internal constant GAME_ROULETTE  = keccak256("ROULETTE");
    bytes32 internal constant GAME_KENO      = keccak256("KENO");

    function run() external {
        string memory snap = vm.readFile(SNAPSHOT_PATH);

        uint256 chainId = snap.readUint(".chainId");
        uint256 blockNumber = snap.readUint(".blockNumber");

        address hub = snap.readAddress(".hub");
        address asset0 = snap.readAddress(".asset_0");

        // Use realistic values (encoding-only). If the token exposes decimals, use 1 unit.
        uint8 dec = _readAssetDecimals(snap, 0);
        uint256 oneUnit = 10 ** uint256(dec);

        SSOTTypes.StakeSpec memory stake = SSOTTypes.StakeSpec({
            amountPerRoll: oneUnit,
            betCount: 10,
            stopGain: 0,
            stopLoss: 0
        });

        address affiliate = address(0);
        uint16 maxHouseEdgeBps = 3000; // 30% (bps) — encoding-only vector

        // params examples (must match onchain decode logic)
        bytes memory paramsDice = abi.encode(uint8(97)); // cap=97
        bytes memory paramsCoinToss = abi.encode(true);  // isHeads=true
        bytes memory paramsRoulette = RouletteParams.encode(RouletteParams.Kind.Bitmask, uint40(1)); // minimal bitmask
        bytes memory paramsKeno = KenoParams.encode(uint40(0x0000000001)); // minimal packed set

        // Build vectors array.
        string memory vectors = "[";
        vectors = string.concat(vectors, _vectorJson(hub, GAME_DICE, asset0, paramsDice, stake, affiliate, maxHouseEdgeBps, "dice.placeBet(bitmask-free)"));
        vectors = string.concat(vectors, ",", _vectorJson(hub, GAME_COIN_TOSS, asset0, paramsCoinToss, stake, affiliate, maxHouseEdgeBps, "coin-toss.placeBet"));
        vectors = string.concat(vectors, ",", _vectorJson(hub, GAME_ROULETTE, asset0, paramsRoulette, stake, affiliate, maxHouseEdgeBps, "roulette.placeBet(bitmask=1)"));
        vectors = string.concat(vectors, ",", _vectorJson(hub, GAME_KENO, asset0, paramsKeno, stake, affiliate, maxHouseEdgeBps, "keno.placeBet(numbersPacked=1)"));
        vectors = string.concat(vectors, "]");

        string memory json = string.concat(
            "{",
                "\"schemaVersion\":1,",
                "\"chainId\":", vm.toString(chainId), ",",
                "\"blockNumber\":", vm.toString(blockNumber), ",",
                "\"generatedAt\":", vm.toString(block.timestamp), ",",
                "\"notes\":\"Vectors are for bytes-encoding correctness tests only (Vitest exact-hex compare). They are not intended as production defaults.\",",
                "\"vectors\":", vectors,
            "}\n"
        );

        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber));
        string memory outTagged = string.concat("deployments/release/golden-vectors-", tag, ".json");

        vm.writeFile(OUT_LATEST, json);
        vm.writeFile(outTagged, json);

        console2.log("Wrote:", OUT_LATEST);
        console2.log("Wrote:", outTagged);
    }

    function _vectorJson(
        address hub,
        bytes32 gameId,
        address asset,
        bytes memory params,
        SSOTTypes.StakeSpec memory stake,
        address affiliate,
        uint16 maxHouseEdgeBps,
        string memory name
    ) internal pure returns (string memory) {
        bytes memory stakeEncoded = abi.encode(stake);
        bytes memory calldata_ = abi.encodeWithSelector(
            IHub.placeBet.selector,
            gameId,
            asset,
            params,
            stake,
            affiliate,
            maxHouseEdgeBps
        );

        // Embedded "args" are to make review easier; the authoritative check is hex equality.
        return string.concat(
            "{",
                "\"name\":\"", name, "\",",
                "\"hub\":\"", _toHexAddr(hub), "\",",
                "\"selector\":\"", _toHex4(IHub.placeBet.selector), "\",",
                "\"gameId\":\"", _toHex32(gameId), "\",",
                "\"asset\":\"", _toHexAddr(asset), "\",",
                "\"params\":\"", _toHex(params), "\",",
                "\"stakeSpec\":{",
                    "\"amountPerRoll\":", _u(stake.amountPerRoll), ",",
                    "\"betCount\":", _u(uint256(stake.betCount)), ",",
                    "\"stopGain\":", _u(stake.stopGain), ",",
                    "\"stopLoss\":", _u(stake.stopLoss),
                "},",
                "\"stakeSpecEncoded\":\"", _toHex(stakeEncoded), "\",",
                "\"affiliate\":\"", _toHexAddr(affiliate), "\",",
                "\"maxHouseEdgeBps\":", _u(uint256(maxHouseEdgeBps)), ",",
                "\"placeBetCalldata\":\"", _toHex(calldata_), "\"",
            "}"
        );
    }

    
    function _readAssetDecimals(string memory snap, uint256 i) internal view returns (uint8 dec) {
        dec = 18;
        string memory suffix = vm.toString(i);
        try jsonReader.readUint(snap, string.concat(".assetDecimals_", suffix)) returns (uint256 d) {
            if (d <= type(uint8).max) dec = uint8(d);
        } catch {}
    }

function _u(uint256 x) internal pure returns (string memory) {
        // vm.toString is not pure; implement minimal uint->string for JSON.
        if (x == 0) return "0";
        uint256 j = x;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory b = new bytes(len);
        while (x != 0) {
            len -= 1;
            b[len] = bytes1(uint8(48 + x % 10));
            x /= 10;
        }
        return string(b);
    }

    function _toHexAddr(address a) internal pure returns (string memory) {
        return _toHex(abi.encodePacked(bytes20(a)));
    }

    function _toHex32(bytes32 x) internal pure returns (string memory) {
        return _toHex(abi.encodePacked(x));
    }

    function _toHex4(bytes4 x) internal pure returns (string memory) {
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
