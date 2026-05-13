// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import "./JsonReader.sol";

import {IGameHub} from "src/core/interfaces/IGameHub.sol";
import {SSOTTypes} from "src/core/interfaces/SSOTTypes.sol";

import {BaccaratParams} from "src/modules/baccarat/BaccaratParams.sol";
import {KenoParams} from "src/modules/keno/KenoParams.sol";
import {PlinkoParams} from "src/modules/plinko/PlinkoParams.sol";
import {RouletteParams} from "src/modules/roulette/RouletteParams.sol";
import {SlotsParams} from "src/modules/slots/SlotsParams.sol";

contract GenerateGoldenVectorsV13 is Script {
    using stdJson for string;

    JsonReader private jsonReader = new JsonReader();

    string internal constant DEFAULT_SNAPSHOT_PATH = "deployments/latest-v13.json";
    string internal constant OUT_LATEST = "deployments/golden-vectors-latest-v13.json";

    bytes32 internal constant GAME_DICE = keccak256("DICE");
    bytes32 internal constant GAME_COIN_TOSS = keccak256("COIN_TOSS");
    bytes32 internal constant GAME_ROULETTE = keccak256("ROULETTE");
    bytes32 internal constant GAME_KENO = keccak256("KENO");
    bytes32 internal constant GAME_PLINKO = keccak256("PLINKO");
    bytes32 internal constant GAME_SLOTS = keccak256("SLOTS");
    bytes32 internal constant GAME_BACCARAT = keccak256("BACCARAT");

    uint256 internal constant DOMAIN_CASINO = 1;

    function run() external {
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", DEFAULT_SNAPSHOT_PATH);
        string memory snap = vm.readFile(snapshotPath);

        uint256 chainId = snap.readUint(".chainId");
        uint256 blockNumber = snap.readUint(".blockNumber");

        address gameHub = snap.readAddress(".gameHub");
        uint64 poolId = _readFirstCasinoPoolId(snap);

        uint8 dec = _readAssetDecimalsForPool(snap, poolId);
        uint256 oneUnit = 10 ** uint256(dec);

        SSOTTypes.StakeSpec memory stake =
            SSOTTypes.StakeSpec({amountPerRoll: oneUnit, betCount: 10, stopGain: 0, stopLoss: 0});

        address affiliate = address(0);
        uint16 maxHouseEdgeBps = 3000;

        bytes memory paramsDice = abi.encode(uint8(97));
        bytes memory paramsCoinToss = abi.encode(true);
        bytes memory paramsRoulette = RouletteParams.encode(RouletteParams.Kind.Bitmask, uint40(1));
        bytes memory paramsKeno = KenoParams.encode(uint40(0x0000000001));
        bytes memory paramsPlinko = PlinkoParams.encode(PlinkoParams.RISK_MEDIUM);
        bytes memory paramsSlots = SlotsParams.encode(SlotsParams.PROFILE_CLASSIC);
        bytes memory paramsBaccarat = BaccaratParams.encode(BaccaratParams.SIDE_PLAYER);

        string memory vectors = "[";
        vectors = string.concat(
            vectors,
            _vectorJson(
                gameHub, GAME_DICE, poolId, paramsDice, stake, affiliate, maxHouseEdgeBps, "dice.placeBet(poolId)"
            )
        );
        vectors = string.concat(
            vectors,
            ",",
            _vectorJson(
                gameHub,
                GAME_COIN_TOSS,
                poolId,
                paramsCoinToss,
                stake,
                affiliate,
                maxHouseEdgeBps,
                "coin-toss.placeBet(poolId)"
            )
        );
        vectors = string.concat(
            vectors,
            ",",
            _vectorJson(
                gameHub,
                GAME_ROULETTE,
                poolId,
                paramsRoulette,
                stake,
                affiliate,
                maxHouseEdgeBps,
                "roulette.placeBet(poolId,bitmask=1)"
            )
        );
        vectors = string.concat(
            vectors,
            ",",
            _vectorJson(
                gameHub, GAME_KENO, poolId, paramsKeno, stake, affiliate, maxHouseEdgeBps, "keno.placeBet(poolId)"
            )
        );
        vectors = string.concat(
            vectors,
            ",",
            _vectorJson(
                gameHub, GAME_PLINKO, poolId, paramsPlinko, stake, affiliate, maxHouseEdgeBps, "plinko.placeBet(poolId)"
            )
        );
        vectors = string.concat(
            vectors,
            ",",
            _vectorJson(
                gameHub, GAME_SLOTS, poolId, paramsSlots, stake, affiliate, maxHouseEdgeBps, "slots.placeBet(poolId)"
            )
        );
        vectors = string.concat(
            vectors,
            ",",
            _vectorJson(
                gameHub,
                GAME_BACCARAT,
                poolId,
                paramsBaccarat,
                stake,
                affiliate,
                maxHouseEdgeBps,
                "baccarat.placeBet(poolId)"
            )
        );
        vectors = string.concat(vectors, "]");

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
            "\"generatedAt\":",
            vm.toString(block.timestamp),
            ",",
            "\"notes\":\"Vectors are for v1.3 IGameHub bytes-encoding correctness tests only. They are not intended as production defaults.\",",
            "\"vectors\":",
            vectors,
            "}\n"
        );

        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber), "-v13");
        string memory outTagged = string.concat("deployments/release/golden-vectors-", tag, ".json");

        vm.writeFile(OUT_LATEST, json);
        vm.writeFile(outTagged, json);

        console2.log("snapshot:", snapshotPath);
        console2.log("Wrote:", OUT_LATEST);
        console2.log("Wrote:", outTagged);
    }

    function _vectorJson(
        address gameHub,
        bytes32 gameId,
        uint64 poolId,
        bytes memory params,
        SSOTTypes.StakeSpec memory stake,
        address affiliate,
        uint16 maxHouseEdgeBps,
        string memory name
    ) internal pure returns (string memory) {
        bytes memory stakeEncoded = abi.encode(stake);
        bytes memory calldata_ = abi.encodeWithSelector(
            IGameHub.placeBet.selector, gameId, poolId, params, stake, affiliate, maxHouseEdgeBps
        );

        return string.concat(
            "{",
            "\"name\":\"",
            name,
            "\",",
            "\"gameHub\":\"",
            _toHexAddr(gameHub),
            "\",",
            "\"selector\":\"",
            _toHex4(IGameHub.placeBet.selector),
            "\",",
            "\"gameId\":\"",
            _toHex32(gameId),
            "\",",
            "\"poolId\":",
            _u(uint256(poolId)),
            ",",
            "\"params\":\"",
            _toHex(params),
            "\",",
            "\"stakeSpec\":{",
            "\"amountPerRoll\":",
            _u(stake.amountPerRoll),
            ",",
            "\"betCount\":",
            _u(uint256(stake.betCount)),
            ",",
            "\"stopGain\":",
            _u(stake.stopGain),
            ",",
            "\"stopLoss\":",
            _u(stake.stopLoss),
            "},",
            "\"stakeSpecEncoded\":\"",
            _toHex(stakeEncoded),
            "\",",
            "\"affiliate\":\"",
            _toHexAddr(affiliate),
            "\",",
            "\"maxHouseEdgeBps\":",
            _u(uint256(maxHouseEdgeBps)),
            ",",
            "\"placeBetCalldata\":\"",
            _toHex(calldata_),
            "\"",
            "}"
        );
    }

    function _readFirstCasinoPoolId(string memory snap) internal pure returns (uint64) {
        uint256 numPools = snap.readUint(".numPools");
        require(numPools >= 1 && numPools <= 32, "numPools out of range");

        for (uint256 i = 0; i < numPools; i++) {
            string memory suffix = vm.toString(i);
            uint256 domainId = snap.readUint(string.concat(".poolDomain_", suffix));
            uint256 activeRaw = snap.readUint(string.concat(".poolActive_", suffix));
            if (domainId == DOMAIN_CASINO && activeRaw != 0) {
                uint256 poolId = snap.readUint(string.concat(".poolId_", suffix));
                require(poolId <= type(uint64).max, "poolId too large");
                return uint64(poolId);
            }
        }
        revert("no active casino pool");
    }

    function _readAssetDecimalsForPool(string memory snap, uint64 poolId) internal view returns (uint8 dec) {
        dec = 18;
        uint256 numPools = snap.readUint(".numPools");
        for (uint256 i = 0; i < numPools; i++) {
            string memory suffix = vm.toString(i);
            if (snap.readUint(string.concat(".poolId_", suffix)) == uint256(poolId)) {
                try jsonReader.readUint(snap, string.concat(".assetDecimals_", suffix)) returns (uint256 d) {
                    if (d <= type(uint8).max) dec = uint8(d);
                } catch {}
                return dec;
            }
        }
        revert("pool not found");
    }

    function _safe(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == '"') b[i] = "'";
        }
        return string(b);
    }

    function _u(uint256 x) internal pure returns (string memory) {
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
