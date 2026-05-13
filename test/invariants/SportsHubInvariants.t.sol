// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";

import {Bank} from "../../src/core/Bank.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {SportsHub} from "../../src/core/SportsHub.sol";
import {SportsRiskEngine} from "../../src/core/SportsRiskEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract SportsHubHandler is Test {
    MockERC20 public asset;
    Bank public bank;
    PoolRegistry public registry;
    SettlementRouter public router;
    SportsRiskEngine public riskEngine;
    SportsHub public sportsHub;

    address public gov;
    address public reporter;
    uint256 public oddsSignerKey;
    address public oddsSigner;
    uint64 public marketId;

    address[] public players;
    uint256[] public ticketIds;

    uint256 public vEarlyDebtOut;

    uint64 internal constant SPORTS_POOL_ID = 2;
    uint64 internal constant EVENT_ID = 5005;
    uint32 internal constant OUTCOME_COUNT = 2;
    uint64 internal constant FINALITY = 30 minutes;
    bytes32 internal constant RESULT_SOURCE_HASH = keccak256("SPORTS_RESULT_PROVIDER");
    bytes32 internal constant RESULT_EVIDENCE_HASH = keccak256("SPORTS_RESULT_EVIDENCE");

    constructor(
        MockERC20 asset_,
        Bank bank_,
        PoolRegistry registry_,
        SettlementRouter router_,
        SportsRiskEngine riskEngine_,
        SportsHub sportsHub_,
        address gov_,
        address reporter_,
        uint256 oddsSignerKey_,
        uint64 marketId_
    ) {
        asset = asset_;
        bank = bank_;
        registry = registry_;
        router = router_;
        riskEngine = riskEngine_;
        sportsHub = sportsHub_;
        gov = gov_;
        reporter = reporter_;
        oddsSignerKey = oddsSignerKey_;
        oddsSigner = vm.addr(oddsSignerKey_);
        marketId = marketId_;

        for (uint256 i = 0; i < 8; ++i) {
            address player = address(uint160(uint256(keccak256(abi.encode("sports-player", i + 1)))));
            players.push(player);
            asset.mint(player, 250_000e6);
            vm.prank(player);
            asset.approve(address(bank), type(uint256).max);
        }
    }

    function ticketIdsLength() external view returns (uint256) {
        return ticketIds.length;
    }

    function action_placeTicket(uint256 seed, uint256 stakeRaw, uint32 outcomeRaw) external {
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.Open) return;
        if (block.timestamp >= market.lockTime) return;

        address player = players[seed % players.length];
        uint256 stake = bound(stakeRaw, 100e6, 500e6);
        uint32 outcomeId = uint32(bound(uint256(outcomeRaw), 0, OUTCOME_COUNT - 1));
        uint64 nonce = uint64(ticketIds.length + 1);

        SSOTTypes.SportsOddsSnapshot memory odds = SSOTTypes.SportsOddsSnapshot({
            marketId: marketId,
            outcomeId: outcomeId,
            marketVersion: market.version,
            oddsWad: 19e17,
            maxStake: 1_000e6,
            maxPayout: 2_000e6,
            expiresAt: uint64(block.timestamp + 1 hours),
            nonce: nonce,
            riskHash: riskEngine.currentRiskHashForPool(SPORTS_POOL_ID)
        });

        bytes32 oddsTicketHash = sportsHub.hashOddsTicket(odds, player, stake);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oddsSignerKey, oddsTicketHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(player);
        try sportsHub.placeTicket(marketId, outcomeId, odds, stake, signature) returns (uint256 ticketId) {
            ticketIds.push(ticketId);
        } catch {}
    }

    function action_lockAndPropose(uint32 winningRaw) external {
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.Open) return;

        vm.prank(gov);
        try sportsHub.lockMarket(marketId) {}
        catch {
            return;
        }

        market = sportsHub.getMarket(marketId);
        if (block.timestamp < market.startsAt) vm.warp(market.startsAt);

        uint32 winningOutcomeId = uint32(bound(uint256(winningRaw), 0, OUTCOME_COUNT - 1));
        vm.prank(reporter);
        try sportsHub.proposeResult(
            marketId, winningOutcomeId, RESULT_SOURCE_HASH, RESULT_EVIDENCE_HASH, uint64(block.timestamp)
        ) {}
            catch {}
    }

    function action_finalizeResult() external {
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.ResultProposed) return;

        SSOTTypes.SportsResult memory result = sportsHub.getResult(marketId);
        vm.warp(result.finalizesAt);
        try sportsHub.finalizeResult(marketId) {} catch {}
    }

    function action_challengeResult(bytes32 reasonHash) external {
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        if (market.state != SSOTTypes.SportsMarketState.ResultProposed) return;
        if (reasonHash == bytes32(0)) reasonHash = keccak256("DEFAULT_CHALLENGE");

        vm.prank(gov);
        try sportsHub.challengeResult(marketId, reasonHash) {} catch {}
    }

    function action_voidMarket() external {
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        if (market.state == SSOTTypes.SportsMarketState.Resolved || market.state == SSOTTypes.SportsMarketState.Voided)
        {
            return;
        }

        vm.prank(gov);
        try sportsHub.voidMarket(marketId) {} catch {}
    }

    function action_debtOut(uint256 seed) external {
        uint256 ticketId = _pickHeldTicket(seed);
        if (ticketId == 0) return;

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        if (market.state == SSOTTypes.SportsMarketState.Resolved) {
            try sportsHub.settleTicket(ticketId) {} catch {}
            return;
        }
        if (market.state == SSOTTypes.SportsMarketState.Voided) {
            if (seed % 2 == 0) {
                try sportsHub.voidTicket(ticketId) {} catch {}
            } else {
                try sportsHub.refundTicket(ticketId) {} catch {}
            }
            return;
        }

        try sportsHub.settleTicket(ticketId) {
            ++vEarlyDebtOut;
        } catch {}
        try sportsHub.voidTicket(ticketId) {
            ++vEarlyDebtOut;
        } catch {}
        try sportsHub.refundTicket(ticketId) {
            ++vEarlyDebtOut;
        } catch {}
    }

    function assertExposureMatchesHeldTickets() external view {
        uint256 marketSum;
        uint256 eventSum;
        uint256[2] memory outcomeSum;

        for (uint256 i = 0; i < ticketIds.length; ++i) {
            SSOTTypes.SportsTicket memory ticket = sportsHub.getTicket(ticketIds[i]);
            if (ticket.state != SSOTTypes.SportsTicketState.Held) continue;

            marketSum += ticket.reserved;
            eventSum += ticket.reserved;
            if (ticket.outcomeId < OUTCOME_COUNT) outcomeSum[ticket.outcomeId] += ticket.reserved;
        }

        assertEq(sportsHub.marketReserved(marketId), marketSum, "market exposure mismatch");
        assertEq(sportsHub.poolEventReserved(SPORTS_POOL_ID, EVENT_ID), eventSum, "pool event exposure mismatch");
        assertEq(sportsHub.eventReserved(EVENT_ID), eventSum, "event exposure mismatch");
        assertEq(sportsHub.marketOutcomeReserved(marketId, 0), outcomeSum[0], "outcome 0 exposure mismatch");
        assertEq(sportsHub.marketOutcomeReserved(marketId, 1), outcomeSum[1], "outcome 1 exposure mismatch");
        assertEq(bank.totalReserved(), marketSum, "bank reserve mismatch");
    }

    function assertRouterPositionsMatchTickets() external view {
        for (uint256 i = 0; i < ticketIds.length; ++i) {
            SSOTTypes.SportsTicket memory ticket = sportsHub.getTicket(ticketIds[i]);
            SSOTTypes.Position memory position = router.getPosition(ticket.positionId);

            assertEq(position.ownerHub, address(sportsHub), "wrong owner hub");
            assertEq(position.poolId, SPORTS_POOL_ID, "wrong pool");
            assertEq(position.player, ticket.player, "wrong player");
            assertEq(position.stake, ticket.stake, "wrong stake");
            assertEq(position.reserved, ticket.reserved, "wrong reserved");
            assertEq(position.snapshotHash, ticket.oddsSnapshotHash, "wrong snapshot");

            if (ticket.state == SSOTTypes.SportsTicketState.Held) {
                assertEq(uint256(position.state), uint256(SSOTTypes.PositionState.Held), "held position mismatch");
            } else if (ticket.state == SSOTTypes.SportsTicketState.Settled) {
                assertEq(uint256(position.state), uint256(SSOTTypes.PositionState.Settled), "settled position mismatch");
            } else if (
                ticket.state == SSOTTypes.SportsTicketState.Refunded
                    || ticket.state == SSOTTypes.SportsTicketState.Voided
            ) {
                assertEq(
                    uint256(position.state), uint256(SSOTTypes.PositionState.Refunded), "refunded position mismatch"
                );
            }
        }
    }

    function _pickHeldTicket(uint256 seed) internal view returns (uint256 ticketId) {
        uint256 n = ticketIds.length;
        if (n == 0) return 0;

        for (uint256 i = 0; i < n; ++i) {
            uint256 candidate = ticketIds[(seed + i) % n];
            SSOTTypes.SportsTicket memory ticket = sportsHub.getTicket(candidate);
            if (ticket.state == SSOTTypes.SportsTicketState.Held) return candidate;
        }
    }
}

