// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import {SportsHub} from "../../src/core/SportsHub.sol";
import {SportsRiskEngine} from "../../src/core/SportsRiskEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

interface IERC20Canary {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IBankCanary {
    function totalAssets() external view returns (uint256);
    function totalReserved() external view returns (uint256);
}

/// @notice Public-testnet SportsHub canary helper.
/// @dev Default mode creates a short-lived market and places one winning-outcome ticket.
///      `CANARY_MODE=void-batch` rehearses direct market void plus batch refund/void debt-out.
///      The wrapper script simulates by default; set BROADCAST=1 there to send transactions.
contract SportsCanaryV13 is Script {
    using stdJson for string;

    uint64 internal constant SPORTS_POOL_ID = 2;
    uint32 internal constant OUTCOME_COUNT = 2;
    uint32 internal constant WINNING_OUTCOME_ID = 1;
    uint256 internal constant WAD = 1e18;

    struct CanaryConfig {
        uint256 privateKey;
        address player;
        address asset;
        address sportsBank;
        SportsHub sportsHub;
        SportsRiskEngine riskEngine;
        uint256 stake;
        uint256 oddsWad;
        uint256 maxPayout;
        uint64 eventId;
        uint64 marketId;
        uint256 ticketId;
        uint64 lockTime;
        uint64 startsAt;
        uint64 expiresAt;
        uint64 finality;
        bytes32 marketKey;
        bytes32 rulebookHash;
    }

    function run() external {
        string memory mode = vm.envOr("CANARY_MODE", string("place"));
        bytes32 modeHash = keccak256(bytes(mode));

        if (modeHash == keccak256("place")) {
            _placeCanary();
            return;
        }

        if (modeHash == keccak256("void-batch")) {
            _voidBatchCanary();
            return;
        }

        revert("unsupported CANARY_MODE");
    }

    function _placeCanary() internal {
        CanaryConfig memory cfg = _readPlaceConfig();

        _validatePlaceConfig(cfg);
        _logPlaceConfig(cfg);
        (uint256 placedTicketId, bytes32 oddsTicketHash) = _broadcastPlace(cfg);

        console2.log("  placedTicketId", placedTicketId);
        console2.logBytes32(oddsTicketHash);
    }

    function _voidBatchCanary() internal {
        CanaryConfig memory cfg = _readPlaceConfig();

        _validateVoidBatchConfig(cfg);
        _logVoidBatchConfig(cfg);
        (uint256[] memory refundIds, uint256[] memory voidIds) = _broadcastVoidBatch(cfg);
        _validateVoidBatchResult(cfg, refundIds, voidIds);

        console2.log("  refund batch size", refundIds.length);
        for (uint256 i = 0; i < refundIds.length; ++i) {
            console2.log("  refundedTicketId", refundIds[i]);
        }
        console2.log("  void batch size", voidIds.length);
        for (uint256 i = 0; i < voidIds.length; ++i) {
            console2.log("  voidedTicketId", voidIds[i]);
        }
    }

    function _readPlaceConfig() internal view returns (CanaryConfig memory cfg) {
        cfg.privateKey = vm.envUint("PRIVATE_KEY");
        cfg.player = vm.addr(cfg.privateKey);
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v13.json"));
        string memory json = vm.readFile(snapshotPath);

        cfg.asset = json.readAddress(".poolAsset_1");
        cfg.sportsBank = json.readAddress(".poolBank_1");
        cfg.sportsHub = SportsHub(json.readAddress(".sportsHub"));
        cfg.riskEngine = SportsRiskEngine(json.readAddress(".sportsRiskEngine"));

        cfg.stake = vm.envOr("CANARY_STAKE", uint256(100_000));
        cfg.oddsWad = vm.envOr("CANARY_ODDS_WAD", uint256(15 * WAD / 10));
        cfg.maxPayout = vm.envOr("CANARY_MAX_PAYOUT", uint256(200_000));
        uint256 lockOffset = vm.envOr("CANARY_LOCK_OFFSET_SECONDS", uint256(5 minutes));
        uint256 startOffset = vm.envOr("CANARY_START_OFFSET_SECONDS", uint256(1 minutes));
        cfg.finality = uint64(vm.envOr("CANARY_RESULT_FINALITY_SECONDS", uint256(10 minutes)));

        cfg.eventId = uint64(vm.envOr("CANARY_EVENT_ID", uint256(block.timestamp)));
        cfg.marketId = cfg.sportsHub.nextMarketId();
        cfg.ticketId = cfg.sportsHub.nextTicketId();
        cfg.lockTime = uint64(block.timestamp + lockOffset);
        cfg.startsAt = uint64(block.timestamp + lockOffset + startOffset);
        cfg.expiresAt = uint64(block.timestamp + lockOffset - 30 seconds);
        cfg.marketKey =
            keccak256(abi.encodePacked("BASE_SEPOLIA_SPORTS_CANARY", block.chainid, cfg.eventId, cfg.player));
        cfg.rulebookHash = keccak256("BASE_SEPOLIA_SPORTS_CANARY_RULEBOOK_V1");
    }

    function _validatePlaceConfig(CanaryConfig memory cfg) internal view {
        uint256 balance = IERC20Canary(cfg.asset).balanceOf(cfg.player);
        uint256 bankAssets = IBankCanary(cfg.sportsBank).totalAssets();
        if (cfg.stake == 0 || cfg.stake > balance) revert("insufficient canary stake balance");
        if (bankAssets == 0) revert("sports bank is unfunded");
        if (cfg.expiresAt <= block.timestamp) revert("bad canary expiry");
    }

    function _validateVoidBatchConfig(CanaryConfig memory cfg) internal view {
        uint256 batchSize = _batchSize();
        if (batchSize == 0 || batchSize > 8) revert("bad batch size");
        uint256 ticketCount = batchSize * 2;
        uint256 balance = IERC20Canary(cfg.asset).balanceOf(cfg.player);
        uint256 bankAssets = IBankCanary(cfg.sportsBank).totalAssets();
        if (cfg.stake == 0 || cfg.stake * ticketCount > balance) revert("insufficient batch stake balance");
        if (bankAssets == 0) revert("sports bank is unfunded");
        if (cfg.expiresAt <= block.timestamp) revert("bad canary expiry");
    }

    function _logPlaceConfig(CanaryConfig memory cfg) internal pure {
        console2.log("Sports canary place:");
        console2.log("  player", cfg.player);
        console2.log("  asset", cfg.asset);
        console2.log("  sportsBank", cfg.sportsBank);
        console2.log("  sportsHub", address(cfg.sportsHub));
        console2.log("  marketId", cfg.marketId);
        console2.log("  ticketId", cfg.ticketId);
        console2.log("  eventId", cfg.eventId);
        console2.log("  stake", cfg.stake);
        console2.log("  oddsWad", cfg.oddsWad);
        console2.log("  expectedPayout", cfg.stake * cfg.oddsWad / WAD);
        console2.log("  lockTime", cfg.lockTime);
        console2.log("  startsAt", cfg.startsAt);
    }

    function _logVoidBatchConfig(CanaryConfig memory cfg) internal view {
        uint256 batchSize = _batchSize();
        uint256 ticketCount = batchSize * 2;
        console2.log("Sports canary direct void + batch debt-out:");
        console2.log("  player", cfg.player);
        console2.log("  asset", cfg.asset);
        console2.log("  sportsBank", cfg.sportsBank);
        console2.log("  sportsHub", address(cfg.sportsHub));
        console2.log("  marketId", cfg.marketId);
        console2.log("  firstTicketId", cfg.ticketId);
        console2.log("  eventId", cfg.eventId);
        console2.log("  stakeEach", cfg.stake);
        console2.log("  oddsWad", cfg.oddsWad);
        console2.log("  ticketCount", ticketCount);
        console2.log("  refundBatchSize", batchSize);
        console2.log("  voidBatchSize", batchSize);
        console2.log("  totalStake", cfg.stake * ticketCount);
        console2.log("  expectedTotalReserved", cfg.stake * cfg.oddsWad / WAD * ticketCount);
        console2.log("  lockTime", cfg.lockTime);
        console2.log("  startsAt", cfg.startsAt);
    }

    function _broadcastPlace(CanaryConfig memory cfg)
        internal
        returns (uint256 placedTicketId, bytes32 oddsTicketHash)
    {
        vm.startBroadcast(cfg.privateKey);

        uint64 createdMarketId = cfg.sportsHub
            .createMarket(
                cfg.eventId,
                SPORTS_POOL_ID,
                OUTCOME_COUNT,
                cfg.startsAt,
                cfg.lockTime,
                cfg.finality,
                cfg.marketKey,
                cfg.rulebookHash
            );
        require(createdMarketId == cfg.marketId, "unexpected marketId");
        cfg.sportsHub.openMarket(cfg.marketId);

        SSOTTypes.SportsMarket memory market = cfg.sportsHub.getMarket(cfg.marketId);
        SSOTTypes.SportsOddsSnapshot memory odds = SSOTTypes.SportsOddsSnapshot({
            marketId: cfg.marketId,
            outcomeId: WINNING_OUTCOME_ID,
            marketVersion: market.version,
            oddsWad: cfg.oddsWad,
            maxStake: cfg.stake,
            maxPayout: cfg.maxPayout,
            expiresAt: cfg.expiresAt,
            nonce: uint64(cfg.ticketId),
            riskHash: cfg.riskEngine.currentRiskHashForPool(SPORTS_POOL_ID)
        });

        oddsTicketHash = cfg.sportsHub.hashOddsTicket(odds, cfg.player, cfg.stake);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(cfg.privateKey, oddsTicketHash);

        IERC20Canary(cfg.asset).approve(cfg.sportsBank, cfg.stake);
        placedTicketId =
            cfg.sportsHub.placeTicket(cfg.marketId, WINNING_OUTCOME_ID, odds, cfg.stake, abi.encodePacked(r, s, v));
        require(placedTicketId == cfg.ticketId, "unexpected ticketId");

        vm.stopBroadcast();
    }

    function _broadcastVoidBatch(CanaryConfig memory cfg)
        internal
        returns (uint256[] memory refundIds, uint256[] memory voidIds)
    {
        uint256 batchSize = _batchSize();
        uint256 ticketCount = batchSize * 2;
        bytes32 voidReasonHash =
            vm.envOr("CANARY_VOID_REASON_HASH", keccak256("BASE_SEPOLIA_SPORTS_CANARY_DIRECT_VOID"));

        refundIds = new uint256[](batchSize);
        voidIds = new uint256[](batchSize);

        vm.startBroadcast(cfg.privateKey);

        uint64 createdMarketId = cfg.sportsHub
            .createMarket(
                cfg.eventId,
                SPORTS_POOL_ID,
                OUTCOME_COUNT,
                cfg.startsAt,
                cfg.lockTime,
                cfg.finality,
                cfg.marketKey,
                cfg.rulebookHash
            );
        require(createdMarketId == cfg.marketId, "unexpected marketId");
        cfg.sportsHub.openMarket(cfg.marketId);

        IERC20Canary(cfg.asset).approve(cfg.sportsBank, cfg.stake * ticketCount);

        for (uint256 i = 0; i < batchSize; ++i) {
            refundIds[i] = _placeTicket(cfg, WINNING_OUTCOME_ID, uint64(cfg.ticketId + i * 2));
            voidIds[i] = _placeTicket(cfg, 0, uint64(cfg.ticketId + i * 2 + 1));
        }

        cfg.sportsHub.voidMarket(cfg.marketId, voidReasonHash);
        cfg.sportsHub.refundTickets(refundIds);
        cfg.sportsHub.voidTickets(voidIds);

        vm.stopBroadcast();

        console2.log("  voidReasonHash");
        console2.logBytes32(voidReasonHash);
    }

    function _placeTicket(CanaryConfig memory cfg, uint32 outcomeId, uint64 nonce) internal returns (uint256 ticketId) {
        SSOTTypes.SportsMarket memory market = cfg.sportsHub.getMarket(cfg.marketId);
        SSOTTypes.SportsOddsSnapshot memory odds = SSOTTypes.SportsOddsSnapshot({
            marketId: cfg.marketId,
            outcomeId: outcomeId,
            marketVersion: market.version,
            oddsWad: cfg.oddsWad,
            maxStake: cfg.stake,
            maxPayout: cfg.maxPayout,
            expiresAt: cfg.expiresAt,
            nonce: nonce,
            riskHash: cfg.riskEngine.currentRiskHashForPool(SPORTS_POOL_ID)
        });

        bytes32 oddsTicketHash = cfg.sportsHub.hashOddsTicket(odds, cfg.player, cfg.stake);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(cfg.privateKey, oddsTicketHash);
        ticketId = cfg.sportsHub.placeTicket(cfg.marketId, outcomeId, odds, cfg.stake, abi.encodePacked(r, s, v));
    }

    function _validateVoidBatchResult(CanaryConfig memory cfg, uint256[] memory refundIds, uint256[] memory voidIds)
        internal
        view
    {
        SSOTTypes.SportsMarket memory market = cfg.sportsHub.getMarket(cfg.marketId);
        require(market.state == SSOTTypes.SportsMarketState.Voided, "market not voided");
        require(cfg.sportsHub.marketReserved(cfg.marketId) == 0, "market reserved not cleared");
        require(cfg.sportsHub.poolEventReserved(SPORTS_POOL_ID, cfg.eventId) == 0, "pool event reserved not cleared");
        require(cfg.sportsHub.eventReserved(cfg.eventId) == 0, "event reserved not cleared");
        require(IBankCanary(cfg.sportsBank).totalReserved() == 0, "bank reserved not cleared");

        for (uint256 i = 0; i < refundIds.length; ++i) {
            SSOTTypes.SportsTicket memory ticket = cfg.sportsHub.getTicket(refundIds[i]);
            require(ticket.state == SSOTTypes.SportsTicketState.Refunded, "ticket not refunded");
        }
        for (uint256 i = 0; i < voidIds.length; ++i) {
            SSOTTypes.SportsTicket memory ticket = cfg.sportsHub.getTicket(voidIds[i]);
            require(ticket.state == SSOTTypes.SportsTicketState.Voided, "ticket not voided");
        }

        console2.log("  postMarketReserved", cfg.sportsHub.marketReserved(cfg.marketId));
        console2.log("  postPoolEventReserved", cfg.sportsHub.poolEventReserved(SPORTS_POOL_ID, cfg.eventId));
        console2.log("  postEventReserved", cfg.sportsHub.eventReserved(cfg.eventId));
        console2.log("  postBankReserved", IBankCanary(cfg.sportsBank).totalReserved());
        console2.log("  postBankAssets", IBankCanary(cfg.sportsBank).totalAssets());
    }

    function _batchSize() internal view returns (uint256) {
        return vm.envOr("CANARY_BATCH_SIZE", uint256(2));
    }
}
