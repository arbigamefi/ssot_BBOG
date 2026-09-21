// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";
import {BaccaratParams} from "../../src/modules/baccarat/BaccaratParams.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
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

        bankA = new Bank(address(assetA), gov, 1000, "LP Share ASTA", "LPA", 18);
        bankB = new Bank(address(assetB), gov, 1000, "LP Share ASTB", "LPB", 18);
        poolRegistry = new PoolRegistry(gov);
        router = new SettlementRouter(address(poolRegistry));
        vrf = new VRFHub(address(this), gov);

        ReferralRegistry refRegistry = new ReferralRegistry(gov);
        DefaultReferralEngine refEngine = new DefaultReferralEngine();

        uint16[6] memory levelBps;
        levelBps[1] = 10_000;

        gameHub = new GameHub(
            address(router),
            address(vrf),
            address(refRegistry),
            address(refEngine),
            gov,
            3600,
            200,
            0,
            10_000,
            10_000,
            3000,
            levelBps,
            2
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
        assetA.approve(address(bankA), type(uint256).max);
        assetB.approve(address(bankB), type(uint256).max);
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
        assertEq(s.PF + s.XP, 0.2 ether, "liabilities follow used turnover, not payout fees");
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
        gameHub.setMaxAffiliateDeltaBps(100);
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

    function _place(
        address player,
        bytes32 gameId,
        uint64 poolId,
        bytes memory params,
        SSOTTypes.StakeSpec memory spec,
        address affiliate
    ) internal returns (uint256 positionId) {
        (uint256 fee,) = gameHub.quoteVRFFee(spec.betCount);
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