contract SportsHubInvariants is StdInvariant, Test {
    MockERC20 internal asset;
    Bank internal bank;
    PoolRegistry internal registry;
    SettlementRouter internal router;
    SportsRiskEngine internal riskEngine;
    SportsHub internal sportsHub;
    SportsHubHandler internal handler;

    address internal gov = address(0xA11CE);
    address internal reporter = address(0xBEEF);
    uint256 internal oddsSignerKey = 0xA11CE1;
    address internal oddsSigner;

    bytes32 internal constant ODDS_SET_HASH = keccak256("ODDS_SET");
    bytes32 internal constant REPORTER_SET_HASH = keccak256("REPORTER_SET");
    bytes32 internal constant MARKET_KEY = keccak256("NBA:LAL:BOS:ML");
    bytes32 internal constant RULEBOOK_HASH = keccak256("SPORTS_RULEBOOK_V1");
    uint64 internal constant SPORTS_POOL_ID = 2;
    uint64 internal constant EVENT_ID = 5005;
    uint64 internal constant FINALITY = 30 minutes;

    function setUp() external {
        vm.warp(1_700_000_000);
        oddsSigner = vm.addr(oddsSignerKey);

        asset = new MockERC20("USD Coin", "USDC", 6);
        bank = new Bank(address(asset), gov, 1000, "LP USDC Sports", "lpUSDC-S", 6);
        registry = new PoolRegistry(gov);
        router = new SettlementRouter(address(registry));
        riskEngine = new SportsRiskEngine(gov, 1_000e6, 2_000e6, 20_000e6, 20_000e6, 20_000e6);
        sportsHub = new SportsHub(address(router), address(riskEngine), gov, ODDS_SET_HASH, REPORTER_SET_HASH);

        vm.startPrank(gov);
        registry.registerPool(SPORTS_POOL_ID, address(asset), address(bank), SSOTTypes.PoolDomain.Sports);
        registry.setHubRegistered(address(sportsHub), true);
        registry.setHubAllowedForPool(SPORTS_POOL_ID, address(sportsHub), true);
        bank.setSettlementRouterOnce(address(router));
        sportsHub.setOddsSigner(oddsSigner, true);
        sportsHub.setResultReporter(reporter, true);
        uint64 marketId = sportsHub.createMarket(
            EVENT_ID,
            SPORTS_POOL_ID,
            2,
            uint64(block.timestamp + 30 days + 1 hours),
            uint64(block.timestamp + 30 days),
            FINALITY,
            MARKET_KEY,
            RULEBOOK_HASH
        );
        sportsHub.openMarket(marketId);
        vm.stopPrank();

        asset.mint(gov, 1_000_000e6);
        vm.startPrank(gov);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(500_000e6, gov);
        vm.stopPrank();

        handler = new SportsHubHandler(
            asset, bank, registry, router, riskEngine, sportsHub, gov, reporter, oddsSignerKey, marketId
        );
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = SportsHubHandler.action_placeTicket.selector;
        selectors[1] = SportsHubHandler.action_lockAndPropose.selector;
        selectors[2] = SportsHubHandler.action_finalizeResult.selector;
        selectors[3] = SportsHubHandler.action_challengeResult.selector;
        selectors[4] = SportsHubHandler.action_voidMarket.selector;
        selectors[5] = SportsHubHandler.action_debtOut.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_sports_exposure_matches_held_tickets() external view {
        handler.assertExposureMatchesHeldTickets();
    }

    function invariant_sports_router_positions_match_tickets() external view {
        handler.assertRouterPositionsMatchTickets();
    }

    function invariant_sports_no_early_debt_out() external view {
        assertEq(handler.vEarlyDebtOut(), 0, "early sports debt-out succeeded");
    }
}
