// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {SportsRiskEngine} from "../../src/core/SportsRiskEngine.sol";
import {ISportsRiskEngine} from "../../src/core/interfaces/ISportsRiskEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Errors} from "../../src/libs/Errors.sol";

contract SportsRiskEngineTest is Test {
    address internal gov = address(0xA11CE);

    uint64 internal constant MARKET_ID = 1;
    uint64 internal constant EVENT_ID = 77;
    uint64 internal constant POOL_ID = 2;
    uint32 internal constant OUTCOME_ID = 1;
    uint32 internal constant OUTCOME_COUNT = 2;
    bytes32 internal constant RULEBOOK_HASH = keccak256("SPORTS_RULEBOOK_V1");

    SportsRiskEngine internal riskEngine;

    function setUp() external {
        vm.warp(1_700_000_000);
        riskEngine = new SportsRiskEngine(gov, 1_000e6, 2_000e6, 10_000e6, 5_000e6, 20_000e6);
    }

    function test_checkTicket_successComputesPayoutAndRiskHash() external view {
        ISportsRiskEngine.RiskDecision memory decision = riskEngine.checkTicket(_input(100e6, 0, 0, 0));

        assertEq(decision.payout, 190e6);
        assertEq(decision.reserved, 190e6);
        assertEq(decision.riskHash, riskEngine.currentRiskHashForPool(POOL_ID));
    }

    function test_setLimits_governanceOnlyAndUpdatesRiskHash() external {
        bytes32 oldHash = riskEngine.currentRiskHashForPool(POOL_ID);

        vm.expectRevert(Errors.Unauthorized.selector);
        riskEngine.setLimits(500e6, 1_000e6, 5_000e6, 2_500e6, 10_000e6);

        vm.prank(gov);
        riskEngine.setLimits(500e6, 1_000e6, 5_000e6, 2_500e6, 10_000e6);

        assertTrue(riskEngine.currentRiskHashForPool(POOL_ID) != oldHash);
        SportsRiskEngine.RiskLimits memory limits = riskEngine.limits();
        assertEq(limits.maxStake, 500e6);
        assertEq(limits.maxPayout, 1_000e6);
        assertEq(limits.maxMarketReserved, 5_000e6);
        assertEq(limits.maxOutcomeReserved, 2_500e6);
        assertEq(limits.maxEventReserved, 10_000e6);
    }

    function test_setLimits_rejectsInvalidCaps() external {
        vm.startPrank(gov);

        vm.expectRevert(Errors.InvalidConfig.selector);
        riskEngine.setLimits(0, 1_000e6, 5_000e6, 2_500e6, 10_000e6);

        vm.expectRevert(Errors.InvalidConfig.selector);
        riskEngine.setLimits(500e6, 3_000e6, 5_000e6, 2_500e6, 10_000e6);

        vm.expectRevert(Errors.InvalidConfig.selector);
        riskEngine.setLimits(500e6, 1_000e6, 2_000e6, 2_500e6, 10_000e6);

        vm.expectRevert(Errors.InvalidConfig.selector);
        riskEngine.setLimits(500e6, 1_000e6, 12_000e6, 2_500e6, 10_000e6);

        vm.stopPrank();
    }

    function test_setPoolLimits_overridesOnlySelectedPoolAndUpdatesRiskHash() external {
        bytes32 oldPoolHash = riskEngine.currentRiskHashForPool(POOL_ID);
        bytes32 otherPoolHash = riskEngine.currentRiskHashForPool(3);

        vm.expectRevert(Errors.Unauthorized.selector);
        riskEngine.setPoolLimits(POOL_ID, 200e6, 400e6, 2_000e6, 1_000e6, 3_000e6);

        vm.prank(gov);
        riskEngine.setPoolLimits(POOL_ID, 200e6, 400e6, 2_000e6, 1_000e6, 3_000e6);

        assertTrue(riskEngine.hasPoolLimits(POOL_ID));
        assertTrue(riskEngine.currentRiskHashForPool(POOL_ID) != oldPoolHash);
        assertEq(riskEngine.currentRiskHashForPool(3), otherPoolHash);

        SportsRiskEngine.RiskLimits memory limits = riskEngine.limitsForPool(POOL_ID);
        assertEq(limits.maxStake, 200e6);
        assertEq(limits.maxPayout, 400e6);
        assertEq(limits.maxMarketReserved, 2_000e6);
        assertEq(limits.maxOutcomeReserved, 1_000e6);
        assertEq(limits.maxEventReserved, 3_000e6);
    }

    function test_checkTicket_usesPoolSpecificLimits() external {
        vm.prank(gov);
        riskEngine.setPoolLimits(POOL_ID, 50e6, 100e6, 1_000e6, 500e6, 2_000e6);

        ISportsRiskEngine.RiskInput memory input = _input(100e6, 0, 0, 0);
        input.odds.riskHash = riskEngine.currentRiskHashForPool(POOL_ID);

        vm.expectRevert(abi.encodeWithSelector(ISportsRiskEngine.StakeTooLarge.selector, MARKET_ID, 100e6, 50e6));
        riskEngine.checkTicket(input);
    }

    function test_checkTicket_rejectsMarketStateAndTiming() external {
        ISportsRiskEngine.RiskInput memory input = _input(100e6, 0, 0, 0);
        input.market.state = SSOTTypes.SportsMarketState.Draft;
        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsRiskEngine.MarketNotOpen.selector, MARKET_ID, SSOTTypes.SportsMarketState.Draft
            )
        );
        riskEngine.checkTicket(input);

        input = _input(100e6, 0, 0, 0);
        input.market.state = SSOTTypes.SportsMarketState.Suspended;
        vm.expectRevert(abi.encodeWithSelector(ISportsRiskEngine.MarketSuspended.selector, MARKET_ID));
        riskEngine.checkTicket(input);

        input = _input(100e6, 0, 0, 0);
        vm.warp(input.market.lockTime);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsRiskEngine.MarketLocked.selector, MARKET_ID, block.timestamp, input.market.lockTime
            )
        );
        riskEngine.checkTicket(input);
    }

    function test_checkTicket_rejectsBadOddsAndExpiredOdds() external {
        ISportsRiskEngine.RiskInput memory input = _input(100e6, 0, 0, 0);
        input.odds.marketVersion = input.market.version + 1;
        vm.expectRevert(abi.encodeWithSelector(ISportsRiskEngine.BadOddsSnapshot.selector, MARKET_ID, OUTCOME_ID));
        riskEngine.checkTicket(input);

        input = _input(100e6, 0, 0, 0);
        input.odds.expiresAt = uint64(block.timestamp);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISportsRiskEngine.OddsExpired.selector, MARKET_ID, uint64(block.timestamp), block.timestamp
            )
        );
        riskEngine.checkTicket(input);
    }

    function test_checkTicket_rejectsStakeAndPayoutCaps() external {
        ISportsRiskEngine.RiskInput memory input = _input(1_001e6, 0, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(ISportsRiskEngine.StakeTooLarge.selector, MARKET_ID, 1_001e6, 1_000e6));
        riskEngine.checkTicket(input);

        input = _input(100e6, 0, 0, 0);
        input.odds.maxPayout = 100e6;
        vm.expectRevert(abi.encodeWithSelector(ISportsRiskEngine.PayoutTooLarge.selector, MARKET_ID, 190e6, 100e6));
        riskEngine.checkTicket(input);
    }

    function test_checkTicket_rejectsExposureCaps() external {
        ISportsRiskEngine.RiskInput memory input = _input(100e6, 9_900e6, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(ISportsRiskEngine.MarketExposureExceeded.selector, MARKET_ID, 10_090e6));
        riskEngine.checkTicket(input);

        input = _input(100e6, 0, 4_900e6, 0);
        vm.expectRevert(
            abi.encodeWithSelector(ISportsRiskEngine.OutcomeExposureExceeded.selector, MARKET_ID, OUTCOME_ID, 5_090e6)
        );
        riskEngine.checkTicket(input);

        input = _input(100e6, 0, 0, 19_900e6);
        vm.expectRevert(abi.encodeWithSelector(ISportsRiskEngine.EventExposureExceeded.selector, EVENT_ID, 20_090e6));
        riskEngine.checkTicket(input);
    }

    function _input(uint256 stake, uint256 marketReserved, uint256 outcomeReserved, uint256 eventReserved)
        internal
        view
        returns (ISportsRiskEngine.RiskInput memory input)
    {
        input = ISportsRiskEngine.RiskInput({
            market: SSOTTypes.SportsMarket({
                marketId: MARKET_ID,
                eventId: EVENT_ID,
                poolId: POOL_ID,
                outcomeCount: OUTCOME_COUNT,
                startsAt: uint64(block.timestamp + 1 days + 1 hours),
                lockTime: uint64(block.timestamp + 1 days),
                resultFinalitySeconds: 30 minutes,
                version: 2,
                marketKey: keccak256("NBA:LAL:BOS:ML"),
                rulebookHash: RULEBOOK_HASH,
                state: SSOTTypes.SportsMarketState.Open
            }),
            odds: SSOTTypes.SportsOddsSnapshot({
                marketId: MARKET_ID,
                outcomeId: OUTCOME_ID,
                marketVersion: 2,
                oddsWad: 19e17,
                maxStake: 1_000e6,
                maxPayout: 2_000e6,
                expiresAt: uint64(block.timestamp + 1 hours),
                nonce: 1,
                riskHash: riskEngine.currentRiskHashForPool(POOL_ID)
            }),
            stake: stake,
            marketReserved: marketReserved,
            outcomeReserved: outcomeReserved,
            eventReserved: eventReserved
        });
    }
}
