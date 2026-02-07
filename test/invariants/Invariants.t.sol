// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";

import {Bank} from "../../src/core/Bank.sol";
import {BankRegistry} from "../../src/core/BankRegistry.sol";
import {Hub} from "../../src/core/Hub.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";


/// @notice Stateful fuzz handler used by StdInvariant.
///         We intentionally model both:
///         - Risk-in actions (deposit/placeBet/affiliate opt-in) that may revert
///         - Debt-out actions (finalize/refund + permissionless XP moves) that MUST remain live
///         - Optional outflows (withdraw/redeem/claim) that are allowed to revert, but if they succeed they MUST keep A4.
contract Handler is Test {
    MockERC20 public assetA;
    MockERC20 public assetB;

    Bank public bankA;
    Bank public bankB;

    Hub public hub;
    VRFHub public vrf;

    address public gov;
    address public coordinator;

    bytes32 constant GAME_DICE = keccak256("DICE");

    address[] public players;
    uint256[] public betIds;

    // ---------------------------------------------------------------------
    // Mirror state for ExecutableSSOT (B/C/D-class)
    // ---------------------------------------------------------------------

    mapping(uint256 => SSOTTypes.BetState) internal _mirrorState;
    mapping(uint256 => uint256) internal _mirrorRequestId;
    mapping(uint256 => address) internal _mirrorBank;
    mapping(uint256 => uint256) internal _mirrorReserved;
    mapping(uint256 => bool) internal _mirrorTerminal;

    uint256 public openReservedA;
    uint256 public openReservedB;


// ---------------------------------------------------------------------
// Additional mirrors for bounded settlement + budgets (B3/P3)
// ---------------------------------------------------------------------

mapping(uint256 => bytes) internal _mirrorParams;
mapping(uint256 => SSOTTypes.StakeSpec) internal _mirrorStakeSpec;
mapping(uint256 => bytes32) internal _mirrorGameId;
mapping(uint256 => uint256) internal _mirrorSeedPlus1; // seed+1 sentinel (0 means unset)

// ---------------------------------------------------------------------
// Violation flags (invariant functions assert these are always zero)
// ---------------------------------------------------------------------
uint256 public v_D2_noAssetBackdoor;
uint256 public v_E2_bucketMovesPreserveTotal;
uint256 public v_E3_claimPauseGated;
uint256 public v_B3_boundedSettlement;
uint256 public v_P3_budgetConservation;
uint256 public v_A4_optionalOutflowDomain;
uint256 public v_LIVE_debtOutMustSucceed;

bytes32 public lastViolationCode;
uint256 public lastViolationBetId;

bytes32 internal constant VC_D2 = keccak256("D2_NO_ASSET_BACKDOOR");
bytes32 internal constant VC_E2 = keccak256("E2_BUCKET_MOVES");
bytes32 internal constant VC_E3 = keccak256("E3_CLAIM_PAUSE_GATED");
bytes32 internal constant VC_B3 = keccak256("B3_BOUNDED_SETTLEMENT");
bytes32 internal constant VC_P3 = keccak256("P3_BUDGET_CONSERVATION");
bytes32 internal constant VC_A4 = keccak256("A4_OPTIONAL_OUTFLOW_DOMAIN");
bytes32 internal constant VC_LIVE = keccak256("LIVE_DEBT_OUT");

function _noteViolation(bytes32 code, uint256 betId) internal {
    lastViolationCode = code;
    lastViolationBetId = betId;
    if (code == VC_D2) v_D2_noAssetBackdoor++;
    else if (code == VC_E2) v_E2_bucketMovesPreserveTotal++;
    else if (code == VC_E3) v_E3_claimPauseGated++;
    else if (code == VC_B3) v_B3_boundedSettlement++;
    else if (code == VC_P3) v_P3_budgetConservation++;
    else if (code == VC_A4) v_A4_optionalOutflowDomain++;
    else if (code == VC_LIVE) v_LIVE_debtOutMustSucceed++;
}

    constructor(
        MockERC20 aA,
        MockERC20 aB,
        Bank bA,
        Bank bB,
        Hub h,
        VRFHub v,
        address g,
        address coord
    ) {
        assetA = aA;
        assetB = aB;
        bankA = bA;
        bankB = bB;
        hub = h;
        vrf = v;
        gov = g;
        coordinator = coord;

        for (uint256 i = 0; i < 6; i++) {
            address p = address(uint160(uint256(keccak256(abi.encode("p", i + 1)))));
            players.push(p);
            assetA.mint(p, 1_000 ether);
            assetB.mint(p, 1_000 ether);
            vm.deal(p, 100 ether);

            vm.startPrank(p);
            assetA.approve(address(bankA), type(uint256).max);
            assetB.approve(address(bankB), type(uint256).max);
            vm.stopPrank();
        }
    }

    function playersLength() external view returns (uint256) { return players.length; }
    function betIdsLength() external view returns (uint256) { return betIds.length; }

    function openReservedSumA() external view returns (uint256) { return openReservedA; }
    function openReservedSumB() external view returns (uint256) { return openReservedB; }

    function _pick(uint256 seed) internal view returns (address asset, Bank bank, MockERC20 token) {
        if (seed % 2 == 0) {
            return (address(assetA), bankA, assetA);
        } else {
            return (address(assetB), bankB, assetB);
        }
    }

    // ----------------------
    // Risk-in: LP deposit
    // ----------------------

    function action_deposit(uint256 seed, uint256 assetsIn) external {
        (address asset, Bank bank, MockERC20 token) = _pick(seed);
        if (bank.riskInPaused()) return;
        address p = players[seed % players.length];
        assetsIn = bound(assetsIn, 0.1 ether, 50 ether);

        vm.startPrank(p);
        token.approve(address(bank), type(uint256).max);
        try bank.deposit(assetsIn, p) { } catch { }
        vm.stopPrank();

        // silence unused
        asset;
    }

    // ----------------------
    // Risk-in: affiliate opt-in for higher HE
    // ----------------------

    function action_setAffiliateHouseEdge(uint256 seed, uint16 bps) external {
        address affiliate = players[seed % players.length];
        // keep within [default, 100%]
        uint16 minBps = hub.defaultHouseEdgeBps();
        bps = uint16(bound(uint256(bps), uint256(minBps), 10_000));

        vm.prank(affiliate);
        try hub.setAffiliateHouseEdge(bps) { } catch { }
    }

    // ----------------------
    // Risk-in: place bet (random asset)
    // ----------------------

    function action_placeBet(uint256 seed, uint256 amountPerRoll, uint8 cap, uint16 maxHE) external virtual {
        (address asset, , ) = _pick(seed);
        // if unsupported or paused, return
        try hub.riskInPaused(asset) returns (bool paused) {
            if (paused) return;
        } catch {
            return;
        }

        address p = players[seed % players.length];
        address affiliate = players[(seed + 1) % players.length];
        if (affiliate == p) affiliate = address(0);

        amountPerRoll = bound(amountPerRoll, 0.1 ether, 20 ether);
        cap = uint8(bound(uint256(cap), 1, 99));
        uint32 betCount = uint32(bound(seed, 1, 8));

        // maxHouseEdge snapshot for pricing constraints
        maxHE = uint16(bound(uint256(maxHE), uint256(hub.defaultHouseEdgeBps()), 10_000));

        // best-effort bind a referrer (first-touch) to increase coverage
        if (affiliate != address(0) && affiliate != p) {
            vm.prank(p);
            try hub.bindReferrer(affiliate) { } catch { }
        }

        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: amountPerRoll,
            betCount: betCount,
            stopGain: 0,
            stopLoss: 0
        });

        (uint256 fee, ) = hub.quoteVRFFee(betCount);

        vm.prank(p);
        try hub.placeBet{value: fee}(GAME_DICE, asset, abi.encode(cap), spec, affiliate, maxHE) returns (uint256 betId) {
            betIds.push(betId);
            _mirrorParams[betId] = abi.encode(cap);
            _mirrorStakeSpec[betId] = spec;
            _mirrorGameId[betId] = GAME_DICE;
            _observeAndTrackNewBet(betId);
        } catch { }
    }

    // ----------------------
    // Debt-out: VRF fulfill + finalize
    // ----------------------

    
