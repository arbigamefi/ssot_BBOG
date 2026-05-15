// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import {SportsHub} from "../../src/core/SportsHub.sol";
import {SportsRiskEngine} from "../../src/core/SportsRiskEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

interface IERC20FootballCanary {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IBankFootballCanary {
    function totalAssets() external view returns (uint256);
    function totalReserved() external view returns (uint256);
}

/// @notice Football 1X2 MVP canary for the 2026 World Cup opening-match shape.
/// @dev Outcome ids are zero-based: 0=Mexico, 1=Draw, 2=South Africa.
///      Modes:
///      - local-resolve: simulation-only full lifecycle using vm.warp.
///      - open-market: create/open a 3-outcome market without placing tickets or locking it.
///      - setup: create/open/lock a 3-outcome market and place tickets.
///      - settle: propose result, or after finality, finalize and settle tickets.
contract WorldCupFootballCanaryV13 is Script {
    using stdJson for string;

    uint64 internal constant DEFAULT_SPORTS_POOL_ID = 2;
    uint64 internal constant DEFAULT_EVENT_ID = 2026061101;
    uint32 internal constant DEFAULT_OUTCOME_COUNT = 3;
    uint32 internal constant DEFAULT_WINNING_OUTCOME_ID = 0;
    uint32 internal constant DEFAULT_LOSING_OUTCOME_ID = 1;
    uint256 internal constant WAD = 1e18;

    struct FootballConfig {
        uint256 privateKey;
        uint256 playerPrivateKey;
        uint256 oddsSignerPrivateKey;
        uint256 resultReporterPrivateKey;
        address governance;
        address player;
        address oddsSigner;
        address resultReporter;
        address asset;
        address sportsBank;
        SportsHub sportsHub;
        SportsRiskEngine riskEngine;
        uint64 poolId;
        uint64 eventId;
        uint64 marketId;
        uint64 lockTime;
        uint64 startsAt;
        uint64 expiresAt;
        uint64 finality;
        uint32 outcomeCount;
        uint32 winningOutcomeId;
        uint32 losingOutcomeId;
        uint256 stake;
        uint256 oddsWad;
        uint256 homeOddsWad;
        uint256 drawOddsWad;
        uint256 awayOddsWad;
        uint256 maxPayout;
        uint256 firstTicketId;
        uint256 ticketCount;
        bytes32 marketKey;
        bytes32 rulebookHash;
        bytes32 resultSourceHash;
        bytes32 evidenceHash;
        uint64 observedAt;
    }

    function run() external {
        string memory mode = vm.envOr("FOOTBALL_CANARY_MODE", string("local-resolve"));
        bytes32 modeHash = keccak256(bytes(mode));

        if (modeHash == keccak256("local-resolve")) {
            _localResolve();
            return;
        }

        if (modeHash == keccak256("setup")) {
            _setup();
            return;
        }

        if (modeHash == keccak256("open-market")) {
            _openMarket();
            return;
        }

        if (modeHash == keccak256("settle")) {
            _settle();
            return;
        }

        revert("unsupported FOOTBALL_CANARY_MODE");
    }

    function _localResolve() internal {
        if (vm.envOr("BROADCAST", false)) revert("local-resolve is simulation only");

        FootballConfig memory cfg = _readNewMarketConfig();
        _validateNewMarketConfig(cfg);
        _logConfig("World Cup football local resolve:", cfg);

        uint256[] memory ticketIds = _simulateSetup(cfg);
        vm.warp(_localResultProposalTime(cfg));
        _simulateProposeResult(cfg);
        SSOTTypes.SportsResult memory result = cfg.sportsHub.getResult(cfg.marketId);
        vm.warp(result.finalizesAt);
        _simulateFinalizeAndSettle(cfg, ticketIds);
        _validateResolved(cfg, ticketIds);

        console2.log("  local football MVP resolved marketId", cfg.marketId);
    }

    function _setup() internal {
        FootballConfig memory cfg = _readNewMarketConfig();
        _validateNewMarketConfig(cfg);
        _logConfig("World Cup football setup:", cfg);

        uint256[] memory ticketIds = _broadcastSetup(cfg);

        console2.log("  FOOTBALL_MARKET_ID", cfg.marketId);
        console2.log("  FOOTBALL_FIRST_TICKET_ID", ticketIds[0]);
        console2.log("  FOOTBALL_TICKET_COUNT", ticketIds.length);
        console2.log("  startsAt", cfg.startsAt);
    }

    function _openMarket() internal {
        FootballConfig memory cfg = _readNewMarketConfig();
        _validateOpenMarketConfig(cfg);
        _logConfig("World Cup football open market:", cfg);

        _broadcastOpenMarket(cfg);

        SSOTTypes.SportsMarket memory market = cfg.sportsHub.getMarket(cfg.marketId);
        require(market.state == SSOTTypes.SportsMarketState.Open, "market not open");
        console2.log("  FOOTBALL_MARKET_ID", cfg.marketId);
        console2.log("  lockTime", cfg.lockTime);
        console2.log("  startsAt", cfg.startsAt);
    }

    function _settle() internal {
        FootballConfig memory cfg = _readExistingMarketConfig();
        uint256[] memory ticketIds = _ticketIds(cfg.firstTicketId, cfg.ticketCount);
        SSOTTypes.SportsMarket memory market = cfg.sportsHub.getMarket(cfg.marketId);

        _logConfig("World Cup football settle:", cfg);

        if (market.state == SSOTTypes.SportsMarketState.Locked) {
            if (block.timestamp < market.startsAt) revert("market has not started");
            _broadcastProposeResult(cfg);
            SSOTTypes.SportsResult memory proposed = cfg.sportsHub.getResult(cfg.marketId);
            console2.log("  result proposed; rerun settle after finalizesAt", proposed.finalizesAt);
            return;
        }

        if (market.state == SSOTTypes.SportsMarketState.ResultProposed) {
            SSOTTypes.SportsResult memory result = cfg.sportsHub.getResult(cfg.marketId);
            if (block.timestamp < result.finalizesAt) revert("result finality pending");
            _broadcastFinalizeAndSettle(cfg, ticketIds);
            _validateResolved(cfg, ticketIds);
            return;
        }

        if (market.state == SSOTTypes.SportsMarketState.Resolved) {
            _broadcastSettleOnly(cfg, ticketIds);
            _validateResolved(cfg, ticketIds);
            return;
        }

        revert("market is not settle-ready");
    }

    function _readNewMarketConfig() internal view returns (FootballConfig memory cfg) {
        cfg.privateKey = vm.envUint("PRIVATE_KEY");
        _readRoleKeys(cfg);
        _readSnapshot(cfg);

        cfg.poolId = uint64(vm.envOr("FOOTBALL_POOL_ID", uint256(DEFAULT_SPORTS_POOL_ID)));
        cfg.eventId = uint64(vm.envOr("FOOTBALL_EVENT_ID", uint256(DEFAULT_EVENT_ID)));
        cfg.outcomeCount = uint32(vm.envOr("FOOTBALL_OUTCOME_COUNT", uint256(DEFAULT_OUTCOME_COUNT)));
        cfg.winningOutcomeId = uint32(vm.envOr("FOOTBALL_WINNING_OUTCOME_ID", uint256(DEFAULT_WINNING_OUTCOME_ID)));
        cfg.losingOutcomeId = uint32(vm.envOr("FOOTBALL_LOSING_OUTCOME_ID", uint256(DEFAULT_LOSING_OUTCOME_ID)));
        cfg.stake = vm.envOr("FOOTBALL_STAKE", uint256(100_000));
        cfg.oddsWad = vm.envOr("FOOTBALL_ODDS_WAD", uint256(18 * WAD / 10));
        _readOutcomeOdds(cfg);
        cfg.maxPayout = vm.envOr("FOOTBALL_MAX_PAYOUT", uint256(300_000));
        cfg.finality = uint64(vm.envOr("FOOTBALL_RESULT_FINALITY_SECONDS", uint256(10 minutes)));
        cfg.ticketCount = vm.envOr("FOOTBALL_TICKET_COUNT", uint256(2));

        uint256 lockOffset = vm.envOr("FOOTBALL_LOCK_OFFSET_SECONDS", uint256(5 minutes));
        uint256 startOffset = vm.envOr("FOOTBALL_START_OFFSET_SECONDS", uint256(1 minutes));
        cfg.marketId = cfg.sportsHub.nextMarketId();
        cfg.firstTicketId = cfg.sportsHub.nextTicketId();
        cfg.lockTime = uint64(block.timestamp + lockOffset);
        cfg.startsAt = uint64(block.timestamp + lockOffset + startOffset);
        cfg.expiresAt = uint64(vm.envOr("FOOTBALL_ODDS_EXPIRES_AT", uint256(block.timestamp + lockOffset - 30 seconds)));
        cfg.marketKey = vm.envOr("FOOTBALL_MARKET_KEY", keccak256("FIFA_WORLD_CUP_2026_MEXICO_SOUTH_AFRICA_1X2"));
        cfg.rulebookHash = vm.envOr("FOOTBALL_RULEBOOK_HASH", keccak256("FIFA_WORLD_CUP_2026_1X2_RULEBOOK_V1"));
        cfg.resultSourceHash =
            vm.envOr("FOOTBALL_RESULT_SOURCE_HASH", keccak256("FIFA_WORLD_CUP_2026_OPENING_MATCH_RESULT_SOURCE"));
        cfg.evidenceHash = vm.envOr("FOOTBALL_EVIDENCE_HASH", keccak256("FIFA_WORLD_CUP_2026_OPENING_MATCH_EVIDENCE"));
        cfg.observedAt = uint64(vm.envOr("FOOTBALL_RESULT_OBSERVED_AT", uint256(0)));
    }

    function _readExistingMarketConfig() internal view returns (FootballConfig memory cfg) {
        cfg.privateKey = vm.envUint("PRIVATE_KEY");
        _readRoleKeys(cfg);
        _readSnapshot(cfg);

        cfg.marketId = uint64(vm.envUint("FOOTBALL_MARKET_ID"));
        cfg.firstTicketId = vm.envUint("FOOTBALL_FIRST_TICKET_ID");
        cfg.ticketCount = vm.envOr("FOOTBALL_TICKET_COUNT", uint256(2));
        cfg.winningOutcomeId = uint32(vm.envOr("FOOTBALL_WINNING_OUTCOME_ID", uint256(DEFAULT_WINNING_OUTCOME_ID)));
        cfg.losingOutcomeId = uint32(vm.envOr("FOOTBALL_LOSING_OUTCOME_ID", uint256(DEFAULT_LOSING_OUTCOME_ID)));
        cfg.stake = vm.envOr("FOOTBALL_STAKE", uint256(100_000));
        cfg.oddsWad = vm.envOr("FOOTBALL_ODDS_WAD", uint256(18 * WAD / 10));
        _readOutcomeOdds(cfg);
        cfg.maxPayout = vm.envOr("FOOTBALL_MAX_PAYOUT", uint256(300_000));
        cfg.resultSourceHash =
            vm.envOr("FOOTBALL_RESULT_SOURCE_HASH", keccak256("FIFA_WORLD_CUP_2026_OPENING_MATCH_RESULT_SOURCE"));
        cfg.evidenceHash = vm.envOr("FOOTBALL_EVIDENCE_HASH", keccak256("FIFA_WORLD_CUP_2026_OPENING_MATCH_EVIDENCE"));
        cfg.observedAt = uint64(vm.envOr("FOOTBALL_RESULT_OBSERVED_AT", uint256(0)));

        SSOTTypes.SportsMarket memory market = cfg.sportsHub.getMarket(cfg.marketId);
        cfg.poolId = market.poolId;
        cfg.eventId = market.eventId;
        cfg.outcomeCount = market.outcomeCount;
        cfg.lockTime = market.lockTime;
        cfg.startsAt = market.startsAt;
        cfg.finality = market.resultFinalitySeconds;
        cfg.marketKey = market.marketKey;
        cfg.rulebookHash = market.rulebookHash;
    }

    function _readRoleKeys(FootballConfig memory cfg) internal view {
        cfg.playerPrivateKey =
            vm.envOr("FOOTBALL_PLAYER_PRIVATE_KEY", vm.envOr("CANARY_PLAYER_PRIVATE_KEY", cfg.privateKey));
        cfg.oddsSignerPrivateKey =
            vm.envOr("FOOTBALL_ODDS_SIGNER_PRIVATE_KEY", vm.envOr("CANARY_ODDS_SIGNER_PRIVATE_KEY", cfg.privateKey));
        cfg.resultReporterPrivateKey = vm.envOr(
            "FOOTBALL_RESULT_REPORTER_PRIVATE_KEY", vm.envOr("CANARY_RESULT_REPORTER_PRIVATE_KEY", cfg.privateKey)
        );
        cfg.player = vm.addr(cfg.playerPrivateKey);
        cfg.oddsSigner = vm.addr(cfg.oddsSignerPrivateKey);
        cfg.resultReporter = vm.addr(cfg.resultReporterPrivateKey);
    }

    function _readOutcomeOdds(FootballConfig memory cfg) internal view {
        cfg.homeOddsWad = vm.envOr("FOOTBALL_HOME_ODDS_WAD", cfg.oddsWad);
        cfg.drawOddsWad = vm.envOr("FOOTBALL_DRAW_ODDS_WAD", cfg.oddsWad);
        cfg.awayOddsWad = vm.envOr("FOOTBALL_AWAY_ODDS_WAD", cfg.oddsWad);
    }

    function _readSnapshot(FootballConfig memory cfg) internal view {
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v13.json"));
        string memory json = vm.readFile(snapshotPath);
        cfg.asset = json.readAddress(".poolAsset_1");
        cfg.sportsBank = json.readAddress(".poolBank_1");
        cfg.sportsHub = SportsHub(json.readAddress(".sportsHub"));
        cfg.riskEngine = SportsRiskEngine(json.readAddress(".sportsRiskEngine"));
        cfg.governance = cfg.sportsHub.governance();
    }

    function _validateNewMarketConfig(FootballConfig memory cfg) internal view {
        if (cfg.poolId == 0) revert("bad pool id");
        if (cfg.outcomeCount != 3) revert("football 1X2 canary expects 3 outcomes");
        if (cfg.winningOutcomeId >= cfg.outcomeCount || cfg.losingOutcomeId >= cfg.outcomeCount) {
            revert("bad outcome id");
        }
        if (cfg.winningOutcomeId == cfg.losingOutcomeId && cfg.ticketCount > 1) revert("duplicate outcome ids");
        if (cfg.ticketCount == 0 || cfg.ticketCount > 2) revert("bad ticket count");
        if (
            cfg.stake == 0 || cfg.oddsWad == 0 || cfg.homeOddsWad == 0 || cfg.drawOddsWad == 0 || cfg.awayOddsWad == 0
                || cfg.maxPayout == 0
        ) {
            revert("bad stake or odds");
        }
        if (cfg.expiresAt <= block.timestamp) revert("bad expiry");
        if (_expectedPayout(cfg, cfg.winningOutcomeId) > cfg.maxPayout) revert("winning payout above cap");
        if (cfg.ticketCount > 1 && _expectedPayout(cfg, cfg.losingOutcomeId) > cfg.maxPayout) {
            revert("losing payout above cap");
        }
        if (!cfg.sportsHub.oddsSigner(cfg.oddsSigner)) revert("odds signer not allowed");
        if (!cfg.sportsHub.resultReporter(cfg.resultReporter)) revert("result reporter not allowed");
        if (cfg.sportsHub.resultReporterThreshold() != 1) revert("football canary supports reporter threshold 1");

        uint256 balance = IERC20FootballCanary(cfg.asset).balanceOf(cfg.player);
        uint256 bankAssets = IBankFootballCanary(cfg.sportsBank).totalAssets();
        if (cfg.stake * cfg.ticketCount > balance) revert("insufficient player balance");
        if (bankAssets == 0) revert("sports bank is unfunded");
    }

    function _validateOpenMarketConfig(FootballConfig memory cfg) internal view {
        if (cfg.poolId == 0) revert("bad pool id");
        if (cfg.outcomeCount != 3) revert("football 1X2 canary expects 3 outcomes");
        if (cfg.lockTime <= block.timestamp) revert("bad lockTime");
        if (cfg.startsAt <= cfg.lockTime) revert("bad startsAt");
        if (!cfg.sportsHub.oddsSigner(cfg.oddsSigner)) revert("odds signer not allowed");
        if (!cfg.sportsHub.resultReporter(cfg.resultReporter)) revert("result reporter not allowed");
        if (cfg.sportsHub.resultReporterThreshold() != 1) revert("football canary supports reporter threshold 1");

        uint256 bankAssets = IBankFootballCanary(cfg.sportsBank).totalAssets();
        if (bankAssets == 0) revert("sports bank is unfunded");
    }

    function _logConfig(string memory label, FootballConfig memory cfg) internal view {
        console2.log(label);
        console2.log("  market: FIFA World Cup 2026 opening match, Mexico vs South Africa, 1X2");
        console2.log("  outcome 0: Mexico");
        console2.log("  outcome 1: Draw");
        console2.log("  outcome 2: South Africa");
        console2.log("  player", cfg.player);
        console2.log("  oddsSigner", cfg.oddsSigner);
        console2.log("  resultReporter", cfg.resultReporter);
        console2.log("  sportsHub", address(cfg.sportsHub));
        console2.log("  sportsBank", cfg.sportsBank);
        console2.log("  sportsBankAssets", IBankFootballCanary(cfg.sportsBank).totalAssets());
        console2.log("  poolId", cfg.poolId);
        console2.log("  eventId", cfg.eventId);
        console2.log("  marketId", cfg.marketId);
        console2.log("  firstTicketId", cfg.firstTicketId);
        console2.log("  ticketCount", cfg.ticketCount);
        console2.log("  winningOutcomeId", cfg.winningOutcomeId);
        console2.log("  losingOutcomeId", cfg.losingOutcomeId);
        console2.log("  stake", cfg.stake);
        console2.log("  oddsWad", cfg.oddsWad);
        console2.log("  homeOddsWad", cfg.homeOddsWad);
        console2.log("  drawOddsWad", cfg.drawOddsWad);
        console2.log("  awayOddsWad", cfg.awayOddsWad);
        console2.log("  expectedWinningPayout", _expectedPayout(cfg, cfg.winningOutcomeId));
        if (cfg.ticketCount > 1) {
            console2.log("  expectedLosingPayout", _expectedPayout(cfg, cfg.losingOutcomeId));
        }
        console2.log("  lockTime", cfg.lockTime);
        console2.log("  startsAt", cfg.startsAt);
        console2.log("  expiresAt", cfg.expiresAt);
        if (cfg.observedAt != 0) {
            console2.log("  observedAt", cfg.observedAt);
        }
        console2.logBytes32(cfg.marketKey);
        console2.logBytes32(cfg.rulebookHash);
    }

    function _broadcastSetup(FootballConfig memory cfg) internal returns (uint256[] memory ticketIds) {
        ticketIds = _ticketIds(cfg.firstTicketId, cfg.ticketCount);

        vm.startBroadcast(cfg.privateKey);
        uint64 createdMarketId = cfg.sportsHub
            .createMarket(
                cfg.eventId,
                cfg.poolId,
                cfg.outcomeCount,
                cfg.startsAt,
                cfg.lockTime,
                cfg.finality,
                cfg.marketKey,
                cfg.rulebookHash
            );
        require(createdMarketId == cfg.marketId, "unexpected market id");
        cfg.sportsHub.openMarket(cfg.marketId);
        vm.stopBroadcast();

        vm.startBroadcast(cfg.playerPrivateKey);
        IERC20FootballCanary(cfg.asset).approve(cfg.sportsBank, cfg.stake * cfg.ticketCount);
        _placeTicket(cfg, cfg.winningOutcomeId, uint64(ticketIds[0]));
        if (cfg.ticketCount > 1) {
            _placeTicket(cfg, cfg.losingOutcomeId, uint64(ticketIds[1]));
        }
        vm.stopBroadcast();

        vm.startBroadcast(cfg.privateKey);
        cfg.sportsHub.lockMarket(cfg.marketId);
        vm.stopBroadcast();
    }

    function _broadcastOpenMarket(FootballConfig memory cfg) internal {
        vm.startBroadcast(cfg.privateKey);
        uint64 createdMarketId = cfg.sportsHub
            .createMarket(
                cfg.eventId,
                cfg.poolId,
                cfg.outcomeCount,
                cfg.startsAt,
                cfg.lockTime,
                cfg.finality,
                cfg.marketKey,
                cfg.rulebookHash
            );
        require(createdMarketId == cfg.marketId, "unexpected market id");
        cfg.sportsHub.openMarket(cfg.marketId);
        vm.stopBroadcast();
    }

    function _simulateSetup(FootballConfig memory cfg) internal returns (uint256[] memory ticketIds) {
        ticketIds = _ticketIds(cfg.firstTicketId, cfg.ticketCount);

        vm.startPrank(cfg.governance);
        uint64 createdMarketId = cfg.sportsHub
            .createMarket(
                cfg.eventId,
                cfg.poolId,
                cfg.outcomeCount,
                cfg.startsAt,
                cfg.lockTime,
                cfg.finality,
                cfg.marketKey,
                cfg.rulebookHash
            );
        require(createdMarketId == cfg.marketId, "unexpected market id");
        cfg.sportsHub.openMarket(cfg.marketId);
        vm.stopPrank();

        vm.startPrank(cfg.player);
        IERC20FootballCanary(cfg.asset).approve(cfg.sportsBank, cfg.stake * cfg.ticketCount);
        _placeTicket(cfg, cfg.winningOutcomeId, uint64(ticketIds[0]));
        if (cfg.ticketCount > 1) {
            _placeTicket(cfg, cfg.losingOutcomeId, uint64(ticketIds[1]));
        }
        vm.stopPrank();

        vm.prank(cfg.governance);
        cfg.sportsHub.lockMarket(cfg.marketId);
    }

    function _broadcastProposeResult(FootballConfig memory cfg) internal {
        vm.startBroadcast(cfg.resultReporterPrivateKey);
        cfg.sportsHub
            .proposeResult(
                cfg.marketId, cfg.winningOutcomeId, cfg.resultSourceHash, cfg.evidenceHash, _resultObservedAt(cfg)
            );
        vm.stopBroadcast();

        SSOTTypes.SportsResult memory result = cfg.sportsHub.getResult(cfg.marketId);
        console2.log("  resultPayloadHash");
        console2.logBytes32(result.resultPayloadHash);
        console2.log("  finalizesAt", result.finalizesAt);
    }

    function _simulateProposeResult(FootballConfig memory cfg) internal {
        vm.prank(cfg.resultReporter);
        cfg.sportsHub
            .proposeResult(
                cfg.marketId, cfg.winningOutcomeId, cfg.resultSourceHash, cfg.evidenceHash, _resultObservedAt(cfg)
            );

        SSOTTypes.SportsResult memory result = cfg.sportsHub.getResult(cfg.marketId);
        console2.log("  resultPayloadHash");
        console2.logBytes32(result.resultPayloadHash);
        console2.log("  finalizesAt", result.finalizesAt);
    }

    function _broadcastFinalizeAndSettle(FootballConfig memory cfg, uint256[] memory ticketIds) internal {
        vm.startBroadcast(cfg.privateKey);
        cfg.sportsHub.finalizeResult(cfg.marketId);
        cfg.sportsHub.settleTickets(ticketIds);
        vm.stopBroadcast();
    }

    function _simulateFinalizeAndSettle(FootballConfig memory cfg, uint256[] memory ticketIds) internal {
        vm.startPrank(cfg.governance);
        cfg.sportsHub.finalizeResult(cfg.marketId);
        cfg.sportsHub.settleTickets(ticketIds);
        vm.stopPrank();
    }

    function _broadcastSettleOnly(FootballConfig memory cfg, uint256[] memory ticketIds) internal {
        vm.startBroadcast(cfg.privateKey);
        cfg.sportsHub.settleTickets(ticketIds);
        vm.stopBroadcast();
    }

    function _placeTicket(FootballConfig memory cfg, uint32 outcomeId, uint64 nonce)
        internal
        returns (uint256 ticketId)
    {
        SSOTTypes.SportsMarket memory market = cfg.sportsHub.getMarket(cfg.marketId);
        SSOTTypes.SportsOddsSnapshot memory odds = SSOTTypes.SportsOddsSnapshot({
            marketId: cfg.marketId,
            outcomeId: outcomeId,
            marketVersion: market.version,
            oddsWad: _oddsWadForOutcome(cfg, outcomeId),
            maxStake: cfg.stake,
            maxPayout: cfg.maxPayout,
            expiresAt: cfg.expiresAt,
            nonce: nonce,
            riskHash: cfg.riskEngine.currentRiskHashForPool(cfg.poolId)
        });

        bytes32 oddsTicketHash = cfg.sportsHub.hashOddsTicket(odds, cfg.player, cfg.stake);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(cfg.oddsSignerPrivateKey, oddsTicketHash);
        ticketId = cfg.sportsHub.placeTicket(cfg.marketId, outcomeId, odds, cfg.stake, abi.encodePacked(r, s, v));
        console2.log("  ticketPlaced", ticketId);
        console2.log("  outcomeId", outcomeId);
    }

    function _validateResolved(FootballConfig memory cfg, uint256[] memory ticketIds) internal view {
        SSOTTypes.SportsMarket memory market = cfg.sportsHub.getMarket(cfg.marketId);
        require(market.state == SSOTTypes.SportsMarketState.Resolved, "market not resolved");
        require(cfg.sportsHub.marketReserved(cfg.marketId) == 0, "market reserved not cleared");
        require(cfg.sportsHub.poolEventReserved(cfg.poolId, cfg.eventId) == 0, "pool event reserved not cleared");
        require(cfg.sportsHub.eventReserved(cfg.eventId) == 0, "event reserved not cleared");
        require(IBankFootballCanary(cfg.sportsBank).totalReserved() == 0, "bank reserved not cleared");

        SSOTTypes.SportsResult memory result = cfg.sportsHub.getResult(cfg.marketId);
        require(result.winningOutcomeId == cfg.winningOutcomeId, "winning outcome mismatch");
        require(result.resultSourceHash == cfg.resultSourceHash, "source hash mismatch");
        require(result.evidenceHash == cfg.evidenceHash, "evidence hash mismatch");
        if (cfg.observedAt != 0) {
            require(result.observedAt == cfg.observedAt, "observedAt mismatch");
        }

        for (uint256 i = 0; i < ticketIds.length; ++i) {
            SSOTTypes.SportsTicket memory ticket = cfg.sportsHub.getTicket(ticketIds[i]);
            require(ticket.state == SSOTTypes.SportsTicketState.Settled, "ticket not settled");
        }

        console2.log("  resolvedMarketId", cfg.marketId);
        console2.log("  postBankReserved", IBankFootballCanary(cfg.sportsBank).totalReserved());
        console2.log("  postBankAssets", IBankFootballCanary(cfg.sportsBank).totalAssets());
    }

    function _ticketIds(uint256 firstTicketId, uint256 ticketCount) internal pure returns (uint256[] memory ticketIds) {
        if (ticketCount == 0 || ticketCount > 2) revert("bad ticket count");
        ticketIds = new uint256[](ticketCount);
        for (uint256 i = 0; i < ticketCount; ++i) {
            ticketIds[i] = firstTicketId + i;
        }
    }

    function _resultObservedAt(FootballConfig memory cfg) internal view returns (uint64) {
        if (cfg.observedAt == 0) {
            return uint64(block.timestamp);
        }
        if (cfg.observedAt < cfg.startsAt || cfg.observedAt > block.timestamp) revert("bad result observedAt");
        return cfg.observedAt;
    }

    function _localResultProposalTime(FootballConfig memory cfg) internal pure returns (uint64) {
        if (cfg.observedAt > cfg.startsAt) {
            return cfg.observedAt;
        }
        return cfg.startsAt;
    }

    function _expectedPayout(FootballConfig memory cfg, uint32 outcomeId) internal pure returns (uint256) {
        return cfg.stake * _oddsWadForOutcome(cfg, outcomeId) / WAD;
    }

    function _oddsWadForOutcome(FootballConfig memory cfg, uint32 outcomeId) internal pure returns (uint256) {
        if (outcomeId == 0) return cfg.homeOddsWad;
        if (outcomeId == 1) return cfg.drawOddsWad;
        if (outcomeId == 2) return cfg.awayOddsWad;
        revert("bad football outcome");
    }
}
