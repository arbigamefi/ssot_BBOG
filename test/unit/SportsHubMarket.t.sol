// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {SportsHub} from "../../src/core/SportsHub.sol";
import {IPoolRegistry} from "../../src/core/interfaces/IPoolRegistry.sol";
import {ISportsHub} from "../../src/core/interfaces/ISportsHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract SportsHubMarketTest is Test {
    address internal gov = address(0xA11CE);
    address internal user = address(0xB0B);
    address internal riskEngine = address(0x5151);

    bytes32 internal constant ODDS_SET_HASH = keccak256("ODDS_SET");
    bytes32 internal constant REPORTER_SET_HASH = keccak256("REPORTER_SET");
    bytes32 internal constant MARKET_KEY = keccak256("NBA:LAL:BOS:ML");
    bytes32 internal constant RULEBOOK_HASH = keccak256("SPORTS_RULEBOOK_V1");

    uint64 internal constant CASINO_POOL_ID = 1;
    uint64 internal constant SPORTS_POOL_ID = 2;
    uint64 internal constant EVENT_ID = 1001;
    uint32 internal constant OUTCOME_COUNT = 2;
    uint64 internal constant FINALITY = 30 minutes;

    MockERC20 internal usdc;
    Bank internal casinoBank;
    Bank internal sportsBank;
    PoolRegistry internal registry;
    SettlementRouter internal router;
    SportsHub internal sportsHub;

    function setUp() external {
        vm.warp(1_700_000_000);

        usdc = new MockERC20("USD Coin", "USDC", 6);
        casinoBank = new Bank(address(usdc), gov, 1000, "LP USDC Casino", "lpUSDC-C", 6);
        sportsBank = new Bank(address(usdc), gov, 1000, "LP USDC Sports", "lpUSDC-S", 6);
        registry = new PoolRegistry(gov);
        router = new SettlementRouter(address(registry));
        sportsHub = new SportsHub(address(router), riskEngine, gov, ODDS_SET_HASH, REPORTER_SET_HASH);

        vm.startPrank(gov);
        registry.registerPool(CASINO_POOL_ID, address(usdc), address(casinoBank), SSOTTypes.PoolDomain.Casino);
        registry.registerPool(SPORTS_POOL_ID, address(usdc), address(sportsBank), SSOTTypes.PoolDomain.Sports);
        registry.setHubRegistered(address(sportsHub), true);
        registry.setHubAllowedForPool(SPORTS_POOL_ID, address(sportsHub), true);
        vm.stopPrank();
    }

    function test_constructor_setsDependencies() external view {
        assertEq(sportsHub.settlementRouter(), address(router));
        assertEq(sportsHub.poolRegistry(), address(registry));
        assertEq(sportsHub.riskEngine(), riskEngine);
        assertEq(sportsHub.oddsSignerSetHash(), ODDS_SET_HASH);
        assertEq(sportsHub.resultReporterSetHash(), REPORTER_SET_HASH);
        assertEq(sportsHub.nextMarketId(), 1);
        assertEq(sportsHub.nextTicketId(), 1);
    }

    function test_constructor_rejectsInvalidInputs() external {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new SportsHub(address(0), riskEngine, gov, ODDS_SET_HASH, REPORTER_SET_HASH);

        vm.expectRevert(Errors.ZeroAddress.selector);
        new SportsHub(address(router), address(0), gov, ODDS_SET_HASH, REPORTER_SET_HASH);

        vm.expectRevert(Errors.InvalidConfig.selector);
        new SportsHub(address(router), riskEngine, gov, bytes32(0), REPORTER_SET_HASH);

        vm.expectRevert(Errors.InvalidConfig.selector);
        new SportsHub(address(router), riskEngine, gov, ODDS_SET_HASH, bytes32(0));
    }

    function test_createMarket_success() external {
        uint64 marketId = _createMarket();

        assertEq(marketId, 1);
        assertEq(sportsHub.nextMarketId(), 2);

        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(market.marketId, marketId);
        assertEq(market.eventId, EVENT_ID);
        assertEq(market.poolId, SPORTS_POOL_ID);
        assertEq(market.outcomeCount, OUTCOME_COUNT);
        assertEq(market.lockTime, _lockTime());
        assertEq(market.startsAt, _startsAt());
        assertEq(market.resultFinalitySeconds, FINALITY);
        assertEq(market.version, 1);
        assertEq(market.marketKey, MARKET_KEY);
        assertEq(market.rulebookHash, RULEBOOK_HASH);
        assertEq(uint256(market.state), uint256(SSOTTypes.SportsMarketState.Draft));
    }

    function test_createMarket_rejectsNonGovAndInvalidConfig() external {
        vm.expectRevert(Errors.Unauthorized.selector);
        sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, OUTCOME_COUNT, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );

        vm.startPrank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.createMarket(
            0, SPORTS_POOL_ID, OUTCOME_COUNT, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );

        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, 1, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );

        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, OUTCOME_COUNT, _lockTime(), _startsAt(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );

        vm.expectRevert(Errors.InvalidConfig.selector);
        sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, OUTCOME_COUNT, _startsAt(), _lockTime(), 0, MARKET_KEY, RULEBOOK_HASH
        );
        vm.stopPrank();
    }

    function test_createMarket_requiresSportsPoolAndHubAllowlist() external {
        vm.startPrank(gov);
        vm.expectRevert(
            abi.encodeWithSelector(ISportsHub.BadPoolDomain.selector, CASINO_POOL_ID, SSOTTypes.PoolDomain.Casino)
        );
        sportsHub.createMarket(
            EVENT_ID, CASINO_POOL_ID, OUTCOME_COUNT, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );

        registry.setHubAllowedForPool(SPORTS_POOL_ID, address(sportsHub), false);
        vm.expectRevert(
            abi.encodeWithSelector(IPoolRegistry.HubNotAllowedForPool.selector, SPORTS_POOL_ID, address(sportsHub))
        );
        sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, OUTCOME_COUNT, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );
        vm.stopPrank();
    }

    function test_marketLifecycle_openSuspendResumeLockVoid() external {
        uint64 marketId = _createMarket();

        vm.prank(gov);
        sportsHub.openMarket(marketId);
        _assertMarketState(marketId, SSOTTypes.SportsMarketState.Open, 2);

        vm.prank(gov);
        sportsHub.suspendMarket(marketId, true);
        _assertMarketState(marketId, SSOTTypes.SportsMarketState.Suspended, 3);

        vm.prank(gov);
        sportsHub.suspendMarket(marketId, false);
        _assertMarketState(marketId, SSOTTypes.SportsMarketState.Open, 4);

        vm.prank(gov);
        sportsHub.lockMarket(marketId);
        _assertMarketState(marketId, SSOTTypes.SportsMarketState.Locked, 5);

        vm.prank(gov);
        sportsHub.voidMarket(marketId);
        _assertMarketState(marketId, SSOTTypes.SportsMarketState.Voided, 6);
    }

    function test_marketLifecycle_rejectsBadTransitions() external {
        uint64 marketId = _createMarket();

        vm.prank(gov);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Draft,
                SSOTTypes.SportsMarketState.Open
            )
        );
        sportsHub.lockMarket(marketId);

        vm.startPrank(gov);
        sportsHub.openMarket(marketId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Open,
                SSOTTypes.SportsMarketState.Draft
            )
        );
        sportsHub.openMarket(marketId);

        sportsHub.voidMarket(marketId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Voided,
                SSOTTypes.SportsMarketState.Open
            )
        );
        sportsHub.voidMarket(marketId);
        vm.stopPrank();
    }

    function test_marketCannotOpenAfterLockTime() external {
        uint64 marketId = _createMarket();

        vm.warp(_lockTime());
        vm.prank(gov);
        vm.expectRevert(abi.encodeWithSelector(ISportsHub.MarketLocked.selector, marketId));
        sportsHub.openMarket(marketId);
    }

    function test_placeTicketRejectsNonOpenSuspendedLockedAndExpiredOdds() external {
        uint64 marketId = _createMarket();

        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsHub.BadMarketState.selector,
                marketId,
                SSOTTypes.SportsMarketState.Draft,
                SSOTTypes.SportsMarketState.Open
            )
        );
        sportsHub.placeTicket(marketId, 0, _odds(marketId, 1, 0, _lockTime()), 100e6, "");

        vm.prank(gov);
        sportsHub.openMarket(marketId);

        vm.expectRevert(
            abi.encodeWithSelector(ISportsHub.OddsExpired.selector, marketId, uint64(block.timestamp), block.timestamp)
        );
        sportsHub.placeTicket(marketId, 0, _odds(marketId, 2, 0, uint64(block.timestamp)), 100e6, "");

        vm.prank(gov);
        sportsHub.suspendMarket(marketId, true);

        vm.expectRevert(abi.encodeWithSelector(ISportsHub.MarketSuspended.selector, marketId));
        sportsHub.placeTicket(marketId, 0, _odds(marketId, 3, 0, _lockTime()), 100e6, "");

        vm.prank(gov);
        sportsHub.lockMarket(marketId);

        vm.expectRevert(abi.encodeWithSelector(ISportsHub.MarketLocked.selector, marketId));
        sportsHub.placeTicket(marketId, 0, _odds(marketId, 4, 0, _lockTime()), 100e6, "");
    }

    function _createMarket() internal returns (uint64 marketId) {
        vm.prank(gov);
        marketId = sportsHub.createMarket(
            EVENT_ID, SPORTS_POOL_ID, OUTCOME_COUNT, _startsAt(), _lockTime(), FINALITY, MARKET_KEY, RULEBOOK_HASH
        );
    }

    function _odds(uint64 marketId, uint64 marketVersion, uint32 outcomeId, uint64 expiresAt)
        internal
        pure
        returns (SSOTTypes.SportsOddsSnapshot memory odds)
    {
        odds = SSOTTypes.SportsOddsSnapshot({
            marketId: marketId,
            outcomeId: outcomeId,
            marketVersion: marketVersion,
            oddsWad: 2e18,
            maxStake: 1_000e6,
            maxPayout: 2_000e6,
            expiresAt: expiresAt,
            nonce: 1,
            riskHash: keccak256("RISK")
        });
    }

    function _assertMarketState(uint64 marketId, SSOTTypes.SportsMarketState state, uint64 version) internal view {
        SSOTTypes.SportsMarket memory market = sportsHub.getMarket(marketId);
        assertEq(uint256(market.state), uint256(state));
        assertEq(market.version, version);
    }

    function _lockTime() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days);
    }

    function _startsAt() internal view returns (uint64) {
        return uint64(block.timestamp + 1 days + 1 hours);
    }
}
