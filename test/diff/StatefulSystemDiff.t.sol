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
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";

import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice A deterministic, stateful *system-level* diff test.
///
/// This is not a replacement for invariants; it complements them by asserting
/// that the observed on-chain accounting deltas match an independent reference
/// accounting model across a full lifecycle:
///   - multi-asset routing
///   - multi-roll + stopGain/stopLoss + refund
///   - fee-on-payout
///   - referral budgets -> XP buckets (accrued/locked/holdback) + protocol fees
///   - holdback vesting release (time-sensitive)
///
/// The model is *intentionally narrow*: it focuses on SSOT accounting and
/// settlement effects, not ERC4626 share math.
contract StatefulSystemDiff is Test {
    using Math for uint256;

    // -------------------------
    // System under test
    // -------------------------
    MockERC20 internal assetA;
    MockERC20 internal assetB;

    Bank internal bankA;
    Bank internal bankB;

    BankRegistry internal registry;
    Hub internal hub;
    VRFHub internal vrf;

    DiceModule internal dice;
    CoinTossModule internal coin;
    RouletteModule internal roulette;
    KenoModule internal keno;

    ReferralRegistry internal refRegistry;
    DefaultReferralEngine internal refEngine;

    // -------------------------
    // Actors
    // -------------------------
    address internal gov = address(0xA11CE);
    address internal coordinator;
address internal anyone = address(0xF00D);

    address[] internal players;

    // Current loop state (seeded each step). Used by deterministic per-step hooks.
    uint256 internal _loopState;

    bytes32 internal constant GAME_DICE = keccak256("DICE");
    bytes32 internal constant GAME_COIN = keccak256("COIN_TOSS");
    bytes32 internal constant GAME_ROULETTE = keccak256("ROULETTE");
    bytes32 internal constant GAME_KENO = keccak256("KENO");

    uint16 internal constant BPS = 10_000;

    // -------------------------
    // Reference model
    // -------------------------
    struct HB {
        uint256 bal;
        uint64 last;
        uint64 end;
    }

    struct XP {
        uint256 accrued;
        uint256 locked;
        uint256 holdback;
        // lock attribution for this test: we only track lockedBySource[payee][player]
        mapping(address => uint256) lockedBySource;
        HB hb;
    }

    struct BankModel {
        uint256 B;   // token balance of bank
        uint256 PF;  // protocolFeesPayable
        uint256 R;   // totalReserved
        uint256 xpAccruedTotal;
        uint256 xpLockedTotal;
        uint256 xpHoldbackTotal;
        mapping(address => uint256) turnover;
        mapping(address => XP) xp;
    }

    mapping(address => BankModel) internal bm; // keyed by asset address
    mapping(address => mapping(address => uint256)) internal playerBal; // player -> asset -> balance

    // pricing + referral mirrors
    mapping(address => address) internal mReferrer; // first-touch
    mapping(address => uint16) internal mAffiliateHE; // explicit set, 0 => unset

    // helper: maintain a small set of "touched payees" so we can assert per-payee buckets
    address[] internal touchedPayees;
    mapping(address => bool) internal touched;

    // -------------------------
    // Setup
    // -------------------------
    function setUp() external {
        assetA = new MockERC20("AssetA", "ASTA", 18);
        assetB = new MockERC20("AssetB", "ASTB", 18);

        coordinator = _configureVRFAdapter(gov);
        vrf = new VRFHub(coordinator, gov);

        vm.startPrank(gov);
        _postConfigureVRFAdapter(gov);
        vm.stopPrank();

        bankA = new Bank(address(assetA), gov, 1000, "LP Share ASTA", "LPA", 18);
        bankB = new Bank(address(assetB), gov, 1000, "LP Share ASTB", "LPB", 18);

        registry = new BankRegistry(gov);
        vm.startPrank(gov);
        registry.registerBank(address(assetA), address(bankA));
        registry.registerBank(address(assetB), address(bankB));
        vm.stopPrank();

        refRegistry = new ReferralRegistry(gov);
        refEngine = new DefaultReferralEngine();

        // Initial referral config mirrors E2E:
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
            200, // 2%
            0,   // affiliate HE capped at default
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

        // keep vesting short to ensure holdback release is exercised when time warps
        bankA.setHoldbackVestingSeconds(10);
        bankB.setHoldbackVestingSeconds(10);
        // keep unlock threshold modest
        bankA.setMinPlayerTurnoverForUnlock(20 ether);
        bankB.setMinPlayerTurnoverForUnlock(20 ether);
        vm.stopPrank();

        dice = new DiceModule();
        coin = new CoinTossModule();
        roulette = new RouletteModule();
        keno = new KenoModule();

        vm.startPrank(gov);
        hub.registerGame(GAME_DICE, address(dice));
        hub.registerGame(GAME_COIN, address(coin));
        hub.registerGame(GAME_ROULETTE, address(roulette));
        hub.registerGame(GAME_KENO, address(keno));
        vm.stopPrank();

        // Players
        for (uint256 i = 0; i < 5; i++) {
            address p = address(uint160(uint256(keccak256(abi.encode("player", i + 1)))));
            players.push(p);
            vm.deal(p, 100 ether);
            assetA.mint(p, 2_000 ether);
            assetB.mint(p, 2_000 ether);
            vm.startPrank(p);
            assetA.approve(address(bankA), type(uint256).max);
            assetB.approve(address(bankB), type(uint256).max);
            vm.stopPrank();
        }

        // Optional hook: adapter variants can add extra player contracts (e.g. refund-failing receivers)
        // after the base EOAs are initialized.
        _postPlayersSetup();

        // Seed liquidity (gov)
        vm.deal(gov, 100 ether);
        assetA.mint(gov, 20_000 ether);
        assetB.mint(gov, 20_000 ether);
        vm.startPrank(gov);
        assetA.approve(address(bankA), type(uint256).max);
        assetB.approve(address(bankB), type(uint256).max);
        bankA.deposit(10_000 ether, gov);
        bankB.deposit(10_000 ether, gov);
        vm.stopPrank();

        // Initialize model from chain
        _syncBankModel(address(assetA));
        _syncBankModel(address(assetB));
        for (uint256 i = 0; i < players.length; i++) {
            address p = players[i];
            playerBal[p][address(assetA)] = assetA.balanceOf(p);
            playerBal[p][address(assetB)] = assetB.balanceOf(p);
        }
    }

    // -------------------------
    // Deterministic stateful diff
    // -------------------------

    
// -------------------------
// Deterministic stateful diff
// -------------------------

/// @notice Hook to configure an external VRF adapter coordinator before VRFHub is deployed.
/// @dev Return the coordinator address that will be authorized to call VRFHub.fulfillRandomWords().
///      Default: this test contract (direct fulfill).
function _configureVRFAdapter(address /*gov_*/) internal virtual returns (address coordinatorOut) {
    coordinatorOut = address(this);
}

/// @notice Hook invoked after VRFHub is deployed (and under gov prank).
/// @dev Adapter tests can wire vrf.setAdapter(...) and adapter.setVRFHub(...) here.
function _postConfigureVRFAdapter(address /*gov_*/) internal virtual {}

/// @notice Optional hook invoked after base players are initialized.
/// @dev Adapter variants can add additional player contracts (e.g. refund-failing receivers)
///      and grant token approvals here.
function _postPlayersSetup() internal virtual {}

/// @notice Deterministic overpay hook for charged VRF fee.
/// @dev Default: no overpay. Adapter variants can override to exercise refund-credit paths.
function _vrfOverpayWei(address /*player*/, uint32 /*betCount*/, uint256 /*feeCharged*/) internal view virtual returns (uint256) {
    return 0;
}

/// @notice Fulfill helper that can be overridden by adapter-based tests.
function _fulfill(uint256 requestId, uint256[] memory randomWords) internal virtual {
    vrf.fulfillRandomWords(requestId, randomWords);
}

function testFuzz_stateful_system_diff(uint256 seed) external {
    _runStateful(seed, 24);
}

/// @notice Internal runner used by adapter variants.
function _runStateful(uint256 seed, uint256 steps) internal {
    // Keep the run bounded and reproducible.
    // If a failure occurs, the fuzzed `seed` is sufficient to repro.
    uint256 state = seed;

    for (uint256 step = 0; step < steps; step++) {
        state = uint256(keccak256(abi.encode(state, step)));

        // Expose per-step state for deterministic hooks (e.g., overpay selection).
        _loopState = state;
        _loopState = state;

        // pick asset
        address asset = (state & 1 == 0) ? address(assetA) : address(assetB);
        Bank bank = (asset == address(assetA)) ? bankA : bankB;

        // pick player + affiliate
        address player = players[(state >> 8) % players.length];
        address affiliate = players[(state >> 16) % players.length];
        if (affiliate == player) affiliate = players[(uint256(uint160(affiliate)) + 1) % players.length];

        // occasionally set affiliate house edge (exercise skyline)
        if ((state >> 24) % 5 == 0) {
            uint16 def = hub.defaultHouseEdgeBps();
            // allow up to 10% for this test (still within max)
            uint16 he = uint16(bound(uint256(state >> 32), uint256(def), 1000));
            _doSetAffiliateHouseEdge(affiliate, he);
        }

        // build params + stakeSpec
        bytes32 gameId;
        bytes memory params;

        uint256 g = (state >> 40) % 4;
        if (g == 0) {
            gameId = GAME_DICE;
            uint8 cap = uint8(bound(uint256(state >> 48), 1, 99));
            params = abi.encode(cap);
        } else if (g == 1) {
            gameId = GAME_COIN;
            bool isTails = ((state >> 48) & 1) == 1;
            params = abi.encode(isTails);
        } else if (g == 2) {
            gameId = GAME_ROULETTE;
            // raw bitmask with 1..6 numbers
            uint8 picks = uint8(bound(uint256(state >> 56), 1, 6));
            uint40 mask = _randomBitmask40(state >> 64, 37, picks);
            params = abi.encode(mask);
        } else {
            gameId = GAME_KENO;
            // keno numbers: 1..10 picks from 40
            uint8 picks = uint8(bound(uint256(state >> 56), 1, 10));
            uint40 mask = _randomBitmask40(state >> 64, 40, picks);
            params = abi.encode(mask);
        }

        uint256 amountPerRoll = bound(uint256(state >> 96), 0.1 ether, 5 ether);
        uint32 betCount = uint32(bound(uint256(state >> 128), 1, 8));

        uint256 stake = amountPerRoll * uint256(betCount);

        uint256 stopGain = 0;
        uint256 stopLoss = 0;
        // occasionally set stopGain/stopLoss with safe bounds
        if ((state >> 160) % 3 == 0) {
            uint256 halfStake = stake / 2;
            if (halfStake >= 0.1 ether) {
                stopGain = bound(uint256(state >> 168), 0.1 ether, halfStake);
            }
        }
        if ((state >> 176) % 3 == 0) {
            uint256 halfStake = stake / 2;
            if (halfStake >= 0.1 ether) {
                stopLoss = bound(uint256(state >> 184), 0.1 ether, halfStake);
            }
        }

        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: amountPerRoll,
            betCount: betCount,
            stopGain: stopGain,
            stopLoss: stopLoss
        });

        // normalize maxHouseEdge like Hub (0 => default)
        uint16 maxHE = 0;

        // reference-model pre-compute (includes first-touch binding)
        address oldRef = mReferrer[player];
        RefPricing memory pricing = _modelComputePricing(player, affiliate, maxHE);

        // execute placeBet (may legitimately fail)
        uint256 betId = _doPlaceBet(player, gameId, asset, params, spec, affiliate, maxHE);
        if (betId == 0) {
            // placeBet reverted => no on-chain state change, roll back any speculative first-touch bind
            mReferrer[player] = oldRef;
            _assertBankMatches(asset);
            continue;
        }

        // assert placement snapshot matches reference pricing
        {
            SSOTTypes.Bet memory b = hub.getBet(betId);
            assertEq(b.player, player);
            assertEq(b.asset, asset);
            assertEq(b.bank, address(bank));
            assertEq(b.stake, stake);
            assertEq(b.amountPerRoll, amountPerRoll);
            assertEq(uint256(b.betCount), uint256(betCount));
            assertEq(uint256(b.stopGain), stopGain);
            assertEq(uint256(b.stopLoss), stopLoss);
            assertEq(uint256(b.baseHouseEdgeBps), uint256(pricing.baseHE));
            assertEq(uint256(b.effectiveHouseEdgeBps), uint256(pricing.effectiveHE));
            assertEq(b.pricingAffiliate, pricing.pricingAffiliate);
            assertEq(b.deltaSkylineHash, keccak256(pricing.skyline));
        }

        // settle path: finalize ~80%, refund ~20%
        bool doRefund = ((state >> 188) % 5 == 0);
        if (doRefund) {
            // warp beyond refund timeout
            uint256 timeout = hub.refundTimeoutSeconds();
            vm.warp(block.timestamp + timeout + 1);
            _modelRefund(betId, asset);
            vm.prank(anyone);
            hub.refund(betId);

            // late fulfill should have no effect
            uint256 requestId = hub.getBet(betId).requestId;
            uint256[] memory rw = new uint256[](1);
            rw[0] = uint256(keccak256(abi.encode(state, betId, "late")));
            _fulfill(requestId, rw);
        } else {
            // fulfill
            uint256 requestId = hub.getBet(betId).requestId;
            uint256 seedWord = uint256(keccak256(abi.encode(state, betId, "seed")));
            uint256[] memory rw = new uint256[](1);
            rw[0] = seedWord;
            _fulfill(requestId, rw);

            // finalize
            _modelFinalize(betId, asset, seedWord, pricing);
            vm.prank(anyone);
            hub.finalize(betId);
        }

        // post-check: key bank + per-payee bucket values
        _assertBankMatches(asset);
    }
}