function action_fulfillFinalize(uint256 seed, uint256 rnd) external {
    uint256 n = betIds.length;
    if (n == 0) return;

    uint256 betId = betIds[seed % n];

    SSOTTypes.Bet memory b;
    try hub.getBet(betId) returns (SSOTTypes.Bet memory bb) { b = bb; } catch { return; }

    uint256 pfBefore = Bank(b.bank).protocolFeesPayable();
    uint256 xpBefore = Bank(b.bank).externalPayablesTotal();
    uint256 turnoverBefore = Bank(b.bank).playerTurnover(b.player);

    if (b.state == SSOTTypes.BetState.PendingVRF && b.requestId != 0) {
        _mirrorSeedPlus1[betId] = rnd + 1;
        uint256[] memory rw = new uint256[](1);
        rw[0] = rnd;
        vm.prank(coordinator);
        vrf.fulfillRandomWords(b.requestId, rw);
    }

    SSOTTypes.Bet memory bMid = hub.getBet(betId);
    if (bMid.state == SSOTTypes.BetState.RandomReady) {
        _checkBoundedSettlementOutcome(betId, bMid);
    }

    bool finalized = false;
    try hub.finalize(betId) { finalized = true; } catch { }

    if (finalized) {
        SSOTTypes.Bet memory bAfter = hub.getBet(betId);
        if (bAfter.state == SSOTTypes.BetState.Settled) {
            _checkBudgetConservation_P3(bAfter, pfBefore, xpBefore, turnoverBefore, betId);
        }
    }

    _observeAndTrack(betId);
}

    // ----------------------
    // Debt-out: refund (permissionless, time-gated)
    // ----------------------

    function action_refund(uint256 seed) external {
        uint256 n = betIds.length;
        if (n == 0) return;

        uint256 betId = betIds[seed % n];

        SSOTTypes.Bet memory b;
        try hub.getBet(betId) returns (SSOTTypes.Bet memory bb) { b = bb; } catch { return; }
        if (b.state != SSOTTypes.BetState.PendingVRF) return;

        uint256 readyAt = uint256(b.placedAt) + hub.refundTimeoutSeconds();
        if (block.timestamp <= readyAt) {
            vm.warp(readyAt + 1);
        }

        try hub.refund(betId) { } catch { }
        _observeAndTrack(betId);
    }

    // ----------------------
    // Transport safety: late fulfill after refund should be a no-op
    // ----------------------

    function action_lateFulfillRefunded(uint256 seed, uint256 rnd) external {
        uint256 n = betIds.length;
        if (n == 0) return;

        uint256 betId = betIds[seed % n];

        SSOTTypes.Bet memory b;
        try hub.getBet(betId) returns (SSOTTypes.Bet memory bb) { b = bb; } catch { return; }
        if (b.state != SSOTTypes.BetState.Refunded) return;
        if (b.requestId == 0) return;

        uint256[] memory rw = new uint256[](1);
        rw[0] = rnd;
        vm.prank(coordinator);
        vrf.fulfillRandomWords(b.requestId, rw);

        // MUST remain refunded
        SSOTTypes.Bet memory b2 = hub.getBet(betId);
        assertEq(uint256(b2.state), uint256(SSOTTypes.BetState.Refunded), "late fulfill mutated refunded bet");

        // mirror must remain terminal
        _observeAndTrack(betId);
    }

    // ----------------------
    // Mirror tracking helpers
    // ----------------------

    function _observeAndTrackNewBet(uint256 betId) internal {
        SSOTTypes.Bet memory b = hub.getBet(betId);
        _mirrorState[betId] = b.state;
        _mirrorRequestId[betId] = b.requestId;
        _mirrorBank[betId] = b.bank;
        _mirrorReserved[betId] = b.reserved;
        _mirrorTerminal[betId] = (b.state == SSOTTypes.BetState.Settled || b.state == SSOTTypes.BetState.Refunded);

        if (!_mirrorTerminal[betId]) {
            if (b.bank == address(bankA)) openReservedA += b.reserved;
            else if (b.bank == address(bankB)) openReservedB += b.reserved;
        }
    }

    function _observeAndTrack(uint256 betId) internal {
        SSOTTypes.Bet memory b;
        try hub.getBet(betId) returns (SSOTTypes.Bet memory bb) { b = bb; } catch { return; }

        // Snapshot immutability: bank + reserved must not change post-place
        address mb = _mirrorBank[betId];
        if (mb != address(0)) {
            assertEq(b.bank, mb, "snapshot bank mutated");
            assertEq(b.reserved, _mirrorReserved[betId], "snapshot reserved mutated");
        }

        SSOTTypes.BetState prev = _mirrorState[betId];
        SSOTTypes.BetState next = b.state;

        // B2: legal transitions (post-tx observed states)
        if (prev != SSOTTypes.BetState.None) {
            bool ok = false;
            if (prev == next) ok = true;
            else if (prev == SSOTTypes.BetState.PendingVRF && next == SSOTTypes.BetState.RandomReady) ok = true;
            else if (prev == SSOTTypes.BetState.RandomReady && next == SSOTTypes.BetState.Settled) ok = true;
            else if (prev == SSOTTypes.BetState.PendingVRF && next == SSOTTypes.BetState.Refunded) ok = true;
            else if (prev == SSOTTypes.BetState.PendingVRF && next == SSOTTypes.BetState.Settled) ok = true;

            // terminality
            if (_mirrorTerminal[betId]) {
                // B1: once terminal, cannot change
                ok = (next == prev);
            }

            assertTrue(ok, "illegal bet state transition");
        }

        // C1/C2: request mapping consistency (best-effort mirror)
        if (next == SSOTTypes.BetState.PendingVRF) {
            assertTrue(b.requestId != 0, "pending has no requestId");
        }

        // If moved to terminal, adjust open reserve sums exactly once
        bool nowTerminal = (next == SSOTTypes.BetState.Settled || next == SSOTTypes.BetState.Refunded);
        if (!_mirrorTerminal[betId] && nowTerminal) {
            address bankAddr = _mirrorBank[betId];
            uint256 res = _mirrorReserved[betId];
            if (bankAddr == address(bankA)) openReservedA -= res;
            else if (bankAddr == address(bankB)) openReservedB -= res;
        }

        _mirrorTerminal[betId] = nowTerminal;
        _mirrorState[betId] = next;
        _mirrorRequestId[betId] = b.requestId;
    }



    // ---------------------------------------------------------------------
    // B3: bounded settlement + P3: budget conservation helpers
    // ---------------------------------------------------------------------

    function _seedWord(uint256 betId) internal view returns (bool ok, uint256 word) {
        uint256 sp1 = _mirrorSeedPlus1[betId];
        if (sp1 == 0) return (false, 0);
        return (true, sp1 - 1);
    }

    function _stakeSpecFromBet(SSOTTypes.Bet memory b) internal pure returns (SSOTTypes.StakeSpec memory spec) {
        spec = SSOTTypes.StakeSpec({
            amountPerRoll: b.amountPerRoll,
            betCount: b.betCount,
            stopGain: b.stopGain,
            stopLoss: b.stopLoss
        });
    }

    function _resolveMirror(
        uint256 betId,
        SSOTTypes.Bet memory b
    ) internal view returns (bool ok, uint256 payoutGross, uint256 refundAmount) {
        bytes memory params = _mirrorParams[betId];
        if (params.length == 0) return (false, 0, 0);

        address module = hub.gameModule(b.gameId);
        if (module == address(0)) return (false, 0, 0);

        (bool hasSeed, uint256 seed) = _seedWord(betId);
        if (!hasSeed) return (false, 0, 0);

        uint256[] memory rw = new uint256[](1);
        rw[0] = seed;

        SSOTTypes.StakeSpec memory spec = _stakeSpecFromBet(b);
        (payoutGross, refundAmount) = IGameModule(module).resolve(params, spec, betId, rw);
        ok = true;
    }

    function _checkBoundedSettlementOutcome(uint256 betId, SSOTTypes.Bet memory bReady) internal {
        // Only meaningful in RandomReady
        if (bReady.state != SSOTTypes.BetState.RandomReady) return;

        (bool ok, uint256 payoutGross, uint256 refundAmount) = _resolveMirror(betId, bReady);
        if (!ok) return;

        // reserved must cover total owed
        if (payoutGross + refundAmount > bReady.reserved) {
            _noteViolation(VC_B3, betId);
        }

        // basic sanity
        if (refundAmount > bReady.stake) {
            _noteViolation(VC_B3, betId);
        }
    }

    function _checkBudgetConservation_P3(
        SSOTTypes.Bet memory bSettled,
        uint256 pfBefore,
        uint256 xpBefore,
        uint256 turnoverBefore,
        uint256 betId
    ) internal {
        Bank bank = Bank(bSettled.bank);

        uint256 pfAfter = bank.protocolFeesPayable();
        uint256 xpAfter = bank.externalPayablesTotal();
        uint256 turnoverAfter = bank.playerTurnover(bSettled.player);

        if (pfAfter < pfBefore || xpAfter < xpBefore || turnoverAfter < turnoverBefore) {
            _noteViolation(VC_P3, betId);
            return;
        }

        // recompute usedTurnover via module.resolve (needs refundAmount)
        (bool ok, , uint256 refundAmount) = _resolveMirror(betId, bSettled);
        if (!ok) return;

        if (refundAmount > bSettled.stake) {
            _noteViolation(VC_P3, betId);
            return;
        }

        uint256 usedTurnover = bSettled.stake - refundAmount;

        // turnover delta MUST match usedTurnover
        if (turnoverAfter - turnoverBefore != usedTurnover) {
            _noteViolation(VC_P3, betId);
            return;
        }

        uint256 dPF = pfAfter - pfBefore;
        uint256 dXP = xpAfter - xpBefore;

        uint256 baseHE = Math.mulDiv(usedTurnover, uint256(bSettled.baseHouseEdgeBps), 10_000);
        uint256 deltaHE = 0;
        if (bSettled.effectiveHouseEdgeBps > bSettled.baseHouseEdgeBps) {
            uint256 deltaBps = uint256(bSettled.effectiveHouseEdgeBps) - uint256(bSettled.baseHouseEdgeBps);
            deltaHE = Math.mulDiv(usedTurnover, deltaBps, 10_000);
        }

        uint256 expected = baseHE + deltaHE;

        if (dPF + dXP != expected) {
            _noteViolation(VC_P3, betId);
        }
    }
    // ----------------------
    // Pause toggle (governance) per asset
    // ----------------------

    function action_pause(uint256 seed, bool p) external {
        (address asset, , ) = _pick(seed);
        vm.prank(gov);
        try hub.setRiskInPaused(asset, p) { } catch { }
    }

    
