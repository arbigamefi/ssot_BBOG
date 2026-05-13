// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {Bank} from "../src/core/Bank.sol";
import {GameHub} from "../src/core/GameHub.sol";
import {PoolRegistry} from "../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../src/core/SettlementRouter.sol";
import {SportsHub} from "../src/core/SportsHub.sol";
import {SportsRiskEngine} from "../src/core/SportsRiskEngine.sol";
import {VRFHub} from "../src/core/VRFHub.sol";
import {SSOTTypes} from "../src/core/interfaces/SSOTTypes.sol";

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

import {ChainlinkV2PlusWrapperAdapter} from "../src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol";

interface IERC20MetadataLikeV13 {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

/// @notice Deployment script for SSOT v1.3 router/pool topology.
///
/// Required env:
///   PRIVATE_KEY, GOV, VRF_WRAPPER, NUM_POOLS, POOL_ASSET_0...
///
/// Per-pool env:
///   POOL_ID_i                         default i + 1
///   POOL_ASSET_i                      required
///   POOL_DOMAIN_i                     default 1; 1=Casino, 2=Sports, 3=Future
///   BANK_MIN_LIQ_BPS_i                default 1000
///   BANK_MIN_TURNOVER_FOR_UNLOCK_i    default 20 ether
///   BANK_HOLDBACK_VESTING_SECONDS_i   default 86400
///   LP_NAME_i / LP_SYMBOL_i / LP_DECIMALS_i
///
/// Required when any pool uses POOL_DOMAIN_i=2 (Sports):
///   SPORTS_MAX_STAKE, SPORTS_MAX_PAYOUT, SPORTS_MAX_MARKET_RESERVED,
///   SPORTS_MAX_OUTCOME_RESERVED, SPORTS_MAX_EVENT_RESERVED,
///   SPORTS_ODDS_SIGNER_SET_HASH, SPORTS_RESULT_REPORTER_SET_HASH
/// Optional per-Sports-pool overrides:
///   SPORTS_MAX_STAKE_POOL_i, SPORTS_MAX_PAYOUT_POOL_i, SPORTS_MAX_MARKET_RESERVED_POOL_i,
///   SPORTS_MAX_OUTCOME_RESERVED_POOL_i, SPORTS_MAX_EVENT_RESERVED_POOL_i
/// Optional Sports bootstrap allowlists:
///   SPORTS_ODDS_SIGNER, SPORTS_RESULT_REPORTER, SPORTS_RESULT_CHALLENGER, SPORTS_RESULT_ARBITRATOR
/// Optional Sports dispute policy:
///   SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS default 604800; minimum 600
///
/// Example:
///   forge script script/DeployV13.s.sol:DeployV13 --rpc-url $RPC_URL --broadcast -vvv
contract DeployV13 is Script {
    bytes32 internal constant GAME_DICE = keccak256("DICE");
    bytes32 internal constant GAME_COIN = keccak256("COIN_TOSS");
    bytes32 internal constant GAME_ROULETTE = keccak256("ROULETTE");
    bytes32 internal constant GAME_KENO = keccak256("KENO");
    bytes32 internal constant GAME_PLINKO = keccak256("PLINKO");
    bytes32 internal constant GAME_SIC_BO = keccak256("SIC_BO");
    bytes32 internal constant GAME_SLOTS = keccak256("SLOTS");
    bytes32 internal constant GAME_BACCARAT = keccak256("BACCARAT");
    uint64 internal constant MIN_RESULT_CHALLENGE_TIMEOUT_SECONDS = 10 minutes;
    uint64 internal constant DEFAULT_RESULT_CHALLENGE_TIMEOUT_SECONDS = 7 days;

    struct RefConfig {
        uint16 baseBudgetBps;
        uint16 deltaBudgetBps;
        uint16 holdbackBps;
        uint16[6] levelBps;
        uint8 levels;
    }

    struct SportsConfig {
        bool enabled;
        uint256 maxStake;
        uint256 maxPayout;
        uint256 maxMarketReserved;
        uint256 maxOutcomeReserved;
        uint256 maxEventReserved;
        bytes32 oddsSignerSetHash;
        bytes32 resultReporterSetHash;
        uint8 resultReporterThreshold;
        uint64 resultChallengeTimeoutSeconds;
        address oddsSigner;
        address resultReporter;
        address resultChallenger;
        address resultArbitrator;
    }

    struct DeployConfig {
        uint256 privateKey;
        address deployer;
        address gov;
        address treasury;
        address vrfWrapper;
        uint256 requestGasPriceWei;
        uint256 refundTimeoutSeconds;
        uint16 defaultHouseEdgeBps;
        uint16 maxAffiliateDeltaBps;
        uint256 poolCount;
        RefConfig refConfig;
        SportsConfig sportsConfig;
    }

    struct PoolConfig {
        uint64 poolId;
        address asset;
        address bank;
        SSOTTypes.PoolDomain domain;
        uint16 minLiqBps;
        uint256 minTurnoverForUnlock;
        uint256 holdbackVestingSeconds;
        string lpName;
        string lpSymbol;
        uint8 lpDecimals;
        uint256 sportsMaxStake;
        uint256 sportsMaxPayout;
        uint256 sportsMaxMarketReserved;
        uint256 sportsMaxOutcomeReserved;
        uint256 sportsMaxEventReserved;
    }

    struct Deployed {
        ChainlinkV2PlusWrapperAdapter adapter;
        VRFHub vrf;
        PoolRegistry poolRegistry;
        SettlementRouter router;
        ReferralRegistry refRegistry;
        DefaultReferralEngine refEngine;
        GameHub gameHub;
        SportsRiskEngine sportsRiskEngine;
        SportsHub sportsHub;
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
        require(cfg.deployer == cfg.gov, "PRIVATE_KEY must correspond to GOV");
        require(cfg.poolCount >= 1 && cfg.poolCount <= 32, "NUM_POOLS out of range");

        PoolConfig[] memory pools = new PoolConfig[](cfg.poolCount);
        for (uint256 i = 0; i < cfg.poolCount; ++i) {
            pools[i] = _readPoolConfig(i);
        }
        bool hasSports = _hasSportsPool(pools);
        require(_hasCasinoPool(pools) || hasSports, "at least one Casino or Sports pool required");
        cfg.sportsConfig = _readSportsConfig(hasSports);
        _readSportsPoolLimits(cfg.sportsConfig, pools);

        vm.startBroadcast(cfg.privateKey);

        Deployed memory d;

        d.adapter = new ChainlinkV2PlusWrapperAdapter(cfg.vrfWrapper, cfg.gov);
        d.vrf = new VRFHub(address(d.adapter), cfg.gov);
        d.adapter.setVRFHub(address(d.vrf));
        d.adapter.setRequestGasPriceWei(cfg.requestGasPriceWei);
        d.vrf.setAdapter(address(d.adapter));

        d.poolRegistry = new PoolRegistry(cfg.gov);
        d.router = new SettlementRouter(address(d.poolRegistry));
        d.refRegistry = new ReferralRegistry(cfg.gov);
        d.refEngine = new DefaultReferralEngine();

        d.gameHub = new GameHub(
            address(d.router),
            address(d.vrf),
            address(d.refRegistry),
            address(d.refEngine),
            cfg.gov,
            cfg.refundTimeoutSeconds,
            cfg.defaultHouseEdgeBps,
            cfg.maxAffiliateDeltaBps,
            cfg.refConfig.baseBudgetBps,
            cfg.refConfig.deltaBudgetBps,
            cfg.refConfig.holdbackBps,
            cfg.refConfig.levelBps,
            cfg.refConfig.levels
        );

        d.refRegistry.setBinderOnce(address(d.gameHub));
        d.poolRegistry.setHubRegistered(address(d.gameHub), true);

        if (cfg.sportsConfig.enabled) {
            d.sportsRiskEngine = new SportsRiskEngine(
                cfg.gov,
                cfg.sportsConfig.maxStake,
                cfg.sportsConfig.maxPayout,
                cfg.sportsConfig.maxMarketReserved,
                cfg.sportsConfig.maxOutcomeReserved,
                cfg.sportsConfig.maxEventReserved
            );
            d.sportsHub = new SportsHub(
                address(d.router),
                address(d.sportsRiskEngine),
                cfg.gov,
                cfg.sportsConfig.oddsSignerSetHash,
                cfg.sportsConfig.resultReporterSetHash
            );
            d.poolRegistry.setHubRegistered(address(d.sportsHub), true);
            if (cfg.sportsConfig.oddsSigner != address(0)) {
                d.sportsHub.setOddsSigner(cfg.sportsConfig.oddsSigner, true);
            }
            if (cfg.sportsConfig.resultReporter != address(0)) {
                d.sportsHub.setResultReporter(cfg.sportsConfig.resultReporter, true);
            }
            if (cfg.sportsConfig.resultReporterThreshold != 1) {
                d.sportsHub.setResultReporterThreshold(cfg.sportsConfig.resultReporterThreshold);
            }
            if (cfg.sportsConfig.resultChallengeTimeoutSeconds != DEFAULT_RESULT_CHALLENGE_TIMEOUT_SECONDS) {
                d.sportsHub.setResultChallengeTimeoutSeconds(cfg.sportsConfig.resultChallengeTimeoutSeconds);
            }
            if (cfg.sportsConfig.resultChallenger != address(0)) {
                d.sportsHub.setResultChallenger(cfg.sportsConfig.resultChallenger, true);
            }
            if (cfg.sportsConfig.resultArbitrator != address(0)) {
                d.sportsHub.setResultArbitrator(cfg.sportsConfig.resultArbitrator, true);
            }
            for (uint256 i = 0; i < pools.length; ++i) {
                if (pools[i].domain == SSOTTypes.PoolDomain.Sports) {
                    d.sportsRiskEngine
                        .setPoolLimits(
                            pools[i].poolId,
                            pools[i].sportsMaxStake,
                            pools[i].sportsMaxPayout,
                            pools[i].sportsMaxMarketReserved,
                            pools[i].sportsMaxOutcomeReserved,
                            pools[i].sportsMaxEventReserved
                        );
                }
            }
        }

        for (uint256 i = 0; i < pools.length; ++i) {
            Bank bank = new Bank(
                pools[i].asset, cfg.gov, pools[i].minLiqBps, pools[i].lpName, pools[i].lpSymbol, pools[i].lpDecimals
            );
            pools[i].bank = address(bank);

            d.poolRegistry.registerPool(pools[i].poolId, pools[i].asset, pools[i].bank, pools[i].domain);
            bank.setSettlementRouterOnce(address(d.router));
            bank.setMinPlayerTurnoverForUnlock(pools[i].minTurnoverForUnlock);
            bank.setHoldbackVestingSeconds(pools[i].holdbackVestingSeconds);

            if (pools[i].domain == SSOTTypes.PoolDomain.Casino) {
                d.poolRegistry.setHubAllowedForPool(pools[i].poolId, address(d.gameHub), true);
            } else if (pools[i].domain == SSOTTypes.PoolDomain.Sports) {
                d.poolRegistry.setHubAllowedForPool(pools[i].poolId, address(d.sportsHub), true);
            }
        }

        d.dice = new DiceModule();
        d.coin = new CoinTossModule();
        d.roulette = new RouletteModule();
        d.keno = new KenoModule();
        d.plinko = new PlinkoModule();
        d.sicBo = new SicBoModule();
        d.slots = new SlotsModule();
        d.baccarat = new BaccaratModule();

        d.gameHub.registerGame(GAME_DICE, address(d.dice));
        d.gameHub.registerGame(GAME_COIN, address(d.coin));
        d.gameHub.registerGame(GAME_ROULETTE, address(d.roulette));
        d.gameHub.registerGame(GAME_KENO, address(d.keno));
        d.gameHub.registerGame(GAME_PLINKO, address(d.plinko));
        d.gameHub.registerGame(GAME_SIC_BO, address(d.sicBo));
        d.gameHub.registerGame(GAME_SLOTS, address(d.slots));
        d.gameHub.registerGame(GAME_BACCARAT, address(d.baccarat));

        vm.stopBroadcast();

        _logDeployment(cfg, pools, d);
        _writeArtifacts(cfg, pools, d);
    }

    function _readDeployConfig() internal view returns (DeployConfig memory cfg) {
        cfg.privateKey = vm.envUint("PRIVATE_KEY");
        cfg.gov = vm.envAddress("GOV");
        cfg.deployer = vm.addr(cfg.privateKey);
        cfg.treasury = vm.envOr("TREASURY", address(0));
        cfg.vrfWrapper = vm.envAddress("VRF_WRAPPER");
        cfg.requestGasPriceWei = vm.envOr("REQUEST_GAS_PRICE_WEI", uint256(0));
        cfg.refundTimeoutSeconds = vm.envOr("REFUND_TIMEOUT_SECONDS", uint256(3600));
        cfg.defaultHouseEdgeBps = uint16(vm.envOr("DEFAULT_HOUSE_EDGE_BPS", uint256(200)));
        cfg.maxAffiliateDeltaBps = uint16(vm.envOr("MAX_AFFILIATE_DELTA_BPS", uint256(0)));
        cfg.poolCount = vm.envOr("NUM_POOLS", uint256(1));

        cfg.refConfig.baseBudgetBps = uint16(vm.envOr("REF_BASE_BUDGET_BPS", uint256(10_000)));
        cfg.refConfig.deltaBudgetBps = uint16(vm.envOr("REF_DELTA_BUDGET_BPS", uint256(10_000)));
        cfg.refConfig.holdbackBps = uint16(vm.envOr("REF_HOLDBACK_BPS", uint256(3000)));
        cfg.refConfig.levels = uint8(vm.envOr("REF_LEVELS", uint256(2)));
        cfg.refConfig.levelBps[0] = uint16(vm.envOr("REF_LEVEL0_BPS", uint256(0)));
        cfg.refConfig.levelBps[1] = uint16(vm.envOr("REF_LEVEL1_BPS", uint256(10_000)));
        cfg.refConfig.levelBps[2] = uint16(vm.envOr("REF_LEVEL2_BPS", uint256(0)));
        cfg.refConfig.levelBps[3] = uint16(vm.envOr("REF_LEVEL3_BPS", uint256(0)));
        cfg.refConfig.levelBps[4] = uint16(vm.envOr("REF_LEVEL4_BPS", uint256(0)));
        cfg.refConfig.levelBps[5] = uint16(vm.envOr("REF_LEVEL5_BPS", uint256(0)));
    }

    function _readSportsConfig(bool enabled) internal view returns (SportsConfig memory cfg) {
        if (!enabled) return cfg;

        cfg.enabled = true;
        cfg.maxStake = vm.envUint("SPORTS_MAX_STAKE");
        cfg.maxPayout = vm.envUint("SPORTS_MAX_PAYOUT");
        cfg.maxMarketReserved = vm.envUint("SPORTS_MAX_MARKET_RESERVED");
        cfg.maxOutcomeReserved = vm.envUint("SPORTS_MAX_OUTCOME_RESERVED");
        cfg.maxEventReserved = vm.envUint("SPORTS_MAX_EVENT_RESERVED");
        cfg.oddsSignerSetHash = vm.envBytes32("SPORTS_ODDS_SIGNER_SET_HASH");
        cfg.resultReporterSetHash = vm.envBytes32("SPORTS_RESULT_REPORTER_SET_HASH");
        uint256 resultReporterThreshold = vm.envOr("SPORTS_RESULT_REPORTER_THRESHOLD", uint256(1));
        require(
            resultReporterThreshold > 0 && resultReporterThreshold <= type(uint8).max,
            "SPORTS_RESULT_REPORTER_THRESHOLD out of range"
        );
        cfg.resultReporterThreshold = uint8(resultReporterThreshold);
        uint256 resultChallengeTimeoutSeconds =
            vm.envOr("SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS", uint256(DEFAULT_RESULT_CHALLENGE_TIMEOUT_SECONDS));
        require(
            resultChallengeTimeoutSeconds >= MIN_RESULT_CHALLENGE_TIMEOUT_SECONDS
                && resultChallengeTimeoutSeconds <= type(uint64).max,
            "SPORTS_RESULT_CHALLENGE_TIMEOUT_SECONDS out of range"
        );
        cfg.resultChallengeTimeoutSeconds = uint64(resultChallengeTimeoutSeconds);
        cfg.oddsSigner = vm.envOr("SPORTS_ODDS_SIGNER", address(0));
        cfg.resultReporter = vm.envOr("SPORTS_RESULT_REPORTER", address(0));
        cfg.resultChallenger = vm.envOr("SPORTS_RESULT_CHALLENGER", address(0));
        cfg.resultArbitrator = vm.envOr("SPORTS_RESULT_ARBITRATOR", address(0));
    }

    function _readSportsPoolLimits(SportsConfig memory sportsConfig, PoolConfig[] memory pools) internal view {
        if (!sportsConfig.enabled) return;

        for (uint256 i = 0; i < pools.length; ++i) {
            if (pools[i].domain != SSOTTypes.PoolDomain.Sports) continue;

            string memory suffix = vm.toString(i);
            pools[i].sportsMaxStake = vm.envOr(string.concat("SPORTS_MAX_STAKE_POOL_", suffix), sportsConfig.maxStake);
            pools[i].sportsMaxPayout =
                vm.envOr(string.concat("SPORTS_MAX_PAYOUT_POOL_", suffix), sportsConfig.maxPayout);
            pools[i].sportsMaxMarketReserved =
                vm.envOr(string.concat("SPORTS_MAX_MARKET_RESERVED_POOL_", suffix), sportsConfig.maxMarketReserved);
            pools[i].sportsMaxOutcomeReserved =
                vm.envOr(string.concat("SPORTS_MAX_OUTCOME_RESERVED_POOL_", suffix), sportsConfig.maxOutcomeReserved);
            pools[i].sportsMaxEventReserved =
                vm.envOr(string.concat("SPORTS_MAX_EVENT_RESERVED_POOL_", suffix), sportsConfig.maxEventReserved);
        }
    }

    function _readPoolConfig(uint256 i) internal view returns (PoolConfig memory cfg) {
        string memory suffix = vm.toString(i);
        cfg.poolId = uint64(vm.envOr(string.concat("POOL_ID_", suffix), i + 1));
        cfg.asset = vm.envAddress(string.concat("POOL_ASSET_", suffix));
        require(cfg.asset != address(0), "POOL_ASSET_i required");

        uint256 domainRaw = vm.envOr(string.concat("POOL_DOMAIN_", suffix), uint256(1));
        cfg.domain = _domainFromRaw(domainRaw);

        cfg.minLiqBps = uint16(vm.envOr(string.concat("BANK_MIN_LIQ_BPS_", suffix), uint256(1000)));
        cfg.minTurnoverForUnlock = vm.envOr(string.concat("BANK_MIN_TURNOVER_FOR_UNLOCK_", suffix), uint256(20 ether));
        cfg.holdbackVestingSeconds = vm.envOr(string.concat("BANK_HOLDBACK_VESTING_SECONDS_", suffix), uint256(86400));
        cfg.lpName = vm.envOr(string.concat("LP_NAME_", suffix), string.concat("LP Share Pool #", suffix));
        cfg.lpSymbol = vm.envOr(string.concat("LP_SYMBOL_", suffix), string.concat("LP", suffix));
        cfg.lpDecimals = uint8(vm.envOr(string.concat("LP_DECIMALS_", suffix), uint256(18)));
    }

    function _domainFromRaw(uint256 raw) internal pure returns (SSOTTypes.PoolDomain) {
        require(
            raw >= uint256(SSOTTypes.PoolDomain.Casino) && raw <= uint256(SSOTTypes.PoolDomain.Future), "bad domain"
        );
        return SSOTTypes.PoolDomain(raw);
    }

    function _logDeployment(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d) internal pure {
        console2.log("GOV", cfg.gov);
        console2.log("VRF_WRAPPER", cfg.vrfWrapper);
        console2.log("adapter", address(d.adapter));
        console2.log("vrfHub", address(d.vrf));
        console2.log("poolRegistry", address(d.poolRegistry));
        console2.log("settlementRouter", address(d.router));
        console2.log("refRegistry", address(d.refRegistry));
        console2.log("refEngine", address(d.refEngine));
        console2.log("gameHub", address(d.gameHub));
        console2.log("sportsRiskEngine", address(d.sportsRiskEngine));
        console2.log("sportsHub", address(d.sportsHub));
        console2.log("NUM_POOLS", pools.length);
        for (uint256 i = 0; i < pools.length; ++i) {
            string memory suffix = vm.toString(i);
            console2.log(string.concat("poolId_", suffix), pools[i].poolId);
            console2.log(string.concat("poolDomain_", suffix), _domainLabel(pools[i].domain));
            console2.log(string.concat("poolAsset_", suffix), pools[i].asset);
            console2.log(string.concat("poolBank_", suffix), pools[i].bank);
        }
    }

    function _writeArtifacts(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d) internal {
        _safeCreateDir("deployments/snapshots");
        _safeCreateDir("deployments/verify");

        string memory obj = "ssot";
        string memory json;

        json = vm.serializeString(obj, "architectureVersion", "v1.3-router-pools");
        json = vm.serializeUint(obj, "chainId", block.chainid);
        json = vm.serializeUint(obj, "blockNumber", block.number);
        json = vm.serializeUint(obj, "timestamp", block.timestamp);
        json = vm.serializeAddress(obj, "deployer", cfg.deployer);
        json = vm.serializeAddress(obj, "gov", cfg.gov);
        json = vm.serializeAddress(obj, "treasury", cfg.treasury);

        json = vm.serializeAddress(obj, "vrfWrapper", cfg.vrfWrapper);
        json = vm.serializeAddress(obj, "adapter", address(d.adapter));
        json = vm.serializeAddress(obj, "vrfHub", address(d.vrf));
        json = vm.serializeUint(obj, "requestGasPriceWei", cfg.requestGasPriceWei);

        json = vm.serializeAddress(obj, "poolRegistry", address(d.poolRegistry));
        json = vm.serializeAddress(obj, "settlementRouter", address(d.router));
        json = vm.serializeAddress(obj, "refRegistry", address(d.refRegistry));
        json = vm.serializeAddress(obj, "refEngine", address(d.refEngine));
        json = vm.serializeAddress(obj, "gameHub", address(d.gameHub));
        json = vm.serializeAddress(obj, "sportsRiskEngine", address(d.sportsRiskEngine));
        json = vm.serializeAddress(obj, "sportsHub", address(d.sportsHub));

        json = vm.serializeAddress(obj, "moduleDice", address(d.dice));
        json = vm.serializeAddress(obj, "moduleCoinToss", address(d.coin));
        json = vm.serializeAddress(obj, "moduleRoulette", address(d.roulette));
        json = vm.serializeAddress(obj, "moduleKeno", address(d.keno));
        json = vm.serializeAddress(obj, "modulePlinko", address(d.plinko));
        json = vm.serializeAddress(obj, "moduleSicBo", address(d.sicBo));
        json = vm.serializeAddress(obj, "moduleSlots", address(d.slots));
        json = vm.serializeAddress(obj, "moduleBaccarat", address(d.baccarat));

        json = _writeConfigJson(obj, json, cfg);
        json = _writeCtorJson(obj, json, cfg, d);
        json = _writePoolJson(obj, json, cfg, pools, d);

        string memory tag = string.concat(vm.toString(block.chainid), "-", vm.toString(block.number), "-v13");
        string memory snapPath = string.concat("deployments/snapshots/deploy-", tag, ".json");

        _safeWriteJson(json, snapPath);
        _safeWriteJson(json, "deployments/latest-v13.json");
        console2.log("Wrote v1.3 deployment snapshot:", snapPath);
        console2.log("Wrote v1.3 deployment snapshot:", "deployments/latest-v13.json");

        string memory sh = _verifyScript(cfg, pools, d);
        string memory verifyPath = string.concat("deployments/verify/verify-", tag, ".sh");

        _safeWriteFile(verifyPath, sh);
        _safeWriteFile("deployments/verify-latest-v13.sh", sh);
        console2.log("Wrote v1.3 verify helper:", verifyPath);
        console2.log("Wrote v1.3 verify helper:", "deployments/verify-latest-v13.sh");
    }

    function _writeConfigJson(string memory obj, string memory json, DeployConfig memory cfg)
        internal
        returns (string memory)
    {
        json = vm.serializeUint(obj, "refundTimeoutSeconds", cfg.refundTimeoutSeconds);
        json = vm.serializeUint(obj, "defaultHouseEdgeBps", cfg.defaultHouseEdgeBps);
        json = vm.serializeUint(obj, "maxAffiliateDeltaBps", cfg.maxAffiliateDeltaBps);
        json = vm.serializeUint(obj, "refBaseBudgetBps", cfg.refConfig.baseBudgetBps);
        json = vm.serializeUint(obj, "refDeltaBudgetBps", cfg.refConfig.deltaBudgetBps);
        json = vm.serializeUint(obj, "refHoldbackBps", cfg.refConfig.holdbackBps);
        json = vm.serializeUint(obj, "refLevels", cfg.refConfig.levels);
        json = vm.serializeUint(obj, "refLevel0Bps", cfg.refConfig.levelBps[0]);
        json = vm.serializeUint(obj, "refLevel1Bps", cfg.refConfig.levelBps[1]);
        json = vm.serializeUint(obj, "refLevel2Bps", cfg.refConfig.levelBps[2]);
        json = vm.serializeUint(obj, "refLevel3Bps", cfg.refConfig.levelBps[3]);
        json = vm.serializeUint(obj, "refLevel4Bps", cfg.refConfig.levelBps[4]);
        json = vm.serializeUint(obj, "refLevel5Bps", cfg.refConfig.levelBps[5]);
        json = vm.serializeUint(obj, "sportsEnabled", cfg.sportsConfig.enabled ? 1 : 0);
        json = vm.serializeUint(obj, "sportsMaxStake", cfg.sportsConfig.maxStake);
        json = vm.serializeUint(obj, "sportsMaxPayout", cfg.sportsConfig.maxPayout);
        json = vm.serializeUint(obj, "sportsMaxMarketReserved", cfg.sportsConfig.maxMarketReserved);
        json = vm.serializeUint(obj, "sportsMaxOutcomeReserved", cfg.sportsConfig.maxOutcomeReserved);
        json = vm.serializeUint(obj, "sportsMaxEventReserved", cfg.sportsConfig.maxEventReserved);
        json = vm.serializeBytes32(obj, "sportsOddsSignerSetHash", cfg.sportsConfig.oddsSignerSetHash);
        json = vm.serializeBytes32(obj, "sportsResultReporterSetHash", cfg.sportsConfig.resultReporterSetHash);
        json = vm.serializeUint(obj, "sportsResultReporterThreshold", cfg.sportsConfig.resultReporterThreshold);
        json = vm.serializeUint(
            obj, "sportsResultChallengeTimeoutSeconds", cfg.sportsConfig.resultChallengeTimeoutSeconds
        );
        json = vm.serializeAddress(obj, "sportsOddsSigner", cfg.sportsConfig.oddsSigner);
        json = vm.serializeAddress(obj, "sportsResultReporter", cfg.sportsConfig.resultReporter);
        json = vm.serializeAddress(obj, "sportsResultChallenger", cfg.sportsConfig.resultChallenger);
        json = vm.serializeAddress(obj, "sportsResultArbitrator", cfg.sportsConfig.resultArbitrator);
        return json;
    }

    function _writeCtorJson(string memory obj, string memory json, DeployConfig memory cfg, Deployed memory d)
        internal
        returns (string memory)
    {
        json = vm.serializeString(obj, "ctorArgs_adapter", vm.toString(abi.encode(cfg.vrfWrapper, cfg.gov)));
        json = vm.serializeString(obj, "ctorArgs_vrfHub", vm.toString(abi.encode(address(d.adapter), cfg.gov)));
        json = vm.serializeString(obj, "ctorArgs_poolRegistry", vm.toString(abi.encode(cfg.gov)));
        json = vm.serializeString(obj, "ctorArgs_settlementRouter", vm.toString(abi.encode(address(d.poolRegistry))));
        json = vm.serializeString(obj, "ctorArgs_refRegistry", vm.toString(abi.encode(cfg.gov)));
        json = vm.serializeString(obj, "ctorArgs_refEngine", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleDice", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleCoinToss", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleRoulette", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleKeno", "0x");
        json = vm.serializeString(obj, "ctorArgs_modulePlinko", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleSicBo", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleSlots", "0x");
        json = vm.serializeString(obj, "ctorArgs_moduleBaccarat", "0x");
        string memory gameHubCtorArgs = _gameHubCtorArgs(cfg, d);
        json = vm.serializeString(obj, "ctorArgs_gameHub", gameHubCtorArgs);
        json = vm.serializeString(obj, "ctorArgs_sportsRiskEngine", _sportsRiskEngineCtorArgs(cfg));
        json = vm.serializeString(obj, "ctorArgs_sportsHub", _sportsHubCtorArgs(cfg, d));
        return json;
    }

    function _writePoolJson(
        string memory obj,
        string memory json,
        DeployConfig memory cfg,
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
            json = vm.serializeUint(obj, string.concat("poolAssetDecimals_", suffix), uint256(assetDecimals));
            json = vm.serializeAddress(obj, string.concat("poolBank_", suffix), pools[i].bank);
            json = vm.serializeUint(obj, string.concat("poolBankMinLiqBps_", suffix), pools[i].minLiqBps);
            json = vm.serializeUint(
                obj, string.concat("poolBankMinTurnoverForUnlock_", suffix), pools[i].minTurnoverForUnlock
            );
            json = vm.serializeUint(
                obj, string.concat("poolBankHoldbackVestingSeconds_", suffix), pools[i].holdbackVestingSeconds
            );
            json = vm.serializeString(obj, string.concat("poolLpName_", suffix), pools[i].lpName);
            json = vm.serializeString(obj, string.concat("poolLpSymbol_", suffix), pools[i].lpSymbol);
            json = vm.serializeUint(obj, string.concat("poolLpDecimals_", suffix), pools[i].lpDecimals);
            json = vm.serializeUint(obj, string.concat("poolActive_", suffix), 1);
            json = vm.serializeUint(obj, string.concat("poolSportsMaxStake_", suffix), pools[i].sportsMaxStake);
            json = vm.serializeUint(obj, string.concat("poolSportsMaxPayout_", suffix), pools[i].sportsMaxPayout);
            json = vm.serializeUint(
                obj, string.concat("poolSportsMaxMarketReserved_", suffix), pools[i].sportsMaxMarketReserved
            );
            json = vm.serializeUint(
                obj, string.concat("poolSportsMaxOutcomeReserved_", suffix), pools[i].sportsMaxOutcomeReserved
            );
            json = vm.serializeUint(
                obj, string.concat("poolSportsMaxEventReserved_", suffix), pools[i].sportsMaxEventReserved
            );
            bytes32 sportsRiskHash = bytes32(0);
            if (pools[i].domain == SSOTTypes.PoolDomain.Sports && address(d.sportsRiskEngine) != address(0)) {
                sportsRiskHash = d.sportsRiskEngine.currentRiskHashForPool(pools[i].poolId);
            }
            json = vm.serializeBytes32(obj, string.concat("poolSportsRiskHash_", suffix), sportsRiskHash);

            json = vm.serializeString(
                obj,
                string.concat("ctorArgs_bank_", suffix),
                vm.toString(
                    abi.encode(
                        pools[i].asset,
                        cfg.gov,
                        pools[i].minLiqBps,
                        pools[i].lpName,
                        pools[i].lpSymbol,
                        pools[i].lpDecimals
                    )
                )
            );
        }
        return json;
    }