// -------------------------
// Model: pricing + referral
    // -------------------------

    struct RefPricing {
        address pricingAffiliate;
        uint16 baseHE;
        uint16 effectiveHE;
        bytes skyline;
    }

    function _getAffiliateHE(address affiliate) internal view returns (uint16) {
        uint16 v = mAffiliateHE[affiliate];
        return v == 0 ? hub.defaultHouseEdgeBps() : v;
    }


    function _canBindFirstTouch(address player, address referrer) internal view returns (bool) {
        // Mirror ReferralRegistry._bind semantics (best-effort, non-reverting in Hub):
        // - reject zero/identity
        // - first-touch immutable (only if unset)
        // - anti-cycle: walk up from referrer; if we reach player, binding is invalid
        if (player == address(0) || referrer == address(0)) return false;
        if (player == referrer) return false;
        if (mReferrer[player] != address(0)) return false;

        address cur = referrer;
        // ReferralRegistry caps at 32 hops for gas safety
        for (uint8 i = 0; i < 32 && cur != address(0); i++) {
            if (cur == player) return false;
            cur = mReferrer[cur];
        }
        return true;
    }

    function _modelComputePricing(address player, address affiliate, uint16 maxHouseEdgeBps)
        internal
        returns (RefPricing memory out)
    {
        // normalize maxHE like Hub
        uint16 maxHE = maxHouseEdgeBps;
        if (maxHE == 0) maxHE = hub.defaultHouseEdgeBps();
        if (maxHE > 10_000) maxHE = 10_000;

        address pricingAff = mReferrer[player];
        if (pricingAff == address(0)) {
            // First-touch: Hub tries binding but does not revert if the registry rejects (cycle, invalid, etc.).
            if (affiliate != address(0) && affiliate != player) {
                if (_canBindFirstTouch(player, affiliate)) {
                    mReferrer[player] = affiliate;
                }
            }
            pricingAff = mReferrer[player];
            if (pricingAff == address(0)) pricingAff = affiliate;
        }

        uint16 baseHE = hub.defaultHouseEdgeBps();
        uint16 curMax = baseHE;

        address[6] memory payeesTmp;
        uint16[6] memory incTmp;
        uint8 k = 0;

        address cur = pricingAff;
        for (uint8 i = 0; i < 6 && cur != address(0); i++) {
            uint16 heCur = _getAffiliateHE(cur);
            if (heCur > curMax) {
                uint16 inc = heCur - curMax;
                payeesTmp[k] = cur;
                incTmp[k] = inc;
                curMax = heCur;
                unchecked { ++k; }
            }
            cur = mReferrer[cur];
        }

        uint16 effective = curMax;
        require(effective <= maxHE, "maxHE");

        bytes memory skyline;
        if (k > 0) {
            skyline = new bytes(uint256(k) * 22);
            for (uint8 j = 0; j < k; j++) {
                uint256 o = uint256(j) * 22;
                bytes20 p = bytes20(payeesTmp[j]);
                uint16 inc = incTmp[j];
                for (uint8 b = 0; b < 20; ++b) {
                    skyline[o + b] = p[b];
                }
                skyline[o + 20] = bytes1(uint8(inc >> 8));
                skyline[o + 21] = bytes1(uint8(inc));
            }
        }

        out = RefPricing({pricingAffiliate: pricingAff, baseHE: baseHE, effectiveHE: effective, skyline: skyline});
    }

    function _doSetAffiliateHouseEdge(address affiliate, uint16 he) internal {
        uint16 def = hub.defaultHouseEdgeBps();
        if (he < def) he = def;
        vm.prank(affiliate);
        try hub.setAffiliateHouseEdge(he) {
            mAffiliateHE[affiliate] = he;
        } catch {
            // ignore
        }
    }

    // -------------------------
    // Model: lifecycle operations
    // -------------------------

    function _doPlaceBet(
        address player,
        bytes32 gameId,
        address asset,
        bytes memory params,
        SSOTTypes.StakeSpec memory spec,
        address affiliate,
        uint16 maxHE
    ) internal returns (uint256 betId) {
        // Risk-in can legitimately fail (pause, solvency, invalid params, etc.).
        // The diff model must treat such failures as "bet rejected" (no state change).
        vm.prank(player);
        (uint256 fee, ) = hub.quoteVRFFee(spec.betCount);
        uint256 overpay = _vrfOverpayWei(player, spec.betCount, fee);
        uint256 msgValue = fee + overpay;
        try hub.placeBet{value: msgValue}(gameId, asset, params, spec, affiliate, maxHE) returns (uint256 id) {
            betId = id;
        } catch {
            return 0;
        }

        // On success, model the risk-in transfers using the *actual* on-chain snapshot.
        SSOTTypes.Bet memory b = hub.getBet(betId);
        playerBal[player][asset] -= b.stake;
        bm[asset].B += b.stake;
        bm[asset].R += b.reserved;
    }

    function _modelRefund(uint256 betId, address asset) internal {
        SSOTTypes.Bet memory b = hub.getBet(betId);
        // hold was already modeled at placeBet. Refund returns full stake and releases full reserve.
        bm[asset].R -= b.reserved;
        bm[asset].B -= b.stake;
        playerBal[b.player][asset] += b.stake;

        // No PF/XP/turnover effects.
    }

    function _modelFinalize(uint256 betId, address asset, uint256 seedWord, RefPricing memory pricing) internal {
        SSOTTypes.Bet memory b = hub.getBet(betId);
        address module = hub.gameModule(b.gameId);
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: b.amountPerRoll,
            betCount: b.betCount,
            stopGain: b.stopGain,
            stopLoss: b.stopLoss
        });

        uint256[] memory rw = new uint256[](1);
        rw[0] = seedWord;

        (uint256 payoutGross, uint256 refundAmount) = IGameModule(module).resolve(hub.getBetParams(betId), spec, betId, rw);

        uint256 feeOnPayout = 0;
        uint256 payoutNet = payoutGross;
        if (payoutGross > 0) {
            feeOnPayout = Math.mulDiv(payoutGross, uint256(b.effectiveHouseEdgeBps), BPS);
            if (feeOnPayout > payoutGross) feeOnPayout = payoutGross;
            payoutNet = payoutGross - feeOnPayout;
        }

        uint256 usedTurnover = b.stake - refundAmount;
        uint256 turnoverBefore = bm[asset].turnover[b.player];
        uint256 turnoverAfter = turnoverBefore + usedTurnover;

        // referral config
        (uint16 baseBudgetBps, uint16 deltaBudgetBps, uint16 holdbackBps, uint16[6] memory levelBps, uint8 levels) =
            hub.getReferralConfig(b.referralConfigId);

        uint256 minTurnover = (asset == address(assetA)) ? bankA.minPlayerTurnoverForUnlock() : bankB.minPlayerTurnoverForUnlock();

        uint256 baseHEAmt = Math.mulDiv(usedTurnover, uint256(b.baseHouseEdgeBps), BPS);
        uint256 baseBudget = Math.mulDiv(baseHEAmt, uint256(baseBudgetBps), BPS);
        if (baseBudget > baseHEAmt) baseBudget = baseHEAmt;
        uint256 nonBudgetBase = baseHEAmt - baseBudget;

        uint256 deltaBudget = 0;
        uint256 nonBudgetDelta = 0;
        if (b.effectiveHouseEdgeBps > b.baseHouseEdgeBps) {
            uint256 deltaHE = uint256(b.effectiveHouseEdgeBps) - uint256(b.baseHouseEdgeBps);
            uint256 deltaHEAmt = Math.mulDiv(usedTurnover, deltaHE, BPS);
            deltaBudget = Math.mulDiv(deltaHEAmt, uint256(deltaBudgetBps), BPS);
            if (deltaBudget > deltaHEAmt) deltaBudget = deltaHEAmt;
            nonBudgetDelta = deltaHEAmt - deltaBudget;
        }

        // Plans (independent of on-chain engine)
        Plan memory planB;
        Plan memory planD;

        if (baseBudget > 0 && levels > 0) {
            address[] memory uplines = _buildUplinesModel(b.player, levels > 0 ? (levels - 1) : 0);
            planB = _splitBase(baseBudget, levelBps, levels, uplines, holdbackBps, minTurnover, turnoverAfter);
        }

        if (deltaBudget > 0) {
            planD = _splitDelta(pricing.skyline, deltaBudget, holdbackBps, minTurnover, turnoverAfter);
        }

        uint256 protocolFeeAccrual = nonBudgetBase + nonBudgetDelta + planB.sink + planD.sink;

        // apply settlement to model
        bm[asset].R -= b.reserved;
        bm[asset].B -= (payoutNet + refundAmount);
        playerBal[b.player][asset] += (payoutNet + refundAmount);
        bm[asset].PF += protocolFeeAccrual;
        bm[asset].turnover[b.player] = turnoverAfter;

        // apply XP awards: playerKick accrues to player
        _touchPayee(b.player);
        _awardAccrued(asset, b.player, planB.playerKick);

        _applyPlanAwards(asset, b.player, planB);
        _applyPlanAwards(asset, b.player, planD);

        // final sanity: payoutGross+refund must fit reserved (B3)
        require(payoutGross + refundAmount <= b.reserved, "reserved");
        require(payoutNet + refundAmount <= b.stake + b.reserved, "owed");
        // silence unused
        feeOnPayout;
    }

    // -------------------------
    // Reference referral engine (pure, independent)
    // -------------------------

    struct Plan {
        uint256 playerKick;
        address[] payees;
        uint256[] immediate;
        uint256[] locked;
        uint256[] holdback;
        uint256 sink;
    }

    function _splitBase(
        uint256 baseBudget,
        uint16[6] memory levelBps,
        uint8 levels,
        address[] memory uplines,
        uint16 holdbackBps,
        uint256 minTurnover,
        uint256 playerTurnover
    ) internal pure returns (Plan memory plan) {
        if (baseBudget == 0) {
            plan.payees = new address[](0);
            plan.immediate = new uint256[](0);
            plan.locked = new uint256[](0);
            plan.holdback = new uint256[](0);
            return plan;
        }

        uint256 accounted = 0;
        uint256 kick = Math.mulDiv(baseBudget, uint256(levelBps[0]), BPS);
        if (kick > baseBudget) kick = baseBudget;
        plan.playerKick = kick;
        accounted += kick;

        address[] memory payees = new address[](levels > 0 ? (levels - 1) : 0);
        uint256[] memory amounts = new uint256[](payees.length);
        uint256 idx = 0;

        for (uint8 l = 1; l < levels; l++) {
            uint256 share = Math.mulDiv(baseBudget, uint256(levelBps[l]), BPS);
            if (share == 0) continue;
            accounted += share;
            address p = address(0);
            uint256 u = uint256(l - 1);
            if (u < uplines.length) p = uplines[u];
            if (p == address(0)) {
                plan.sink += share;
                continue;
            }
            payees[idx] = p;
            amounts[idx] = share;
            idx++;
        }

        assembly ("memory-safe") {
            mstore(payees, idx)
            mstore(amounts, idx)
        }

        if (accounted < baseBudget) {
            plan.sink += (baseBudget - accounted);
        }

        (plan.payees, plan.immediate, plan.locked, plan.holdback) = _splitAmounts(
            payees,
            amounts,
            holdbackBps,
            minTurnover,
            playerTurnover
        );
    }

    function _splitDelta(
        bytes memory skyline,
        uint256 deltaBudget,
        uint16 holdbackBps,
        uint256 minTurnover,
        uint256 playerTurnover
    ) internal pure returns (Plan memory plan) {
        if (deltaBudget == 0) {
            plan.payees = new address[](0);
            plan.immediate = new uint256[](0);
            plan.locked = new uint256[](0);
            plan.holdback = new uint256[](0);
            return plan;
        }
        if (skyline.length == 0) {
            plan.sink = deltaBudget;
            plan.payees = new address[](0);
            plan.immediate = new uint256[](0);
            plan.locked = new uint256[](0);
            plan.holdback = new uint256[](0);
            return plan;
        }
        require(skyline.length % 22 == 0, "skyline");
        uint256 k = skyline.length / 22;
        require(k <= 6, "k");

        address[] memory payees = new address[](k);
        uint16[] memory inc = new uint16[](k);
        uint256 sumInc = 0;

        for (uint256 i = 0; i < k; i++) {
            (address p, uint16 bps) = _decodeSegment(skyline, i);
            payees[i] = p;
            inc[i] = bps;
            sumInc += uint256(bps);
        }

        if (sumInc == 0) {
            plan.sink = deltaBudget;
            plan.payees = new address[](0);
            plan.immediate = new uint256[](0);
            plan.locked = new uint256[](0);
            plan.holdback = new uint256[](0);
            return plan;
        }

        uint256 last = 0;
        for (uint256 i = 0; i < k; i++) {
            if (inc[i] > 0) last = i;
        }

        uint256[] memory amounts = new uint256[](k);
        uint256 distributed = 0;
        for (uint256 i = 0; i < k; i++) {
            uint256 share;
            if (i == last) {
                share = deltaBudget - distributed;
            } else {
                share = Math.mulDiv(deltaBudget, uint256(inc[i]), sumInc);
                distributed += share;
            }
            if (payees[i] == address(0) || share == 0) {
                plan.sink += share;
                amounts[i] = 0;
            } else {
                amounts[i] = share;
            }
        }

        (plan.payees, plan.immediate, plan.locked, plan.holdback) = _splitAmounts(
            payees,
            amounts,
            holdbackBps,
            minTurnover,
            playerTurnover
        );
    }

    function _splitAmounts(
        address[] memory payees,
        uint256[] memory amounts,
        uint16 holdbackBps,
        uint256 minTurnover,
        uint256 playerTurnover
    ) internal pure returns (address[] memory outPayees, uint256[] memory immediate, uint256[] memory locked, uint256[] memory holdback) {
        outPayees = payees;
        uint256 n = payees.length;
        immediate = new uint256[](n);
        locked = new uint256[](n);
        holdback = new uint256[](n);

        bool eligible = playerTurnover >= minTurnover;
        for (uint256 i = 0; i < n; i++) {
            uint256 amt = amounts[i];
            if (amt == 0) continue;
            uint256 hb = (holdbackBps == 0) ? 0 : Math.mulDiv(amt, uint256(holdbackBps), BPS);
            if (hb > amt) hb = amt;
            uint256 rest = amt - hb;
            holdback[i] = hb;
            if (eligible) immediate[i] = rest;
            else locked[i] = rest;
        }
    }

    function _decodeSegment(bytes memory skyline, uint256 index) internal pure returns (address payee, uint16 incBps) {
        uint256 o = index * 22;
        require(skyline.length >= o + 22, "o");
        assembly ("memory-safe") {
            let word := mload(add(add(skyline, 0x20), o))
            payee := shr(96, word)
            let word2 := mload(add(add(skyline, 0x20), add(o, 20)))
            incBps := shr(240, word2)
        }
    }

    function _buildUplinesModel(address player, uint8 maxUplines) internal view returns (address[] memory uplines) {
        if (maxUplines == 0) return new address[](0);
        uplines = new address[](maxUplines);
        uint8 filled = 0;

        address cur = mReferrer[player];
        for (uint8 i = 0; i < maxUplines; i++) {
            if (cur == address(0)) break;
            bool dup = false;
            for (uint8 j = 0; j < filled; j++) {
                if (uplines[j] == cur) {
                    dup = true;
                    break;
                }
            }
            if (!dup) {
                uplines[filled] = cur;
                filled++;
            }
            cur = mReferrer[cur];
        }
        assembly ("memory-safe") {
            mstore(uplines, filled)
        }
    }

    // -------------------------
    // Model: XP bucket accounting (incl. holdback vesting release)
    // -------------------------

    function _touchPayee(address payee) internal {
        if (!touched[payee]) {
            touched[payee] = true;
            touchedPayees.push(payee);
        }
    }

    function _syncHoldbackModel(address asset, address payee, uint64 nowTs) internal {
        XP storage x = bm[asset].xp[payee];
        uint256 bal = x.hb.bal;
        if (bal == 0) {
            if (x.hb.last == 0) {
                x.hb.last = nowTs;
                x.hb.end = nowTs;
            }
            return;
        }
        uint64 last = x.hb.last;
        uint64 end = x.hb.end;
        if (end == 0 || last == 0) return;
        if (nowTs <= last) {
            x.hb.last = nowTs;
            return;
        }
        uint256 release;
        if (nowTs >= end) {
            release = bal;
        } else {
            uint64 denom = end - last;
            if (denom == 0) release = bal;
            else {
                uint64 dt = nowTs - last;
                release = (bal * uint256(dt)) / uint256(denom);
            }
        }
        if (release == 0) {
            x.hb.last = nowTs;
            return;
        }
        // move holdback -> accrued
        x.hb.bal = bal - release;
        x.holdback -= release;
        bm[asset].xpHoldbackTotal -= release;

        x.accrued += release;
        bm[asset].xpAccruedTotal += release;

        x.hb.last = nowTs;
        if (nowTs >= x.hb.end) x.hb.end = nowTs;
    }

    function _awardAccrued(address asset, address payee, uint256 amt) internal {
        if (amt == 0) return;
        XP storage x = bm[asset].xp[payee];
        x.accrued += amt;
        bm[asset].xpAccruedTotal += amt;
    }

    function _awardLocked(address asset, address payee, address sourcePlayer, uint256 amt) internal {
        if (amt == 0) return;
        XP storage x = bm[asset].xp[payee];
        x.locked += amt;
        bm[asset].xpLockedTotal += amt;
        x.lockedBySource[sourcePlayer] += amt;
    }

    function _awardHoldback(address asset, address payee, uint256 amt, uint64 nowTs, uint64 vestSeconds) internal {
        if (amt == 0) return;
        XP storage x = bm[asset].xp[payee];
        // settleBet does _syncHoldback(payee, now) *before* adding holdback
        _syncHoldbackModel(asset, payee, nowTs);

        x.holdback += amt;
        bm[asset].xpHoldbackTotal += amt;
        x.hb.bal += amt;

        // Non-extending aggregate schedule: do not delay existing holdback.
        if (x.hb.bal == amt || x.hb.end <= nowTs) {
            x.hb.last = nowTs;
            x.hb.end = nowTs + vestSeconds;
        }
    }

    function _applyPlanAwards(address asset, address sourcePlayer, Plan memory plan) internal {
        uint256 n = plan.payees.length;
        uint64 nowTs = uint64(block.timestamp);
        uint64 vest = uint64((asset == address(assetA)) ? bankA.holdbackVestingSeconds() : bankB.holdbackVestingSeconds());
        for (uint256 i = 0; i < n; i++) {
            address payee = plan.payees[i];
            if (payee == address(0)) continue;
            _touchPayee(payee);
            uint256 imm = plan.immediate[i];
            uint256 lok = plan.locked[i];
            uint256 hb = plan.holdback[i];
            if (imm > 0) _awardAccrued(asset, payee, imm);
            if (lok > 0) _awardLocked(asset, payee, sourcePlayer, lok);
            if (hb > 0) _awardHoldback(asset, payee, hb, nowTs, vest);
        }
    }

    // -------------------------
    // Assertions
    // -------------------------

    function _syncBankModel(address asset) internal {
        Bank bank = (asset == address(assetA)) ? bankA : bankB;
        bm[asset].B = IERC20Like(asset).balanceOf(address(bank));
        bm[asset].PF = bank.protocolFeesPayable();
        bm[asset].R = bank.totalReserved();
        bm[asset].xpAccruedTotal = bank.xpAccruedTotal();
        bm[asset].xpLockedTotal = bank.xpLockedTotal();
        bm[asset].xpHoldbackTotal = bank.xpHoldbackTotal();
    }

    function _assertBankMatches(address asset) internal {
        Bank bank = (asset == address(assetA)) ? bankA : bankB;

        assertEq(IERC20Like(asset).balanceOf(address(bank)), bm[asset].B, "bank.B");
        assertEq(bank.protocolFeesPayable(), bm[asset].PF, "bank.PF");
        assertEq(bank.totalReserved(), bm[asset].R, "bank.R");
        assertEq(bank.xpAccruedTotal(), bm[asset].xpAccruedTotal, "bank.xpAccruedTotal");
        assertEq(bank.xpLockedTotal(), bm[asset].xpLockedTotal, "bank.xpLockedTotal");
        assertEq(bank.xpHoldbackTotal(), bm[asset].xpHoldbackTotal, "bank.xpHoldbackTotal");

        // touched payees: per-payee buckets
        for (uint256 i = 0; i < touchedPayees.length; i++) {
            address p = touchedPayees[i];
            XP storage x = bm[asset].xp[p];
            assertEq(bank.xpAccruedOf(p), x.accrued, "xpAccruedOf");
            assertEq(bank.xpLockedOf(p), x.locked, "xpLockedOf");
            assertEq(bank.xpHoldbackOf(p), x.holdback, "xpHoldbackOf");

            // lock attribution for each player (bounded small)
            for (uint256 j = 0; j < players.length; j++) {
                address sp = players[j];
                uint256 exp = x.lockedBySource[sp];
                if (exp == 0) continue;
                assertEq(bank.xpLockedBySource(p, sp), exp, "xpLockedBySource");
            }
        }

        // player balances (only the players we manage)
        for (uint256 i = 0; i < players.length; i++) {
            address p = players[i];
            assertEq(IERC20Like(asset).balanceOf(p), playerBal[p][asset], "playerBal");
            assertEq(bank.playerTurnover(p), bm[asset].turnover[p], "turnover");
        }
    }

    // -------------------------
    // Utilities
    // -------------------------

    function _randomBitmask40(uint256 x, uint8 domain, uint8 picks) internal pure returns (uint40 out) {
        require(domain <= 40, "domain");
        require(picks > 0 && picks <= domain, "picks");
        uint256 used = 0;
        out = 0;
        for (uint8 i = 0; i < picks; i++) {
            // rejection sample to avoid duplicates
            uint8 v;
            for (uint256 k = 0; k < 128; k++) {
                v = uint8(uint256(keccak256(abi.encode(x, i, k))) % domain);
                if ((used & (uint256(1) << v)) == 0) break;
            }
            used |= (uint256(1) << v);
            out |= uint40(uint256(1) << v);
        }
    }
}

interface IERC20Like {
    function balanceOf(address a) external view returns (uint256);
}