// ----------------------
// D2: Governance calls must not move ASSET (no backdoor)
// ----------------------

function action_govNoAssetBackdoor(uint256 seed, uint256 x) external {
    (address asset, Bank bank, MockERC20 token) = _pick(seed);

    uint256 balBefore = token.balanceOf(address(bank));

    vm.startPrank(gov);
    try hub.setRiskInPaused(asset, (x % 2 == 0)) { } catch { }
    try bank.setMinLiquidityBps(bound(x, 0, 10_000)) { } catch { }
    uint256 vb = bound(x, 1, 365 days);
    try bank.setHoldbackVestingSeconds(vb) { } catch { }
    try bank.setMinPlayerTurnoverForUnlock(bound(x, 0, 200 ether)) { } catch { }
    vm.stopPrank();

    uint256 balAfter = token.balanceOf(address(bank));
    if (balAfter != balBefore) {
        _noteViolation(VC_D2, 0);
    }

    vm.prank(gov);
    try bank.rescueToken(asset, gov, 1) {
        _noteViolation(VC_D2, 0);
    } catch { }

    uint256 balEnd = token.balanceOf(address(bank));
    if (balEnd != balBefore) {
        _noteViolation(VC_D2, 0);
    }
}

// ----------------------
    // D1: When paused, risk-in + optional outflows must fail
    // ----------------------

    