    function _verifyScript(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d)
        internal
        view
        returns (string memory)
    {
        string memory verifierUrl = vm.envOr("VERIFIER_URL", string(""));
        if (bytes(verifierUrl).length == 0) {
            verifierUrl = _defaultVerifierUrl(block.chainid);
        }

        string memory sh = "#!/usr/bin/env bash\n";
        sh = string.concat(sh, "set -euo pipefail\n");
        sh = string.concat(sh, "export FOUNDRY_PROFILE=\"${FOUNDRY_PROFILE:-default}\"\n");
        sh = string.concat(sh, "ETHERSCAN_API_KEY=\"${ETHERSCAN_API_KEY:-${ETHERSCAN_V2_API_KEY:-}}\"\n");
        sh = string.concat(
            sh,
            "if [ -z \"$ETHERSCAN_API_KEY\" ]; then echo \"set ETHERSCAN_API_KEY (or ETHERSCAN_V2_API_KEY)\"; exit 1; fi\n"
        );
        sh = string.concat(sh, "CHAIN_ID=", vm.toString(block.chainid), "\n");
        sh = string.concat(sh, "VERIFIER_URL=\"${VERIFIER_URL:-", verifierUrl, "}\"\n\n");
        sh = string.concat(sh, "CHAIN_FLAG=\"--chain\"\n");
        sh = string.concat(
            sh,
            "if forge verify-contract --help 2>/dev/null | grep -q -- \"--chain-id\"; then CHAIN_FLAG=\"--chain-id\"; fi\n\n"
        );
        sh = string.concat(sh, "PROFILE_FLAG=\"\"\n");
        sh = string.concat(
            sh,
            "if forge verify-contract --help 2>/dev/null | grep -q -- \"--compilation-profile\"; then PROFILE_FLAG=\"--compilation-profile default\"; fi\n\n"
        );

        sh = _appendVerifyLine(
            sh,
            address(d.adapter),
            "src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol:ChainlinkV2PlusWrapperAdapter",
            vm.toString(abi.encode(cfg.vrfWrapper, cfg.gov)),
            verifierUrl
        );
        sh = _appendVerifyLine(
            sh,
            address(d.vrf),
            "src/core/VRFHub.sol:VRFHub",
            vm.toString(abi.encode(address(d.adapter), cfg.gov)),
            verifierUrl
        );
        sh = _appendVerifyLine(
            sh,
            address(d.poolRegistry),
            "src/core/PoolRegistry.sol:PoolRegistry",
            vm.toString(abi.encode(cfg.gov)),
            verifierUrl
        );
        sh = _appendVerifyLine(
            sh,
            address(d.router),
            "src/core/SettlementRouter.sol:SettlementRouter",
            vm.toString(abi.encode(address(d.poolRegistry))),
            verifierUrl
        );
        sh = _appendVerifyLine(
            sh,
            address(d.refRegistry),
            "src/engines/referral/ReferralRegistry.sol:ReferralRegistry",
            vm.toString(abi.encode(cfg.gov)),
            verifierUrl
        );
        sh = _appendVerifyLine(
            sh,
            address(d.refEngine),
            "src/engines/referral/DefaultReferralEngine.sol:DefaultReferralEngine",
            "0x",
            verifierUrl
        );
        sh = _appendVerifyLine(
            sh, address(d.gameHub), "src/core/GameHub.sol:GameHub", _gameHubCtorArgs(cfg, d), verifierUrl
        );
        if (address(d.sportsRiskEngine) != address(0)) {
            sh = _appendVerifyLine(
                sh,
                address(d.sportsRiskEngine),
                "src/core/SportsRiskEngine.sol:SportsRiskEngine",
                _sportsRiskEngineCtorArgs(cfg),
                verifierUrl
            );
        }
        if (address(d.sportsHub) != address(0)) {
            sh = _appendVerifyLine(
                sh, address(d.sportsHub), "src/core/SportsHub.sol:SportsHub", _sportsHubCtorArgs(cfg, d), verifierUrl
            );
        }

        for (uint256 i = 0; i < pools.length; ++i) {
            sh = _appendVerifyLine(
                sh,
                pools[i].bank,
                "src/core/Bank.sol:Bank",
                vm.toString(
                    abi.encode(
                        pools[i].asset,
                        cfg.gov,
                        pools[i].minLiqBps,
                        pools[i].lpName,
                        pools[i].lpSymbol,
                        pools[i].lpDecimals
                    )
                ),
                verifierUrl
            );
        }

        sh = _appendVerifyLine(sh, address(d.dice), "src/modules/dice/DiceModule.sol:DiceModule", "0x", verifierUrl);
        sh = _appendVerifyLine(
            sh, address(d.coin), "src/modules/cointoss/CoinTossModule.sol:CoinTossModule", "0x", verifierUrl
        );
        sh = _appendVerifyLine(
            sh, address(d.roulette), "src/modules/roulette/RouletteModule.sol:RouletteModule", "0x", verifierUrl
        );
        sh = _appendVerifyLine(sh, address(d.keno), "src/modules/keno/KenoModule.sol:KenoModule", "0x", verifierUrl);
        sh = _appendVerifyLine(
            sh, address(d.plinko), "src/modules/plinko/PlinkoModule.sol:PlinkoModule", "0x", verifierUrl
        );
        sh = _appendVerifyLine(sh, address(d.sicBo), "src/modules/sicbo/SicBoModule.sol:SicBoModule", "0x", verifierUrl);
        sh = _appendVerifyLine(sh, address(d.slots), "src/modules/slots/SlotsModule.sol:SlotsModule", "0x", verifierUrl);
        return _appendVerifyLine(
            sh, address(d.baccarat), "src/modules/baccarat/BaccaratModule.sol:BaccaratModule", "0x", verifierUrl
        );
    }

