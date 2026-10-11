// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {SafeGovernance} from "./common/SafeGovernance.sol";
import {V16Batches} from "./release/V16Batches.sol";
import {V16Snapshot} from "./release/V16Snapshot.sol";
import {VmSafe} from "forge-std/Vm.sol";

import {GovernanceTimelock} from "../src/access/GovernanceTimelock.sol";
import {Bank} from "../src/core/Bank.sol";
import {GameHub} from "../src/core/GameHub.sol";
import {PoolRegistry} from "../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../src/core/SettlementRouter.sol";
import {VRFHub} from "../src/core/VRFHub.sol";
import {SSOTTypes} from "../src/core/interfaces/SSOTTypes.sol";
import {HouseEdgeLib} from "../src/libs/HouseEdgeLib.sol";

import {ReferralRegistry} from "../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../src/engines/referral/DefaultReferralEngine.sol";

import {BaccaratModule} from "../src/modules/baccarat/BaccaratModule.sol";
import {CoinTossModule} from "../src/modules/cointoss/CoinTossModule.sol";
import {DiceModule} from "../src/modules/dice/DiceModule.sol";
import {PlinkoModule} from "../src/modules/plinko/PlinkoModule.sol";
import {RouletteModule} from "../src/modules/roulette/RouletteModule.sol";
import {KenoModule} from "../src/modules/keno/KenoModule.sol";
import {SicBoModule} from "../src/modules/sicbo/SicBoModule.sol";
import {SlotsModule} from "../src/modules/slots/SlotsModule.sol";