function action_placeBetWhenPausedMustFail(uint256 seed, uint256 amountPerRoll, uint8 cap) external {
    (address asset, , ) = _pick(seed);
    bool p;
    try hub.riskInPaused(asset) returns (bool paused_) { p = paused_; } catch { return; }
    if (!p) return;

    address player = players[seed % players.length];
    amountPerRoll = bound(amountPerRoll, 0.1 ether, 5 ether);
    cap = uint8(bound(uint256(cap), 1, 99));

    SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
        amountPerRoll: amountPerRoll,
        betCount: 1,
        stopGain: 0,
        stopLoss: 0
    });

    (uint256 fee, ) = hub.quoteVRFFee(1);

    vm.prank(player);
    try hub.placeBet{value: fee}(GAME_DICE, asset, abi.encode(cap), spec, address(0), hub.defaultHouseEdgeBps()) returns (uint256) {
        _noteViolation(VC_LIVE, 0);
    } catch { }
}

    
function action_optionalOutflowWhenPausedMustFail(uint256 seed) external {
    ( , Bank bank, ) = _pick(seed);
    if (!bank.riskInPaused()) return;

    address owner = players[seed % players.length];

    uint256 bal = bank.balanceOf(owner);
    if (bal > 0) {
        vm.prank(owner);
        try bank.redeem(1, owner, owner) {
            _noteViolation(VC_E3, 0);
        } catch { }
    }

    uint256 xp = bank.xpAccruedOf(owner);
    if (xp > 0) {
        vm.prank(owner);
        try bank.claimXPAcrued(1, owner) {
            _noteViolation(VC_E3, 0);
        } catch { }
    }
}

    // ----------------------
    // Debt-out liveness: when ready, refund/finalize must succeed even if paused
    // ----------------------

    
