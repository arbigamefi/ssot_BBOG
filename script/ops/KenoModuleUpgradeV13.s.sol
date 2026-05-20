// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import {GameHub} from "../../src/core/GameHub.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";

/// @notice Keno-only module upgrade helper for v1.3 deployments.
/// @dev This intentionally does not redeploy GameHub, Bank, VRFHub, or other modules.
///
/// Required env:
///   PRIVATE_KEY
///   RPC_URL (provided to forge script)
///
/// Optional env:
///   SNAPSHOT_PATH defaults to deployments/latest-v13.json
///   GAME_HUB overrides .gameHub from the snapshot
///   GOV      if set, requires PRIVATE_KEY to belong to GOV
///
/// Example:
///   source .env
///   forge script script/ops/KenoModuleUpgradeV13.s.sol:KenoModuleUpgradeV13 \
///     --rpc-url "$RPC_URL" --broadcast -vvv
contract KenoModuleUpgradeV13 is Script {
    using stdJson for string;

    bytes32 internal constant GAME_KENO = keccak256("KENO");
    string internal constant DEFAULT_SNAPSHOT_PATH = "deployments/latest-v13.json";
    string internal constant OUT_LATEST = "deployments/keno-upgrade-latest-v13.json";

    function run() external {
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", DEFAULT_SNAPSHOT_PATH);
        string memory snap = vm.readFile(snapshotPath);

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(privateKey);

        address gameHubAddr = vm.envOr("GAME_HUB", address(0));
        if (gameHubAddr == address(0)) {
            gameHubAddr = snap.readAddress(".gameHub");
        }

        address expectedGov = vm.envOr("GOV", address(0));
        if (expectedGov == address(0)) {
            expectedGov = snap.readAddress(".gov");
        }
        require(expectedGov == address(0) || broadcaster == expectedGov, "PRIVATE_KEY is not GOV");

        GameHub gameHub = GameHub(gameHubAddr);
        address previousKeno = gameHub.gameModule(GAME_KENO);
        require(previousKeno != address(0), "Keno not registered");

        console2.log("snapshot:", snapshotPath);
        console2.log("broadcaster:", broadcaster);
        console2.log("gameHub:", gameHubAddr);
        console2.log("previousKeno:", previousKeno);

        vm.startBroadcast(privateKey);
        KenoModule newKeno = new KenoModule();
        gameHub.registerGame(GAME_KENO, address(newKeno));
        vm.stopBroadcast();

        address registered = gameHub.gameModule(GAME_KENO);
        require(registered == address(newKeno), "Keno registration mismatch");

        uint256 chainId = block.chainid;
        uint256 blockNumber = block.number;
        string memory tag = string.concat(vm.toString(chainId), "-", vm.toString(blockNumber), "-v13");
        string memory outTagged = string.concat("deployments/keno-upgrade-", tag, ".json");

        string memory obj = "upgrade";
        string memory json;
        json = vm.serializeString(obj, "schema", "SSOT_KENO_MODULE_UPGRADE_V13");
        json = vm.serializeString(obj, "snapshotPath", snapshotPath);
        json = vm.serializeUint(obj, "chainId", chainId);
        json = vm.serializeUint(obj, "blockNumber", blockNumber);
        json = vm.serializeUint(obj, "timestamp", block.timestamp);
        json = vm.serializeAddress(obj, "broadcaster", broadcaster);
        json = vm.serializeAddress(obj, "gameHub", gameHubAddr);
        json = vm.serializeBytes32(obj, "gameId", GAME_KENO);
        json = vm.serializeAddress(obj, "previousModuleKeno", previousKeno);
        json = vm.serializeAddress(obj, "moduleKeno", address(newKeno));

        vm.writeJson(json, OUT_LATEST);
        vm.writeJson(json, outTagged);

        console2.log("newKeno:", address(newKeno));
        console2.log("registeredKeno:", registered);
        console2.log("wrote:", OUT_LATEST);
        console2.log("wrote:", outTagged);
    }
}