interface IERC20MetadataLikeV16 {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

/// @notice Deploys SSOT v1.6 as ADR-0037 decision D1 prescribes. The GovernanceTimelock comes first; every governed
///         contract is constructed with the timelock as its governance, so the deploying address holds no power at any
///         time. Nothing is wired here: the Safe schedules the wiring batch afterwards (PrepareTimelockBatchesV16) and
///         anyone executes it after 72 hours; activation is a second operation (script/release/V16Batches.sol).
///
///         Before anything is broadcast the script rehearses both operations against the simulated deployment and
///         checks the result as release verification will (V16Snapshot), then restores the simulated state: a batch
///         that would revert or wire something else stops the deployment instead of wasting 72 hours or a one-shot
///         setter.
///
/// Required env:
///   DEPLOYER (the deploying address; it receives no role), GOV (the 2-of-3 Safe: timelock proposer and canceller,
///   sentinel), SAFE_CODE_HASH, SAFE_OWNERS_HASH, SAFE_CONTROL_HASH,
///   GUARDIAN (an independent multisig: timelock canceller, Bank guardian), GUARDIAN_CODE_HASH, GUARDIAN_OWNERS_HASH,
///   GUARDIAN_CONTROL_HASH, CHAIN_ID, KEEPER_ADDRESS, RELEASE_SIGNER, VRF_WRAPPER, NUM_POOLS, POOL_ASSET_0...,
///   GAME_MAX_BET_COUNT_<GAME> and GAME_CALLBACK_GAS_LIMIT_<GAME> for the eight games
///
/// Per-pool env:
///   POOL_ID_i                         default i + 1
///   POOL_ASSET_i                      required
///   BANK_MIN_BET_AMOUNT_i             required, minimum per casino round in asset units
///   BANK_RISK_RESERVE_BPS_i           default 6000
///   BANK_WITHDRAWAL_BUFFER_BPS_i      default 1000 (independent PF/XP outflow policy)
///   BANK_MIN_TURNOVER_FOR_UNLOCK_i    default 20 asset units
///   BANK_HOLDBACK_VESTING_SECONDS_i   default 86400
///   Asset decimals are read from the token
///
/// Every pool is a casino pool served by GameHub.
///
/// Broadcast only through the gated path (docs/deploy/v16-release.md): script/release/run_preflight.sh runs this script
/// without a key at one block and reviews its plan, and script/release/broadcast_v16.sh sends exactly that plan.
contract DeployV16 is Script {
    /// The release delay: GovernanceTimelock.MIN_DELAY, the floor its constructor and updateDelay enforce (D7).
    uint256 internal constant TIMELOCK_DELAY = 259_200;

    /// @dev SSOT v1.6 referral schedule: rates are bps of the base turnover edge, l0 + l1 + l2 <= 3500.
    struct RefConfig {
        uint16 l0Bps;
        uint16 l1Bps;
        uint16 l2Bps;
        uint16 holdbackBps;
    }

    struct GameConfig {
        uint32 maxBetCount;
        uint32 callbackGasLimit;
    }

    struct DeployConfig {
        address deployer;
        address safe;
        bytes32 safeOwnersHash;
        bytes32 safeCodeHash;
        bytes32 safeControlHash;
        address guardian;
        bytes32 guardianOwnersHash;
        bytes32 guardianCodeHash;
        bytes32 guardianControlHash;
        address keeper;
        address releaseSigner;
        address treasury;
        address vrfWrapper;
        uint256 refundTimeoutSeconds;
        uint16 defaultHouseEdgeBps;
        uint256 poolCount;
        RefConfig refConfig;
        GameConfig[8] games;
        uint256 originBlock;
        uint256 originTimestamp;
    }

    struct PoolConfig {
        uint64 poolId;
        address asset;
        address bank;
        SSOTTypes.PoolDomain domain;
        uint256 minBetAmount;
        uint16 riskReserveBps;
        uint16 withdrawalBufferBps;
        uint256 minTurnoverForUnlock;
        uint256 holdbackVestingSeconds;
        uint8 assetDecimals;
    }

    struct Deployed {
        GovernanceTimelock timelock;
        VRFHub vrf;
        PoolRegistry poolRegistry;
        SettlementRouter router;
        ReferralRegistry refRegistry;
        DefaultReferralEngine refEngine;
        GameHub gameHub;
        DiceModule dice;
        CoinTossModule coin;
        RouletteModule roulette;
        KenoModule keno;
        PlinkoModule plinko;
        SicBoModule sicBo;
        SlotsModule slots;
        BaccaratModule baccarat;
    }

    function run() external {
        DeployConfig memory cfg = _readDeployConfig();
        require(block.chainid == vm.envUint("CHAIN_ID"), "CHAIN_ID mismatch");
        SafeGovernance.validate(cfg.safe, cfg.safeOwnersHash, cfg.safeCodeHash, cfg.safeControlHash);
        SafeGovernance.validateGuardian(
            cfg.guardian, cfg.safe, cfg.guardianOwnersHash, cfg.guardianCodeHash, cfg.guardianControlHash
        );
        require(cfg.vrfWrapper.code.length != 0, "VRF wrapper has no code");
        require(cfg.poolCount >= 1 && cfg.poolCount <= 32, "NUM_POOLS out of range");

        PoolConfig[] memory pools = new PoolConfig[](cfg.poolCount);
        for (uint256 i = 0; i < cfg.poolCount; ++i) {
            pools[i] = _readPoolConfig(i);
            require(pools[i].riskReserveBps <= 10_000, "BANK_RISK_RESERVE_BPS_i out of range");
            require(pools[i].withdrawalBufferBps <= 10_000, "BANK_WITHDRAWAL_BUFFER_BPS_i out of range");
            for (uint256 j; j < i; ++j) {
                require(pools[i].poolId != pools[j].poolId, "duplicate POOL_ID");
            }
        }

        vm.startBroadcast(cfg.deployer);

        Deployed memory d;

        d.timelock = new GovernanceTimelock(TIMELOCK_DELAY, _list(cfg.safe), _list(cfg.guardian), _list(address(0)));
        address gov = address(d.timelock);
        d.poolRegistry = new PoolRegistry(gov);
        d.router = new SettlementRouter(address(d.poolRegistry));
        d.vrf = new VRFHub(cfg.vrfWrapper, address(d.router));
        d.refRegistry = new ReferralRegistry(gov);
        d.refEngine = new DefaultReferralEngine();

        d.gameHub = new GameHub(
            address(d.router),
            address(d.vrf),
            address(d.refRegistry),
            address(d.refEngine),
            gov,
            cfg.refundTimeoutSeconds,
            cfg.defaultHouseEdgeBps,
            cfg.refConfig.l0Bps,
            cfg.refConfig.l1Bps,
            cfg.refConfig.l2Bps,
            cfg.refConfig.holdbackBps
        );

        for (uint256 i = 0; i < pools.length; ++i) {
            pools[i].bank = address(
                new Bank(pools[i].asset, gov, pools[i].riskReserveBps, pools[i].assetDecimals, pools[i].minBetAmount)
            );
        }

        d.dice = new DiceModule();
        d.coin = new CoinTossModule();
        d.roulette = new RouletteModule();
        d.keno = new KenoModule();
        d.plinko = new PlinkoModule();
        d.sicBo = new SicBoModule();
        d.slots = new SlotsModule();
        d.baccarat = new BaccaratModule();

        vm.stopBroadcast();

        string memory snap = _snapshotJson(cfg, pools, d);
        _rehearse(snap);
        _logDeployment(cfg, pools, d, snap);
        if (_shouldWriteArtifacts()) {
            _writeArtifacts(snap);
        } else {
            console2.log("Skipping v1.6 deployment artifact writes during dry run.");
            console2.log("Set WRITE_DRY_RUN_ARTIFACTS=true to write simulated artifacts intentionally.");
        }
    }

    /// The Safe schedules the wiring, anyone executes it 72 hours later, then the same for the activation; each
    /// result must pass release verification. The simulated chain is restored afterwards, so the snapshot and the
    /// broadcast describe the deployment only.
    function _rehearse(string memory snap) internal {
        uint256 state = vm.snapshotState();
        GovernanceTimelock timelock = GovernanceTimelock(payable(vm.parseJsonAddress(snap, ".governanceTimelock")));
        address safe = vm.parseJsonAddress(snap, ".gov");
        V16Snapshot.verify(snap, V16Snapshot.Mode.Deployed);
        _scheduleAndExecute(timelock, safe, V16Batches.wiring(snap));
        V16Snapshot.verify(snap, V16Snapshot.Mode.Release);
        _scheduleAndExecute(timelock, safe, V16Batches.activation(snap));
        V16Snapshot.verify(snap, V16Snapshot.Mode.Live);
        require(vm.revertToStateAndDelete(state), "rehearsal state not restored");
    }

    function _scheduleAndExecute(GovernanceTimelock timelock, address safe, V16Batches.Batch memory b) internal {
        uint256 delay = timelock.getMinDelay();
        vm.prank(safe);
        timelock.scheduleBatch(b.targets, b.values, b.payloads, b.predecessor, b.salt, delay);
        vm.warp(block.timestamp + delay);
        timelock.executeBatch(b.targets, b.values, b.payloads, b.predecessor, b.salt);
    }

    function _shouldWriteArtifacts() internal view virtual returns (bool) {
        return vm.isContext(VmSafe.ForgeContext.ScriptBroadcast) || vm.envOr("WRITE_DRY_RUN_ARTIFACTS", false);
    }

    function _readDeployConfig() internal view returns (DeployConfig memory cfg) {
        cfg.originBlock = block.number;
        cfg.originTimestamp = block.timestamp;
        cfg.deployer = vm.envAddress("DEPLOYER");
        require(cfg.deployer != address(0), "deployer required");
        cfg.safe = vm.envAddress("GOV");
        cfg.safeOwnersHash = vm.envBytes32("SAFE_OWNERS_HASH");
        cfg.safeCodeHash = vm.envBytes32("SAFE_CODE_HASH");
        cfg.safeControlHash = vm.envBytes32("SAFE_CONTROL_HASH");
        cfg.guardian = vm.envAddress("GUARDIAN");
        cfg.guardianOwnersHash = vm.envBytes32("GUARDIAN_OWNERS_HASH");
        cfg.guardianCodeHash = vm.envBytes32("GUARDIAN_CODE_HASH");
        cfg.guardianControlHash = vm.envBytes32("GUARDIAN_CONTROL_HASH");
        cfg.keeper = vm.envAddress("KEEPER_ADDRESS");
        cfg.releaseSigner = vm.envAddress("RELEASE_SIGNER");
        require(cfg.safe != cfg.deployer, "Safe must differ from deployer");
        require(cfg.guardian != cfg.deployer, "guardian must differ from deployer");
        require(
            cfg.keeper != address(0) && cfg.keeper != cfg.deployer && cfg.keeper != cfg.safe
                && cfg.keeper != cfg.guardian,
            "independent keeper required"
        );
        require(cfg.releaseSigner != address(0), "release signer required");
        cfg.treasury = vm.envOr("TREASURY", address(0));
        cfg.vrfWrapper = vm.envAddress("VRF_WRAPPER");
        cfg.refundTimeoutSeconds = vm.envOr("REFUND_TIMEOUT_SECONDS", uint256(3600));
        require(
            cfg.refundTimeoutSeconds >= HouseEdgeLib.MIN_REFUND_TIMEOUT_SECONDS,
            "REFUND_TIMEOUT_SECONDS below one minute"
        );
        require(
            cfg.refundTimeoutSeconds <= HouseEdgeLib.MAX_REFUND_TIMEOUT_SECONDS, "REFUND_TIMEOUT_SECONDS above one day"
        );
        cfg.defaultHouseEdgeBps = _bps("DEFAULT_HOUSE_EDGE_BPS", 200);
        require(
            cfg.defaultHouseEdgeBps > 0 && cfg.defaultHouseEdgeBps <= HouseEdgeLib.MAX_HOUSE_EDGE_BPS,
            "DEFAULT_HOUSE_EDGE_BPS out of range"
        );
        cfg.poolCount = vm.envOr("NUM_POOLS", uint256(1));

        // The three-level referral schedule is funded by the operator half.
        cfg.refConfig.l0Bps = _bps("REF_L0_BPS", 1000);
        cfg.refConfig.l1Bps = _bps("REF_L1_BPS", 2000);
        cfg.refConfig.l2Bps = _bps("REF_L2_BPS", 500);
        cfg.refConfig.holdbackBps = _bps("REF_HOLDBACK_BPS", 3000);
        require(
            uint256(cfg.refConfig.l0Bps) + cfg.refConfig.l1Bps + cfg.refConfig.l2Bps <= HouseEdgeLib.MAX_REFERRAL_BPS,
            "REF_L0_BPS + REF_L1_BPS + REF_L2_BPS exceeds 3500"
        );

        (string[8] memory names,) = V16Batches.games();
        for (uint256 g; g < names.length; ++g) {
            uint256 count = vm.envUint(string.concat("GAME_MAX_BET_COUNT_", names[g]));
            uint256 gasLimit = vm.envUint(string.concat("GAME_CALLBACK_GAS_LIMIT_", names[g]));
            require(count > 0 && count <= type(uint32).max && gasLimit <= type(uint32).max, "invalid game admission");
            cfg.games[g] = GameConfig({maxBetCount: uint32(count), callbackGasLimit: uint32(gasLimit)});
        }
    }

    function _readPoolConfig(uint256 i) internal view returns (PoolConfig memory cfg) {
        string memory suffix = vm.toString(i);
        uint256 poolId = vm.envOr(string.concat("POOL_ID_", suffix), i + 1);
        require(poolId > 0 && poolId <= type(uint64).max, "POOL_ID out of range");
        cfg.poolId = uint64(poolId);
        cfg.asset = vm.envAddress(string.concat("POOL_ASSET_", suffix));
        require(cfg.asset.code.length != 0, "POOL_ASSET_i has no code");
        (, uint8 assetDecimals) = _tryAssetMetadata(cfg.asset);
        uint256 oneAssetUnit = 10 ** uint256(assetDecimals);

        cfg.domain = SSOTTypes.PoolDomain.Casino;

        cfg.minBetAmount = vm.envUint(string.concat("BANK_MIN_BET_AMOUNT_", suffix));
        require(cfg.minBetAmount > 0, "BANK_MIN_BET_AMOUNT_i must be positive");
        cfg.riskReserveBps = _bps(string.concat("BANK_RISK_RESERVE_BPS_", suffix), 6000);
        cfg.withdrawalBufferBps = _bps(string.concat("BANK_WITHDRAWAL_BUFFER_BPS_", suffix), 1000);
        cfg.minTurnoverForUnlock =
            vm.envOr(string.concat("BANK_MIN_TURNOVER_FOR_UNLOCK_", suffix), uint256(20 * oneAssetUnit));
        cfg.holdbackVestingSeconds = vm.envOr(string.concat("BANK_HOLDBACK_VESTING_SECONDS_", suffix), uint256(86400));
        cfg.assetDecimals = assetDecimals;
    }

    function _bps(string memory key, uint256 fallbackValue) internal view returns (uint16) {
        uint256 value = vm.envOr(key, fallbackValue);
        require(value <= 10_000, string.concat(key, " out of range"));
        return uint16(value);
    }

    function _list(address a) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = a;
    }