function action_finalizeReadyMustSucceed(uint256 seed) external {
    uint256 n = betIds.length;
    if (n == 0) return;
    uint256 betId = betIds[seed % n];

    SSOTTypes.Bet memory b;
    try hub.getBet(betId) returns (SSOTTypes.Bet memory bb) { b = bb; } catch { return; }
    if (b.state != SSOTTypes.BetState.RandomReady) return;

    uint256 pfBefore = Bank(b.bank).protocolFeesPayable();
    uint256 xpBefore = Bank(b.bank).externalPayablesTotal();
    uint256 turnoverBefore = Bank(b.bank).playerTurnover(b.player);

    vm.prank(address(uint160(uint256(keccak256(abi.encodePacked(seed, block.number))))));
    bool ok = true;
    try hub.finalize(betId) { } catch { ok = false; }

    if (!ok) {
        _noteViolation(VC_LIVE, betId);
        return;
    }

    SSOTTypes.Bet memory bAfter = hub.getBet(betId);
    if (bAfter.state != SSOTTypes.BetState.Settled) {
        _noteViolation(VC_LIVE, betId);
        return;
    }

    _checkBudgetConservation_P3(bAfter, pfBefore, xpBefore, turnoverBefore, betId);
    _observeAndTrack(betId);
}

    
function action_refundReadyMustSucceed(uint256 seed) external {
    uint256 n = betIds.length;
    if (n == 0) return;
    uint256 betId = betIds[seed % n];

    SSOTTypes.Bet memory b;
    try hub.getBet(betId) returns (SSOTTypes.Bet memory bb) { b = bb; } catch { return; }
    if (b.state != SSOTTypes.BetState.PendingVRF) return;

    uint256 readyAt = uint256(b.placedAt) + hub.refundTimeoutSeconds();
    if (block.timestamp <= readyAt) vm.warp(readyAt + 1);

    vm.prank(address(uint160(uint256(keccak256(abi.encodePacked(seed, block.timestamp))))));
    bool ok = true;
    try hub.refund(betId) { } catch { ok = false; }

    if (!ok) {
        _noteViolation(VC_LIVE, betId);
        return;
    }

    SSOTTypes.Bet memory bAfter = hub.getBet(betId);
    if (bAfter.state != SSOTTypes.BetState.Refunded) {
        _noteViolation(VC_LIVE, betId);
        return;
    }

    _observeAndTrack(betId);
}

    // ----------------------
    // Optional outflows: withdraw/redeem + XP claim
    // If they succeed, A4 MUST hold post-state.
    // ----------------------

    function action_withdraw(uint256 seed, uint256 assetsOut) external {
        ( , Bank bank, ) = _pick(seed);
        if (bank.riskInPaused()) return;
        address owner = players[seed % players.length];
        assetsOut = bound(assetsOut, 0.01 ether, 20 ether);

        vm.prank(owner);
        try bank.withdraw(assetsOut, owner, owner) {
            _assertOptionalOutflowDomain(bank);
        } catch { }
    }

    function action_redeem(uint256 seed, uint256 shares) external {
        ( , Bank bank, ) = _pick(seed);
        if (bank.riskInPaused()) return;
        address owner = players[seed % players.length];
        uint256 bal = bank.balanceOf(owner);
        if (bal == 0) return;
        shares = bound(shares, 1, bal);

        vm.prank(owner);
        try bank.redeem(shares, owner, owner) {
            _assertOptionalOutflowDomain(bank);
        } catch { }
    }

    function action_claimXPAcrued(uint256 seed, uint256 amount) external {
        ( , Bank bank, ) = _pick(seed);
        if (bank.riskInPaused()) return;
        address payee = players[seed % players.length];
        uint256 bal = bank.xpAccruedOf(payee);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);

        vm.prank(payee);
        try bank.claimXPAcrued(amount, payee) {
            _assertOptionalOutflowDomain(bank);
        } catch { }
    }

    // ----------------------
    // Permissionless XP bucket moves (must never revert)
    // ----------------------

    function action_unlock_locked(uint256 seedA, uint256 seedB) external {
        ( , Bank bank, ) = _pick(seedA);
        uint256 xpBefore = bank.externalPayablesTotal();
        address payee = players[bound(seedA, 0, players.length - 1)];
        address src = players[bound(seedB, 0, players.length - 1)];

        address caller = address(uint160(uint256(keccak256(abi.encodePacked(seedA, seedB, block.number)))));
        vm.prank(caller);
        try bank.unlockXPLocked(payee, src) { } catch { _noteViolation(VC_LIVE, 0); }
        uint256 xpAfter = bank.externalPayablesTotal();
        if (xpAfter != xpBefore) _noteViolation(VC_E2, 0);
    }

    function action_sync_holdback(uint256 seedA) external {
        ( , Bank bank, ) = _pick(seedA);
        uint256 xpBefore = bank.externalPayablesTotal();
        address payee = players[bound(seedA, 0, players.length - 1)];
        address caller = address(uint160(uint256(keccak256(abi.encodePacked(seedA, block.timestamp)))));
        vm.prank(caller);
        try bank.syncXPHoldback(payee) { } catch { _noteViolation(VC_LIVE, 0); }
        uint256 xpAfter = bank.externalPayablesTotal();
        if (xpAfter != xpBefore) _noteViolation(VC_E2, 0);
    }

    function _assertOptionalOutflowDomain(Bank bank) internal {
        SSOTTypes.SSOT memory s = bank.getSSOT();
        // A4 post-condition for optional outflows
        if (s.NAV < s.R) { _noteViolation(VC_A4, 0); }
        else if (s.NAV - s.R < s.minLiq) { _noteViolation(VC_A4, 0); }
    }
}

