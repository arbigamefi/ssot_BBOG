// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";

import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";

contract RouterStakePayoutModule is IGameModule {
    function validate(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec) external pure {
        require(stakeSpec.amountPerRoll > 0 && stakeSpec.betCount > 0, "bad spec");
    }

    function maxPayout(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec) external pure returns (uint256) {
        return stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
    }

    function resolve(bytes calldata, SSOTTypes.StakeSpec calldata stakeSpec, uint256, uint256[] calldata)
        external
        pure
        returns (uint256 payoutGross, uint256 refundAmount)
    {
        payoutGross = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        refundAmount = 0;
    }
}

/// @dev Deterministic terminal tuples exercise receipt storage independently of any game's RNG.
contract RouterTerminalOutcomeModule is IGameModule {
    function validate(bytes calldata params, SSOTTypes.StakeSpec calldata spec) external pure {
        require(params.length == 64 && spec.amountPerRoll > 0 && spec.betCount > 0, "bad spec");
    }

    function maxPayout(bytes calldata, SSOTTypes.StakeSpec calldata spec) external pure returns (uint256) {
        return 2 * spec.amountPerRoll * uint256(spec.betCount);
    }

    function resolve(bytes calldata params, SSOTTypes.StakeSpec calldata, uint256, uint256[] calldata)
        external
        pure
        returns (uint256 payoutGross, uint256 refundAmount)
    {
        return abi.decode(params, (uint256, uint256));
    }
}