    function _logDeployment(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d, string memory snap)
        internal
        pure
        virtual
    {
        console2.log("GOV (Safe)", cfg.safe);
        console2.log("GUARDIAN", cfg.guardian);
        console2.log("governanceTimelock", address(d.timelock));
        console2.log("VRF_WRAPPER", cfg.vrfWrapper);
        console2.log("vrfHub", address(d.vrf));
        console2.log("poolRegistry", address(d.poolRegistry));
        console2.log("settlementRouter", address(d.router));
        console2.log("refRegistry", address(d.refRegistry));
        console2.log("refEngine", address(d.refEngine));
        console2.log("gameHub", address(d.gameHub));
        console2.log("NUM_POOLS", pools.length);
        for (uint256 i = 0; i < pools.length; ++i) {
            string memory suffix = vm.toString(i);
            console2.log(string.concat("poolId_", suffix), pools[i].poolId);
            console2.log(string.concat("poolDomain_", suffix), _domainLabel(pools[i].domain));
            console2.log(string.concat("poolAsset_", suffix), pools[i].asset);
            console2.log(string.concat("poolBank_", suffix), pools[i].bank);
        }
        console2.log("wiringOperationId", vm.toString(vm.parseJsonBytes32(snap, ".wiringOperationId")));
        console2.log("activationOperationId", vm.toString(vm.parseJsonBytes32(snap, ".activationOperationId")));
        console2.log("Next: the Safe schedules the wiring batch (make timelock-batches-v16).");
    }