    function _gameHubCtorArgs(DeployConfig memory cfg, Deployed memory d) internal pure returns (string memory) {
        return vm.toString(
            abi.encode(
                address(d.router),
                address(d.vrf),
                address(d.refRegistry),
                address(d.refEngine),
                cfg.gov,
                cfg.refundTimeoutSeconds,
                cfg.defaultHouseEdgeBps,
                cfg.maxAffiliateDeltaBps,
                cfg.refConfig.baseBudgetBps,
                cfg.refConfig.deltaBudgetBps,
                cfg.refConfig.holdbackBps,
                cfg.refConfig.levelBps,
                cfg.refConfig.levels
            )
        );
    }

    function _sportsRiskEngineCtorArgs(DeployConfig memory cfg) internal pure returns (string memory) {
        return vm.toString(
            abi.encode(
                cfg.gov,
                cfg.sportsConfig.maxStake,
                cfg.sportsConfig.maxPayout,
                cfg.sportsConfig.maxMarketReserved,
                cfg.sportsConfig.maxOutcomeReserved,
                cfg.sportsConfig.maxEventReserved
            )
        );
    }

    function _sportsHubCtorArgs(DeployConfig memory cfg, Deployed memory d) internal pure returns (string memory) {
        return vm.toString(
            abi.encode(
                address(d.router),
                address(d.sportsRiskEngine),
                cfg.gov,
                cfg.sportsConfig.oddsSignerSetHash,
                cfg.sportsConfig.resultReporterSetHash
            )
        );
    }

