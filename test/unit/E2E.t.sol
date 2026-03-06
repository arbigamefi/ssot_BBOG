// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {BankRegistry} from "../../src/core/BankRegistry.sol";
import {Hub} from "../../src/core/Hub.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {RouletteParams} from "../../src/modules/roulette/RouletteParams.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";
import {KenoParams} from "../../src/modules/keno/KenoParams.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract E2E is Test {
    MockERC20 assetA;
    MockERC20 assetB;

    Bank bankA;
    Bank bankB;

    BankRegistry registry;
    Hub hub;
    VRFHub vrf;

    DiceModule dice;
    CoinTossModule coin;
    RouletteModule roulette;
    KenoModule keno;

    address gov = address(0xA11CE);
    address alice = address(0xBEEF);
    address bob = address(0xB0B);

    bytes32 constant GAME_DICE = keccak256("DICE");
    bytes32 constant GAME_COIN = keccak256("COIN_TOSS");
    bytes32 constant GAME_ROULETTE = keccak256("ROULETTE");
    bytes32 constant GAME_KENO = keccak256("KENO");

    bytes constant RNG_DOMAIN = "SSOT_RNG_V1";

    function setUp() external {
        assetA = new MockERC20("AssetA", "ASTA", 18);
        assetB = new MockERC20("AssetB", "ASTB", 18);

        vrf = new VRFHub(address(this), gov);

        bankA = new Bank(address(assetA), gov, 1000, "LP Share ASTA", "LPA", 18);
        bankB = new Bank(address(assetB), gov, 1000, "LP Share ASTB", "LPB", 18);

        registry = new BankRegistry(gov);

        vm.startPrank(gov);
        registry.registerBank(address(assetA), address(bankA));
        registry.registerBank(address(assetB), address(bankB));
        vm.stopPrank();

        ReferralRegistry refRegistry = new ReferralRegistry(gov);
        DefaultReferralEngine refEngine = new DefaultReferralEngine();

        // initial referral config:
        // - baseBudgetBps=100%
        // - deltaBudgetBps=100%
        // - holdback=30%
        // - L0=0, L1=100% (single upline)
        uint16[6] memory levelBps;
        levelBps[0] = 0;
        levelBps[1] = 10_000;

        hub = new Hub(
            address(registry),
            address(vrf),
            address(refRegistry),
            address(refEngine),
            gov,
            3600,
            200, // defaultHouseEdgeBps = 2%
            0,   // maxAffiliateDeltaBps = 0 => allow up to 100%
            10_000,
            10_000,
            3000,
            levelBps,
            2
        );

        vm.startPrank(gov);
        bankA.setHubOnce(address(hub));
        bankB.setHubOnce(address(hub));
        refRegistry.setBinderOnce(address(hub));

        // lock eligibility threshold and vesting for tests (per asset)
        bankA.setMinPlayerTurnoverForUnlock(20 ether);
        bankA.setHoldbackVestingSeconds(10);
        bankB.setMinPlayerTurnoverForUnlock(20 ether);
        bankB.setHoldbackVestingSeconds(10);
        vm.stopPrank();

        dice = new DiceModule();
        vm.prank(gov);
        hub.registerGame(GAME_DICE, address(dice));

        coin = new CoinTossModule();
        vm.prank(gov);
        hub.registerGame(GAME_COIN, address(coin));

        roulette = new RouletteModule();
        vm.prank(gov);
        hub.registerGame(GAME_ROULETTE, address(roulette));

        keno = new KenoModule();
        vm.prank(gov);
        hub.registerGame(GAME_KENO, address(keno));

        assetA.mint(alice, 1_000 ether);
        assetA.mint(bob, 1_000 ether);
        assetA.mint(gov, 10_000 ether);

        assetB.mint(alice, 1_000 ether);
        assetB.mint(bob, 1_000 ether);
        assetB.mint(gov, 10_000 ether);

        // fund native token for VRF fee payment
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(gov, 100 ether);

        // provide initial liquidity for both assets
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

        vm.startPrank(bob);
        assetA.approve(address(bankA), type(uint256).max);
        assetB.approve(address(bankB), type(uint256).max);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------
    // Helpers (mirror SSOT RNG)
    // ---------------------------------------------------------------------

    function _rng(uint256 betId, uint256 i, uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(RNG_DOMAIN, betId, i, seed)));
    }

    function _vrfFee(uint32 betCount) internal view returns (uint256 fee) {
        (fee, ) = hub.quoteVRFFee(betCount);
    }

    function _rng2(uint256 betId, uint256 i, uint256 j, uint256 seed) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(RNG_DOMAIN, betId, i, j, seed)));
    }

    function _kenoDraw0(uint256 betId, uint256 seed) internal pure returns (uint40 rolled) {
        // Mirror KenoModule._draw for rollIndex=0
        uint8[40] memory available;
        for (uint8 i = 0; i < 40; ) {
            available[i] = i;
            unchecked { ++i; }
        }
        uint256 result = 0;
        uint256 remaining = 40;
        for (uint8 i = 0; i < 10; ) {
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

    function _findSeedKenoHit(uint256 betId, uint40 numbers, bool wantHit) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 16384; seed++) {
            uint40 rolled = _kenoDraw0(betId, seed);
            bool hit = (numbers & rolled) != 0;
            if (hit == wantHit) return seed;
        }
        revert("no seed");
    }

    function _findSeedDiceWin(uint256 betId, uint8 cap) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 2048; seed++) {
            uint256 r = _rng(betId, 0, seed);
            uint256 rolled = (r % 100) + 1;
            if (rolled > cap) return seed;
        }
        revert("no seed");
    }

    function _findSeedDiceLose(uint256 betId, uint8 cap) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 2048; seed++) {
            uint256 r = _rng(betId, 0, seed);
            uint256 rolled = (r % 100) + 1;
            if (rolled <= cap) return seed;
        }
        revert("no seed");
    }

    function _findSeedCoinWin(uint256 betId, bool isTails) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 2048; seed++) {
            uint256 r = _rng(betId, 0, seed);
            bool rolledTails = (r % 2) == 1;
            if (rolledTails == isTails) return seed;
        }
        revert("no seed");
    }

    function _findSeedRouletteHit(uint256 betId, uint256 want) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 8192; seed++) {
            uint256 r = _rng(betId, 0, seed);
            if (r % 37 == want) return seed;
        }
        revert("no seed");
    }

    function _findSeedRouletteMiss(uint256 betId, uint40 numbersMask) internal pure returns (uint256) {
        for (uint256 seed = 0; seed < 8192; seed++) {
            uint256 r = _rng(betId, 0, seed);
            uint256 rolled = r % 37;
            if (((uint256(1) << rolled) & uint256(numbersMask)) == 0) return seed;
        }
        revert("no seed");
    }

    // ---------------------------------------------------------------------
    // Tests
    // ---------------------------------------------------------------------

    function test_place_finalize_win_fee_on_payout_assetA() external {
        // cap=50 => 2x payout on win
        uint8 cap = 50;
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_DICE, address(assetA), abi.encode(cap), spec, address(0), 10_000);
        vm.stopPrank();

        SSOTTypes.Bet memory bet = hub.getBet(betId);
        assertEq(bet.asset, address(assetA));
        assertEq(bet.bank, address(bankA));
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.PendingVRF));

        uint256 seed = _findSeedDiceWin(betId, cap);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(bet.requestId, rw);

        bet = hub.getBet(betId);
        assertEq(uint256(bet.state), uint256(SSOTTypes.BetState.RandomReady));

        uint256 balBefore = assetA.balanceOf(alice);
        hub.finalize(betId);
        uint256 balAfter = assetA.balanceOf(alice);

        // payoutGross = 10 * 100/(100-50) = 20
        // feeOnPayout = 20 * 2% = 0.4; payoutNet = 19.6
        assertEq(balAfter - balBefore, (196 ether) / 10);
    }

    function test_cointoss_win_fee_on_payout_assetB() external {
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_COIN, address(assetB), abi.encode(true), spec, address(0), 10_000); // tails
        vm.stopPrank();

        SSOTTypes.Bet memory bet = hub.getBet(betId);
        assertEq(bet.asset, address(assetB));
        assertEq(bet.bank, address(bankB));

        uint256 seed = _findSeedCoinWin(betId, true);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(bet.requestId, rw);

        uint256 balBefore = assetB.balanceOf(alice);
        hub.finalize(betId);
        uint256 balAfter = assetB.balanceOf(alice);

        // payoutGross = 20; feeOnPayout = 0.4; payoutNet = 19.6
        assertEq(balAfter - balBefore, (196 ether) / 10);
    }

    function test_roulette_single_number_win_fee_on_payout_assetA() external {
        // pick number 7 (bit 7)
        uint40 numbers = uint40(1) << 7;
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_ROULETTE, address(assetA), abi.encode(numbers), spec, address(0), 10_000);
        vm.stopPrank();

        SSOTTypes.Bet memory bet = hub.getBet(betId);

        // reserved should equal stake * 37 / popcount(1) = 370
        assertEq(bet.reserved, 370 ether);

        uint256 seed = _findSeedRouletteHit(betId, 7);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(bet.requestId, rw);

        uint256 balBefore = assetA.balanceOf(alice);
        hub.finalize(betId);
        uint256 balAfter = assetA.balanceOf(alice);

        // payoutGross = 370; feeOnPayout = 370 * 2% = 7.4; payoutNet = 362.6
        assertEq(balAfter - balBefore, (3626 ether) / 10);
    }

    function test_roulette_red_win_fee_on_payout_assetA() external {
        // Typed bet: Red (18 numbers)
        bytes memory params = RouletteParams.encode(RouletteParams.Kind.Red, 0);

        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_ROULETTE, address(assetA), params, spec, address(0), 10_000);
        vm.stopPrank();

        SSOTTypes.Bet memory bet = hub.getBet(betId);
        uint256 expectedGross = Math.mulDiv(10 ether, 37, 18);
        assertEq(bet.reserved, expectedGross);

        // choose a known red number: 7
        uint256 seed = _findSeedRouletteHit(betId, 7);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(bet.requestId, rw);

        uint256 balBefore = assetA.balanceOf(alice);
        hub.finalize(betId);
        uint256 balAfter = assetA.balanceOf(alice);

        uint256 fee = Math.mulDiv(expectedGross, hub.defaultHouseEdgeBps(), 10_000);
        uint256 expectedNet = expectedGross - fee;
        assertEq(balAfter - balBefore, expectedNet);
    }

    function test_roulette_red_lose_no_payout_assetA() external {
        bytes memory params = RouletteParams.encode(RouletteParams.Kind.Red, 0);
        uint40 mask = RouletteParams.redMask();

        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_ROULETTE, address(assetA), params, spec, address(0), 10_000);
        vm.stopPrank();

        SSOTTypes.Bet memory bet = hub.getBet(betId);

        uint256 seed = _findSeedRouletteMiss(betId, mask);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(bet.requestId, rw);

        uint256 balBefore = assetA.balanceOf(alice);
        hub.finalize(betId);
        uint256 balAfter = assetA.balanceOf(alice);

        assertEq(balAfter - balBefore, 0);
    }

    function test_roulette_invalid_street_reverts_assetA() external {
        // street start must be 1,4,7,...,34; start=2 should revert
        bytes memory params = RouletteParams.encode(RouletteParams.Kind.Street, 2);
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 1 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.prank(alice);
        vm.expectRevert("street=start");
        hub.placeBet(GAME_ROULETTE, address(assetA), params, spec, address(0), 10_000);
    }

    function test_refund_detach_late_fulfill_no_effect_assetB() external {
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_DICE, address(assetB), abi.encode(uint8(50)), spec, address(0), 10_000);
        vm.stopPrank();

        SSOTTypes.Bet memory b = hub.getBet(betId);
        // warp past refund timeout
        vm.warp(uint256(b.placedAt) + hub.refundTimeoutSeconds() + 1);
        hub.refund(betId);

        // late fulfill should not mutate refunded bet
        uint256[] memory rw = new uint256[](1);
        rw[0] = 123;
        vrf.fulfillRandomWords(b.requestId, rw);

        SSOTTypes.Bet memory b2 = hub.getBet(betId);
        assertEq(uint256(b2.state), uint256(SSOTTypes.BetState.Refunded));
    }

    function test_skyline_delta_budget_accrues_xp_per_asset_isolated() external {
        // first-touch: alice binds bob
        vm.prank(alice);
        hub.bindReferrer(bob);

        // bob opts into higher house edge (3%) => deltaHE = 1%
        vm.prank(bob);
        hub.setAffiliateHouseEdge(300);

        // place a bet in assetA that LOSES (cap=50, rolled<=50)
        uint8 cap = 50;
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_DICE, address(assetA), abi.encode(cap), spec, bob, 10_000);
        vm.stopPrank();

        SSOTTypes.Bet memory b = hub.getBet(betId);
        uint256 seed = _findSeedDiceLose(betId, cap);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(b.requestId, rw);

        // finalize
        hub.finalize(betId);

        // turnover should accrue only in assetA (10)
        assertEq(bankA.playerTurnover(alice), 10 ether);
        assertEq(bankB.playerTurnover(alice), 0);

        uint256 xpAccA = bankA.xpAccruedOf(bob);
        uint256 xpLockA = bankA.xpLockedOf(bob);
        uint256 xpHoldA = bankA.xpHoldbackOf(bob);

        assertEq(xpAccA, 0);
        assertGt(xpLockA + xpHoldA, 0);

        // ensure assetB remains clean
        assertEq(bankB.xpAccruedOf(bob), 0);
        assertEq(bankB.xpLockedOf(bob), 0);
        assertEq(bankB.xpHoldbackOf(bob), 0);
    }

    function test_keno_single_pick_hit_fee_on_payout_assetA() external {
        // Select a single number (played=1).
        // If hit: factor=20000 => 2x payout gross.
        uint40 numbers = uint40(1) << 5;
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_KENO, address(assetA), KenoParams.encode(numbers), spec, address(0), 10_000);
        vm.stopPrank();

        SSOTTypes.Bet memory bet = hub.getBet(betId);
        assertEq(bet.reserved, 20 ether);

        uint256 seed = _findSeedKenoHit(betId, numbers, true);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(bet.requestId, rw);

        uint256 balBefore = assetA.balanceOf(alice);
        hub.finalize(betId);
        uint256 balAfter = assetA.balanceOf(alice);

        // payoutGross = 20, fee=0.4, payoutNet=19.6
        assertEq(balAfter - balBefore, (196 ether) / 10);
    }

    function test_keno_invalid_numbers_revert() external {
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 1 ether,
            betCount: 1,
            stopGain: 0,
            stopLoss: 0
        });

        vm.startPrank(alice);
        vm.expectRevert();
        hub.placeBet(GAME_KENO, address(assetA), KenoParams.encode(0), spec, address(0), 10_000);
        vm.stopPrank();
    }

    function test_cointoss_multiroll_stopgain_refund_turnover_assetB() external {
        // 5 rolls escrowed, but stopGain triggers after first win (profit>=10)
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: 10 ether,
            betCount: 5,
            stopGain: 10 ether,
            stopLoss: 0
        });

        vm.startPrank(alice);
        uint256 betId = hub.placeBet{value: _vrfFee(spec.betCount)}(GAME_COIN, address(assetB), abi.encode(true), spec, address(0), 10_000);
        vm.stopPrank();

        SSOTTypes.Bet memory bet = hub.getBet(betId);
        assertEq(bet.stake, 50 ether);
        assertEq(bet.reserved, 100 ether);

        // choose seed so first roll is tails => win => profit=10 => stop
        uint256 seed = _findSeedCoinWin(betId, true);
        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;
        vrf.fulfillRandomWords(bet.requestId, rw);

        uint256 balBefore = assetB.balanceOf(alice);
        hub.finalize(betId);
        uint256 balAfter = assetB.balanceOf(alice);

        // payoutGross = 20 (one win), fee = 0.4, payoutNet = 19.6; refund = 40
        assertEq(balAfter - balBefore, 40 ether + (196 ether) / 10);

        // turnover uses usedTurnover (one roll) not stake (five rolls)
        assertEq(bankB.playerTurnover(alice), 10 ether);
    }
}