    function _snapshotJson(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d)
        internal
        returns (string memory)
    {
        string memory obj = "ssot";
        string memory json;

        json = vm.serializeString(obj, "architectureVersion", "v1.6-nft-liquidity");
        json = vm.serializeUint(obj, "chainId", block.chainid);
        // The release history starts before the timelock exists, so a replay from here sees its constructor's
        // RoleGranted and MinDelayChange events and every later authorization event of the governed contracts.
        json = vm.serializeUint(obj, "blockNumber", cfg.originBlock);
        json = vm.serializeUint(obj, "timestamp", cfg.originTimestamp);
        json = vm.serializeAddress(obj, "deployer", cfg.deployer);
        json = vm.serializeAddress(obj, "gov", cfg.safe);
        json = vm.serializeBytes32(obj, "safeOwnersHash", cfg.safeOwnersHash);
        json = vm.serializeBytes32(obj, "safeCodeHash", cfg.safeCodeHash);
        json = vm.serializeBytes32(obj, "safeControlHash", cfg.safeControlHash);
        json = vm.serializeAddress(obj, "guardian", cfg.guardian);
        json = vm.serializeBytes32(obj, "guardianOwnersHash", cfg.guardianOwnersHash);
        json = vm.serializeBytes32(obj, "guardianCodeHash", cfg.guardianCodeHash);
        json = vm.serializeBytes32(obj, "guardianControlHash", cfg.guardianControlHash);
        json = vm.serializeAddress(obj, "keeper", cfg.keeper);
        json = vm.serializeAddress(obj, "releaseSigner", cfg.releaseSigner);
        json = vm.serializeAddress(obj, "treasury", cfg.treasury);

        json = vm.serializeAddress(obj, "governanceTimelock", address(d.timelock));
        json = vm.serializeUint(obj, "timelockMinDelay", d.timelock.getMinDelay());

        json = vm.serializeAddress(obj, "vrfWrapper", cfg.vrfWrapper);
        json = vm.serializeAddress(obj, "vrfHub", address(d.vrf));

        json = vm.serializeAddress(obj, "poolRegistry", address(d.poolRegistry));
        json = vm.serializeAddress(obj, "settlementRouter", address(d.router));
        json = vm.serializeAddress(obj, "refRegistry", address(d.refRegistry));
        json = vm.serializeAddress(obj, "refEngine", address(d.refEngine));
        json = vm.serializeAddress(obj, "gameHub", address(d.gameHub));

        json = vm.serializeAddress(obj, "moduleDice", address(d.dice));
        json = vm.serializeAddress(obj, "moduleCoinToss", address(d.coin));
        json = vm.serializeAddress(obj, "moduleRoulette", address(d.roulette));
        json = vm.serializeAddress(obj, "moduleKeno", address(d.keno));
        json = vm.serializeAddress(obj, "modulePlinko", address(d.plinko));
        json = vm.serializeAddress(obj, "moduleSicBo", address(d.sicBo));
        json = vm.serializeAddress(obj, "moduleSlots", address(d.slots));
        json = vm.serializeAddress(obj, "moduleBaccarat", address(d.baccarat));

        json = vm.serializeBytes32(obj, "codeHash_governanceTimelock", address(d.timelock).codehash);
        json = vm.serializeBytes32(obj, "codeHash_vrfHub", address(d.vrf).codehash);
        json = vm.serializeBytes32(obj, "codeHash_poolRegistry", address(d.poolRegistry).codehash);
        json = vm.serializeBytes32(obj, "codeHash_settlementRouter", address(d.router).codehash);
        json = vm.serializeBytes32(obj, "codeHash_refRegistry", address(d.refRegistry).codehash);
        json = vm.serializeBytes32(obj, "codeHash_refEngine", address(d.refEngine).codehash);
        json = vm.serializeBytes32(obj, "codeHash_gameHub", address(d.gameHub).codehash);
        json = vm.serializeBytes32(obj, "codeHash_moduleDice", address(d.dice).codehash);
        json = vm.serializeBytes32(obj, "codeHash_moduleCoinToss", address(d.coin).codehash);
        json = vm.serializeBytes32(obj, "codeHash_moduleRoulette", address(d.roulette).codehash);
        json = vm.serializeBytes32(obj, "codeHash_moduleKeno", address(d.keno).codehash);
        json = vm.serializeBytes32(obj, "codeHash_modulePlinko", address(d.plinko).codehash);
        json = vm.serializeBytes32(obj, "codeHash_moduleSicBo", address(d.sicBo).codehash);
        json = vm.serializeBytes32(obj, "codeHash_moduleSlots", address(d.slots).codehash);
        json = vm.serializeBytes32(obj, "codeHash_moduleBaccarat", address(d.baccarat).codehash);
        for (uint256 i; i < pools.length; ++i) {
            json = vm.serializeBytes32(obj, string.concat("codeHash_poolBank_", vm.toString(i)), pools[i].bank.codehash);
        }
        json = _writeConfigJson(obj, json, cfg);
        json = _writeCtorJson(obj, json, cfg, d);
        json = _writePoolJson(obj, json, cfg, pools, d);

        // The two operations follow from everything above; the release digest signs their ids.
        json = vm.serializeBytes32(obj, "wiringOperationId", V16Batches.id(V16Batches.wiring(json)));
        json = vm.serializeBytes32(obj, "activationOperationId", V16Batches.id(V16Batches.activation(json)));
        return json;
    }

