// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {Governable} from "../src/access/Governable.sol";
import {SafeGovernance} from "./common/SafeGovernance.sol";
import {VmSafe} from "forge-std/Vm.sol";

import {Bank} from "../src/core/Bank.sol";
import {GameHub} from "../src/core/GameHub.sol";
import {PoolRegistry} from "../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../src/core/SettlementRouter.sol";
import {SportsHub} from "../src/core/SportsHub.sol";
import {SportsRiskEngine} from "../src/core/SportsRiskEngine.sol";
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

/// @notice Deployment script for SSOT v1.6 Safe-governed router/pool topology.
///
/// Required env:
///   DEPLOYER (bootstrap public address), GOV (final 2/3 Safe), CHAIN_ID, GUARDIAN, KEEPER_ADDRESS,
///   RELEASE_SIGNER, SAFE_CODE_HASH, SAFE_OWNERS_HASH, SAFE_CONTROL_HASH,
///   VRF_WRAPPER, NUM_POOLS, POOL_ASSET_0...
///
/// Per-pool env:
///   POOL_ID_i                         default i + 1
///   POOL_ASSET_i                      required
///   POOL_DOMAIN_i                     default 1; 1=Casino, 2=Sports, 3=Future
///   BANK_MIN_BET_AMOUNT_i             required, minimum per casino round in asset units
///   BANK_RISK_RESERVE_BPS_i                default 6000
///   BANK_WITHDRAWAL_BUFFER_BPS_i      default 1000 (independent PF/XP outflow policy)
///   BANK_MIN_TURNOVER_FOR_UNLOCK_i    default 20 asset units
///   BANK_HOLDBACK_VESTING_SECONDS_i   default 86400
///   Asset decimals are read from the token
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
/// Optional Sports role-set hash policy:
///   SPORTS_DERIVE_ROLE_SET_HASHES=true derives final hashes from deployed SportsHub + bootstrap roles
///
/// Example:
///   forge script script/DeployV16.s.sol:DeployV16 --rpc-url $RPC_URL --broadcast -vvv
contract DeployV16 is Script {
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

    /// @dev SSOT v1.6 referral schedule: rates are bps of the base turnover edge, l0 + l1 + l2 <= 3500.
    struct RefConfig {
        uint16 l0Bps;
        uint16 l1Bps;
        uint16 l2Bps;
        uint16 holdbackBps;
    }

    struct SportsConfig {
        bool enabled;
        uint256 maxStake;
        uint256 maxPayout;
        uint256 maxMarketReserved;
        uint256 maxOutcomeReserved;
        uint256 maxEventReserved;
        bytes32 oddsSignerSetHash;
        bytes32 initialOddsSignerSetHash;
        bytes32 resultReporterSetHash;
        bytes32 initialResultReporterSetHash;
        uint8 resultReporterThreshold;
        uint64 resultChallengeTimeoutSeconds;
        bool deriveRoleSetHashes;
        address oddsSigner;
        address resultReporter;
        address resultChallenger;
        address resultArbitrator;
    }

    struct DeployConfig {
        address deployer;
        address gov; // temporary bootstrap signer, preserved in constructor arguments
        address finalGovernance;
        address guardian;
        address keeper;
        address releaseSigner;
        bytes32 safeOwnersHash;
        bytes32 safeCodeHash;
        bytes32 safeControlHash;
        address treasury;
        address vrfWrapper;
        uint256 refundTimeoutSeconds;
        uint16 defaultHouseEdgeBps;
        uint256 poolCount;
        RefConfig refConfig;
        SportsConfig sportsConfig;
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
        uint256 sportsMaxStake;
        uint256 sportsMaxPayout;
        uint256 sportsMaxMarketReserved;
        uint256 sportsMaxOutcomeReserved;
        uint256 sportsMaxEventReserved;
    }

    struct Deployed {
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
        require(block.chainid == vm.envUint("CHAIN_ID"), "CHAIN_ID mismatch");
        SafeGovernance.validate(cfg.finalGovernance, cfg.safeOwnersHash, cfg.safeCodeHash, cfg.safeControlHash);
        require(cfg.vrfWrapper.code.length != 0, "VRF wrapper has no code");
        require(cfg.poolCount >= 1 && cfg.poolCount <= 32, "NUM_POOLS out of range");

        PoolConfig[] memory pools = new PoolConfig[](cfg.poolCount);
        for (uint256 i = 0; i < cfg.poolCount; ++i) {
            pools[i] = _readPoolConfig(i);
            require(pools[i].riskReserveBps <= 10_000, "BANK_RISK_RESERVE_BPS_i out of range");
            require(pools[i].withdrawalBufferBps <= 10_000, "BANK_WITHDRAWAL_BUFFER_BPS_i out of range");
        }
        bool hasSports = _hasSportsPool(pools);
        require(_hasCasinoPool(pools) || hasSports, "at least one Casino or Sports pool required");
        cfg.sportsConfig = _readSportsConfig(hasSports);
        _readSportsPoolLimits(cfg.sportsConfig, pools);

        vm.startBroadcast(cfg.deployer);

        Deployed memory d;

        d.poolRegistry = new PoolRegistry(cfg.gov);
        d.router = new SettlementRouter(address(d.poolRegistry));
        d.vrf = new VRFHub(cfg.vrfWrapper, address(d.router));
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
            cfg.refConfig.l0Bps,
            cfg.refConfig.l1Bps,
            cfg.refConfig.l2Bps,
            cfg.refConfig.holdbackBps
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
            if (cfg.sportsConfig.resultReporterThreshold != 1) {
                d.sportsHub.setResultReporterThreshold(cfg.sportsConfig.resultReporterThreshold);
            }
            if (cfg.sportsConfig.resultChallengeTimeoutSeconds != DEFAULT_RESULT_CHALLENGE_TIMEOUT_SECONDS) {
                d.sportsHub.setResultChallengeTimeoutSeconds(cfg.sportsConfig.resultChallengeTimeoutSeconds);
            }
            if (cfg.sportsConfig.deriveRoleSetHashes) {
                require(
                    cfg.sportsConfig.oddsSigner != address(0) && cfg.sportsConfig.resultReporter != address(0),
                    "derived sports hashes require signer/reporter"
                );
                cfg.sportsConfig.oddsSignerSetHash =
                    _derivedOddsSignerSetHash(address(d.sportsHub), cfg.sportsConfig.oddsSigner);
                cfg.sportsConfig.resultReporterSetHash = _derivedResultReporterSetHash(
                    address(d.sportsHub), cfg.sportsConfig.resultReporter, cfg.sportsConfig.resultReporterThreshold
                );
                d.sportsHub.setOddsSignerSetHash(cfg.sportsConfig.oddsSignerSetHash);
                d.sportsHub.setResultReporterSetHash(cfg.sportsConfig.resultReporterSetHash);
            }
            if (cfg.sportsConfig.oddsSigner != address(0)) {
                d.sportsHub.setOddsSigner(cfg.sportsConfig.oddsSigner, true);
            }
            if (cfg.sportsConfig.resultReporter != address(0)) {
                d.sportsHub.setResultReporter(cfg.sportsConfig.resultReporter, true);
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
                pools[i].asset, cfg.gov, pools[i].riskReserveBps, pools[i].assetDecimals, pools[i].minBetAmount
            );
            pools[i].bank = address(bank);
            bank.setRiskInPaused(true);
            bank.setGuardian(cfg.guardian);

            d.poolRegistry.registerPool(pools[i].poolId, pools[i].asset, pools[i].bank, pools[i].domain);
            bank.setSettlementRouterOnce(address(d.router));
            bank.setRandomnessConsumerOnce(address(d.vrf));
            bank.setMinPlayerTurnoverForUnlock(pools[i].minTurnoverForUnlock);
            bank.setHoldbackVestingSeconds(pools[i].holdbackVestingSeconds);
            if (pools[i].withdrawalBufferBps != pools[i].riskReserveBps) {
                bank.setWithdrawalBufferBps(pools[i].withdrawalBufferBps);
            }

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

        _registerGame(d.gameHub, GAME_DICE, address(d.dice), "DICE");
        _registerGame(d.gameHub, GAME_COIN, address(d.coin), "COIN_TOSS");
        _registerGame(d.gameHub, GAME_ROULETTE, address(d.roulette), "ROULETTE");
        _registerGame(d.gameHub, GAME_KENO, address(d.keno), "KENO");
        _registerGame(d.gameHub, GAME_PLINKO, address(d.plinko), "PLINKO");
        _registerGame(d.gameHub, GAME_SIC_BO, address(d.sicBo), "SIC_BO");
        _registerGame(d.gameHub, GAME_SLOTS, address(d.slots), "SLOTS");
        _registerGame(d.gameHub, GAME_BACCARAT, address(d.baccarat), "BACCARAT");

        _nominateGovernance(cfg, pools, d);
        vm.stopBroadcast();

        _logDeployment(cfg, pools, d);
        if (_shouldWriteArtifacts()) {
            _writeArtifacts(cfg, pools, d);
        } else {
            console2.log("Skipping v1.6 deployment artifact writes during dry run.");
            console2.log("Set WRITE_DRY_RUN_ARTIFACTS=true to write simulated artifacts intentionally.");
        }
    }

    function _shouldWriteArtifacts() internal view virtual returns (bool) {
        return vm.isContext(VmSafe.ForgeContext.ScriptBroadcast) || vm.envOr("WRITE_DRY_RUN_ARTIFACTS", false);
    }

    function _readDeployConfig() internal view returns (DeployConfig memory cfg) {
        cfg.deployer = vm.envAddress("DEPLOYER");
        require(cfg.deployer != address(0), "deployer required");
        cfg.gov = cfg.deployer;
        cfg.finalGovernance = vm.envAddress("GOV");
        cfg.guardian = vm.envAddress("GUARDIAN"); // explicit zero disables the role
        cfg.keeper = vm.envAddress("KEEPER_ADDRESS");
        cfg.releaseSigner = vm.envAddress("RELEASE_SIGNER");
        cfg.safeOwnersHash = vm.envBytes32("SAFE_OWNERS_HASH");
        cfg.safeCodeHash = vm.envBytes32("SAFE_CODE_HASH");
        cfg.safeControlHash = vm.envBytes32("SAFE_CONTROL_HASH");
        require(cfg.finalGovernance != cfg.deployer, "Safe must differ from deployer");
        require(
            cfg.keeper != address(0) && cfg.keeper != cfg.deployer && cfg.keeper != cfg.finalGovernance,
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
        cfg.initialOddsSignerSetHash = cfg.oddsSignerSetHash;
        cfg.initialResultReporterSetHash = cfg.resultReporterSetHash;
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
        cfg.deriveRoleSetHashes = vm.envOr("SPORTS_DERIVE_ROLE_SET_HASHES", false);
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
        uint256 poolId = vm.envOr(string.concat("POOL_ID_", suffix), i + 1);
        require(poolId > 0 && poolId <= type(uint64).max, "POOL_ID out of range");
        cfg.poolId = uint64(poolId);
        cfg.asset = vm.envAddress(string.concat("POOL_ASSET_", suffix));
        require(cfg.asset.code.length != 0, "POOL_ASSET_i has no code");
        (, uint8 assetDecimals) = _tryAssetMetadata(cfg.asset);
        uint256 oneAssetUnit = 10 ** uint256(assetDecimals);

        uint256 domainRaw = vm.envOr(string.concat("POOL_DOMAIN_", suffix), uint256(1));
        cfg.domain = _domainFromRaw(domainRaw);

        cfg.minBetAmount = vm.envUint(string.concat("BANK_MIN_BET_AMOUNT_", suffix));
        require(cfg.minBetAmount > 0, "BANK_MIN_BET_AMOUNT_i must be positive");
        cfg.riskReserveBps = _bps(string.concat("BANK_RISK_RESERVE_BPS_", suffix), 6000);
        cfg.withdrawalBufferBps = _bps(string.concat("BANK_WITHDRAWAL_BUFFER_BPS_", suffix), 1000);
        cfg.minTurnoverForUnlock =
            vm.envOr(string.concat("BANK_MIN_TURNOVER_FOR_UNLOCK_", suffix), uint256(20 * oneAssetUnit));
        cfg.holdbackVestingSeconds = vm.envOr(string.concat("BANK_HOLDBACK_VESTING_SECONDS_", suffix), uint256(86400));
        cfg.assetDecimals = assetDecimals;
    }

    function _registerGame(GameHub hub, bytes32 gameId, address module, string memory name) internal {
        uint256 count = vm.envUint(string.concat("GAME_MAX_BET_COUNT_", name));
        uint256 gasLimit = vm.envUint(string.concat("GAME_CALLBACK_GAS_LIMIT_", name));
        require(count > 0 && count <= hub.MAX_BET_COUNT() && gasLimit <= type(uint32).max, "invalid game admission");
        hub.registerGame(gameId, module, uint32(count), uint32(gasLimit));
    }

    function _bps(string memory key, uint256 fallbackValue) internal view returns (uint16) {
        uint256 value = vm.envOr(key, fallbackValue);
        require(value <= 10_000, string.concat(key, " out of range"));
        return uint16(value);
    }

    function _domainFromRaw(uint256 raw) internal pure returns (SSOTTypes.PoolDomain) {
        require(
            raw >= uint256(SSOTTypes.PoolDomain.Casino) && raw <= uint256(SSOTTypes.PoolDomain.Future), "bad domain"
        );
        return SSOTTypes.PoolDomain(raw);
    }

    function _logDeployment(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d)
        internal
        pure
        virtual
    {
        console2.log("BOOTSTRAP_GOV", cfg.gov);
        console2.log("GOV", cfg.finalGovernance);
        console2.log("VRF_WRAPPER", cfg.vrfWrapper);
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

    function _snapshotJson(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d)
        internal
        returns (string memory)
    {
        string memory obj = "ssot";
        string memory json;

        json = vm.serializeString(obj, "architectureVersion", "v1.6-nft-liquidity");
        json = vm.serializeUint(obj, "chainId", block.chainid);
        json = vm.serializeUint(obj, "blockNumber", block.number);
        json = vm.serializeUint(obj, "timestamp", block.timestamp);
        json = vm.serializeAddress(obj, "deployer", cfg.deployer);
        json = vm.serializeAddress(obj, "gov", cfg.finalGovernance);
        json = vm.serializeAddress(obj, "bootstrapGovernance", cfg.gov);
        json = vm.serializeAddress(obj, "guardian", cfg.guardian);
        json = vm.serializeAddress(obj, "keeper", cfg.keeper);
        json = vm.serializeAddress(obj, "releaseSigner", cfg.releaseSigner);
        json = vm.serializeBytes32(obj, "safeOwnersHash", cfg.safeOwnersHash);
        json = vm.serializeBytes32(obj, "safeCodeHash", cfg.safeCodeHash);
        json = vm.serializeBytes32(obj, "safeControlHash", cfg.safeControlHash);
        json = vm.serializeString(obj, "bootstrapStatus", "pending-safe-acceptance");
        json = vm.serializeBool(obj, "initialRiskInPaused", true);
        json = vm.serializeAddress(obj, "treasury", cfg.treasury);

        json = vm.serializeAddress(obj, "vrfWrapper", cfg.vrfWrapper);
        json = vm.serializeAddress(obj, "vrfHub", address(d.vrf));

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

        json = vm.serializeBytes32(obj, "codeHash_vrfHub", address(d.vrf).codehash);
        json = vm.serializeBytes32(obj, "codeHash_poolRegistry", address(d.poolRegistry).codehash);
        json = vm.serializeBytes32(obj, "codeHash_settlementRouter", address(d.router).codehash);
        json = vm.serializeBytes32(obj, "codeHash_refRegistry", address(d.refRegistry).codehash);
        json = vm.serializeBytes32(obj, "codeHash_refEngine", address(d.refEngine).codehash);
        json = vm.serializeBytes32(obj, "codeHash_gameHub", address(d.gameHub).codehash);
        json = vm.serializeBytes32(obj, "codeHash_sportsRiskEngine", address(d.sportsRiskEngine).codehash);
        json = vm.serializeBytes32(obj, "codeHash_sportsHub", address(d.sportsHub).codehash);
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

        return json;
    }

    function _writeArtifacts(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d) internal virtual {
        _safeCreateDir("deployments/snapshots");
        string memory json = _snapshotJson(cfg, pools, d);
        string memory tag = string.concat(vm.toString(block.chainid), "-", vm.toString(block.number), "-v16");
        string memory snapPath = string.concat("deployments/snapshots/deploy-", tag, ".json");

        _safeWriteJson(json, snapPath);
        _safeWriteJson(json, "deployments/latest-v16.json");
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
        json = vm.serializeString(obj, "ctorArgs_vrfHub", vm.toString(abi.encode(cfg.vrfWrapper, address(d.router))));
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

        string[8] memory games =
            [string("DICE"), "COIN_TOSS", "ROULETTE", "KENO", "PLINKO", "SIC_BO", "SLOTS", "BACCARAT"];
        for (uint256 g; g < games.length; ++g) {
            bytes32 id = keccak256(bytes(games[g]));
            json = vm.serializeUint(obj, string.concat("gameMaxBetCount_", games[g]), d.gameHub.gameMaxBetCount(id));
            json = vm.serializeUint(
                obj, string.concat("gameCallbackGasLimit_", games[g]), d.gameHub.gameCallbackGasLimit(id)
            );
        }
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
                        pools[i].asset, cfg.gov, pools[i].riskReserveBps, pools[i].assetDecimals, pools[i].minBetAmount
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
                cfg.gov,
                cfg.refundTimeoutSeconds,
                cfg.defaultHouseEdgeBps,
                cfg.refConfig.l0Bps,
                cfg.refConfig.l1Bps,
                cfg.refConfig.l2Bps,
                cfg.refConfig.holdbackBps
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
                cfg.sportsConfig.initialOddsSignerSetHash,
                cfg.sportsConfig.initialResultReporterSetHash
            )
        );
    }

    function _derivedOddsSignerSetHash(address sportsHub, address oddsSigner) internal view returns (bytes32) {
        return
            keccak256(abi.encodePacked("BASE_SEPOLIA_SPORTS_ODDS_SIGNER_SET_V1", block.chainid, sportsHub, oddsSigner));
    }

    function _derivedResultReporterSetHash(address sportsHub, address reporter, uint8 threshold)
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                "BASE_SEPOLIA_SPORTS_RESULT_REPORTER_SET_V1", block.chainid, sportsHub, reporter, threshold
            )
        );
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

    function _nominateGovernance(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory d) internal {
        d.poolRegistry.transferGovernance(cfg.finalGovernance);
        d.refRegistry.transferGovernance(cfg.finalGovernance);
        d.gameHub.transferGovernance(cfg.finalGovernance);
        if (cfg.sportsConfig.enabled) {
            d.sportsRiskEngine.transferGovernance(cfg.finalGovernance);
            d.sportsHub.transferGovernance(cfg.finalGovernance);
        }
        for (uint256 i; i < pools.length; ++i) {
            Bank(pools[i].bank).transferGovernance(cfg.finalGovernance);
        }
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
        if (domain == SSOTTypes.PoolDomain.Casino) return "Casino";
        if (domain == SSOTTypes.PoolDomain.Sports) return "Sports";
        if (domain == SSOTTypes.PoolDomain.Future) return "Future";
        return "Unknown";
    }
}
