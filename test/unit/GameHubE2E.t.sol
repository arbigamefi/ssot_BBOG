// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";
import {BaccaratParams} from "../../src/modules/baccarat/BaccaratParams.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {ISettlementRouter} from "../../src/core/interfaces/ISettlementRouter.sol";
import {IReferralEngine} from "../../src/engines/referral/IReferralEngine.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";
import {KenoParams} from "../../src/modules/keno/KenoParams.sol";
import {PlinkoModule} from "../../src/modules/plinko/PlinkoModule.sol";
import {PlinkoParams} from "../../src/modules/plinko/PlinkoParams.sol";
import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {RouletteParams} from "../../src/modules/roulette/RouletteParams.sol";
import {SicBoModule} from "../../src/modules/sicbo/SicBoModule.sol";
import {SicBoParams} from "../../src/modules/sicbo/SicBoParams.sol";
import {SlotsModule} from "../../src/modules/slots/SlotsModule.sol";
import {SlotsParams} from "../../src/modules/slots/SlotsParams.sol";

contract GameHubE2E is Test {
    uint64 internal constant POOL_A = 1;
    uint64 internal constant POOL_B = 2;

    bytes32 internal constant GAME_DICE = keccak256("DICE");
    bytes32 internal constant GAME_COIN = keccak256("COIN_TOSS");
    bytes32 internal constant GAME_ROULETTE = keccak256("ROULETTE");
    bytes32 internal constant GAME_KENO = keccak256("KENO");
    bytes32 internal constant GAME_SLOTS = keccak256("SLOTS");
    bytes32 internal constant GAME_BACCARAT = keccak256("BACCARAT");
    bytes32 internal constant GAME_PLINKO = keccak256("PLINKO");
    bytes32 internal constant GAME_SIC_BO = keccak256("SIC_BO");
    bytes internal constant RNG_DOMAIN = "SSOT_RNG_V1";

    address internal gov = address(0xA11CE);
    address internal alice = address(0xBEEF);
    address internal bob = address(0xB0B);

    MockERC20 internal assetA;
    MockERC20 internal assetB;
    Bank internal bankA;
    Bank internal bankB;
    PoolRegistry internal poolRegistry;
    SettlementRouter internal router;
    VRFHub internal vrf;
    GameHub internal gameHub;

    function setUp() external {
        assetA = new MockERC20("AssetA", "ASTA", 18);
        assetB = new MockERC20("AssetB", "ASTB", 18);

        bankA = new Bank(address(assetA), gov, 1000, "LP Share ASTA", "LPA", 18, 1);
        bankB = new Bank(address(assetB), gov, 1000, "LP Share ASTB", "LPB", 18, 1);
        poolRegistry = new PoolRegistry(gov);
        router = new SettlementRouter(address(poolRegistry));
        vrf = new VRFHub(address(this), gov);

        ReferralRegistry refRegistry = new ReferralRegistry(gov);
        DefaultReferralEngine refEngine = new DefaultReferralEngine();

        // ADR-0032 initial schedule: L0 10%, L1 20%, L2 5% of the base edge, 30% holdback.
        gameHub = new GameHub(
            address(router),
            address(vrf),
            address(refRegistry),
            address(refEngine),
            gov,
            3600,
            200,
            1000,
            2000,
            500,
            3000
        );

        vm.startPrank(gov);
        poolRegistry.registerPool(POOL_A, address(assetA), address(bankA), SSOTTypes.PoolDomain.Casino);
        poolRegistry.registerPool(POOL_B, address(assetB), address(bankB), SSOTTypes.PoolDomain.Casino);
        poolRegistry.setHubRegistered(address(gameHub), true);
        poolRegistry.setHubAllowedForPool(POOL_A, address(gameHub), true);
        poolRegistry.setHubAllowedForPool(POOL_B, address(gameHub), true);

        bankA.setSettlementRouterOnce(address(router));
        bankB.setSettlementRouterOnce(address(router));
        bankA.setMinPlayerTurnoverForUnlock(20 ether);
        bankA.setHoldbackVestingSeconds(10);
        bankB.setMinPlayerTurnoverForUnlock(20 ether);
        bankB.setHoldbackVestingSeconds(10);

        refRegistry.setBinderOnce(address(gameHub));
        gameHub.registerGame(GAME_DICE, address(new DiceModule()));
        gameHub.registerGame(GAME_COIN, address(new CoinTossModule()));
        gameHub.registerGame(GAME_ROULETTE, address(new RouletteModule()));
        gameHub.registerGame(GAME_KENO, address(new KenoModule()));
        gameHub.registerGame(GAME_SLOTS, address(new SlotsModule()));
        gameHub.registerGame(GAME_BACCARAT, address(new BaccaratModule()));
        gameHub.registerGame(GAME_PLINKO, address(new PlinkoModule()));
        gameHub.registerGame(GAME_SIC_BO, address(new SicBoModule()));
        vm.stopPrank();

        assetA.mint(alice, 1_000 ether);
        assetA.mint(bob, 1_000 ether);
        assetA.mint(gov, 10_000 ether);
        assetB.mint(alice, 1_000 ether);
        assetB.mint(bob, 1_000 ether);
        assetB.mint(gov, 10_000 ether);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(gov, 100 ether);

        vm.startPrank(gov);
        assetA.approve(address(bankA), type(uint256).max);
        bankA.deposit(5_000 ether, gov);
        assetB.approve(address(bankB), type(uint256).max);
        bankB.deposit(5_000 ether, gov);
        vm.stopPrank();

        vm.startPrank(alice);
        assetA.approve(address(gameHub), type(uint256).max);
        assetB.approve(address(gameHub), type(uint256).max);
        vm.stopPrank();
    }

    function test_guardianPauseDoesNotBlockWinningFinalize() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, bob);

        vm.prank(gov);
        bankA.setGuardian(bob);
        vm.prank(bob);
        bankA.setRiskInPaused(true);

        // Both the VRF callback and the player's payout must stay live while paused.
        _fulfill(positionId, _findSeedDiceWin(positionId, 50));
        uint256 balanceBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);

        assertEq(assetA.balanceOf(alice) - balanceBefore, 19.6 ether);
        assertEq(bankA.totalReserved(), 0);
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Settled));
        assertTrue(bankA.riskInPaused());
        assertEq(bankA.maxWithdraw(gov), 0);
        vm.prank(gov);
        vm.expectRevert(IBank.RiskInPaused.selector);
        bankA.withdraw(1 ether, gov, gov);
    }

    function test_guardianPauseDoesNotBlockTimedOutRefund() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, bob);

        vm.prank(gov);
        bankA.setGuardian(bob);
        vm.prank(bob);
        bankA.setRiskInPaused(true);

        SSOTTypes.Bet memory bet = gameHub.getBet(positionId);
        uint256 balanceBefore = assetA.balanceOf(alice);
        vm.warp(uint256(bet.placedAt) + gameHub.refundTimeoutSeconds());
        gameHub.refund(positionId);

        assertEq(assetA.balanceOf(alice) - balanceBefore, bet.stake);
        assertEq(bankA.totalReserved(), 0);
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Refunded));
        assertEq(vrf.getRequest(bet.requestId).hub, address(0));
        assertTrue(bankA.riskInPaused());
    }

    function test_losingBetAccruesTurnoverLiabilitiesWithAnotherBetStillHeld() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 settledId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, bob);
        uint256 heldId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, bob);
        _fulfill(settledId, _findSeedDiceLose(settledId, 50));
        gameHub.finalize(settledId);

        SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(settledId);
        SSOTTypes.SSOT memory s = bankA.getSSOT();
        assertEq(terminal.feeOnPayout, 0);
        // E = 2% of 10 = 0.2; the operator half accrues as PF + XP even though the bet paid no fee.
        assertEq(s.PF + s.XP, 0.1 ether, "liabilities follow used turnover, not payout fees");
        assertEq(s.R, gameHub.getBet(heldId).reserved);
        assertGt(s.R, 0);
        assertGe(s.NAV, s.R);
    }

    function test_diceWinSettlesThroughRouterPoolA() external {
        uint8 cap = 50;
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, cap), spec, address(0));

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        assertEq(pos.ownerHub, address(gameHub));
        assertEq(pos.poolId, POOL_A);
        assertEq(pos.bank, address(bankA));

        uint256 seed = _findSeedDiceWin(positionId, cap);
        _fulfill(positionId, seed);
        uint256[] memory words = gameHub.getBetRandomWords(positionId);
        assertEq(words.length, 1);
        assertEq(words[0], seed);

        uint256 balBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetA.balanceOf(alice);

        assertEq(balAfter - balBefore, (196 ether) / 10);
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Settled));
    }

    function test_diceUnderWinSettlesThroughRouterPoolA() external {
        uint8 target = 50;
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId = _place(alice, GAME_DICE, POOL_A, abi.encode(false, target), spec, address(0));
        assertEq(gameHub.getBet(positionId).reserved, 20 ether);

        uint256 seed = _findSeedDiceUnderWin(positionId, target);
        _fulfill(positionId, seed);

        uint256 balBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetA.balanceOf(alice);

        assertEq(balAfter - balBefore, (196 ether) / 10);
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Settled));
    }

    function test_finalizeSkipsVrfDetachWhenRequestAlreadyClearedByFulfill() external {
        uint8 cap = 50;
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, cap), spec, address(0));
        uint256 requestId = gameHub.getBet(positionId).requestId;

        uint256 seed = _findSeedDiceWin(positionId, cap);
        _fulfill(positionId, seed);

        assertEq(vrf.getRequest(requestId).hub, address(0), "fulfilled callback should clear VRF request storage");

        vm.expectCall(address(vrf), abi.encodeWithSelector(IVRFHub.detach.selector, requestId), 0);
        gameHub.finalize(positionId);
    }

    function test_coinMultirollStopGainRefundsUnusedStakeThroughRouterPoolB() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 5, stopGain: 10 ether, stopLoss: 0});

        uint256 positionId = _place(alice, GAME_COIN, POOL_B, abi.encode(true), spec, address(0));
        SSOTTypes.Bet memory bet = gameHub.getBet(positionId);
        assertEq(bet.stake, 50 ether);
        assertEq(bet.reserved, 100 ether);

        uint256 seed = _findSeedCoinWin(positionId, true);
        _fulfill(positionId, seed);

        uint256 balBefore = assetB.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetB.balanceOf(alice);

        assertEq(balAfter - balBefore, 40 ether + (196 ether) / 10);
        assertEq(bankB.playerTurnover(alice), 10 ether);
    }

    function test_rouletteRedWinKeepsModuleMathThroughRouter() external {
        bytes memory params = RouletteParams.encode(RouletteParams.Kind.Red, 0);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId = _place(alice, GAME_ROULETTE, POOL_A, params, spec, address(0));
        uint256 expectedGross = Math.mulDiv(10 ether, 37, 18);
        assertEq(gameHub.getBet(positionId).reserved, expectedGross);

        _fulfill(positionId, _findSeedRouletteHit(positionId, 7));

        uint256 balBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetA.balanceOf(alice);

        uint256 fee = Math.mulDiv(expectedGross, gameHub.defaultHouseEdgeBps(), 10_000);
        assertEq(balAfter - balBefore, expectedGross - fee);
    }

    function test_kenoSinglePickHitSettlesThroughRouter() external {
        uint40 numbers = uint40(1) << 5;
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId = _place(alice, GAME_KENO, POOL_A, KenoParams.encode(numbers), spec, address(0));
        assertEq(gameHub.getBet(positionId).reserved, 15 ether);

        _fulfill(positionId, _findSeedKenoHit(positionId, numbers, true));

        uint256 balBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetA.balanceOf(alice);

        uint256 expectedGross = 15 ether;
        uint256 fee = Math.mulDiv(expectedGross, gameHub.defaultHouseEdgeBps(), 10_000);
        assertEq(balAfter - balBefore, expectedGross - fee);
    }

    function test_slotsJackpotSettlesThroughRouter() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId =
            _place(alice, GAME_SLOTS, POOL_A, SlotsParams.encode(SlotsParams.PROFILE_CLASSIC), spec, address(0));
        assertEq(gameHub.getBet(positionId).reserved, 640 ether);

        _fulfill(positionId, _findSeedSlotsJackpot(positionId));

        uint256 balBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetA.balanceOf(alice);

        uint256 expectedGross = 640 ether;
        uint256 fee = Math.mulDiv(expectedGross, gameHub.defaultHouseEdgeBps(), 10_000);
        assertEq(balAfter - balBefore, expectedGross - fee);
    }

    function test_baccaratTieSettlesThroughRouter() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId =
            _place(alice, GAME_BACCARAT, POOL_A, BaccaratParams.encode(BaccaratParams.SIDE_TIE), spec, address(0));
        uint256 expectedGross = Math.mulDiv(10 ether, 104_793, 10_000);
        assertEq(gameHub.getBet(positionId).reserved, expectedGross);

        _fulfill(positionId, _findSeedBaccaratOutcome(positionId, BaccaratParams.SIDE_TIE));

        uint256 balBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetA.balanceOf(alice);

        uint256 fee = Math.mulDiv(expectedGross, gameHub.defaultHouseEdgeBps(), 10_000);
        assertEq(balAfter - balBefore, expectedGross - fee);
    }

    function test_plinkoHighRiskEdgeBucketSettlesThroughRouter() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId =
            _place(alice, GAME_PLINKO, POOL_A, PlinkoParams.encode(PlinkoParams.RISK_HIGH), spec, address(0));
        uint256 expectedGross = Math.mulDiv(10 ether, 246_153, 10_000);
        assertEq(gameHub.getBet(positionId).reserved, expectedGross);

        _fulfill(positionId, _findSeedPlinkoEdge(positionId));

        uint256 balBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetA.balanceOf(alice);

        uint256 fee = Math.mulDiv(expectedGross, gameHub.defaultHouseEdgeBps(), 10_000);
        assertEq(balAfter - balBefore, expectedGross - fee);
    }

    function test_sicBoSpecificTripleSettlesThroughRouter() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 1 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        uint256 positionId = _place(
            alice, GAME_SIC_BO, POOL_A, SicBoParams.encode(SicBoParams.KIND_SPECIFIC_TRIPLE, 6), spec, address(0)
        );
        uint256 expectedGross = 216 ether;
        assertEq(gameHub.getBet(positionId).reserved, expectedGross);

        _fulfill(positionId, _findSeedSicBoSpecificTriple(positionId, 6));

        uint256 balBefore = assetA.balanceOf(alice);
        gameHub.finalize(positionId);
        uint256 balAfter = assetA.balanceOf(alice);

        uint256 fee = Math.mulDiv(expectedGross, gameHub.defaultHouseEdgeBps(), 10_000);
        assertEq(balAfter - balBefore, expectedGross - fee);
    }

    function test_referralSkylineAccruesXpOnlyInSettledPool() external {
        vm.prank(alice);
        gameHub.bindReferrer(bob);

        vm.prank(gov);
        gameHub.queueEdgeChange(IGameHub.EdgeParam.MaxAffiliateDelta, 100);
        (, uint64 activatesAt) = gameHub.pendingEdgeChange(IGameHub.EdgeParam.MaxAffiliateDelta);
        vm.warp(activatesAt);
        gameHub.activateEdgeChange(IGameHub.EdgeParam.MaxAffiliateDelta);
        vm.prank(bob);
        gameHub.setAffiliateHouseEdge(300);

        uint8 cap = 50;
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, cap), spec, bob);

        _fulfill(positionId, _findSeedDiceLose(positionId, cap));
        gameHub.finalize(positionId);

        assertEq(bankA.playerTurnover(alice), 10 ether);
        assertEq(bankB.playerTurnover(alice), 0);
        assertEq(bankA.xpAccruedOf(bob), 0);
        assertGt(bankA.xpLockedOf(bob) + bankA.xpHoldbackOf(bob), 0);
        assertEq(bankB.xpAccruedOf(bob), 0);
        assertEq(bankB.xpLockedOf(bob), 0);
        assertEq(bankB.xpHoldbackOf(bob), 0);
    }

    function test_invalidRouletteParamsRevertBeforeRouterPosition() external {
        bytes memory params = RouletteParams.encode(RouletteParams.Kind.Street, 2);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 1 ether, betCount: 1, stopGain: 0, stopLoss: 0});

        vm.prank(alice);
        vm.expectRevert("street=start");
        gameHub.placeBet(GAME_ROULETTE, POOL_A, params, spec, address(0), 10_000);

        assertEq(router.nextPositionId(), 1);
    }

    function test_asyncExitKeepsBettingLiveAndHistoricalRecoveriesSeparate() external {
        vm.prank(gov);
        bankA.requestRedeem(2_000 ether, gov, gov);
        uint256 cutoff = bankA.redeemBatch(bankA.currentEpoch()).cutoff;
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        vm.warp(cutoff - 1);
        uint256 oldPosition = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, address(0));
        vm.warp(cutoff);
        uint256 boundaryPosition = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, address(0));
        bankA.activateBatch();
        assertEq(bankA.recoveryEpoch(1).remainingHolds, 2);
        uint256 liquid = Math.mulDiv(_exitEquity(5_020 ether, 5_000 ether, 2_000 ether, 1e15), 4_980 ether, 5_020 ether);
        assertEq(bankA.redeemBatch(1).assets, liquid);
        uint256 backing = bankA.recoveryBacking();
        uint256 newPosition = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, address(0));
        assertEq(bankA.recoveryBacking(), backing);
        assertEq(bankA.recoveryEpoch(1).remainingHolds, 2);
        _fulfill(oldPosition, _findSeedDiceWin(oldPosition, 50));
        gameHub.finalize(oldPosition);
        _fulfill(boundaryPosition, _findSeedDiceLose(boundaryPosition, 50));
        gameHub.finalize(boundaryPosition);
        assertEq(bankA.openHolds(), 1);
        IBank.RecoveryEpoch memory epoch = bankA.recoveryEpoch(1);
        assertEq(epoch.remainingHolds, 0);
        uint256 units = Math.mulDiv(20 ether, _exitEquity(5_020 ether, 5_000 ether, 2_000 ether, 1e15), 5_020 ether);
        uint256 recovery = Math.mulDiv(units, 0.3 ether, 20 ether) + Math.mulDiv(units, 19.9 ether, 20 ether);
        assertEq(epoch.initialReserve, 2 * units);
        assertEq(epoch.settledCost, 2 * units - recovery, "only exiting units bear historical cost");
        uint256 expected = liquid + recovery;
        assertEq(_claimGovExit(bankA, 2_000 ether, 1), expected);
        uint256 afterClaim = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, address(0));
        assertEq(router.getPosition(afterClaim).bank, address(bankA));
        assertEq(uint256(router.getPosition(newPosition).state), uint256(SSOTTypes.PositionState.Held));
        uint256 otherPosition = _place(alice, GAME_DICE, POOL_B, abi.encode(true, uint8(50)), spec, address(0));
        assertEq(router.getPosition(otherPosition).bank, address(bankB));
    }

    function test_realGamePathKeepsPayingLaterLpExitsWhileAnOldPositionStaysUnresolved() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 oldPosition = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, address(0));
        vm.prank(gov);
        bankA.requestRedeem(1_000 ether, gov, gov);
        vm.warp(bankA.redeemBatch(1).cutoff);
        bankA.activateBatch();
        vm.prank(gov);
        assertGt(bankA.redeem(1_000 ether, gov, gov), 0);
        for (uint256 epoch = 2; epoch <= 3; ++epoch) {
            uint256 later = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, address(0));
            vm.prank(gov);
            bankA.requestRedeem(1_000 ether, gov, gov);
            vm.warp(Math.max(bankA.redeemBatch(epoch).cutoff, block.timestamp + 365 days));
            bankA.activateBatch();
            vm.prank(gov);
            assertGt(bankA.redeem(1_000 ether, gov, gov), 0, "older recovery cannot gate later cash");
            _fulfill(later, _findSeedDiceLose(later, 50));
            gameHub.finalize(later);
            assertEq(bankA.recoveryEpoch(1).remainingHolds, 1);
            assertEq(uint256(router.getPosition(oldPosition).state), uint256(SSOTTypes.PositionState.Held));
            assertEq(uint256(gameHub.getBet(oldPosition).state), uint256(SSOTTypes.BetState.PendingVRF));
        }
        uint256 activeBefore = bankA.totalAssets();
        uint256 thirdEpochCost = bankA.recoveryEpoch(3).settledCost;
        uint256 firstUnits = bankA.recoveryEpoch(1).remainingReserve;
        uint256 thirdUnits = bankA.recoveryEpoch(3).remainingReserve;
        uint256 activeOld = 20 ether - firstUnits - bankA.recoveryEpoch(2).remainingReserve - thirdUnits;
        _fulfill(oldPosition, _findSeedDiceWin(oldPosition, 50));
        gameHub.finalize(oldPosition);
        assertEq(bankA.currentEpoch(), 4);
        assertEq(bankA.recoveryEpoch(1).remainingHolds, 0);
        assertEq(bankA.recoveryEpoch(1).settledCost, firstUnits - Math.mulDiv(firstUnits, 0.3 ether, 20 ether));
        assertEq(
            bankA.recoveryEpoch(3).settledCost,
            thirdEpochCost + thirdUnits - Math.mulDiv(thirdUnits, 0.3 ether, 20 ether),
            "each batch bears its own old units"
        );
        assertEq(
            bankA.totalAssets(),
            activeBefore - Math.mulDiv(activeOld, 19.7 ether, 20 ether),
            "staying shares keep their original risk"
        );
        vm.prank(gov);
        assertGt(bankA.claimRecovery(1, gov, gov), 0);
    }

    function test_asyncPendingRefundWhilePausedReleasesHistoricalRecovery() external {
        uint256 cutoff = _requestGovExit(bankA);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, bob);
        SSOTTypes.Bet memory bet = gameHub.getBet(positionId);
        vm.warp(Math.max(cutoff, uint256(bet.placedAt) + gameHub.refundTimeoutSeconds()));
        bankA.activateBatch();

        assertEq(bankA.recoveryEpoch(1).remainingHolds, 1);
        assertTrue(bankA.redeemBatch(1).priced);
        vm.prank(gov);
        bankA.setRiskInPaused(true);
        uint256 playerBalance = assetA.balanceOf(alice);
        vm.prank(bob);
        gameHub.refund(positionId);

        assertEq(assetA.balanceOf(alice) - playerBalance, bet.stake);
        assertEq(uint256(gameHub.getBet(positionId).state), uint256(SSOTTypes.BetState.Refunded));
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Refunded));
        assertEq(bankA.openHolds(), 0);
        assertEq(bankA.totalReserved(), 0);
        assertEq(bankA.totalBetsSettled(), 0);
        assertEq(bankA.totalBetsRefunded(), 1);
        assertEq(vrf.getRequest(bet.requestId).hub, address(0));
        _fulfill(positionId, 123);
        _fulfill(positionId, 456);
        vm.expectRevert(
            abi.encodeWithSelector(
                IGameHub.BadState.selector, positionId, SSOTTypes.BetState.Refunded, SSOTTypes.BetState.PendingVRF
            )
        );
        gameHub.refund(positionId);
        assertEq(bankA.totalBetsRefunded(), 1, "late callbacks do not refund twice");
        assertEq(assetA.balanceOf(alice), playerBalance + bet.stake);

        vm.prank(gov);
        vm.expectRevert(IBank.RiskInPaused.selector);
        bankA.claimRecovery(1, gov, gov);
        vm.prank(gov);
        bankA.setRiskInPaused(false);
        uint256 lpBalance = assetA.balanceOf(gov);
        uint256 expectedCash = _fullExitCash(5_010 ether, 5_000 ether, 20 ether, 10 ether, 1e15);
        assertEq(_claimGovExit(bankA, 5_000 ether, 1), expectedCash);
        assertEq(assetA.balanceOf(gov) - lpBalance, expectedCash);
        assertEq(bankA.exitPayable(), 0);
        assertEq(bankA.maxRedeem(gov), 0);
    }

    function test_asyncRandomReadyWinnerChargesHistoricalRecoveryAfterLiquidPricing() external {
        uint256 cutoff = _requestGovExit(bankA);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, bob);
        uint256 winningSeed = _findSeedDiceWin(positionId, 50);
        _fulfill(positionId, winningSeed);
        _fulfill(positionId, _findSeedDiceLose(positionId, 50));
        assertEq(gameHub.getBetRandomWords(positionId)[0], winningSeed, "duplicate callback cannot replace the win");

        vm.warp(Math.max(cutoff, uint256(gameHub.getBet(positionId).placedAt) + gameHub.refundTimeoutSeconds()));
        bankA.activateBatch();
        vm.expectRevert(
            abi.encodeWithSelector(
                IGameHub.BadState.selector, positionId, SSOTTypes.BetState.RandomReady, SSOTTypes.BetState.PendingVRF
            )
        );
        gameHub.refund(positionId);
        assertEq(bankA.recoveryEpoch(1).remainingHolds, 1);
        assertTrue(bankA.redeemBatch(1).priced);
        vm.prank(gov);
        bankA.setRiskInPaused(true);
        uint256 playerBalance = assetA.balanceOf(alice);
        vm.prank(bob);
        gameHub.finalize(positionId);

        assertEq(assetA.balanceOf(alice) - playerBalance, 19.6 ether, "the known winner gets its net award");
        assertEq(uint256(gameHub.getBet(positionId).state), uint256(SSOTTypes.BetState.Settled));
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(bankA.openHolds(), 0);
        assertEq(bankA.totalReserved(), 0);
        assertEq(bankA.totalBetsSettled(), 1);
        assertEq(bankA.totalBetsRefunded(), 0);
        assertEq(bankA.totalProtocolFeeAccrued() + bankA.externalPayablesTotal(), 0.1 ether);
        _fulfill(positionId, winningSeed);
        vm.expectRevert(
            abi.encodeWithSelector(
                IGameHub.BadState.selector, positionId, SSOTTypes.BetState.Settled, SSOTTypes.BetState.RandomReady
            )
        );
        gameHub.finalize(positionId);
        assertEq(bankA.totalBetsSettled(), 1, "the callback and finalizer cannot settle twice");
        assertEq(assetA.balanceOf(alice), playerBalance + 19.6 ether);

        vm.prank(gov);
        bankA.setRiskInPaused(false);
        assertEq(
            _claimGovExit(bankA, 5_000 ether, 1),
            _fullExitCash(5_010 ether, 5_000 ether, 20 ether, 19.7 ether, 1e15),
            "the LP bears the win and PF/XP"
        );
        assertEq(
            assetA.balanceOf(address(bankA)),
            bankA.protocolFeesPayable() + bankA.externalPayablesTotal(),
            "PF/XP and protocol residual stay backed"
        );
        assertEq(bankA.exitPayable(), 0);
    }

    function test_asyncPartialRefundChargesHistoricalRecoveryExactlyOnce() external {
        uint256 cutoff = _requestGovExit(bankB);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10 ether, betCount: 5, stopGain: 10 ether, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_COIN, POOL_B, abi.encode(true), spec, bob);
        _fulfill(positionId, _findSeedCoinWin(positionId, true));
        vm.warp(cutoff);
        bankB.activateBatch();
        uint256 playerBalance = assetB.balanceOf(alice);
        gameHub.finalize(positionId);

        SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(positionId);
        assertEq(terminal.payoutGross, 20 ether);
        assertEq(terminal.refundAmount, 40 ether);
        assertEq(assetB.balanceOf(alice) - playerBalance, 59.6 ether);
        assertEq(bankB.totalBetsHeld(), 1);
        assertEq(bankB.totalBetsSettled(), 1);
        assertEq(bankB.totalBetsRefunded(), 0, "a settle-path refund is not another terminal position");
        assertEq(bankB.totalRefunded(), 40 ether);
        assertEq(bankB.playerTurnover(alice), 10 ether);
        assertEq(bankB.openHolds(), 0);
        assertEq(bankB.totalReserved(), 0);
        assertEq(bankB.totalProtocolFeeAccrued() + bankB.externalPayablesTotal(), 0.1 ether);
        assertEq(
            _claimGovExit(bankB, 5_000 ether, 1), _fullExitCash(5_050 ether, 5_000 ether, 100 ether, 59.7 ether, 1e15)
        );
        assertEq(bankB.exitPayable(), 0);
        assertEq(bankA.totalAssets(), 5_000 ether, "the other pool's equity is unchanged");
    }

    function test_asyncBlacklistedWinnerTerminatesAndClaimsLaterWhilePaused() external {
        (BlacklistToken blockedAsset, Bank blockedBank) = _newPayablePool(false);
        uint256 cutoff = _requestGovExit(blockedBank);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_DICE, 3, abi.encode(true, uint8(50)), spec, bob);
        _fulfill(positionId, _findSeedDiceWin(positionId, 50));
        vm.warp(cutoff);
        blockedBank.activateBatch();
        blockedAsset.setBlocked(alice, true);
        vm.prank(gov);
        blockedBank.setRiskInPaused(true);
        gameHub.finalize(positionId);

        assertEq(uint256(gameHub.getBet(positionId).state), uint256(SSOTTypes.BetState.Settled));
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(blockedBank.openHolds(), 0);
        assertEq(blockedBank.totalReserved(), 0);
        assertEq(blockedBank.playerPayable(alice), 19_600_000);
        assertEq(blockedAsset.balanceOf(alice), 90e6, "the refused transfer moved nothing");
        vm.prank(gov);
        blockedBank.setRiskInPaused(false);
        assertEq(_claimGovExit(blockedBank, 5_000e6, 1), _fullExitCash(5_010e6, 5_000e6, 20e6, 19_700_000, 1000));

        vm.prank(gov);
        blockedBank.setRiskInPaused(true);
        vm.expectRevert(bytes("blocked"));
        blockedBank.claimPlayerPayable(alice);
        assertEq(blockedBank.playerPayable(alice), 19_600_000, "a refused claim preserves the debt");
        blockedAsset.setBlocked(alice, false);
        vm.prank(bob);
        assertEq(blockedBank.claimPlayerPayable(alice), 19_600_000);
        assertEq(blockedAsset.balanceOf(alice), 109_600_000, "the trigger cannot redirect the claim");
        assertEq(blockedAsset.balanceOf(bob), 0);
        assertEq(blockedBank.playerPayableTotal(), 0);
        assertEq(blockedBank.totalBetsSettled(), 1);
        assertEq(blockedBank.totalPayoutNet(), 19_600_000, "claiming never counts the award twice");
        assertEq(
            blockedAsset.balanceOf(address(blockedBank)),
            blockedBank.protocolFeesPayable() + blockedBank.externalPayablesTotal(),
            "only fixed debts and protocol residual remain"
        );
    }

    function test_asyncUnderfundedFinalizeRollsBackTheWholeChainAndCanRetry() external {
        (BlacklistToken proxyAsset, Bank proxyBank) = _newPayablePool(true);
        uint256 cutoff = _requestGovExit(proxyBank);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_DICE, 3, abi.encode(true, uint8(50)), spec, bob);
        assertEq(uint256(gameHub.getBet(positionId).state), uint256(SSOTTypes.BetState.PendingVRF));
        _fulfill(positionId, _findSeedDiceWin(positionId, 50));
        vm.warp(cutoff);
        proxyBank.activateBatch();
        uint256 playerBalance = proxyAsset.balanceOf(alice);
        uint256 bankBalance = proxyAsset.balanceOf(address(proxyBank));
        uint256 fixedBefore = proxyBank.protocolFeesPayable() + proxyBank.externalPayablesTotal();
        proxyAsset.setGasSink(alice, 25_000_000);

        // The outer finalization cannot finish booking the failed transfer, so every layer must roll back.
        // Both this failed attempt and the later retry must reach the actual token transfer.
        vm.expectCall(address(proxyAsset), abi.encodeCall(proxyAsset.transfer, (alice, 19_600_000)), 2);
        vm.expectRevert();
        gameHub.finalize{gas: 1_000_000}(positionId);
        assertEq(uint256(gameHub.getBet(positionId).state), uint256(SSOTTypes.BetState.RandomReady));
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Held));
        assertEq(proxyBank.openHolds(), 1);
        assertEq(proxyBank.totalReserved(), 20e6);
        assertEq(proxyBank.totalBetsSettled(), 0);
        assertEq(proxyBank.totalBetsRefunded(), 0);
        assertEq(proxyBank.totalPayoutNet(), 0);
        assertEq(proxyBank.protocolFeesPayable() + proxyBank.externalPayablesTotal(), fixedBefore);
        assertEq(proxyBank.playerPayable(alice), 0);
        assertEq(proxyBank.playerPayableTotal(), 0);
        assertEq(proxyAsset.balanceOf(alice), playerBalance);
        assertEq(proxyAsset.balanceOf(address(proxyBank)), bankBalance);
        assertEq(proxyBank.recoveryEpoch(1).remainingHolds, 1);
        assertTrue(proxyBank.redeemBatch(1).priced);

        proxyAsset.setGasSink(address(0), 0);
        gameHub.finalize(positionId);
        assertEq(uint256(gameHub.getBet(positionId).state), uint256(SSOTTypes.BetState.Settled));
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(proxyAsset.balanceOf(alice), playerBalance + 19_600_000);
        assertEq(proxyBank.openHolds(), 0);
        assertEq(proxyBank.totalReserved(), 0);
        assertEq(proxyBank.totalBetsSettled(), 1);
        assertEq(proxyBank.playerPayableTotal(), 0);
        assertEq(_claimGovExit(proxyBank, 5_000e6, 1), _fullExitCash(5_010e6, 5_000e6, 20e6, 19_700_000, 1000));
        assertEq(proxyBank.exitPayable(), 0);
    }

    function test_asyncProxyTransferOogPreservesWinnerDebtAndHistoricalAccounting() external {
        (BlacklistToken proxyAsset, Bank proxyBank) = _newPayablePool(true);
        uint256 cutoff = _requestGovExit(proxyBank);
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        uint256 positionId = _place(alice, GAME_DICE, 3, abi.encode(true, uint8(50)), spec, bob);
        _fulfill(positionId, _findSeedDiceWin(positionId, 50));
        vm.warp(cutoff);
        proxyBank.activateBatch();
        uint256 playerBalance = proxyAsset.balanceOf(alice);
        proxyAsset.setGasSink(alice, 25_000_000);

        // The token fails internally, but the outer call has enough gas left to record the full debt.
        gameHub.finalize{gas: 20_000_000}(positionId);
        assertEq(uint256(gameHub.getBet(positionId).state), uint256(SSOTTypes.BetState.Settled));
        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(proxyAsset.balanceOf(alice), playerBalance);
        assertEq(proxyBank.playerPayable(alice), 19_600_000);
        assertEq(proxyBank.playerPayableTotal(), 19_600_000);
        assertEq(proxyBank.openHolds(), 0);
        assertEq(proxyBank.totalReserved(), 0);
        assertEq(proxyBank.totalBetsSettled(), 1);
        assertEq(proxyBank.totalBetsRefunded(), 0);
        assertEq(_claimGovExit(proxyBank, 5_000e6, 1), _fullExitCash(5_010e6, 5_000e6, 20e6, 19_700_000, 1000));

        proxyAsset.setGasSink(address(0), 0);
        vm.prank(bob);
        assertEq(proxyBank.claimPlayerPayable(alice), 19_600_000);
        assertEq(proxyAsset.balanceOf(alice), playerBalance + 19_600_000);
        assertEq(proxyBank.playerPayableTotal(), 0);
        assertEq(proxyBank.totalBetsSettled(), 1);
        assertEq(proxyBank.totalPayoutNet(), 19_600_000);
        assertEq(
            proxyAsset.balanceOf(address(proxyBank)),
            proxyBank.protocolFeesPayable() + proxyBank.externalPayablesTotal()
        );
    }

    // Admission is measured at the complete finalize call, separately from the VRF callback budget.
    // This is a regression envelope for the pinned local contracts, not a production gas estimate.
    uint256 internal constant ADMISSION_FINALIZE_GAS = 3_000_000;
    uint256 internal constant ADMISSION_AMOUNT = 0.01 ether;

    function test_admissionMaxCoin() external {
        bytes[] memory variants = new bytes[](2);
        variants[0] = abi.encode(false);
        variants[1] = abi.encode(true);
        _admissionVariants(GAME_COIN, variants);
    }

    function test_admissionMaxDice() external {
        bytes[] memory variants = new bytes[](6);
        for (uint256 i; i < 2; ++i) {
            variants[i * 3] = abi.encode(i == 1, uint8(1));
            variants[i * 3 + 1] = abi.encode(i == 1, uint8(50));
            variants[i * 3 + 2] = abi.encode(i == 1, uint8(99));
        }
        _admissionVariants(GAME_DICE, variants);
    }

    function test_admissionMaxRoulette() external {
        bytes[] memory variants = new bytes[](14);
        uint40[14] memory payloads =
            [uint40((uint256(1) << 36) - 1), 36, 1 | (2 << 6), 34, 32, 31, 3, 3, 0, 0, 0, 0, 0, 0];
        for (uint8 kind; kind < 14; ++kind) {
            variants[kind] = abi.encode(kind, payloads[kind]);
        }
        _admissionVariants(GAME_ROULETTE, variants);
    }

    function test_admissionMaxKeno() external {
        bytes[] memory variants = new bytes[](5);
        for (uint256 i; i < 5; ++i) {
            variants[i] = abi.encode(uint40((uint256(1) << (i + 1)) - 1));
        }
        _admissionVariants(GAME_KENO, variants);
    }

    function test_admissionMaxSlots() external {
        bytes[] memory variants = new bytes[](1);
        variants[0] = SlotsParams.encode(SlotsParams.PROFILE_CLASSIC);
        _admissionVariants(GAME_SLOTS, variants);
    }

    function test_admissionMaxBaccarat() external {
        bytes[] memory variants = new bytes[](3);
        for (uint8 side; side < 3; ++side) {
            variants[side] = BaccaratParams.encode(side);
        }
        _admissionVariants(GAME_BACCARAT, variants);
    }

    function test_admissionMaxPlinko() external {
        bytes[] memory variants = new bytes[](3);
        for (uint8 risk; risk < 3; ++risk) {
            variants[risk] = PlinkoParams.encode(risk);
        }
        _admissionVariants(GAME_PLINKO, variants);
    }

    function test_admissionMaxSicBo() external {
        // Every kind, every exact-total table branch, and all six faces for face-specific bets.
        bytes[] memory variants = new bytes[](35);
        uint256 n;
        for (uint8 kind; kind < 7; ++kind) {
            if (kind < 3) {
                variants[n++] = SicBoParams.encode(kind, 0);
            } else if (kind == SicBoParams.KIND_TOTAL) {
                for (uint8 total = 4; total <= 17; ++total) {
                    variants[n++] = SicBoParams.encode(kind, total);
                }
            } else {
                for (uint8 face = 1; face <= 6; ++face) {
                    variants[n++] = SicBoParams.encode(kind, face);
                }
            }
        }
        assertEq(n, variants.length);
        _admissionVariants(GAME_SIC_BO, variants);
    }

    function _admissionVariants(bytes32 gameId, bytes[] memory variants) internal {
        _configureMaxReferral();
        uint256 baseline = vm.snapshotState();
        uint256 maxGas;
        for (uint256 i; i < variants.length; ++i) {
            // Exercise the accepted byte limit even for single-word module formats.
            if (variants[i].length == 32) variants[i] = bytes.concat(variants[i], abi.encode(type(uint256).max));
            for (uint256 eligibility; eligibility < 2; ++eligibility) {
                uint256 used = _admissionCase(gameId, variants[i], eligibility == 1, 12345);
                maxGas = Math.max(maxGas, used);
                assertTrue(vm.revertToState(baseline));
            }
        }
        emit log_named_uint("maximum cold finalize call gas in this parameter matrix", maxGas);
    }

    function test_admissionRareResolveBranches() external {
        _configureMaxReferral();
        uint256 baseline = vm.snapshotState();
        // Select an actual RNG seed whose first Keno draw executes all five non-self swaps.
        uint256 seed;
        for (;; ++seed) {
            bool allSwap = true;
            for (uint256 j; j < 5; ++j) {
                if (_rng2(1, 0, j, seed) % (15 - j) == 0) allSwap = false;
            }
            if (allSwap) break;
        }
        // Selecting that same five-number draw forces the deepest matchCount=5 gain-table branch.
        _admissionCase(GAME_KENO, abi.encode(_kenoDraw0(1, seed)), false, seed);
        assertTrue(vm.revertToState(baseline));

        // Both sides draw a third card; bankerTotal=6 and playerThird=6/7 reaches the last rule.
        for (seed = 0; seed < 65_536; ++seed) {
            uint8 playerTotal = (_baccaratCardValue(1, 0, seed) + _baccaratCardValue(1, 2, seed)) % 10;
            uint8 bankerTotal = (_baccaratCardValue(1, 1, seed) + _baccaratCardValue(1, 3, seed)) % 10;
            uint8 third = _baccaratCardValue(1, 4, seed);
            if (playerTotal <= 5 && bankerTotal == 6 && (third == 6 || third == 7)) break;
        }
        assertLt(seed, 65_536, "six-card Baccarat witness exists");
        _admissionCase(GAME_BACCARAT, BaccaratParams.encode(BaccaratParams.SIDE_BANKER), false, seed);
        assertTrue(vm.revertToState(baseline));

        // The last pair comparison, rather than the earlier jackpot/triple branches.
        for (seed = 0; seed < 2_048; ++seed) {
            uint8 a = _slotSymbol(1, 0, seed);
            uint8 b = _slotSymbol(1, 1, seed);
            uint8 c = _slotSymbol(1, 2, seed);
            if (a != b && a != c && b == c) break;
        }
        assertLt(seed, 2_048, "late pair witness exists");
        _admissionCase(GAME_SLOTS, SlotsParams.encode(SlotsParams.PROFILE_CLASSIC), false, seed);
        assertTrue(vm.revertToState(baseline));

        for (seed = 0; seed < 2_048; ++seed) {
            (uint8 a, uint8 b, uint8 c) = _sicBoDice(1, seed);
            if (a + b + c == 10) break;
        }
        assertLt(seed, 2_048, "deep exact-total witness exists");
        _admissionCase(GAME_SIC_BO, SicBoParams.encode(SicBoParams.KIND_TOTAL, 10), false, seed);
    }

    function testFuzz_admissionGasCannotTurnAValidResultIntoARefund(uint8 game, uint256 seed, uint32 suppliedGas)
        external
    {
        _configureMaxReferral();
        (bytes32 gameId, bytes memory params) = _admissionGame(game % 8);
        SSOTTypes.StakeSpec memory spec = _admissionSpec();
        uint256 cutoff = _requestGovExit(bankA);
        uint256 id = _place(alice, gameId, POOL_A, params, spec, address(0xAA00));
        _fulfill(id, seed);
        vm.warp(cutoff);
        bankA.activateBatch();
        address module = gameHub.gameModule(gameId);
        (uint256 gross,) = IGameModule(module).resolve(params, spec, id, gameHub.getBetRandomWords(id));
        uint256 gasBudget = bound(uint256(suppliedGas), 50_000, ADMISSION_FINALIZE_GAS);
        uint256 reserve = bankA.totalReserved();
        _coolFinalize(module);
        (bool ok,) = address(gameHub).call{gas: gasBudget}(abi.encodeCall(gameHub.finalize, (id)));
        if (!ok) {
            assertEq(uint256(gameHub.getBet(id).state), uint256(SSOTTypes.BetState.RandomReady));
            assertEq(uint256(router.getPosition(id).state), uint256(SSOTTypes.PositionState.Held));
            assertEq(bankA.openHolds(), 1);
            assertEq(bankA.totalReserved(), reserve);
            assertEq(bankA.totalBetsSettled() + bankA.totalBetsRefunded(), 0);
            assertEq(bankA.totalProtocolFeeAccrued() + bankA.externalPayablesTotal() + bankA.playerPayableTotal(), 0);
            assertEq(assetA.balanceOf(alice), 999 ether);
            assertEq(assetA.balanceOf(address(bankA)), 5_001 ether);
            assertEq(bankA.recoveryEpoch(1).remainingHolds, 1);
            assertTrue(bankA.redeemBatch(1).priced);
            _coolFinalize(module);
            gameHub.finalize{gas: ADMISSION_FINALIZE_GAS}(id);
        }
        _assertAdmissionSettlement(id, gross);
        _claimAdmissionExit();
    }

    function _admissionGame(uint8 index) internal pure returns (bytes32 gameId, bytes memory params) {
        if (index == 0) return (GAME_COIN, abi.encode(true));
        if (index == 1) return (GAME_DICE, abi.encode(false, uint8(99)));
        if (index == 2) return (GAME_ROULETTE, RouletteParams.encode(RouletteParams.Kind.High, 0));
        if (index == 3) return (GAME_KENO, abi.encode(uint40(31)));
        if (index == 4) return (GAME_SLOTS, SlotsParams.encode(SlotsParams.PROFILE_CLASSIC));
        if (index == 5) return (GAME_BACCARAT, BaccaratParams.encode(BaccaratParams.SIDE_BANKER));
        if (index == 6) return (GAME_PLINKO, PlinkoParams.encode(PlinkoParams.RISK_MEDIUM));
        return (GAME_SIC_BO, SicBoParams.encode(SicBoParams.KIND_TOTAL, 10));
    }

    function test_admissionModuleFailureBranchesTerminateWithoutAllocation() external {
        uint256 baseline = vm.snapshotState();
        for (uint256 mode; mode < 4; ++mode) {
            uint256 cutoff = _requestGovExit(bankA);
            uint256 id = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), _admissionSpec(), bob);
            _fulfill(id, 12345);
            vm.warp(cutoff);
            bankA.activateBatch();
            SSOTTypes.Bet memory bet = gameHub.getBet(id);
            address module = gameHub.gameModule(GAME_DICE);
            bytes memory callData = abi.encodeWithSelector(IGameModule.resolve.selector);
            if (mode == 0) {
                vm.mockCallRevert(module, callData, abi.encodeWithSignature("Error(string)", "module failure"));
            } else if (mode == 1) {
                vm.mockCall(module, callData, abi.encode(uint256(0), bet.stake + 1));
            } else if (mode == 2) {
                vm.mockCall(module, callData, abi.encode(bet.reserved + 1, uint256(0)));
            } else {
                vm.mockCall(module, callData, abi.encode(bet.reserved, uint256(1)));
            }
            _coolFinalize(module);
            gameHub.finalize{gas: ADMISSION_FINALIZE_GAS}(id);
            vm.clearMockedCalls();
            assertEq(uint256(gameHub.getBet(id).state), uint256(SSOTTypes.BetState.Refunded));
            assertEq(uint256(router.getPosition(id).state), uint256(SSOTTypes.PositionState.Refunded));
            assertEq(gameHub.getBetTerminal(id).refundAmount, bet.stake);
            assertEq(bankA.totalBetsRefunded(), 1);
            assertEq(bankA.totalBetsSettled(), 0);
            assertEq(bankA.openHolds(), 0);
            assertEq(bankA.totalReserved(), 0);
            assertEq(bankA.totalProtocolFeeAccrued() + bankA.externalPayablesTotal() + bankA.playerPayableTotal(), 0);
            assertEq(assetA.balanceOf(alice), 1_000 ether);
            _claimAdmissionExit();
            assertTrue(vm.revertToState(baseline));
        }
    }

    function test_admissionRejectsOversizedParamsBeforeHoldAndVrf() external {
        SSOTTypes.StakeSpec memory spec = _admissionSpec();
        (uint256 fee,) = gameHub.quoteVRFFee(spec.betCount, tx.gasprice);
        for (uint256 i; i < 2; ++i) {
            // abi.decode accepts both payloads: canonical Dice fields followed by surplus bytes.
            bytes memory params = bytes.concat(abi.encode(true, uint8(50)), new bytes(i == 0 ? 1 : 49_152));
            uint256 requestNonce = vrf.nextRequestId();
            vm.prank(alice);
            vm.expectRevert(Errors.InvalidConfig.selector);
            gameHub.placeBet{value: fee}(GAME_DICE, POOL_A, params, spec, address(0), 10_000);
            assertEq(router.nextPositionId(), 1);
            assertEq(vrf.nextRequestId(), requestNonce);
            assertEq(bankA.openHolds(), 0);
            assertEq(bankA.totalReserved(), 0);
            assertEq(assetA.balanceOf(alice), 1_000 ether);
            assertEq(assetA.balanceOf(address(bankA)), 5_000 ether);
        }
    }

    function test_admissionAllows64ByteSingleFieldParams() external {
        _configureMaxReferral();
        // The bound does not invent stricter encodings: harmless padding within the limit still works.
        _admissionCase(GAME_COIN, bytes.concat(abi.encode(true), new bytes(32)), false, 12345);
    }

    function test_admissionAllocationCapFailureRollsBackThenRetries() external {
        _configureMaxReferral();
        uint256 cutoff = _requestGovExit(bankA);
        bytes memory params = abi.encode(true, uint8(50));
        SSOTTypes.StakeSpec memory spec = _admissionSpec();
        uint256 id = _place(alice, GAME_DICE, POOL_A, params, spec, address(0xAA00));
        _fulfill(id, 12345);
        vm.warp(cutoff);
        bankA.activateBatch();
        address module = gameHub.gameModule(GAME_DICE);
        (uint256 gross,) = IGameModule(module).resolve(params, spec, id, gameHub.getBetRandomWords(id));
        IReferralEngine.Allocation memory invalid;
        invalid.protocolFee = 1 ether;
        // Inject an engine defect; the real Router must reject it, not turn a valid game into a refund.
        vm.mockCall(
            gameHub.referralEngine(),
            abi.encodeWithSelector(IReferralEngine.allocate.selector),
            abi.encode(invalid, new SSOTTypes.XPAward[](0))
        );
        vm.expectRevert(
            abi.encodeWithSelector(ISettlementRouter.AllocationExceedsCap.selector, id, 1 ether, 0.025 ether)
        );
        gameHub.finalize(id);
        vm.clearMockedCalls();
        assertEq(uint256(gameHub.getBet(id).state), uint256(SSOTTypes.BetState.RandomReady));
        assertEq(uint256(router.getPosition(id).state), uint256(SSOTTypes.PositionState.Held));
        assertEq(bankA.openHolds(), 1);
        assertEq(bankA.totalReserved(), 2 ether);
        assertEq(bankA.totalBetsSettled() + bankA.totalBetsRefunded(), 0);
        assertEq(bankA.totalProtocolFeeAccrued() + bankA.externalPayablesTotal() + bankA.playerPayableTotal(), 0);
        assertEq(assetA.balanceOf(alice), 999 ether);
        assertEq(assetA.balanceOf(address(bankA)), 5_001 ether);
        assertEq(bankA.recoveryEpoch(1).remainingHolds, 1);
        assertTrue(bankA.redeemBatch(1).priced);
        _coolFinalize(module);
        gameHub.finalize{gas: ADMISSION_FINALIZE_GAS}(id);
        _assertAdmissionSettlement(id, gross);
        _claimAdmissionExit();
    }

    function test_admissionMaxCountStopGainAndStopLossTerminate() external {
        _configureMaxReferral();
        uint256 baseline = vm.snapshotState();
        for (uint256 winning; winning < 2; ++winning) {
            uint256 cutoff = _requestGovExit(bankA);
            SSOTTypes.StakeSpec memory spec = _admissionSpec();
            spec.stopGain = 1;
            spec.stopLoss = 1;
            uint256 id = _place(alice, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), spec, address(0xAA00));
            _fulfill(id, winning == 1 ? _findSeedDiceWin(id, 50) : _findSeedDiceLose(id, 50));
            vm.warp(cutoff);
            bankA.activateBatch();
            _coolFinalize(gameHub.gameModule(GAME_DICE));
            gameHub.finalize{gas: ADMISSION_FINALIZE_GAS}(id);
            SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(id);
            assertEq(uint256(gameHub.getBet(id).state), uint256(SSOTTypes.BetState.Settled));
            assertEq(uint256(router.getPosition(id).state), uint256(SSOTTypes.PositionState.Settled));
            assertEq(terminal.refundAmount, 99 * ADMISSION_AMOUNT);
            assertEq(terminal.payoutGross, winning == 1 ? 2 * ADMISSION_AMOUNT : 0);
            assertEq(terminal.payoutNet, winning == 1 ? 0.019 ether : 0);
            assertEq(assetA.balanceOf(alice), 1_000 ether - ADMISSION_AMOUNT + terminal.payoutNet);
            assertEq(bankA.playerTurnover(alice), ADMISSION_AMOUNT);
            assertEq(bankA.totalProtocolFeeAccrued() + bankA.externalPayablesTotal(), 0.00025 ether);
            assertEq(bankA.totalBetsSettled(), 1);
            assertEq(bankA.totalBetsRefunded(), 0, "partial refund is still exactly one settlement");
            assertEq(bankA.openHolds(), 0);
            assertEq(bankA.totalReserved(), 0);
            _claimAdmissionExit();
            assertTrue(vm.revertToState(baseline));
        }
    }

    function _configureMaxReferral() internal {
        vm.prank(gov);
        gameHub.queueEdgeChange(IGameHub.EdgeParam.MaxAffiliateDelta, 300);
        vm.warp(block.timestamp + 7 days);
        gameHub.activateEdgeChange(IGameHub.EdgeParam.MaxAffiliateDelta);
        // Six distinct skyline payees; L1 and L2 also receive their separate base-edge awards.
        for (uint160 i; i < 6; ++i) {
            address payee = address(0xAA00 + i);
            vm.startPrank(payee);
            if (i < 5) gameHub.bindReferrer(address(0xAA01 + i));
            gameHub.setAffiliateHouseEdge(uint16(250 + 50 * i));
            vm.stopPrank();
        }
    }

    function _admissionSpec() internal pure returns (SSOTTypes.StakeSpec memory) {
        // Both stop branches execute, but cannot shorten the maximum 100-roll workload.
        return SSOTTypes.StakeSpec({
            amountPerRoll: ADMISSION_AMOUNT, betCount: 100, stopGain: type(uint256).max, stopLoss: type(uint256).max
        });
    }

    function _admissionCase(bytes32 gameId, bytes memory params, bool eligible, uint256 seed)
        internal
        returns (uint256 gasUsed)
    {
        vm.prank(gov);
        bankA.setMinPlayerTurnoverForUnlock(eligible ? 0 : 2 ether);
        uint256 cutoff = _requestGovExit(bankA);
        SSOTTypes.StakeSpec memory spec = _admissionSpec();
        uint256 id = _place(alice, gameId, POOL_A, params, spec, address(0xAA00));
        assertEq(gameHub.getDeltaSkyline(id).length, 6 * 22, "all six skyline segments accepted");
        uint256[] memory words = new uint256[](1);
        words[0] = seed;
        SSOTTypes.Bet memory bet = gameHub.getBet(id);
        address module = gameHub.gameModule(gameId);
        (uint256 gross, uint256 refundAmount) = IGameModule(module).resolve(params, spec, id, words);
        assertEq(refundAmount, 0, "all 100 rolls must run");
        vm.cool(address(gameHub));
        vm.cool(address(vrf));
        vrf.fulfillRandomWords{gas: bet.vrfCallbackGasLimit}(bet.requestId, words);
        assertEq(uint256(gameHub.getBet(id).state), uint256(SSOTTypes.BetState.RandomReady));
        vm.warp(cutoff);
        bankA.activateBatch();
        assertEq(bankA.recoveryEpoch(1).remainingHolds, 1);
        assertTrue(bankA.redeemBatch(1).priced);
        _coolFinalize(module);
        vm.recordLogs();
        uint256 beforeGas = gasleft();
        gameHub.finalize{gas: ADMISSION_FINALIZE_GAS}(id);
        gasUsed = beforeGas - gasleft();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        this.assertNineAwards(logs, eligible);
        _assertAdmissionSettlement(id, gross);
        _claimAdmissionExit();
    }

    function test_admissionColdHistoricalSettlementKeepsCurrentEpochOpen() external {
        _configureMaxReferral();
        vm.prank(gov);
        bankA.setMinPlayerTurnoverForUnlock(2 ether);
        vm.prank(bob);
        assetA.approve(address(gameHub), type(uint256).max);
        uint256 baseline = vm.snapshotState();
        uint256 maximumGas;
        for (uint8 index; index < 8; ++index) {
            (bytes32 gameId, bytes memory params) = _admissionGame(index);
            uint256 id = _place(alice, gameId, POOL_A, params, _admissionSpec(), address(0xAA00));
            vm.prank(gov);
            bankA.requestRedeem(2_000 ether, gov, gov);
            vm.warp(bankA.redeemBatch(1).cutoff);
            bankA.activateBatch();
            SSOTTypes.StakeSpec memory nextSpec =
                SSOTTypes.StakeSpec({amountPerRoll: 1 ether, betCount: 1, stopGain: 0, stopLoss: 0});
            uint256 currentId = _place(bob, GAME_DICE, POOL_A, abi.encode(true, uint8(50)), nextSpec, address(0));
            uint256 activeBefore = bankA.totalAssets();
            uint256 currentReserve = gameHub.getBet(currentId).reserved;
            uint256 oldActive = bankA.activeReserved() - currentReserve;
            _fulfill(id, 12345);
            _coolFinalize(gameHub.gameModule(gameId));
            vm.recordLogs();
            uint256 beforeGas = gasleft();
            gameHub.finalize{gas: ADMISSION_FINALIZE_GAS}(id);
            uint256 used = beforeGas - gasleft();
            maximumGas = Math.max(maximumGas, used);
            this.assertNineAwards(vm.getRecordedLogs(), false);
            IBank.RecoveryEpoch memory historical = bankA.recoveryEpoch(1);
            SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(id);
            assertEq(uint256(terminal.state), uint256(SSOTTypes.BetState.Settled));
            assertEq(terminal.refundAmount, 0);
            assertEq(historical.remainingHolds, 0);
            uint256 cost = terminal.payoutNet + 0.025 ether;
            uint256 originalReserve = gameHub.getBet(id).reserved;
            uint256 recovered = Math.mulDiv(historical.initialReserve, originalReserve - cost, originalReserve);
            assertEq(historical.settledCost, historical.initialReserve - recovered);
            assertEq(historical.recoveredAssets, recovered);
            uint256 activeAfter = activeBefore - Math.mulDiv(oldActive, cost, originalReserve);
            assertEq(bankA.totalAssets(), activeAfter);
            assertEq(bankA.activeReserved(), currentReserve);
            assertEq(bankA.totalReserved(), currentReserve);
            assertEq(bankA.activeOpenHolds(), 1);
            assertEq(uint256(router.getPosition(currentId).state), uint256(SSOTTypes.PositionState.Held));
            vm.prank(gov);
            assertEq(bankA.claimRecovery(1, gov, gov), historical.recoveredAssets);
            assertEq(bankA.totalAssets(), activeAfter, "historical cash claims do not debit active capital");
            emit log_named_uint("cold historical finalize gas", used);
            assertTrue(vm.revertToState(baseline));
        }
        emit log_named_uint("maximum cold historical finalize gas", maximumGas);
    }

    function _coolFinalize(address module) internal {
        // Getter reads happen first; cooling afterwards also clears every touched storage slot.
        address engine = gameHub.referralEngine();
        vm.cool(address(gameHub));
        vm.cool(address(router));
        vm.cool(address(bankA));
        vm.cool(address(assetA));
        vm.cool(address(vrf));
        vm.cool(engine);
        vm.cool(module);
    }

    // External test assertion avoids optimizer inlining the log decoder into every matrix variant.
    function assertNineAwards(Vm.Log[] memory logs, bool eligible) external view {
        bytes32 awardTopic = keccak256("XPAwarded(uint256,address,address,uint256,uint256,uint256,bytes32)");
        uint256 n;
        uint256 allocated;
        uint256 reasons;
        uint256 skylinePayees;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(bankA) || logs[i].topics[0] != awardTopic) continue;
            (uint256 accrued, uint256 locked, uint256 holdback, bytes32 reason) =
                abi.decode(logs[i].data, (uint256, uint256, uint256, bytes32));
            assertGt(accrued + locked + holdback, 0, "no empty awards pad the maximum");
            assertEq(uint256(logs[i].topics[1]), 1, "the first and only position");
            assertEq(address(uint160(uint256(logs[i].topics[3]))), alice);
            address payee = address(uint160(uint256(logs[i].topics[2])));
            uint256 bit;
            uint256 amount;
            if (reason == keccak256("REF_L0")) {
                assertEq(payee, alice);
                bit = 1;
                amount = 0.002 ether;
                assertEq(locked + holdback, 0);
            } else if (reason == keccak256("REF_L1")) {
                assertEq(payee, address(0xAA00));
                bit = 2;
                amount = 0.004 ether;
            } else if (reason == keccak256("REF_L2")) {
                assertEq(payee, address(0xAA01));
                bit = 4;
                amount = 0.001 ether;
            } else {
                assertEq(reason, keccak256("REF_MARKUP"));
                assertGe(uint160(payee), 0xAA00);
                assertLe(uint160(payee), 0xAA05);
                uint256 payeeBit = uint256(1) << (uint160(payee) - 0xAA00);
                assertEq(skylinePayees & payeeBit, 0, "unique skyline recipient");
                skylinePayees |= payeeBit;
                amount = 0.0025 ether;
            }
            assertEq(reasons & bit, 0, "unique base-edge reason");
            reasons |= bit;
            assertEq(accrued + locked + holdback, amount);
            if (reason != keccak256("REF_L0")) {
                assertEq(holdback, amount * 3 / 10);
                assertEq(eligible ? accrued : locked, amount - holdback);
                assertEq(eligible ? locked : accrued, 0);
            }
            allocated += accrued + locked + holdback;
            ++n;
        }
        assertEq(n, 9, "L0, L1, L2 and six markup awards");
        assertEq(reasons, 7);
        assertEq(skylinePayees, 63);
        assertEq(bankA.externalPayablesTotal(), allocated);
        // Events and aggregate backing are insufficient: prove each recipient's actual debt ownership.
        assertEq(bankA.xpAccruedOf(alice), 0.002 ether);
        assertEq(bankA.xpLockedOf(alice) + bankA.xpHoldbackOf(alice), 0);
        for (uint160 i; i < 6; ++i) {
            address payee = address(0xAA00 + i);
            uint256 amount = 0.0025 ether + (i == 0 ? 0.004 ether : i == 1 ? 0.001 ether : 0);
            uint256 holdback = amount * 3 / 10;
            uint256 locked = eligible ? 0 : amount - holdback;
            assertEq(bankA.xpHoldbackOf(payee), holdback);
            assertEq(bankA.xpAccruedOf(payee), eligible ? amount - holdback : 0);
            assertEq(bankA.xpLockedOf(payee), locked);
            assertEq(bankA.xpLockedBySource(payee, alice), locked);
        }
    }

    function _assertAdmissionSettlement(uint256 id, uint256 gross) internal view {
        SSOTTypes.BetTerminal memory terminal = gameHub.getBetTerminal(id);
        assertEq(uint256(gameHub.getBet(id).state), uint256(SSOTTypes.BetState.Settled));
        assertEq(uint256(terminal.state), uint256(SSOTTypes.BetState.Settled), "valid results cannot become refunds");
        assertEq(uint256(router.getPosition(id).state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(terminal.payoutGross, gross);
        assertEq(terminal.refundAmount, 0);
        assertEq(terminal.payoutNet, gross - Math.mulDiv(gross, 500, 10_000));
        assertEq(assetA.balanceOf(alice), 1_000 ether - 1 ether + terminal.payoutNet);
        assertEq(bankA.playerTurnover(alice), 1 ether);
        assertEq(bankA.totalBetsSettled(), 1);
        assertEq(bankA.totalBetsRefunded(), 0);
        assertEq(bankA.openHolds(), 0);
        assertEq(bankA.totalReserved(), 0);
        assertEq(bankA.playerPayableTotal(), 0);
        assertEq(bankA.totalProtocolFeeAccrued() + bankA.externalPayablesTotal(), 0.025 ether);
        IBank.RecoveryEpoch memory epoch = bankA.recoveryEpoch(1);
        assertEq(epoch.snapshotNav, 5_001 ether);
        assertEq(epoch.snapshotSupply, 5_000 ether);
        uint256 reserve = gameHub.getBet(id).reserved;
        uint256 units = Math.mulDiv(reserve, _exitEquity(5_001 ether, 5_000 ether, 5_000 ether, 1e15), 5_001 ether);
        uint256 recovered = Math.mulDiv(units, reserve - terminal.payoutNet - 0.025 ether, reserve);
        assertEq(epoch.initialReserve, units);
        assertEq(epoch.settledCost, units - recovered);
        assertEq(epoch.recoveredAssets, recovered);
    }

    function _claimAdmissionExit() internal {
        IBank.RecoveryEpoch memory epoch = bankA.recoveryEpoch(1);
        uint256 liquid = bankA.redeemBatch(1).assets;
        uint256 expected = liquid + (epoch.initialReserve - epoch.settledCost - epoch.remainingReserve);
        uint256 cashBefore = assetA.balanceOf(gov);
        assertEq(_claimGovExit(bankA, 5_000 ether, 1), expected);
        assertEq(assetA.balanceOf(gov) - cashBefore, expected);
        assertEq(bankA.exitPayable(), 0);
        assertEq(bankA.totalSupply(), 0);
        assertEq(bankA.recoveryBacking(), 0);
        assertEq(
            assetA.balanceOf(address(bankA)),
            bankA.protocolFeesPayable() + bankA.externalPayablesTotal(),
            "LP cash and recovery leave all referral and protocol liabilities backed"
        );
    }

    function _claimGovExit(Bank target, uint256 shares, uint256 epoch) internal returns (uint256 amount) {
        vm.startPrank(gov);
        amount = target.redeem(shares, gov, gov);
        amount += target.claimRecovery(epoch, gov, gov);
        vm.stopPrank();
    }

    function _exitEquity(uint256 nav_, uint256 supply, uint256 q, uint256 v) internal pure returns (uint256) {
        return Math.mulDiv(q, Math.min(Math.mulDiv(supply, nav_ + v, supply + v), nav_), supply);
    }

    function _fullExitCash(uint256 nav_, uint256 supply, uint256 reserve, uint256 cost, uint256 v)
        internal
        pure
        returns (uint256)
    {
        uint256 equity = _exitEquity(nav_, supply, supply, v);
        uint256 liquid = Math.mulDiv(equity, nav_ - reserve, nav_);
        uint256 units = Math.mulDiv(reserve, equity, nav_);
        return liquid + Math.mulDiv(units, reserve - cost, reserve);
    }

    function _newPayablePool(bool useProxy) internal returns (BlacklistToken token, Bank bank) {
        // Add only a token/Bank pair; reuse the fixture's real Hub, Router, VRF and registered modules.
        token = new BlacklistToken();
        if (useProxy) token = BlacklistToken(address(new ERC1967Proxy(address(token), "")));
        bank = new Bank(address(token), gov, 1000, "Payable LP", "PLP", 6, 1);
        vm.startPrank(gov);
        poolRegistry.registerPool(3, address(token), address(bank), SSOTTypes.PoolDomain.Casino);
        poolRegistry.setHubAllowedForPool(3, address(gameHub), true);
        bank.setSettlementRouterOnce(address(router));
        token.mint(gov, 5_000e6);
        token.approve(address(bank), type(uint256).max);
        bank.deposit(5_000e6, gov);
        vm.stopPrank();
        token.mint(alice, 100e6);
        vm.prank(alice);
        token.approve(address(gameHub), type(uint256).max);
    }

    function _requestGovExit(Bank target) internal returns (uint256 cutoff) {
        uint256 shares = target.balanceOf(gov);
        vm.prank(gov);
        target.requestRedeem(shares, gov, gov);
        return target.redeemBatch(target.currentEpoch()).cutoff;
    }

    function _place(
        address player,
        bytes32 gameId,
        uint64 poolId,
        bytes memory params,
        SSOTTypes.StakeSpec memory spec,
        address affiliate
    ) internal returns (uint256 positionId) {
        (uint256 fee,) = gameHub.quoteVRFFee(spec.betCount, tx.gasprice);
        vm.prank(player);
        positionId = gameHub.placeBet{value: fee}(gameId, poolId, params, spec, affiliate, 10_000);
    }

    function _fulfill(uint256 positionId, uint256 seed) internal {
        SSOTTypes.Bet memory bet = gameHub.getBet(positionId);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(bet.requestId, rw);
    }

    function _rng(uint256 betId, uint256 i, uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(RNG_DOMAIN, betId, i, seed)));
    }

    function _rng2(uint256 betId, uint256 i, uint256 j, uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(RNG_DOMAIN, betId, i, j, seed)));
    }

    function _findSeedDiceWin(uint256 betId, uint8 cap) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 2048; seed++) {
            uint256 rolled = (_rng(betId, 0, seed) % 100) + 1;
            if (rolled > cap) return seed;
        }
        revert("no seed");
    }

    function _findSeedDiceLose(uint256 betId, uint8 cap) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 2048; seed++) {
            uint256 rolled = (_rng(betId, 0, seed) % 100) + 1;
            if (rolled <= cap) return seed;
        }
        revert("no seed");
    }

    function _findSeedDiceUnderWin(uint256 betId, uint8 target) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 2048; seed++) {
            uint256 rolled = (_rng(betId, 0, seed) % 100) + 1;
            if (rolled <= target) return seed;
        }
        revert("no seed");
    }

    function _findSeedCoinWin(uint256 betId, bool isTails) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 2048; seed++) {
            bool rolledTails = (_rng(betId, 0, seed) % 2) == 1;
            if (rolledTails == isTails) return seed;
        }
        revert("no seed");
    }

    function _findSeedRouletteHit(uint256 betId, uint256 want) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 8192; seed++) {
            if (_rng(betId, 0, seed) % 37 == want) return seed;
        }
        revert("no seed");
    }

    function _findSeedKenoHit(uint256 betId, uint40 numbers, bool wantHit) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 16384; seed++) {
            uint40 rolled = _kenoDraw0(betId, seed);
            bool hit = (numbers & rolled) != 0;
            if (hit == wantHit) return seed;
        }
        revert("no seed");
    }

    function _findSeedSlotsJackpot(uint256 betId) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 16384; seed++) {
            if (
                _slotSymbol(betId, 0, seed) == 7 && _slotSymbol(betId, 1, seed) == 7 && _slotSymbol(betId, 2, seed) == 7
            ) {
                return seed;
            }
        }
        revert("no seed");
    }

    function _slotSymbol(uint256 betId, uint256 reelIndex, uint256 seed) internal pure returns (uint8) {
        return uint8(_rng2(betId, 0, reelIndex, seed) % 8);
    }

    function _findSeedBaccaratOutcome(uint256 betId, uint8 want) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 16384; seed++) {
            if (_baccaratOutcome(betId, seed) == want) return seed;
        }
        revert("no seed");
    }

    function _baccaratOutcome(uint256 betId, uint256 seed) internal pure returns (uint8) {
        uint8 playerTotal = (_baccaratCardValue(betId, 0, seed) + _baccaratCardValue(betId, 2, seed)) % 10;
        uint8 bankerTotal = (_baccaratCardValue(betId, 1, seed) + _baccaratCardValue(betId, 3, seed)) % 10;

        if (playerTotal < 8 && bankerTotal < 8) {
            bool playerDraws = playerTotal <= 5;
            uint8 playerThird = 0;

            if (playerDraws) {
                playerThird = _baccaratCardValue(betId, 4, seed);
                playerTotal = (playerTotal + playerThird) % 10;
            }

            if (_baccaratBankerDraws(bankerTotal, playerDraws, playerThird)) {
                bankerTotal = (bankerTotal + _baccaratCardValue(betId, 5, seed)) % 10;
            }
        }

        if (playerTotal > bankerTotal) return BaccaratParams.SIDE_PLAYER;
        if (bankerTotal > playerTotal) return BaccaratParams.SIDE_BANKER;
        return BaccaratParams.SIDE_TIE;
    }

    function _baccaratBankerDraws(uint8 bankerTotal, bool playerDraws, uint8 playerThird) internal pure returns (bool) {
        if (!playerDraws) return bankerTotal <= 5;
        if (bankerTotal <= 2) return true;
        if (bankerTotal == 3) return playerThird != 8;
        if (bankerTotal == 4) return playerThird >= 2 && playerThird <= 7;
        if (bankerTotal == 5) return playerThird >= 4 && playerThird <= 7;
        if (bankerTotal == 6) return playerThird == 6 || playerThird == 7;
        return false;
    }

    function _baccaratCardValue(uint256 betId, uint256 cardIndex, uint256 seed) internal pure returns (uint8) {
        uint8 rank = uint8(_rng2(betId, 0, cardIndex, seed) % 13);
        if (rank <= 8) return rank + 1;
        return 0;
    }

    function _findSeedPlinkoEdge(uint256 betId) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 16384; seed++) {
            uint8 bucket = _plinkoBucket(betId, seed);
            if (bucket == 0 || bucket == 8) return seed;
        }
        revert("no seed");
    }

    function _plinkoBucket(uint256 betId, uint256 seed) internal pure returns (uint8 bucket) {
        for (uint8 row = 0; row < 8; row++) {
            bucket += uint8(_rng2(betId, 0, uint256(row), seed) & 1);
        }
    }

    function _findSeedSicBoSpecificTriple(uint256 betId, uint8 face) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 65536; seed++) {
            (uint8 a, uint8 b, uint8 c) = _sicBoDice(betId, seed);
            if (a == face && b == face && c == face) return seed;
        }
        revert("no seed");
    }

    function _sicBoDice(uint256 betId, uint256 seed) internal pure returns (uint8 a, uint8 b, uint8 c) {
        a = uint8(_rng2(betId, 0, 0, seed) % 6) + 1;
        b = uint8(_rng2(betId, 0, 1, seed) % 6) + 1;
        c = uint8(_rng2(betId, 0, 2, seed) % 6) + 1;
    }

    function _kenoDraw0(uint256 betId, uint256 seed) internal pure returns (uint40 rolled) {
        uint8[15] memory available;
        for (uint8 i = 0; i < 15;) {
            available[i] = i;
            unchecked {
                ++i;
            }
        }

        uint256 result = 0;
        uint256 remaining = 15;
        for (uint8 i = 0; i < 5;) {
            uint256 r = _rng2(betId, 0, uint256(i), seed);
            uint256 randomIndex = (r % remaining) + uint256(i);
            uint8 selected = available[randomIndex];
            result |= (uint256(1) << selected);
            if (randomIndex != i) {
                available[randomIndex] = available[i];
            }
            unchecked {
                --remaining;
                ++i;
            }
        }
        return uint40(result);
    }
}