    function _writeArtifacts(string memory snap) internal virtual {
        _safeCreateDir("deployments/snapshots");
        string memory tag = string.concat(
            vm.toString(block.chainid), "-", vm.toString(vm.parseJsonUint(snap, ".blockNumber")), "-v16"
        );
        string memory snapPath = string.concat("deployments/snapshots/deploy-", tag, ".json");

        _safeWriteJson(snap, snapPath);
        _safeWriteJson(snap, "deployments/latest-v16.json");
        console2.log("Wrote v1.6 deployment snapshot:", snapPath);
        console2.log("Wrote v1.6 deployment snapshot:", "deployments/latest-v16.json");
    }

    function _writeConfigJson(string memory obj, string memory json, DeployConfig memory cfg)
        internal
        returns (string memory)
    {
        json = vm.serializeUint(obj, "refundTimeoutSeconds", cfg.refundTimeoutSeconds);
        json = vm.serializeUint(obj, "defaultHouseEdgeBps", cfg.defaultHouseEdgeBps);
        json = vm.serializeUint(obj, "lpShareBps", HouseEdgeLib.LP_SHARE_BPS);
        json = vm.serializeUint(obj, "refL0Bps", cfg.refConfig.l0Bps);
        json = vm.serializeUint(obj, "refL1Bps", cfg.refConfig.l1Bps);
        json = vm.serializeUint(obj, "refL2Bps", cfg.refConfig.l2Bps);
        json = vm.serializeUint(obj, "refHoldbackBps", cfg.refConfig.holdbackBps);
        (string[8] memory names,) = V16Batches.games();
        for (uint256 g; g < names.length; ++g) {
            json = vm.serializeUint(obj, string.concat("gameMaxBetCount_", names[g]), cfg.games[g].maxBetCount);
            json =
                vm.serializeUint(obj, string.concat("gameCallbackGasLimit_", names[g]), cfg.games[g].callbackGasLimit);
        }
        return json;
    }