    function _appendVerifyLine(
        string memory sh,
        address addr,
        string memory contractId,
        string memory ctorArgs,
        string memory verifierUrl
    ) internal pure returns (string memory) {
        return string.concat(sh, _verifyLine(addr, contractId, ctorArgs, verifierUrl));
    }

    function _hasCasinoPool(PoolConfig[] memory pools) internal pure returns (bool) {
        for (uint256 i = 0; i < pools.length; ++i) {
            if (pools[i].domain == SSOTTypes.PoolDomain.Casino) return true;
        }
        return false;
    }

    function _hasSportsPool(PoolConfig[] memory pools) internal pure returns (bool) {
        for (uint256 i = 0; i < pools.length; ++i) {
            if (pools[i].domain == SSOTTypes.PoolDomain.Sports) return true;
        }
        return false;
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

    function _verifyLine(address addr, string memory contractId, string memory ctorArgs, string memory verifierUrl)
        internal
        pure
        returns (string memory)
    {
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

        if (keccak256(bytes(ctorArgs)) != keccak256(bytes("0x"))) {
            base = string.concat(base, " --constructor-args ", ctorArgs);
        }
        return string.concat(base, "\n");
    }

    function _tryAssetMetadata(address token) internal view returns (string memory sym, uint8 dec) {
        sym = "";
        dec = 18;
        if (token.code.length == 0) {
            return (sym, dec);
        }
        try IERC20MetadataLikeV13(token).symbol() returns (string memory s) {
            sym = s;
        } catch {}
        try IERC20MetadataLikeV13(token).decimals() returns (uint8 d) {
            dec = d;
        } catch {}
    }

    function _domainLabel(SSOTTypes.PoolDomain domain) internal pure returns (string memory) {
        if (domain == SSOTTypes.PoolDomain.Casino) return "Casino";
        if (domain == SSOTTypes.PoolDomain.Sports) return "Sports";
        if (domain == SSOTTypes.PoolDomain.Future) return "Future";
        return "Unknown";
    }
}