contract MultiAssetInvariants is StdInvariant, Test {
    MockERC20 assetA;
    MockERC20 assetB;

    Bank bankA;
    Bank bankB;

    BankRegistry registry;
    Hub hub;
    VRFHub vrf;

    Handler handler;

    address gov = address(0xA11CE);
    address coordinator = address(0xC0FFEE);

    function setUp() external {
        assetA = new MockERC20("AssetA", "ASTA", 18);
        assetB = new MockERC20("AssetB", "ASTB", 18);

        vrf = new VRFHub(coordinator, gov);

        bankA = new Bank(address(assetA), address(0), gov, 1000, "LP ASTA", "LPA", 18);
        bankB = new Bank(address(assetB), address(0), gov, 1000, "LP ASTB", "LPB", 18);

        registry = new BankRegistry(gov);
        vm.startPrank(gov);
        registry.registerBank(address(assetA), address(bankA));
        registry.registerBank(address(assetB), address(bankB));
        vm.stopPrank();

        ReferralRegistry refRegistry = new ReferralRegistry(gov);
        DefaultReferralEngine refEngine = new DefaultReferralEngine();

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
            200,
            0,
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

        // keep XP gating simple
        bankA.setMinPlayerTurnoverForUnlock(20 ether);
        bankB.setMinPlayerTurnoverForUnlock(20 ether);
        bankA.setHoldbackVestingSeconds(10);
        bankB.setHoldbackVestingSeconds(10);
        vm.stopPrank();

        // register game
        DiceModule dice = new DiceModule();
        vm.prank(gov);
        hub.registerGame(keccak256("DICE"), address(dice));

        // provide some liquidity for both banks
        assetA.mint(gov, 5_000 ether);
        assetB.mint(gov, 5_000 ether);
        vm.startPrank(gov);
        assetA.approve(address(bankA), type(uint256).max);
        assetB.approve(address(bankB), type(uint256).max);
        bankA.deposit(2_000 ether, gov);
        bankB.deposit(2_000 ether, gov);
        vm.stopPrank();

        handler = new Handler(assetA, assetB, bankA, bankB, hub, vrf, gov, coordinator);
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](17);
        selectors[0] = Handler.action_deposit.selector;
        selectors[1] = Handler.action_setAffiliateHouseEdge.selector;
        selectors[2] = Handler.action_placeBet.selector;
        selectors[3] = Handler.action_fulfillFinalize.selector;
        selectors[4] = Handler.action_refund.selector;
        selectors[5] = Handler.action_lateFulfillRefunded.selector;
        selectors[6] = Handler.action_pause.selector;
        selectors[7] = Handler.action_withdraw.selector;
        selectors[8] = Handler.action_redeem.selector;
        selectors[9] = Handler.action_claimXPAcrued.selector;

        // D-class + liveness strengthening
        selectors[10] = Handler.action_placeBetWhenPausedMustFail.selector;
        selectors[11] = Handler.action_optionalOutflowWhenPausedMustFail.selector;
        selectors[12] = Handler.action_finalizeReadyMustSucceed.selector;
        selectors[13] = Handler.action_refundReadyMustSucceed.selector;

        // Permissionless XP moves (must never revert)
        selectors[14] = Handler.action_unlock_locked.selector;
        selectors[15] = Handler.action_sync_holdback.selector;

        // Governance hygiene (D2)
        selectors[16] = Handler.action_govNoAssetBackdoor.selector;

        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @notice Core per-asset solvency invariants.
    function invariant_A1_totalAssets_equals_NAV_per_asset() external view {
        _assertPerAssetTotalAssetsEqualsNAV(address(assetA));
        _assertPerAssetTotalAssetsEqualsNAV(address(assetB));
    }

    function _assertPerAssetTotalAssetsEqualsNAV(address asset) internal view {
        Bank bank = (asset == address(assetA)) ? bankA : bankB;
        SSOTTypes.SSOT memory s = bank.getSSOT();
        uint256 ta = bank.totalAssets();
        assertEq(ta, s.NAV, "A1 totalAssets != NAV");
        // NAV identity is by definition B - PF - XP (AccountingLib.nav).
        // This check is redundant with Bank.getSSOT() but makes the invariant explicit.
        assertEq(s.NAV, s.B - s.PF - s.XP, "A1 NAV identity");
    }

    function invariant_A2_A3_per_asset() external view {
        _assertSolvent(bankA);
        _assertSolvent(bankB);
    }

    /// @notice B4: totalReserved equals sum of active bet reserves (per asset).
    function invariant_B4_totalReserved_matches_active_reserves() external view {
        assertEq(bankA.totalReserved(), handler.openReservedA(), "B4 R mismatch A");
        assertEq(bankB.totalReserved(), handler.openReservedB(), "B4 R mismatch B");
    }

    /// @notice X1: no cross-asset custody leakage between banks.
    function invariant_X1_no_cross_asset_custody_leakage() external view {
        assertEq(assetA.balanceOf(address(bankB)), 0, "X1 bankB holds assetA");
        assertEq(assetB.balanceOf(address(bankA)), 0, "X1 bankA holds assetB");
    }

    /// @notice C1/C2: request mapping consistency (sampled over recent betIds).
    function invariant_C1_request_mapping_consistency_sampled() external view {
        uint256 n = handler.betIdsLength();
        uint256 limit = n > 64 ? 64 : n;
        for (uint256 i = 0; i < limit; i++) {
            uint256 betId = handler.betIds(i);
            SSOTTypes.Bet memory b = hub.getBet(betId);
            if (b.requestId == 0) continue;
            uint256 mapped = hub.requestToBetId(b.requestId);
            if (b.state == SSOTTypes.BetState.PendingVRF) {
                assertEq(mapped, betId, "C1 pending mapping wrong");
            } else {
                assertEq(mapped, 0, "C1 non-pending should be detached");
            }
        }
    }

    
    /// @notice D2: governance must not have an ASSET backdoor.
    function invariant_D2_no_asset_backdoor() external view {
        assertEq(handler.v_D2_noAssetBackdoor(), 0, "D2 violated");
    }

    /// @notice E2: permissionless bucket moves preserve XP_total.
    function invariant_E2_bucket_moves_preserve_total() external view {
        assertEq(handler.v_E2_bucketMovesPreserveTotal(), 0, "E2 violated");
    }

    /// @notice E3: claim (optional outflow) must be pause-gated.
    function invariant_E3_claim_pause_gated() external view {
        assertEq(handler.v_E3_claimPauseGated(), 0, "E3 violated");
    }

    /// @notice B3: realized settlement is always bounded by reserved (per bet).
    function invariant_B3_bounded_settlement_outcome() external view {
        assertEq(handler.v_B3_boundedSettlement(), 0, "B3 violated");
    }

    /// @notice P3: house-edge accrual equals PF delta + XP delta per settled bet.
    function invariant_P3_budget_conservation() external view {
        assertEq(handler.v_P3_budgetConservation(), 0, "P3 violated");
    }

    /// @notice A4: if optional outflows succeed, NAV-R must remain >= minLiq.
    function invariant_A4_optional_outflow_domain() external view {
        assertEq(handler.v_A4_optionalOutflowDomain(), 0, "A4 violated");
    }

    /// @notice Debt-out liveness: ready finalize/refund must not revert.
    function invariant_LIVE_debt_out_must_succeed() external view {
        assertEq(handler.v_LIVE_debtOutMustSucceed(), 0, "LIVE violated");
    }

function _assertSolvent(Bank bank) internal view {
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertGe(s.B, s.PF + s.XP, "A2 B<PF+XP");
        assertGe(s.NAV, s.R, "A3 NAV<R");
        // identity
        assertEq(bank.totalAssets(), s.NAV, "A1 totalAssets!=NAV");
    }
}