    function _writeCtorJson(string memory obj, string memory json, DeployConfig memory cfg, Deployed memory d)
        internal
        returns (string memory)
    {
        address gov = address(d.timelock);
        json = vm.serializeString(
            obj,
            "ctorArgs_governanceTimelock",
            vm.toString(abi.encode(d.timelock.getMinDelay(), _list(cfg.safe), _list(cfg.guardian), _list(address(0))))
        );
        json = vm.serializeString(obj, "ctorArgs_vrfHub", vm.toString(abi.encode(cfg.vrfWrapper, address(d.router))));
        json = vm.serializeString(obj, "ctorArgs_poolRegistry", vm.toString(abi.encode(gov)));
        json = vm.serializeString(obj, "ctorArgs_settlementRouter", vm.toString(abi.encode(address(d.poolRegistry))));
        json = vm.serializeString(obj, "ctorArgs_refRegistry", vm.toString(abi.encode(gov)));
        json = vm.serializeString(obj, "ctorArgs_refEngine", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleDice", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleCoinToss", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleRoulette", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleKeno", "0x");
        json = vm.serializeString(obj, "ctorArgs_modulePlinko", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleSicBo", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleSlots", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleBaccarat", "0x");
        json = vm.serializeString(obj, "ctorArgs_gameHub", _gameHubCtorArgs(cfg, d));
        return json;
    }

    function _writePoolJson(
        string memory obj,
        string memory json,
        DeployConfig memory,
        PoolConfig[] memory pools,
        Deployed memory d
    ) internal returns (string memory) {
        json = vm.serializeUint(obj, "numPools", pools.length);
        for (uint256 i = 0; i < pools.length; ++i) {
            string memory suffix = vm.toString(i);
            (string memory assetSymbol, uint8 assetDecimals) = _tryAssetMetadata(pools[i].asset);

            json = vm.serializeUint(obj, string.concat("poolId_", suffix), pools[i].poolId);
            json = vm.serializeUint(obj, string.concat("poolDomain_", suffix), uint256(pools[i].domain));
            json = vm.serializeString(obj, string.concat("poolDomainLabel_", suffix), _domainLabel(pools[i].domain));
            json = vm.serializeAddress(obj, string.concat("poolAsset_", suffix), pools[i].asset);
            json = vm.serializeString(obj, string.concat("poolAssetSymbol_", suffix), assetSymbol);
            json = vm.serializeAddress(obj, string.concat("poolBank_", suffix), pools[i].bank);
            address vault = Bank(pools[i].bank).vault();
            json = vm.serializeAddress(obj, string.concat("poolVault_", suffix), vault);
            json = vm.serializeBytes32(obj, string.concat("codeHash_poolVault_", suffix), vault.codehash);
            json = vm.serializeString(
                obj, string.concat("ctorArgs_vault_", suffix), vm.toString(abi.encode(pools[i].asset, pools[i].bank))
            );
            require(
                pools[i].assetDecimals == assetDecimals
                    && pools[i].assetDecimals == Bank(pools[i].bank).assetDecimals(),
                "pool precision mismatch"
            );
            json = vm.serializeUint(obj, string.concat("poolBankMinBetAmount_", suffix), pools[i].minBetAmount);
            json = vm.serializeUint(obj, string.concat("poolBankRiskReserveBps_", suffix), pools[i].riskReserveBps);
            json = vm.serializeUint(
                obj, string.concat("poolBankWithdrawalBufferBps_", suffix), pools[i].withdrawalBufferBps
            );
            json = vm.serializeUint(
                obj, string.concat("poolBankMinTurnoverForUnlock_", suffix), pools[i].minTurnoverForUnlock
            );
            json = vm.serializeUint(
                obj, string.concat("poolBankHoldbackVestingSeconds_", suffix), pools[i].holdbackVestingSeconds
            );
            json = vm.serializeUint(obj, string.concat("poolAssetDecimals_", suffix), pools[i].assetDecimals);

            json = vm.serializeString(
                obj,
                string.concat("ctorArgs_bank_", suffix),
                vm.toString(
                    abi.encode(
                        pools[i].asset,
                        address(d.timelock),
                        pools[i].riskReserveBps,
                        pools[i].assetDecimals,
                        pools[i].minBetAmount
                    )
                )
            );
        }
        return json;
    }

    function _gameHubCtorArgs(DeployConfig memory cfg, Deployed memory d) internal pure returns (string memory) {
        return vm.toString(
            abi.encode(
                address(d.router),
                address(d.vrf),
                address(d.refRegistry),
                address(d.refEngine),
                address(d.timelock),
                cfg.refundTimeoutSeconds,
                cfg.defaultHouseEdgeBps,
                cfg.refConfig.l0Bps,
                cfg.refConfig.l1Bps,
                cfg.refConfig.l2Bps,
                cfg.refConfig.holdbackBps
            )
        );
    }

    function _safeCreateDir(string memory path) internal {
        vm.createDir(path, true);
    }

    function _safeWriteJson(string memory json, string memory path) internal {
        vm.writeJson(json, path);
    }

    function _tryAssetMetadata(address token) internal view returns (string memory sym, uint8 dec) {
        sym = "";
        dec = 18;
        if (token.code.length == 0) {
            return (sym, dec);
        }
        try IERC20MetadataLikeV16(token).symbol() returns (string memory s) {
            sym = s;
        } catch {}
        dec = IERC20MetadataLikeV16(token).decimals();
        require(dec <= 77, "asset decimals out of range");
    }

    function _domainLabel(SSOTTypes.PoolDomain domain) internal pure returns (string memory) {
        return domain == SSOTTypes.PoolDomain.Casino ? "Casino" : "Unknown";
    }
}