contract GameHubRouterTest is Test {
    bytes32 internal constant GAME_STAKE = keccak256("ROUTER_STAKE");

    address internal gov = address(0xA11CE);
    address internal player = address(0xBEEF);

    MockERC20 internal asset;
    Bank internal bank;
    Bank internal secondBank;
    PoolRegistry internal poolRegistry;
    SettlementRouter internal router;
    VRFHub internal vrf;
    MockVRFV2PlusWrapper internal wrapper;
    ReferralRegistry internal refRegistry;
    DefaultReferralEngine internal refEngine;
    GameHub internal gameHub;

    function setUp() external {
        asset = new MockERC20("USD Coin", "USDC", 6);
        bank = new Bank(address(asset), gov, 0, 6, 1);
        secondBank = new Bank(address(asset), gov, 0, 6, 1);
        poolRegistry = new PoolRegistry(gov);
        router = new SettlementRouter(address(poolRegistry));
        wrapper = new MockVRFV2PlusWrapper();
        vrf = new VRFHub(address(wrapper), address(router));
        refRegistry = new ReferralRegistry(gov);
        refEngine = new DefaultReferralEngine();

        gameHub = new GameHub(
            address(router), address(vrf), address(refRegistry), address(refEngine), gov, 3600, 200, 0, 0, 0, 0
        );

        vm.startPrank(gov);
        poolRegistry.registerPool(1, address(asset), address(bank), SSOTTypes.PoolDomain.Casino);
        poolRegistry.registerPool(2, address(asset), address(secondBank), SSOTTypes.PoolDomain.Casino);
        poolRegistry.setHubRegistered(address(gameHub), true);
        poolRegistry.setHubAllowedForPool(1, address(gameHub), true);
        poolRegistry.setHubAllowedForPool(2, address(gameHub), true);
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(vrf));
        secondBank.setSettlementRouterOnce(address(router));
        secondBank.setRandomnessConsumerOnce(address(vrf));
        refRegistry.setBinderOnce(address(gameHub));
        gameHub.registerGame(GAME_STAKE, address(new RouterStakePayoutModule()), 25, 2_447_746);
        vm.stopPrank();

        asset.mint(gov, 1_000_000e6);
        asset.mint(player, 100e6);
        vm.deal(player, 10 ether);

        vm.startPrank(gov);
        asset.approve(address(bank.vault()), type(uint256).max);
        LiquidityVault(bank.vault()).addDepositFor(gov, 500_000e6);
        vm.stopPrank();

        vm.prank(player);
        asset.approve(address(gameHub), type(uint256).max);
    }

    function test_exactRiskMaximumIncludesIncomingStakeAndFloorBuffer() external {
        _prepareRiskCoin();
        uint256 capital = LiquidityVault(bank.vault()).getReserve();
        uint256 maximum = _coinRiskMaximum(capital, 0);
        assertEq(maximum, 409_090_909_091, "500000 USDC, 10% retained, 2x gross odds");
        assertEq(maximum, capital * 9 / 11 + 1, "floor buffer admits one extra smallest asset unit here");
        uint256 playerBefore = asset.balanceOf(player);
        _placeRiskCoin(maximum + 1, 1, true);
        assertEq(asset.balanceOf(player), playerBefore, "rejection rolls back collection into Hub");
        assertEq(bank.pendingStakeTotal(), 0);
        assertEq(bank.totalReserved(), 0);
        _placeRiskCoin(maximum, 1, false);
        SSOTTypes.SSOT memory status = bank.getSSOT();
        assertEq(status.G, capital + maximum, "only accepted principal increases risk capital");
        assertEq(status.R, maximum * 2, "reserve is gross payout, including stake");
        assertEq(status.K, maximum, "Vault locks only net capital at risk");
        assertEq(status.G - status.R, status.riskReserve, "exact integer solvency boundary");
        assertTrue(status.accountingValid);
    }

    function test_sixtyPercentRetainedRiskAllowsExactTwentyFivePercentCoinPrincipal() external {
        _prepareRiskCoin();
        vm.prank(gov);
        bank.setRiskReserveBps(6000);
        uint256 capital = LiquidityVault(bank.vault()).getReserve();
        uint256 maximum = (4000 * capital + 9999) / 16000;
        assertEq(maximum, 125_000e6);
        _placeRiskCoin(maximum + 1, 1, true);
        assertEq(bank.openHolds(), 0);
        _placeRiskCoin(maximum, 1, false);
        SSOTTypes.SSOT memory status = bank.getSSOT();
        assertEq(status.G, 625_000e6);
        assertEq(status.R, 250_000e6);
        assertEq(status.K, 125_000e6);
        assertEq(status.riskReserve, 375_000e6);
        assertEq(status.G - status.R, status.riskReserve);
        assertTrue(status.accountingValid);
    }

    function test_pendingPrincipalAndGrossReserveDetermineTwentyFiveRoundMaximum() external {
        _prepareRiskCoin();
        _placeRiskCoin(100_000e6, 1, false);
        SSOTTypes.SSOT memory beforeBet = bank.getSSOT();
        assertEq(beforeBet.P, 100_000e6);
        assertEq(beforeBet.R, 200_000e6);
        assertEq(beforeBet.K, 100_000e6);
        uint256 maximum = _coinRiskMaximum(beforeBet.G, beforeBet.R);
        uint256 perRound = maximum / 25;
        _placeRiskCoin(perRound + 1, 25, true);
        assertEq(bank.pendingStakeTotal(), beforeBet.P);
        assertEq(bank.totalReserved(), beforeBet.R);
        _placeRiskCoin(perRound, 25, false);
        SSOTTypes.SSOT memory afterBet = bank.getSSOT();
        assertEq(afterBet.P, beforeBet.P + 25 * perRound);
        assertEq(afterBet.R, beforeBet.R + 50 * perRound);
        assertEq(afterBet.K, beforeBet.K + 25 * perRound);
        assertEq(bank.openHolds(), 2, "twenty-five rolls are one reserved position");
        assertGe(afterBet.G - afterBet.R, afterBet.riskReserve);
        assertTrue(afterBet.accountingValid);
    }

    function test_protocolReferralPlayerDebtsAndDonationsDoNotExpandRiskMaximum() external {
        _prepareRiskCoin();
        vm.startPrank(gov);
        gameHub.setActiveReferralConfig(gameHub.createReferralConfig(1000, 2000, 500, 3000));
        vm.stopPrank();
        vm.prank(player);
        gameHub.bindReferrer(address(0xCAFE));
        uint256 id = _placeOutcomeBet(10e6, 20e6, 0);
        // Simulate a token refusing just this winner transfer without changing either balance.
        vm.mockCall(
            address(asset), abi.encodeWithSignature("transfer(address,uint256)", player, 19_600_000), abi.encode(false)
        );
        _fulfillReceiptBet(id);
        vm.clearMockedCalls();
        SSOTTypes.SSOT memory beforeGift = bank.getSSOT();
        assertGt(beforeGift.PF, 0);
        assertGt(beforeGift.XP, 0);
        assertEq(beforeGift.PP, 19_600_000);
        assertEq(beforeGift.G, beforeGift.L, "settled liabilities are excluded from capital");
        assertEq(beforeGift.bankCash, beforeGift.PF + beforeGift.XP + beforeGift.PP);
        uint256 maximum = _coinRiskMaximum(beforeGift.G, beforeGift.R);
        vm.startPrank(gov);
        asset.transfer(address(bank), 17e6);
        asset.transfer(bank.vault(), 23e6);
        vm.stopPrank();
        SSOTTypes.SSOT memory afterGift = bank.getSSOT();
        assertEq(afterGift.bankSurplus, 17e6);
        assertEq(afterGift.vaultSurplus, 23e6);
        assertEq(afterGift.G, beforeGift.G, "unallocated cash is not insurance capital");
        _placeRiskCoin(maximum + 1, 1, true);
        _placeRiskCoin(maximum, 1, false);
        assertTrue(bank.getSSOT().accountingValid);
    }

    function _prepareRiskCoin() private {
        vm.startPrank(gov);
        bank.setRiskReserveBps(1000);
        gameHub.registerGame(keccak256("RISK_COIN"), address(new CoinTossModule()), 25, 2_447_746);
        vm.stopPrank();
        asset.mint(player, 5_000_000e6);
    }

    // For integer 2x gross odds and b=1000: s + floor((G+s)/10) <= G-R.
    // Strict integer rearrangement gives floor((9000G-10000R+9999)/11000), not a float approximation.
    function _coinRiskMaximum(uint256 gross, uint256 reserved) private pure returns (uint256) {
        return (9000 * gross - 10000 * reserved + 9999) / 11000;
    }

    function _placeRiskCoin(uint256 amountPerRoll, uint32 count, bool expectBudgetRevert) private returns (uint256 id) {
        bytes32 game = keccak256("RISK_COIN");
        (uint256 fee,) = gameHub.quoteVRFFee(game, count, tx.gasprice);
        vm.prank(player);
        if (expectBudgetRevert) vm.expectRevert(IBank.SolvencyViolation.selector);
        id = gameHub.placeBet{value: fee}(
            game, 1, abi.encode(true), SSOTTypes.StakeSpec(amountPerRoll, count, 0, 0), address(0), 500
        );
    }

    function test_callbackRejectsUnknownRequestBeforeTouchingAnyBet() external {
        _placeReceiptBet(GAME_STAKE, "", 10e6);
        uint256[] memory words = new uint256[](1);
        vm.prank(address(vrf));
        vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
        gameHub.onRandomWords(type(uint256).max, words);
        assertEq(bank.openHolds(), 1);
        assertEq(bank.totalBetsSettled(), 0);
    }

    function test_callbackAuthenticatesEveryCanonicalBindingAndSeedField() external {
        uint256 id = _placeReceiptBet(GAME_STAKE, "", 10e6);
        uint256 other = _placeReceiptBet(GAME_STAKE, "", 10e6);
        uint256 requestId = gameHub.getBet(id).requestId;
        uint256[] memory words = new uint256[](1);
        words[0] = 123;
        // Isolate the Hub's receipt-validation boundary; real wrapper/consumer lifecycle is tested separately.
        for (uint8 mutation; mutation < 11; ++mutation) {
            IVRFHub.RequestInfo memory request = vrf.getRequest(requestId);
            request.state = IVRFHub.RequestState.Received;
            request.seed = 123;
            uint256 deliveredId = requestId;
            if (mutation == 0) request.betId = 0;
            else if (mutation == 1) request.betId = type(uint256).max;
            else if (mutation == 2) request.betId = other;
            else if (mutation == 3) request.hub = address(0xBAD);
            else if (mutation == 4) request.bank = address(secondBank);
            else if (mutation == 5) request.payer = gov;
            else if (mutation == 6) request.state = IVRFHub.RequestState.Awaiting;
            else if (mutation == 7) request.seed = 124;
            else if (mutation == 8) deliveredId = type(uint256).max;
            else if (mutation == 9) deliveredId = requestId + 1;
            else deliveredId = 0;
            vm.mockCall(address(vrf), abi.encodeCall(IVRFHub.getRequest, (deliveredId)), abi.encode(request));
            vm.prank(address(vrf));
            vm.expectRevert(IGameHub.InvalidRandomReceipt.selector);
            gameHub.onRandomWords(deliveredId, words);
            vm.clearMockedCalls();
            assertEq(uint256(gameHub.getBet(id).state), uint256(SSOTTypes.BetState.PendingVRF));
            assertEq(gameHub.getBet(id).randomHash, bytes32(0));
            assertEq(bank.openHolds(), 2);
            assertEq(bank.totalBetsSettled(), 0);
        }
        _fulfillReceiptBet(id);
        assertEq(bank.totalBetsSettled(), 1, "real receipt still settles exactly its own position");
        assertEq(uint256(gameHub.getBet(other).state), uint256(SSOTTypes.BetState.PendingVRF));
    }

    function test_placeFinalizeCasinoBetThroughSettlementRouter() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = gameHub.quoteVRFFee(GAME_STAKE, spec.betCount, tx.gasprice);

        vm.prank(player);
        uint256 positionId = gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        assertEq(pos.ownerHub, address(gameHub));
        assertEq(pos.poolId, 1);
        assertEq(pos.asset, address(asset));
        assertEq(pos.bank, address(bank));
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Held));
        assertEq(bank.totalReserved(), 10e6);

        SSOTTypes.Bet memory bet = gameHub.getBet(positionId);
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.PendingVRF));
        assertEq(bet.asset, address(asset));
        assertEq(bet.bank, address(bank));
        SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(positionId);
        assertEq(uint256(terminal.state), uint256(SSOTTypes.BetState.None));

        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        wrapper.fulfillTo(address(vrf), bet.requestId, words);

        pos = router.getPosition(positionId);
        bet = gameHub.getBet(positionId);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.Settled));
        terminal = gameHub.getBetTerminal(positionId);
        assertEq(uint256(terminal.state), uint256(SSOTTypes.BetState.Settled));
        assertEq(terminal.payoutGross, 10e6);
        assertEq(terminal.payoutNet, 9_800_000);
        assertEq(terminal.feeOnPayout, 200_000);
        // No referrer: the operator half of the 0.2 USDC turnover edge accrues as protocol fees; LPs keep the rest.
        assertEq(terminal.protocolFeeAccrual, 100_000);
        assertEq(terminal.refundAmount, 0);
        assertEq(bank.totalReserved(), 0);
        assertEq(bank.protocolFeesPayable(), 100_000);
        assertEq(asset.balanceOf(player), 99_800_000);
        assertEq(asset.balanceOf(address(gameHub)), 0);
        assertEq(asset.allowance(address(gameHub), address(bank)), 0);
        assertEq(asset.allowance(player, address(bank)), 0);
    }

    function test_stakeFundingPreservesDonationsAndRollsBackWhenVrfBudgetFails() external {
        asset.mint(address(gameHub), 123);
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec(10e6, 1, 0, 0);
        (uint256 fee,) = gameHub.quoteVRFFee(GAME_STAKE, 1, tx.gasprice);
        vm.prank(player);
        asset.approve(address(gameHub), 10e6);
        uint256 bankBefore = asset.balanceOf(address(bank));
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.InsufficientVRFFee.selector, fee - 1, fee));
        gameHub.placeBet{value: fee - 1}(GAME_STAKE, 1, "", spec, address(0), 10_000);
        assertEq(asset.balanceOf(player), 100e6);
        assertEq(asset.balanceOf(address(bank)), bankBefore);
        assertEq(asset.balanceOf(address(gameHub)), 123);
        assertEq(asset.allowance(player, address(gameHub)), 10e6);
        assertEq(asset.allowance(address(gameHub), address(bank)), 0);
        assertEq(router.nextPositionId(), 1);
        assertEq(bank.openHolds(), 0);
        vm.prank(player);
        gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);
        assertEq(asset.balanceOf(address(gameHub)), 123);
        assertEq(asset.allowance(address(gameHub), address(bank)), 0);
        assertEq(asset.allowance(player, address(gameHub)), 0);
    }

    function test_refundDeadlineIsFixedAtAcceptanceAcrossGovernanceChanges() external {
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec(1e6, 1, 0, 0);
        (uint256 fee,) = gameHub.quoteVRFFee(GAME_STAKE, 1, tx.gasprice);
        vm.prank(player);
        uint256 first = gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);
        uint256 deadline = gameHub.getBet(first).refundDeadline;
        assertEq(deadline, block.timestamp + 1 hours);
        vm.prank(gov);
        gameHub.setRefundTimeout(60);
        vm.prank(player);
        uint256 second = gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);
        assertEq(gameHub.getBet(second).refundDeadline, block.timestamp + 60);
        vm.prank(gov);
        gameHub.setRefundTimeout(1 days);
        vm.warp(gameHub.getBet(second).refundDeadline);
        gameHub.refund(second);
        vm.warp(deadline - 1);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.RefundNotReady.selector, first, deadline - 1, deadline));
        gameHub.refund(first);
        vm.warp(deadline);
        gameHub.refund(first);
        vm.prank(gov);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.InvalidRefundTimeout.selector, uint256(0)));
        gameHub.setRefundTimeout(0);
    }

    function test_minimumPerRoundAcceptsOneAndTwentyFiveRoundsBelowOldPositionMinimum() external {
        vm.prank(gov);
        bank.setMinBetAmount(10_000); // 0.01 USDC per round.
        assertEq(bank.minBetAmount(), 10_000);
        assertEq(gameHub.MAX_BET_COUNT(), 25);
        uint32[2] memory counts = [uint32(1), 25];
        for (uint256 i; i < counts.length; ++i) {
            SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec(10_000, counts[i], 0, 0);
            (uint256 fee,) = gameHub.quoteVRFFee(GAME_STAKE, counts[i], tx.gasprice);
            vm.prank(player);
            uint256 id = gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);
            assertEq(gameHub.getBet(id).stake, 10_000 * uint256(counts[i]));
            assertEq(gameHub.getBet(id).amountPerRoll, 10_000);
        }
        assertEq(bank.openHolds(), 2);
        assertEq(bank.pendingStakeTotal(), 260_000);
    }

    function test_totalAboveMinimumCannotHideSubminimumRoundBeforeFundingOrVrf() external {
        vm.prank(gov);
        bank.setMinBetAmount(10_000);
        vm.prank(player);
        asset.approve(address(gameHub), 0);
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec(9_999, 25, 0, 0);
        assertGt(spec.amountPerRoll * spec.betCount, bank.minBetAmount());
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(IBank.BetAmountBelowMinimum.selector, uint256(9_999), uint256(10_000)));
        gameHub.placeBet(GAME_STAKE, 1, "", spec, address(0), 10_000);
        assertEq(asset.balanceOf(player), 100e6);
        assertEq(bank.openHolds(), 0);
        assertEq(router.nextPositionId(), 1);
        assertEq(wrapper.lastRequestId(), 0);
    }

    function testFuzz_subminimumRoundsCannotAggregatePastTheMinimum(uint32 count, uint256 amount) external {
        count = uint32(bound(count, 1, 25));
        amount = bound(amount, 1, 9_999);
        vm.prank(gov);
        bank.setMinBetAmount(10_000);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(IBank.BetAmountBelowMinimum.selector, amount, uint256(10_000)));
        gameHub.placeBet(GAME_STAKE, 1, "", SSOTTypes.StakeSpec(amount, count, 0, 0), address(0), 10_000);
        assertEq(wrapper.lastRequestId(), 0);
    }

    function test_twentySixRoundsRejectedByAdmissionQuoteAndPlacement() external {
        address module = gameHub.gameModule(GAME_STAKE);
        vm.prank(gov);
        vm.expectRevert(Errors.InvalidConfig.selector);
        gameHub.registerGame(keccak256("TOO_MANY_ROUNDS"), module, 26, 2_447_746);
        vm.expectRevert(Errors.InvalidConfig.selector);
        gameHub.quoteVRFFee(GAME_STAKE, 26, tx.gasprice);
        vm.prank(player);
        vm.expectRevert(Errors.InvalidConfig.selector);
        gameHub.placeBet(GAME_STAKE, 1, "", SSOTTypes.StakeSpec(10_000, 26, 0, 0), address(0), 10_000);
        assertEq(wrapper.lastRequestId(), 0);
        assertEq(router.nextPositionId(), 1);
    }

    function test_perGameLowerRoundLimitAppliesToQuoteAndPlacement() external {
        bytes32 game = keccak256("TEN_ROUNDS");
        address module = gameHub.gameModule(GAME_STAKE);
        vm.prank(gov);
        gameHub.registerGame(game, module, 10, 2_447_746);
        gameHub.quoteVRFFee(game, 10, tx.gasprice);
        vm.expectRevert(Errors.InvalidConfig.selector);
        gameHub.quoteVRFFee(game, 11, tx.gasprice);
        vm.prank(player);
        vm.expectRevert(Errors.InvalidConfig.selector);
        gameHub.placeBet(game, 1, "", SSOTTypes.StakeSpec(10_000, 11, 0, 0), address(0), 10_000);
    }

    function test_minimumChangeAppliesToNewRoundsWithoutBlockingAcceptedRefund() external {
        vm.prank(gov);
        bank.setMinBetAmount(10_000);
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec(10_000, 25, 0, 0);
        (uint256 fee,) = gameHub.quoteVRFFee(GAME_STAKE, 25, tx.gasprice);
        vm.prank(player);
        uint256 id = gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);
        vm.prank(gov);
        bank.setMinBetAmount(20_000);
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(IBank.BetAmountBelowMinimum.selector, uint256(10_000), uint256(20_000)));
        gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);
        vm.warp(gameHub.getBet(id).refundDeadline);
        gameHub.refund(id);
        assertEq(asset.balanceOf(player), 100e6);
    }

    function test_refundCasinoBetThroughSettlementRouterAfterTimeout() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = gameHub.quoteVRFFee(GAME_STAKE, spec.betCount, tx.gasprice);

        vm.prank(player);
        uint256 positionId = gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);

        vm.warp(block.timestamp + gameHub.refundTimeoutSeconds());
        gameHub.refund(positionId);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        SSOTTypes.Bet memory bet = gameHub.getBet(positionId);
        SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(positionId);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Refunded));
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.Refunded));
        assertEq(uint256(terminal.state), uint256(SSOTTypes.BetState.Refunded));
        assertEq(terminal.payoutGross, 0);
        assertEq(terminal.payoutNet, 0);
        assertEq(terminal.feeOnPayout, 0);
        assertEq(terminal.protocolFeeAccrual, 0);
        assertEq(terminal.refundAmount, 10e6);
        assertEq(bank.totalReserved(), 0);
        assertEq(asset.balanceOf(player), 100e6);
    }

    function test_terminalUnknownRevertsAndPendingReturnsAllZeroNone() external {
        vm.expectRevert(abi.encodeWithSelector(IGameHub.BetNotFound.selector, uint256(999)));
        gameHub.getBetTerminal(999);
        uint256 id = _placeReceiptBet(GAME_STAKE, "", 10e6);
        _assertEmptyReceipt(id);
    }

    function test_terminalZeroPayoutRetainsProtocolFeeAndSettledState() external {
        uint256 id = _placeOutcomeBet(10e6, 0, 0);
        _fulfillReceiptBet(id);
        _assertReceipt(id, SSOTTypes.BetState.Settled, 0, 0, 100_000);
        assertEq(asset.balanceOf(player), 90e6);
        assertEq(bank.protocolFeesPayable(), 100_000);
        assertTrue(bank.getSSOT().accountingValid);
    }

    function test_terminalPartialRefundPreservesPayoutAndFeeIdentity() external {
        uint256 id = _placeOutcomeBet(20e6, 25e6, 5e6);
        vm.recordLogs();
        _fulfillReceiptBet(id);
        _assertReceipt(id, SSOTTypes.BetState.Settled, 25e6, 5e6, 150_000);
        assertEq(asset.balanceOf(player), 109_500_000);
        assertEq(bank.totalRefunded(), 5e6);
        assertEq(bank.totalFeeOnPayout(), 500_000);
        assertEq(bank.totalBetsSettled(), 1);
        assertEq(bank.totalBetsRefunded(), 0);

        Vm.Log[] memory entries = vm.getRecordedLogs();
        bytes32 signature = keccak256("BetFinalized(uint256,uint256,uint256,uint256,uint256)");
        bool found;
        for (uint256 i; i < entries.length; ++i) {
            if (entries[i].emitter != address(gameHub) || entries[i].topics[0] != signature) continue;
            assertEq(uint256(entries[i].topics[1]), id);
            assertEq(
                entries[i].data, abi.encode(uint256(25e6), uint256(24_500_000), uint256(500_000), uint256(150_000))
            );
            found = true;
        }
        assertTrue(found, "terminal event must match the reconstructed receipt");
    }

    function test_terminalDerivedFeePreservesIntegerRounding() external {
        uint256 id = _placeOutcomeBet(10_000, 19_999, 0);
        _fulfillReceiptBet(id);
        _assertReceipt(id, SSOTTypes.BetState.Settled, 19_999, 0, 100);
        assertEq(gameHub.getBetTerminal(id).feeOnPayout, 399);
        assertEq(gameHub.getBetTerminal(id).payoutNet, 19_600);
    }

    function test_failedTerminalWriteRollsBackToEmptyRandomReadyReceipt() external {
        uint256 id = _placeReceiptBet(GAME_STAKE, "", 10e6);
        uint256 playerBefore = asset.balanceOf(player);
        uint256 rootBefore = LiquidityVault(bank.vault()).getReserve();
        vm.mockCallRevert(
            address(router), abi.encodeWithSelector(router.settlePosition.selector), bytes("terminal blocked")
        );
        _fulfillReceiptBet(id);
        assertEq(uint256(gameHub.getBet(id).state), uint256(SSOTTypes.BetState.RandomReady));
        _assertEmptyReceipt(id);
        assertEq(bank.totalFeeOnPayout(), 0, "failed settlement does not accrue payout fee statistics");
        assertEq(asset.balanceOf(player), playerBefore);
        assertEq(LiquidityVault(bank.vault()).getReserve(), rootBefore);
        assertEq(bank.openHolds(), 1);
        assertEq(vrf.unbookedResultCount(address(bank)), 1);

        vm.clearMockedCalls();
        gameHub.finalize(id);
        _assertReceipt(id, SSOTTypes.BetState.Settled, 10e6, 0, 100_000);
        assertEq(asset.balanceOf(player), playerBefore + 9_800_000);
        assertEq(bank.totalFeeOnPayout(), 200_000, "retry accounts for the fee exactly once");
        assertEq(bank.openHolds(), 0);
        assertEq(vrf.unbookedResultCount(address(bank)), 0);
    }

    function test_terminalAmountsNear108BitCapitalLimitDoNotTruncate() external {
        uint256 stake = _prepareCapitalLimitStake();
        uint256 id = _placeReceiptBet(GAME_STAKE, "", stake);
        assertEq(bank.getSSOT().G, LiquidityVault(bank.vault()).MAX_TREE_CAPITAL());
        assertGt(stake, type(uint96).max);
        _fulfillReceiptBet(id);
        _assertReceipt(id, SSOTTypes.BetState.Settled, stake, 0, (stake * 200 / 10_000) / 2);
        assertTrue(bank.getSSOT().accountingValid);
        assertEq(bank.openHolds(), 0);
    }

    function test_terminalRefundNear108BitCapitalLimitDoesNotTruncate() external {
        uint256 stake = _prepareCapitalLimitStake();
        uint256 id = _placeReceiptBet(GAME_STAKE, "", stake);
        assertEq(bank.getSSOT().G, LiquidityVault(bank.vault()).MAX_TREE_CAPITAL());
        uint256 playerBefore = asset.balanceOf(player);
        vm.warp(gameHub.getBet(id).refundDeadline);
        gameHub.refund(id);
        _assertReceipt(id, SSOTTypes.BetState.Refunded, 0, stake, 0);
        assertEq(asset.balanceOf(player), playerBefore + stake);
        assertTrue(bank.getSSOT().accountingValid);
        assertEq(bank.openHolds(), 0);
    }

    function _placeOutcomeBet(uint256 stake, uint256 gross, uint256 refundAmount) private returns (uint256) {
        bytes32 game = keccak256("TERMINAL_OUTCOME");
        RouterTerminalOutcomeModule module = new RouterTerminalOutcomeModule();
        vm.prank(gov);
        gameHub.registerGame(game, address(module), 25, 2_447_746);
        return _placeReceiptBet(game, abi.encode(gross, refundAmount), stake);
    }

    function _placeReceiptBet(bytes32 game, bytes memory params, uint256 stake) private returns (uint256) {
        (uint256 fee,) = gameHub.quoteVRFFee(game, 1, tx.gasprice);
        vm.prank(player);
        return gameHub.placeBet{value: fee}(game, 1, params, SSOTTypes.StakeSpec(stake, 1, 0, 0), address(0), 10_000);
    }

    function _fulfillReceiptBet(uint256 id) private {
        uint256[] memory words = new uint256[](1);
        words[0] = 1;
        assertTrue(wrapper.fulfillTo(address(vrf), gameHub.getBet(id).requestId, words));
    }

    function _assertEmptyReceipt(uint256 id) private view {
        assertEq(
            abi.encode(gameHub.getBetTerminal(id)),
            abi.encode(SSOTTypes.BetTerminal(SSOTTypes.BetState.None, 0, 0, 0, 0, 0))
        );
    }

    function _assertReceipt(
        uint256 id,
        SSOTTypes.BetState state,
        uint256 gross,
        uint256 refundAmount,
        uint256 protocolFee
    ) private view {
        uint256 fee = gross * 200 / 10_000;
        assertEq(
            abi.encode(gameHub.getBetTerminal(id)),
            abi.encode(SSOTTypes.BetTerminal(state, gross, gross - fee, fee, protocolFee, refundAmount))
        );
    }

    function _prepareCapitalLimitStake() private returns (uint256 stake) {
        LiquidityVault vault = LiquidityVault(bank.vault());
        vm.warp(block.timestamp + 1 days);
        vm.startPrank(gov);
        vault.withdrawDeposit(vault.getLastDepositId(), 1e12);
        vault.addDeposit(1);
        vm.stopPrank();
        stake = vault.MAX_TREE_CAPITAL() - 1;
        asset.mint(player, stake);
    }

    function test_inactivePoolBlocksGameHubRiskIn() external {
        vm.prank(gov);
        poolRegistry.setPoolActive(1, false);

        assertTrue(gameHub.riskInPaused(1));

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = gameHub.quoteVRFFee(GAME_STAKE, spec.betCount, tx.gasprice);

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(IGameHub.RiskInPaused.selector, uint64(1)));
        gameHub.placeBet{value: fee}(GAME_STAKE, 1, "", spec, address(0), 10_000);
    }
}
