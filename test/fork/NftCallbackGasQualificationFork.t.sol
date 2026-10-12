// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {IReferralRegistry} from "../../src/engines/referral/IReferralRegistry.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";
import {PlinkoModule} from "../../src/modules/plinko/PlinkoModule.sol";
import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {SicBoModule} from "../../src/modules/sicbo/SicBoModule.sol";
import {SlotsModule} from "../../src/modules/slots/SlotsModule.sol";
import {ITreeView, PrefixPath} from "../utils/PrefixPath.sol";

interface INftGasWrapper {
    function s_vrfCoordinator() external view returns (address);
    function s_callbacks(uint256 requestId) external view returns (address, uint32, uint64);
    function getConfig()
        external
        view
        returns (int256, uint32, uint32, uint32, uint32, uint32, uint32, uint16, uint8, uint8, bytes32, uint8);
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata words) external;
}

interface INftGasCoordinator {
    function s_config() external view returns (uint16, uint32, bool, uint32, uint32, uint32, uint32, uint8, uint8);
}

interface INftGasUsdc is IERC20Metadata {
    function blacklister() external view returns (address);
    function blacklist(address account) external;
    function isBlacklisted(address account) external view returns (bool);
}

/// @notice Actual production core, deployed wrapper bytecode and deployed USDC, executed ONLY on a local fork.
/// @dev Every invocation prepares ONE case in setUp and fulfills in the independent test transaction.
///      A matrix runner must invoke this test separately per case: same-test loops would introduce dirty
///      storage discounts. NFT_GAS_QUALIFICATION_FORK opts in; enabled RPC/semantic failures are fatal.
///      Uses a pinned observed block/hash (2026-10-04 UTC); no network broadcast, proof verification,
///      coordinator billing or oracle delivery SLA is claimed. Warps in setUp create matured LP/XP state.
///      Sampled full callback successes are lower-bound evidence of required gas, NEVER a worst-case proof.
contract NftCallbackGasQualificationForkTest is Test {
    /// Binds through ReferralRegistry, which requires the player as caller (GameHub keeps no forwarder).
    function _bindReferrer(GameHub target, address player, address referrer) internal {
        IReferralRegistry referrals = IReferralRegistry(target.referralRegistry());
        vm.prank(player);
        referrals.bind(player, referrer);
    }

    uint256 private constant PINNED_BLOCK = 47_657_524;
    bytes32 private constant PINNED_HASH = 0x5a75e3c5fbaaa54dd1e67075af773668d43757b4e5de71f788ee69837650b872;
    address private constant WRAPPER = 0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed;
    address private constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address private constant GOV = address(0xA11CE);
    address private constant PLAYER = address(0xBEEF);
    uint48 private constant FIRST_LEAF = 1 << 40;
    uint40 private constant ONE = 1e12;
    uint256 private constant UNIT = 1e6;
    bytes32 private constant AWARD_TOPIC =
        keccak256("XPAwarded(uint256,address,address,uint256,uint256,uint256,bytes32)");

    INftGasUsdc private token;
    INftGasWrapper private wrapper;
    address private coordinator;
    address private tokenImplementation;
    Bank private bank;
    LiquidityVault private vault;
    SettlementRouter private router;
    VRFHub private consumer;
    GameHub private hub;
    DefaultReferralEngine private engine;
    IGameModule private module;
    bytes32 private gameId;
    bytes private params;
    SSOTTypes.StakeSpec private spec;
    uint32 private consumerGas;
    uint32 private wrapperGas;
    uint256 private game;
    uint256 private variant;
    uint256 private variant2;
    uint256 private seed;
    uint256 private treeMode;
    uint256 private oldLeaves;
    uint256 private lateLeaves;
    uint48 private targetCutoff;
    uint48 private denseCutoff;
    uint48 private denseLastUsed;
    uint48 private tailDepositId;
    uint48[] private denseDepositIds;
    bool private thinPrefix;
    bool private thinPrefixProfit;
    bool private blocked;
    bool private priorHoldback;
    bool private priorNewSourceHeld;
    bool private eligible;
    bool private zeroPlayerBalance;
    uint256 private amountProfile;
    uint256 private setupProfitSeed;
    uint256 private cutoffRetain;
    uint256 private expectPredicate;
    uint256 private lateLargeUsdc;
    uint256 private setupCallbackFailures;
    bool private secondHold;
    bool private disableGame;
    uint256 private secondBetId;
    uint256 private secondStake;
    uint256 private secondReserved;
    uint256 private betId;
    uint256 private requestId;
    uint256 private expectedGross;
    uint256 private expectedRefund;
    uint256 private expectedNet;
    uint256 private beforeFees;
    uint256 private beforeTurnover;
    uint256 private beforeSettled;
    uint256 private beforePlayer;
    uint256 private beforeRoot;
    uint256 private beforeRefunded;
    uint256 private beforeL1Holdback;
    uint256 private beforeL2Holdback;

    function setUp() public {
        if (!vm.envOr("NFT_GAS_QUALIFICATION_FORK", false)) return;
        uint256 target = vm.envOr("NFT_GAS_BLOCK", PINNED_BLOCK);
        require(target == PINNED_BLOCK, "refresh pinned block AND hash in reviewed fixture together");
        vm.createSelectFork(vm.envString("NFT_GAS_RPC_URL"), target);
        assertEq(block.chainid, 84_532);
        assertEq(block.number, PINNED_BLOCK);
        // BLOCKHASH excludes the current block; temporarily advance locally to authenticate it.
        vm.roll(PINNED_BLOCK + 1);
        assertEq(blockhash(PINNED_BLOCK), PINNED_HASH, "pinned fork block identity");
        vm.roll(PINNED_BLOCK);
        game = vm.envOr("NFT_GAS_GAME", uint256(0));
        // 0 Keno, 1 Plinko, 2 Baccarat, 3 Coin, 4 Dice, 5 Roulette, 6 SicBo, 7 Slots.
        uint256[8] memory defaults = [uint256(31), 1, 2, 1, 99, 13, 6, 0];
        require(game < defaults.length, "unknown game");
        variant = vm.envOr("NFT_GAS_VARIANT", defaults[game]);
        variant2 = vm.envOr("NFT_GAS_VARIANT2", game == 6 ? uint256(2) : uint256(0));
        uint256 rounds = vm.envOr("NFT_GAS_ROUNDS", uint256(25));
        require(rounds > 0 && rounds <= 25 && UNIT % rounds == 0, "invalid matrix input");
        seed = vm.envOr("NFT_GAS_SEED", uint256(12345));
        treeMode = vm.envOr("NFT_GAS_TREE", uint256(1)); // 3/4 are compressed structural histories, not live attack claims.
        oldLeaves = vm.envOr("NFT_GAS_OLD_LEAVES", uint256(255));
        lateLeaves = vm.envOr("NFT_GAS_LATE_LEAVES", uint256(256));
        require(treeMode <= 4 && oldLeaves > 0 && oldLeaves <= 1023 && lateLeaves <= 1024);
        thinPrefix = vm.envOr("NFT_GAS_THIN_PREFIX", false);
        thinPrefixProfit = vm.envOr("NFT_GAS_THIN_PREFIX_PROFIT", false);
        require(!thinPrefixProfit || thinPrefix, "profit range case requires a thin prefix");
        require(!thinPrefix || treeMode == 4, "thin structural prefix requires TREE4");
        if (treeMode == 4) _prepareDenseDepositPlan();
        if (treeMode == 3) {
            require(oldLeaves == 1 && lateLeaves == 1, "compressed history requires two real final leaves");
        }
        blocked = vm.envOr("NFT_GAS_BLACKLIST", false);
        priorHoldback = vm.envOr("NFT_GAS_PRIOR_HOLDBACK", false);
        priorNewSourceHeld = vm.envOr("NFT_GAS_PRIOR_NEW_SOURCE_HELD", false);
        eligible = vm.envOr("NFT_GAS_ELIGIBLE", false);
        require(
            !priorNewSourceHeld || (!priorHoldback && !eligible),
            "new-source held case requires a fresh ineligible player"
        );
        zeroPlayerBalance = vm.envOr("NFT_GAS_ZERO_PLAYER_BALANCE", true);
        // 0 keeps the uniform deposits above. 1 is the concentrated loss witness: 5-raw NFTs, one large cutoff
        // NFT and one large last NFT, a large real historical Coin profit, and fresh target reward/fee slots.
        amountProfile = vm.envOr("NFT_GAS_AMOUNT_PROFILE", uint256(0));
        cutoffRetain = vm.envOr("NFT_GAS_CUTOFF_RETAIN", uint256(0)); // parts of ONE kept in the cutoff NFT
        expectPredicate = vm.envOr("NFT_GAS_EXPECT_PREDICATE", uint256(0)); // 1 all splits cover, 2 all splits reject
        lateLargeUsdc = vm.envOr("NFT_GAS_LATE_LARGE_USDC", uint256(1_000_000));
        // Launch candidate: a second open hold of the same player (its Bank slot goes 2 -> 1 at settlement) and a game
        // disabled after the target bet was accepted (the callback must still settle it).
        secondHold = vm.envOr("NFT_GAS_SECOND_HOLD", false);
        disableGame = vm.envOr("NFT_GAS_DISABLE_GAME", false);
        require(!secondHold || (treeMode <= 2 && amountProfile == 0), "second hold keeps the uniform deposit tree");
        require(amountProfile <= 1 && expectPredicate <= 2 && cutoffRetain < ONE, "amount profile input");
        require(
            amountProfile == 0 || (treeMode == 4 && !thinPrefix && !priorHoldback && !priorNewSourceHeld && game != 3),
            "concentrated amounts need the dense tree, fresh reward slots and a distinct historical Coin game"
        );
        require(cutoffRetain == 0 || amountProfile == 1, "cutoff retention belongs to the concentrated profile");
        require(expectPredicate == 0 || cutoffRetain != 0, "full predicate witness needs an explicit cutoff retention");
        // Each accepted encoding is 64 bytes; one-word modules have a nonzero ignored tail.
        if (game == 4) {
            require(variant2 <= 1, "dice direction");
            params = abi.encode(variant2 == 1, uint8(variant));
        } else if (game == 5 || game == 6) {
            params = abi.encode(uint8(variant), variant2);
        } else {
            params = abi.encode(variant, bytes32(uint256(0xDEAD)));
        }
        spec = SSOTTypes.StakeSpec(
            UNIT / rounds,
            uint32(rounds),
            vm.envOr("NFT_GAS_STOP_GAIN", uint256(type(uint256).max)),
            vm.envOr("NFT_GAS_STOP_LOSS", uint256(type(uint256).max))
        );
        consumerGas = uint32(vm.envOr("NFT_GAS_CALLBACK", uint256(2_447_746)));
        _deploy();
        _fundAndRefer();
        if (priorHoldback) {
            _preparePriorHoldback();
        }
        if (priorNewSourceHeld) _preparePriorNewSourceHeld();
        betId = _place(spec);
        requestId = hub.getBet(betId).requestId;
        if (secondHold) {
            secondBetId = _place(spec);
            (, secondStake, secondReserved,,) = bank.holds(secondBetId);
            assertEq(bank.openHoldsOf(PLAYER), 2, "the player holds the maximum two positions");
        }
        if (disableGame) {
            vm.prank(GOV);
            hub.disableGame(gameId);
            assertTrue(hub.gameDisabled(gameId));
            vm.expectRevert(abi.encodeWithSelector(IGameHub.GameIsDisabled.selector, gameId));
            hub.quoteVRFFee(gameId, spec.betCount, 2 gwei);
        }
        (,,, targetCutoff,) = bank.holds(betId);
        if (treeMode == 4) assertEq(targetCutoff, denseCutoff, "target snapshots the specified dense cutoff");
        uint256[] memory words = _words(seed);
        (expectedGross, expectedRefund) = module.resolve(params, spec, betId, words);
        uint256 edge = hub.getBet(betId).houseEdgeBps;
        expectedNet = expectedGross - expectedGross * edge / 10_000;
        require(!blocked || expectedNet + expectedRefund > 0, "blacklist case must actually owe player");
        if (amountProfile == 1) {
            require(
                expectedNet + expectedRefund + ((UNIT - expectedRefund) * edge / 10_000) / 2 > UNIT,
                "concentrated witness seed must produce an LP loss"
            );
        }
        _prepareLateTree();
        beforeFees = bank.protocolFeesPayable() + bank.externalPayablesTotal();
        beforeTurnover = bank.playerTurnover(PLAYER);
        beforeSettled = bank.totalBetsSettled();
        beforeRefunded = bank.totalRefunded();
        if (priorNewSourceHeld) {
            assertEq(beforeTurnover, 0, "target player has no previous turnover");
            assertEq(bank.xpAccruedTotal(), 0, "old immediate XP was claimed before maturity");
            assertEq(bank.xpLockedTotal(), 0, "old eligible player created no locked XP");
            beforeL1Holdback = bank.xpHoldbackOf(address(0xAA00));
            beforeL2Holdback = bank.xpHoldbackOf(address(0xAA01));
            assertGt(beforeL1Holdback, 0);
            assertGt(beforeL2Holdback, 0);
            assertEq(bank.xpLockedBySource(address(0xAA00), PLAYER), 0);
            assertEq(bank.xpLockedBySource(address(0xAA01), PLAYER), 0);
        }
        if (zeroPlayerBalance) {
            uint256 remainder = token.balanceOf(PLAYER);
            vm.prank(PLAYER);
            token.transfer(address(0xDEADCAFE), remainder);
        }
        if (blocked) {
            address blacklister = token.blacklister();
            vm.prank(blacklister);
            token.blacklist(PLAYER);
            assertTrue(token.isBlacklisted(PLAYER));
        }
        beforePlayer = token.balanceOf(PLAYER);
        beforeRoot = vault.getReserve();
        if (expectPredicate != 0) _assertFullPredicate(expectPredicate == 1);
        assertEq(consumer.unbookedResultCount(address(bank)), 0);
        assertEq(consumer.getRequest(requestId).seed, 0);
        assertEq(uint8(consumer.getRequest(requestId).state), uint8(IVRFHub.RequestState.Awaiting));
    }

    function _deploy() private {
        token = INftGasUsdc(USDC);
        wrapper = INftGasWrapper(WRAPPER);
        coordinator = wrapper.s_vrfCoordinator();
        // Circle's deployed legacy proxy stores its delegate target in this named slot.
        tokenImplementation = address(uint160(uint256(vm.load(USDC, keccak256("org.zeppelinos.proxy.implementation")))));
        require(tokenImplementation.code.length != 0, "USDC delegate target must be cooled as well as proxy");
        assertEq(token.decimals(), 6);
        (,,,, uint32 overhead,,,,,,,) = wrapper.getConfig();
        (, uint32 maximum,,,,,,,) = INftGasCoordinator(coordinator).s_config();
        uint256 expanded = uint256(consumerGas) + consumerGas / 63 + 1 + overhead;
        assertEq(overhead, 13_400);
        assertEq(maximum, 2_500_000);
        assertLe(expanded, maximum, "actual provider consumer envelope");
        wrapperGas = uint32(expanded);
        PoolRegistry registry = new PoolRegistry(GOV);
        router = new SettlementRouter(address(registry));
        consumer = new VRFHub(WRAPPER, address(router));
        bank = new Bank(USDC, GOV, 6000, 6, 10_000);
        vault = LiquidityVault(bank.vault());
        ReferralRegistry refs = new ReferralRegistry(GOV);
        engine = new DefaultReferralEngine();
        if (game == 0) {
            gameId = keccak256("KENO");
            module = new KenoModule();
        } else if (game == 1) {
            gameId = keccak256("PLINKO");
            module = new PlinkoModule();
        } else if (game == 2) {
            gameId = keccak256("BACCARAT");
            module = new BaccaratModule();
        } else if (game == 3) {
            gameId = keccak256("COIN_TOSS");
            module = new CoinTossModule();
        } else if (game == 4) {
            gameId = keccak256("DICE");
            module = new DiceModule();
        } else if (game == 5) {
            gameId = keccak256("ROULETTE");
            module = new RouletteModule();
        } else if (game == 6) {
            gameId = keccak256("SIC_BO");
            module = new SicBoModule();
        } else {
            gameId = keccak256("SLOTS");
            module = new SlotsModule();
        }
        hub = new GameHub(
            address(router), address(consumer), address(refs), address(engine), GOV, 3600, 200, 1000, 2000, 500, 3000
        );
        vm.startPrank(GOV);
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(consumer));
        bank.setMinPlayerTurnoverForUnlock(eligible ? 0 : 10_000 * UNIT);
        registry.registerPool(1, USDC, address(bank), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(address(hub), true);
        registry.setHubAllowedForPool(1, address(hub), true);
        refs.setBinderOnce(address(hub));
        hub.registerGame(gameId, address(module), 25, consumerGas);
        vm.stopPrank();
        vm.txGasPrice(1 gwei);
    }

    function _fundAndRefer() private {
        _bindReferrer(hub, address(0xAA00), address(0xAA01));
        deal(USDC, GOV, (amountProfile == 1 ? 12_000_000 + lateLargeUsdc : 10_000_000) * UNIT);
        deal(USDC, PLAYER, 100 * UNIT);
        vm.deal(PLAYER, 100 ether);
        vm.prank(PLAYER);
        token.approve(address(hub), type(uint256).max);
        if (treeMode == 3) {
            // Same explicit compression as NftTreeGasBounds: skip only an empty mint/burn prefix.
            // The two funded NFTs and both bets below are created through production public APIs.
            // This is structural lifecycle evidence, NOT an executed trillion-deposit history.
            uint64 simulatedUpdates = uint64(1 + 3 * (uint256(FIRST_LEAF) - 2));
            vm.store(
                address(vault), bytes32(0), bytes32(uint256(2 * FIRST_LEAF - 2) | (uint256(simulatedUpdates) << 48))
            );
            assertEq(vault.nextNode(), 2 * FIRST_LEAF - 2);
            assertEq(vault.updateId(), simulatedUpdates);
        }
        vm.startPrank(GOV);
        token.approve(address(vault), type(uint256).max);
        for (uint256 i; i < oldLeaves; ++i) {
            if (treeMode == 4) _skipEmptyHistoryTo(denseDepositIds[i]);
            uint256 amount =
                amountProfile == 1 ? (i + 1 == oldLeaves ? 2_000_000 * UNIT : 5) : (treeMode >= 3 ? 2000 : 1000) * UNIT;
            uint48 id = vault.addDeposit(amount);
            if (treeMode == 4) assertEq(id, denseDepositIds[i]);
        }
        vm.stopPrank();
        vm.warp(block.timestamp + 1 days);
    }

    /// @dev Structural fixture only: it does not claim the skipped histories were executed.
    ///      Two paths contribute at most 40 sibling representatives each, plus both endpoints.
    function _prepareDenseDepositPlan() private {
        uint256 cutoff = vm.envOr("NFT_GAS_CUTOFF", uint256(2 * FIRST_LEAF - 1 - 16_383));
        uint256 lastUsed = vm.envOr("NFT_GAS_LAST_USED", uint256(2 * FIRST_LEAF - 1 - 8_191));
        require(cutoff >= FIRST_LEAF && cutoff < lastUsed && lastUsed < 2 * FIRST_LEAF, "dense leaf bounds");
        denseCutoff = uint48(cutoff);
        denseLastUsed = uint48(lastUsed);
        uint48[82] memory candidates;
        candidates[0] = denseCutoff;
        candidates[1] = denseLastUsed;
        uint256 count = _appendSiblingLeaves(candidates, 2, denseCutoff, denseLastUsed);
        count = _appendSiblingLeaves(candidates, count, denseLastUsed, denseLastUsed);
        for (uint256 i = 1; i < count; ++i) {
            uint48 value = candidates[i];
            uint256 j = i;
            while (j > 0 && candidates[j - 1] > value) {
                candidates[j] = candidates[j - 1];
                --j;
            }
            candidates[j] = value;
        }
        oldLeaves = 0;
        lateLeaves = 0;
        for (uint256 i; i < count; ++i) {
            uint48 id = candidates[i];
            if (i > 0 && id == candidates[i - 1]) continue;
            denseDepositIds.push(id);
            if (id <= denseCutoff) ++oldLeaves;
            else ++lateLeaves;
        }
        require(oldLeaves > 0 && lateLeaves > 0 && denseDepositIds[oldLeaves - 1] == denseCutoff);
    }

    function _appendSiblingLeaves(uint48[82] memory candidates, uint256 count, uint48 leaf, uint48 lastUsed)
        private
        pure
        returns (uint256)
    {
        uint48 start = FIRST_LEAF;
        uint48 end = 2 * FIRST_LEAF - 1;
        while (start < end) {
            uint48 mid = (start + end) / 2;
            if (leaf <= mid) {
                if (mid + 1 <= lastUsed) candidates[count++] = mid + 1;
                end = mid;
            } else {
                candidates[count++] = start;
                start = mid + 1;
            }
        }
        return count;
    }

    /// @dev Skip only IDs/counter updates. All nonzero amounts arise from real deposits and settlements.
    ///      Omitted empty-leaf slots make this a structural pressure fixture, not a whole-history proof.
    function _skipEmptyHistoryTo(uint48 nextId) private {
        uint48 current = vault.nextNode();
        require(nextId >= current, "structural leaf IDs must increase");
        uint256 updates = uint256(vault.updateId()) + 3 * uint256(nextId - current);
        require(updates <= type(uint64).max, "structural update bound");
        vm.store(address(vault), bytes32(0), bytes32(uint256(nextId) | (updates << 48)));
        assertEq(vault.nextNode(), nextId);
        assertEq(vault.updateId(), updates);
    }

    function _place(SSOTTypes.StakeSpec memory stakeSpec) private returns (uint256 id) {
        (uint256 fee,) = hub.quoteVRFFee(gameId, stakeSpec.betCount, 2 gwei);
        vm.prank(PLAYER);
        id = hub.placeBet{value: fee}(gameId, 1, params, stakeSpec, address(0xAA00), 10_000);
        (address callback, uint32 gasLimit,) = wrapper.s_callbacks(hub.getBet(id).requestId);
        assertEq(callback, address(consumer));
        assertEq(gasLimit, consumerGas);
    }

    function _preparePriorHoldback() private {
        uint256 warmup = _place(SSOTTypes.StakeSpec(UNIT, 1, type(uint256).max, type(uint256).max));
        uint256 warmupRequest = hub.getBet(warmup).requestId;
        vm.prank(coordinator);
        wrapper.rawFulfillRandomWords{gas: wrapperGas}(warmupRequest, _words(seed));
        if (consumer.getRequest(warmupRequest).state != IVRFHub.RequestState.Terminal) {
            ++setupCallbackFailures; // a setup history callback missed the same first-callback budget
            consumer.retry{gas: 8_000_000}(warmupRequest);
        }
        assertEq(uint8(hub.getBet(warmup).state), uint8(SSOTTypes.BetState.Settled));
        assertGt(bank.xpHoldbackTotal(), 0);
        vm.warp(block.timestamp + bank.holdbackVestingSeconds() + 1);
    }

    /// @dev Public-API history: eligible A leaves holdback, claims immediate XP, then fresh B
    ///      shares the two referrers while ineligible. Only B's callback is measured separately.
    function _preparePriorNewSourceHeld() private {
        address oldPlayer = address(0xBAD0);
        uint256 targetThreshold = bank.minPlayerTurnoverForUnlock();
        vm.prank(GOV);
        bank.setMinPlayerTurnoverForUnlock(0);
        deal(USDC, oldPlayer, 100 * UNIT);
        vm.deal(oldPlayer, 100 ether);
        (uint256 fee,) = hub.quoteVRFFee(gameId, 1, 2 gwei);
        vm.startPrank(oldPlayer);
        token.approve(address(hub), UNIT);
        uint256 warmup = hub.placeBet{value: fee}(
            gameId,
            1,
            params,
            SSOTTypes.StakeSpec(UNIT, 1, type(uint256).max, type(uint256).max),
            address(0xAA00),
            10_000
        );
        vm.stopPrank();
        uint256 warmupRequest = hub.getBet(warmup).requestId;
        vm.prank(coordinator);
        wrapper.rawFulfillRandomWords{gas: wrapperGas}(warmupRequest, _words(seed));
        if (consumer.getRequest(warmupRequest).state != IVRFHub.RequestState.Terminal) {
            ++setupCallbackFailures; // a setup history callback missed the same first-callback budget
            consumer.retry{gas: 8_000_000}(warmupRequest);
        }
        assertEq(uint8(hub.getBet(warmup).state), uint8(SSOTTypes.BetState.Settled));
        address[3] memory oldPayees = [oldPlayer, address(0xAA00), address(0xAA01)];
        for (uint256 i; i < oldPayees.length; ++i) {
            uint256 accrued = bank.xpAccruedOf(oldPayees[i]);
            assertGt(accrued, 0, "old eligible allocation has immediate XP");
            vm.prank(oldPayees[i]);
            bank.claimXPAccrued(accrued, oldPayees[i]);
        }
        assertEq(bank.xpAccruedTotal(), 0);
        assertEq(bank.xpLockedTotal(), 0);
        assertGt(bank.xpHoldbackOf(address(0xAA00)), 0);
        assertGt(bank.xpHoldbackOf(address(0xAA01)), 0);
        vm.prank(GOV);
        bank.setMinPlayerTurnoverForUnlock(targetThreshold);
        vm.warp(block.timestamp + bank.holdbackVestingSeconds() + 1);
    }

    function _prepareLateTree() private {
        vm.startPrank(GOV);
        for (uint256 i; i < lateLeaves; ++i) {
            if (treeMode == 4) _skipEmptyHistoryTo(denseDepositIds[oldLeaves + i]);
            uint256 amount = amountProfile == 1
                ? (i + 1 == lateLeaves ? lateLargeUsdc * UNIT : 5)
                : (treeMode >= 3 ? 2000 : 1000) * UNIT;
            tailDepositId = vault.addDeposit(amount);
            if (treeMode == 4) assertEq(tailDepositId, denseDepositIds[oldLeaves + i]);
        }
        if (thinPrefix) {
            for (uint256 i; i < oldLeaves; ++i) {
                uint48 id = denseDepositIds[i];
                assertEq(vault.ownerOf(id), GOV, "real owner withdraws each old NFT");
                assertGe(block.timestamp, vault.withdrawAfter(id), "old NFT is mature");
                vault.withdrawDeposit(id, ONE - 1);
                assertEq(vault.nodeWithdrawView(id), 1, "one base unit retained per old NFT");
            }
        }
        if (treeMode == 1 || treeMode == 2) {
            require(lateLeaves > 0, "late capital must cover pending risk");
            for (uint256 i; i < oldLeaves; ++i) {
                vault.withdrawDeposit(FIRST_LEAF + uint48(i), i == 0 && treeMode == 1 ? ONE - 1 : ONE);
            }
            assertEq(vault.nodeWithdrawView(FIRST_LEAF), treeMode == 1 ? 1 : 0);
        }
        vm.stopPrank();
        if (cutoffRetain != 0) {
            vm.prank(GOV);
            vault.withdrawDeposit(denseCutoff, uint40(ONE - cutoffRetain));
        }
        if (treeMode >= 3) _prepareWholeTreeProfit();
        if (thinPrefix) {
            uint256 prefixAssets;
            for (uint256 i; i < oldLeaves; ++i) {
                prefixAssets += vault.nodeWithdrawView(denseDepositIds[i]);
            }
            uint256 expectedFees = ((UNIT - expectedRefund) * hub.getBet(betId).houseEdgeBps / 10_000) / 2;
            uint256 expectedCost = expectedNet + expectedRefund + expectedFees;
            assertGt(prefixAssets, 0, "old prefix remains nonempty after the real lazy profit");
            if (thinPrefixProfit) {
                (, uint256 stake, uint256 reserved,,) = bank.holds(betId);
                assertLt(expectedCost, UNIT, "H1 profit case must generate positive LP PnL");
                assertLt(prefixAssets, reserved - stake, "H1 maximum-loss rule must select the whole tree");
            } else {
                assertGt(expectedCost, UNIT, "thin-prefix case must generate a pool loss");
                assertLt(
                    prefixAssets, expectedCost - UNIT, "old prefix cannot fund this loss; whole-range fallback required"
                );
                assertLt(
                    oldLeaves + UNIT,
                    expectedCost - UNIT,
                    "even allocating all setup profit to old NFTs cannot cover loss"
                );
            }
        }
    }

    function _prepareWholeTreeProfit() private {
        if (amountProfile == 1) {
            _prepareLargeHistoricalProfit();
            return;
        }
        address other = address(0xCAFE);
        deal(USDC, other, UNIT);
        vm.deal(other, 1 ether);
        SSOTTypes.StakeSpec memory priorSpec = SSOTTypes.StakeSpec(UNIT, 1, type(uint256).max, type(uint256).max);
        (uint256 fee,) = hub.quoteVRFFee(gameId, 1, 2 gwei);
        vm.startPrank(other);
        token.approve(address(hub), UNIT);
        uint256 prior = hub.placeBet{value: fee}(gameId, 1, params, priorSpec, address(0), 200);
        vm.stopPrank();
        uint256 profitSeed;
        uint256 priorNet;
        uint256 priorFee = UNIT * 200 / 10_000 / 2;
        bool found;
        for (; profitSeed < 1024; ++profitSeed) {
            (uint256 gross, uint256 refund) = module.resolve(params, priorSpec, prior, _words(profitSeed));
            priorNet = gross - gross * 200 / 10_000;
            if (refund == 0 && priorNet + priorFee < UNIT) {
                found = true;
                break;
            }
        }
        require(found, "fixture must find an actual pool-profit result");
        uint256 rootBefore = vault.getReserve();
        uint256 priorRequest = hub.getBet(prior).requestId;
        vm.prank(coordinator);
        wrapper.rawFulfillRandomWords{gas: wrapperGas}(priorRequest, _words(profitSeed));
        if (consumer.getRequest(priorRequest).state != IVRFHub.RequestState.Terminal) {
            ++setupCallbackFailures; // a setup history callback missed the same first-callback budget
            consumer.retry{gas: 12_000_000}(priorRequest);
        }
        assertEq(uint8(hub.getBet(prior).state), uint8(SSOTTypes.BetState.Settled));
        assertEq(vault.getReserve(), rootBefore + UNIT - priorNet - priorFee);
        assertEq(bank.pendingStakeTotal(), UNIT, "only the target remains pending");
        assertEq(
            vault.nextNode(),
            treeMode == 3 ? 2 * FIRST_LEAF : denseLastUsed + 1,
            "real deposits end at the specified structural endpoint"
        );
    }

    /// @dev Concentrated profile: one real historical Coin settlement at 24.9% of the reserve leaves a large lazy
    ///      profit over every used leaf. Its own XP and the protocol fees are then claimed, so the target's
    ///      reward and fee records start from zero.
    function _prepareLargeHistoricalProfit() private {
        address other = address(0xCAFE);
        bytes32 priorGame = keccak256("COIN_TOSS");
        CoinTossModule priorModule = new CoinTossModule();
        vm.prank(GOV);
        hub.registerGame(priorGame, address(priorModule), 25, consumerGas);
        uint256 largeStake = uint256(vault.getReserve()) * 249 / 1000;
        deal(USDC, other, largeStake);
        vm.deal(other, 1 ether);
        bytes memory priorParams = abi.encode(uint8(0));
        SSOTTypes.StakeSpec memory priorSpec = SSOTTypes.StakeSpec(largeStake, 1, type(uint256).max, type(uint256).max);
        (uint256 fee,) = hub.quoteVRFFee(priorGame, 1, 2 gwei);
        vm.startPrank(other);
        token.approve(address(hub), largeStake);
        uint256 prior = hub.placeBet{value: fee}(priorGame, 1, priorParams, priorSpec, address(0), 200);
        vm.stopPrank();
        uint256 priorFee = largeStake * 200 / 10_000 / 2;
        // The setup result is part of the case: PROFIT_SEED, recorded in the case file, must leave the pool a profit.
        if (!vm.envExists("NFT_GAS_PROFIT_SEED")) _recordProfitSeed(priorModule, priorParams, priorSpec, prior, priorFee);
        setupProfitSeed = vm.envUint("NFT_GAS_PROFIT_SEED");
        (bool profit, uint256 priorNet) =
            _poolProfit(priorModule, priorParams, priorSpec, prior, priorFee, setupProfitSeed);
        if (!profit) _recordProfitSeed(priorModule, priorParams, priorSpec, prior, priorFee);
        uint256 rootBefore = vault.getReserve();
        uint256 priorRequest = hub.getBet(prior).requestId;
        vm.prank(coordinator);
        wrapper.rawFulfillRandomWords{gas: wrapperGas}(priorRequest, _words(setupProfitSeed));
        if (consumer.getRequest(priorRequest).state != IVRFHub.RequestState.Terminal) {
            ++setupCallbackFailures; // a setup history callback missed the same first-callback budget
            consumer.retry{gas: 12_000_000}(priorRequest);
        }
        assertEq(uint8(hub.getBet(prior).state), uint8(SSOTTypes.BetState.Settled));
        assertEq(vault.getReserve(), rootBefore + largeStake - priorNet - priorFee);
        assertEq(bank.pendingStakeTotal(), UNIT, "only the target remains pending");
        uint256 oldAccrued = bank.xpAccruedOf(other);
        if (oldAccrued != 0) {
            vm.prank(other);
            bank.claimXPAccrued(oldAccrued, other);
        }
        uint256 priorFees = bank.protocolFeesPayable();
        vm.prank(GOV);
        bank.claimProtocolFees(priorFees, GOV);
        assertEq(bank.xpAccruedTotal(), 0);
        assertEq(vault.nextNode(), denseLastUsed + 1, "real deposits end at the specified structural endpoint");
    }

    /// @dev Whether `seed` settles the setup bet as a pool profit, and its net payout.
    function _poolProfit(
        IGameModule m,
        bytes memory p,
        SSOTTypes.StakeSpec memory s,
        uint256 bet,
        uint256 setupFee,
        uint256 seed
    ) private view returns (bool profit, uint256 net) {
        (uint256 gross, uint256 refund) = m.resolve(p, s, bet, _words(seed));
        net = gross - gross * 200 / 10_000;
        profit = refund == 0 && net + setupFee < s.amountPerRoll;
    }

    /// @dev Stops the case and names the first seed that leaves the pool a profit, to be recorded as PROFIT_SEED.
    function _recordProfitSeed(
        IGameModule m,
        bytes memory p,
        SSOTTypes.StakeSpec memory s,
        uint256 bet,
        uint256 setupFee
    ) private view {
        for (uint256 seed; seed < 1024; ++seed) {
            (bool profit,) = _poolProfit(m, p, s, bet, setupFee, seed);
            if (profit) revert(string.concat("record PROFIT_SEED ", vm.toString(seed), " in the case file"));
        }
        revert("no seed below 1024 leaves the pool a profit on the setup bet");
    }

    /// @dev Test-only projection of the production prefix predicate over the actual admitted tree: no interval
    ///      bound may decide before the cutoff leaf, so all 40 splits run, then the expected decision is checked.
    function _assertFullPredicate(bool covers) private view {
        (, uint256 stake, uint256 reserved,,) = bank.holds(betId);
        uint256 k = reserved - stake;
        (PrefixPath.Step[] memory steps, uint256 capital, uint256 amount) =
            PrefixPath.walk(ITreeView(address(vault)), FIRST_LEAF, targetCutoff);
        for (uint256 i; i < steps.length; ++i) {
            assertLt(steps[i].capital, k, "lower bound must not exit early");
            assertGe(steps[i].capital + steps[i].amount, k, "upper bound must not exit early");
        }
        assertEq(steps.length, 40, "must exercise every predicate split");
        if (covers) assertGe(capital + amount, k, "selected prefix can fund maximum loss");
        else assertLt(capital + amount, k, "full-depth prefix must reject maximum loss");
    }

    function test_freshTransactionFullCallbackQualification() public {
        vm.skip(!vm.envOr("NFT_GAS_QUALIFICATION_FORK", false), "requires explicit local archive fork opt-in");
        _cool();
        uint256[] memory words = _words(seed);
        vm.recordLogs();
        vm.prank(coordinator);
        uint256 start = gasleft();
        wrapper.rawFulfillRandomWords{gas: wrapperGas}(requestId, words);
        uint256 boundedUsed = start - gasleft();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool fit = consumer.getRequest(requestId).state == IVRFHub.RequestState.Terminal;
        assertEq(consumer.getRequest(requestId).seed, seed, "canonical seed persists at actual wrapper budget");
        uint256 retryUsed;
        if (!fit) {
            _assertReceivedAndFenced();
            _cool();
            vm.recordLogs();
            start = gasleft();
            consumer.retry{gas: 12_000_000}(requestId);
            retryUsed = start - gasleft();
            logs = vm.getRecordedLogs();
        }
        this.assertTerminal(logs);
        emit log_named_uint("game (Keno Plinko Baccarat Coin Dice Roulette SicBo Slots)", game);
        emit log_named_uint("variant", variant);
        emit log_named_uint("variant2", variant2);
        emit log_named_uint("rounds", spec.betCount);
        emit log_named_uint("seed", seed);
        emit log_named_uint(
            "tree (0 intact, 1 one-unit prefix, 2 empty prefix, 3 compressed lifetime, 4 dense structural)", treeMode
        );
        emit log_named_uint("compressed historical prefix (not executed)", treeMode >= 3 ? 1 : 0);
        emit log_named_uint("old leaves", oldLeaves);
        emit log_named_uint("late leaves", lateLeaves);
        emit log_named_uint("target cutoff", targetCutoff);
        emit log_named_uint("last used deposit id", vault.nextNode() - 1);
        emit log_named_uint("thin structural prefix", thinPrefix ? 1 : 0);
        emit log_named_uint("thin prefix positive PnL", thinPrefixProfit ? 1 : 0);
        emit log_named_uint("blacklisted player", blocked ? 1 : 0);
        emit log_named_uint("prior matured holdback", priorHoldback ? 1 : 0);
        emit log_named_uint("prior eligible player, fresh ineligible source", priorNewSourceHeld ? 1 : 0);
        emit log_named_uint("eligible player", eligible ? 1 : 0);
        emit log_named_uint("zero player balance before payout", zeroPlayerBalance ? 1 : 0);
        emit log_named_uint("amount profile (0 uniform, 1 concentrated loss witness)", amountProfile);
        if (amountProfile == 1) emit log_named_uint("setup profit seed (case PROFIT_SEED)", setupProfitSeed);
        emit log_named_uint("cutoff NFT retained parts of 1e12", cutoffRetain);
        emit log_named_uint("expected full predicate (0 none, 1 covers, 2 rejects)", expectPredicate);
        emit log_named_uint("late large NFT USDC (concentrated profile)", amountProfile == 1 ? lateLargeUsdc : 0);
        emit log_named_uint("second open hold of the player", secondHold ? 1 : 0);
        emit log_named_uint("game disabled after placement", disableGame ? 1 : 0);
        emit log_named_uint("gross payout", expectedGross);
        emit log_named_uint("net payout", expectedNet);
        emit log_named_uint("partial refund", expectedRefund);
        emit log_named_uint("provider consumer gas", consumerGas);
        emit log_named_uint("wrapper callback gas, excludes proof and billing", boundedUsed);
        emit log_named_uint("provider bounded callback settled", fit ? 1 : 0);
        emit log_named_uint("diagnostic retry gas, separate path NOT callback qualification", retryUsed);
        emit log_named_uint("setup history callbacks that missed the first-callback budget", setupCallbackFailures);
        if (vm.envOr("NFT_GAS_REQUIRE_FIT", false)) {
            assertTrue(fit, "sample must settle within provider budget");
            assertEq(setupCallbackFailures, 0, "a setup history callback did not settle within provider budget");
        }
    }

    function _assertReceivedAndFenced() private {
        assertEq(uint8(consumer.getRequest(requestId).state), uint8(IVRFHub.RequestState.Received));
        assertEq(consumer.unbookedResultCount(address(bank)), 1);
        assertEq(uint8(router.getPosition(betId).state), uint8(SSOTTypes.PositionState.Held));
        assertEq(bank.pendingStakeTotal(), UNIT + secondStake);
        assertEq(bank.totalBetsSettled(), beforeSettled);
        assertEq(vault.getReserve(), beforeRoot);
        assertEq(token.balanceOf(PLAYER), beforePlayer);
        bytes memory unavailable =
            abi.encodeWithSelector(LiquidityVault.LPUnavailable.selector, ILiquidityVaultBank.LPStatus.UnbookedResult);
        vm.startPrank(GOV);
        vm.expectRevert(unavailable);
        vault.addDeposit(UNIT);
        // Use an extant late NFT even when all old NFTs were burned.
        vm.expectRevert(unavailable);
        vault.withdrawDeposit(tailDepositId, ONE);
        vm.stopPrank();
    }

    function assertTerminal(Vm.Log[] calldata logs) external view {
        require(msg.sender == address(this), "fixture only");
        assertEq(uint8(hub.getBet(betId).state), uint8(SSOTTypes.BetState.Settled), "no false success through refund");
        assertEq(uint8(router.getPosition(betId).state), uint8(SSOTTypes.PositionState.Settled));
        assertEq(uint8(consumer.getRequest(requestId).state), uint8(IVRFHub.RequestState.Terminal));
        assertEq(consumer.unbookedResultCount(address(bank)), 0);
        SSOTTypes.BetTerminal memory receipt = hub.getBetTerminal(betId);
        assertEq(receipt.payoutGross, expectedGross);
        assertEq(receipt.refundAmount, expectedRefund);
        assertEq(receipt.payoutNet, expectedNet);
        assertEq(bank.totalBetsSettled(), beforeSettled + 1);
        assertEq(bank.playerTurnover(PLAYER) - beforeTurnover, UNIT - expectedRefund);
        assertEq(bank.totalRefunded() - beforeRefunded, expectedRefund);
        uint256 edge = hub.getBet(betId).houseEdgeBps;
        uint256 addedFees = bank.protocolFeesPayable() + bank.externalPayablesTotal() - beforeFees;
        assertEq(addedFees, ((UNIT - expectedRefund) * edge / 10_000) / 2);
        assertEq(vault.getReserve(), beforeRoot + UNIT - expectedNet - expectedRefund - addedFees);
        assertEq(token.balanceOf(PLAYER) - beforePlayer, blocked ? 0 : expectedNet + expectedRefund);
        assertEq(bank.playerPayable(PLAYER), blocked ? expectedNet + expectedRefund : 0);
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertTrue(s.accountingValid);
        assertEq(s.P, secondStake, "only the second hold stays pending");
        assertEq(s.R, secondReserved);
        assertEq(s.K, secondReserved - secondStake);
        assertEq(bank.openHoldsOf(PLAYER), secondHold ? 1 : 0);
        assertEq(s.vaultCash, s.L);
        assertEq(s.bankCash, s.PF + s.XP + s.PP + s.P);
        assertEq(s.bankSurplus + s.vaultSurplus, 0);
        uint256 awards;
        uint256 uniquePayees;
        bool[3] memory seen;
        for (uint256 i; i < logs.length; ++i) {
            Vm.Log memory entry = logs[i];
            if (entry.emitter != address(bank) || entry.topics[0] != AWARD_TOPIC) continue;
            assertEq(entry.topics.length, 4);
            assertEq(uint256(entry.topics[1]), betId, "award is bound to the terminal bet");
            assertEq(address(uint160(uint256(entry.topics[3]))), PLAYER, "award source is the actual player");
            address payee = address(uint160(uint256(entry.topics[2])));
            uint256 index;
            if (payee != PLAYER) {
                require(payee >= address(0xAA00) && payee < address(0xAA02), "unexpected referral payee");
                index = uint256(uint160(payee) - 0xAA00) + 1;
            }
            if (!seen[index]) {
                seen[index] = true;
                ++uniquePayees;
            }
            ++awards;
        }
        assertEq(awards, 3, "L0 rakeback and two referral tiers");
        assertEq(uniquePayees, 3, "player plus two referrers");
        if (priorNewSourceHeld) {
            uint256 turnoverEdge = ((UNIT - expectedRefund) * edge) / 10_000;
            uint256 r0 = turnoverEdge * 1000 / 10_000;
            uint256 r1 = turnoverEdge * 2000 / 10_000;
            uint256 r2 = turnoverEdge * 500 / 10_000;
            uint256 h1 = r1 * 3000 / 10_000;
            uint256 h2 = r2 * 3000 / 10_000;
            assertEq(bank.xpAccruedOf(PLAYER), r0);
            assertEq(bank.xpAccruedOf(address(0xAA00)), beforeL1Holdback);
            assertEq(bank.xpAccruedOf(address(0xAA01)), beforeL2Holdback);
            assertEq(bank.xpHoldbackOf(address(0xAA00)), h1);
            assertEq(bank.xpHoldbackOf(address(0xAA01)), h2);
            assertEq(bank.xpLockedBySource(address(0xAA00), PLAYER), r1 - h1);
            assertEq(bank.xpLockedBySource(address(0xAA01), PLAYER), r2 - h2);
            assertEq(bank.xpLockedTotal(), r1 - h1 + r2 - h2);
            assertEq(bank.xpAccruedTotal(), r0 + beforeL1Holdback + beforeL2Holdback);
        }
    }

    function _words(uint256 word) private pure returns (uint256[] memory words) {
        words = new uint256[](1);
        words[0] = word;
    }

    function _cool() private {
        vm.cool(USDC);
        vm.cool(tokenImplementation);
        vm.cool(WRAPPER);
        vm.cool(address(consumer));
        vm.cool(address(hub));
        vm.cool(address(router));
        vm.cool(address(bank));
        vm.cool(address(vault));
        vm.cool(address(engine));
        vm.cool(address(module));
    }
}
