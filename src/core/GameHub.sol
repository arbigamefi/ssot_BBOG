// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IGameHub} from "./interfaces/IGameHub.sol";
import {IBank} from "./interfaces/IBank.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {ISettlementRouter} from "./interfaces/ISettlementRouter.sol";
import {IVRFHub} from "./interfaces/IVRFHub.sol";
import {IGameModule} from "./interfaces/IGameModule.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";
import {HouseEdgeLib} from "../libs/HouseEdgeLib.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IReferralRegistry} from "../engines/referral/IReferralRegistry.sol";
import {IReferralEngine} from "../engines/referral/IReferralEngine.sol";

/// @notice GameHub = casino-game lifecycle SSOT + skyline pricing + referral orchestration.
///
/// Option 1 (institutional):
/// - player = msg.sender (no relayer / no delegated betting)
/// - affiliate hint is used for best-effort first-touch binding + skyline pricing
/// - bet snapshots pricing, referral schedule and referral payees to prevent retroactive changes
///
/// House-edge allocation (SSOT v1.6, ADR-0032): of the turnover edge E, LPs retain E - O where
/// O = floor(E * (10000 - LP_SHARE_BPS) / 10000). Referral rewards and markup are paid from O, and whatever
/// they do not use accrues as protocol fees. The SettlementRouter enforces the same bound independently.
contract GameHub is IGameHub, Governable, ReentrancyGuard {
    uint16 internal constant BPS = 10_000;
    uint8 internal constant MAX_SKYLINE_SEGMENTS = 6;

    uint16 public constant override LP_SHARE_BPS = HouseEdgeLib.LP_SHARE_BPS;
    uint16 public constant override MAX_REFERRAL_BPS = HouseEdgeLib.MAX_REFERRAL_BPS;
    uint16 public constant override MAX_HOUSE_EDGE_BPS = HouseEdgeLib.MAX_HOUSE_EDGE_BPS;
    uint256 public constant override EDGE_CHANGE_DELAY = HouseEdgeLib.EDGE_CHANGE_DELAY;

    address public immutable override settlementRouter;
    address public immutable override vrfHub;

    address public immutable override referralRegistry;
    address public immutable override referralEngine;

    uint256 public override refundTimeoutSeconds;

    // pricing
    uint16 public override defaultHouseEdgeBps; // active base edge h_b
    uint16 public override maxAffiliateDeltaBps; // active markup cap; 0 disables markup
    mapping(address => uint16) public override affiliateHouseEdgeBps; // 0 => unset

    /// @dev activatesAt == 0 means nothing is queued.
    struct PendingEdgeChange {
        uint16 bps;
        uint64 activatesAt;
    }

    PendingEdgeChange public override pendingBaseHouseEdge;
    PendingEdgeChange public override pendingMaxAffiliateDelta;

    /// @dev Immutable once created. Rates are bps of the base turnover edge; l0 + l1 + l2 <= MAX_REFERRAL_BPS.
    struct ReferralSchedule {
        uint16 l0Bps; // player rakeback, paid only if the player had a referrer at acceptance
        uint16 l1Bps; // direct referrer
        uint16 l2Bps; // referrer's referrer
        uint16 holdbackBps; // share of L1/L2 and markup amounts that vests linearly
        bool exists;
    }

    mapping(uint32 => ReferralSchedule) internal _refCfg;
    uint32 internal _nextRefCfgId = 1;
    uint32 public override activeReferralConfigId;

    struct ReferralPayees {
        address l1;
        address l2;
    }

    mapping(bytes32 => address) public override gameModule;

    mapping(uint256 => SSOTTypes.Bet) internal bets;
    mapping(uint256 => SSOTTypes.BetTerminal) internal betTerminals;
    mapping(uint256 => bytes) internal betParams;
    mapping(uint256 => bytes) internal betRandomData;
    mapping(uint256 => bytes) internal betDeltaSkyline;
    mapping(uint256 => ReferralPayees) internal betReferralPayees;

    mapping(uint256 => uint256) public requestToBetId;

    bytes32 internal constant REASON_REF_L0 = keccak256("REF_L0");
    bytes32 internal constant REASON_REF_L1 = keccak256("REF_L1");
    bytes32 internal constant REASON_REF_L2 = keccak256("REF_L2");
    bytes32 internal constant REASON_REF_MARKUP = keccak256("REF_MARKUP");

    /// @dev Per-bet allocation of the turnover edge, computed at finalize.
    struct Allocation {
        uint256 edge; // E
        uint256 operatorShare; // O
        uint256 r0;
        uint256 r1;
        uint256 r2;
        uint256 markup; // M
        uint256 protocolFee; // O - r0 - r1 - r2 - M
    }

    constructor(
        address settlementRouter_,
        address vrfHub_,
        address referralRegistry_,
        address referralEngine_,
        address gov_,
        uint256 refundTimeoutSeconds_,
        uint16 defaultHouseEdgeBps_,
        // initial referral schedule
        uint16 l0Bps_,
        uint16 l1Bps_,
        uint16 l2Bps_,
        uint16 holdbackBps_
    ) Governable(gov_) {
        if (
            settlementRouter_ == address(0) || vrfHub_ == address(0) || referralRegistry_ == address(0)
                || referralEngine_ == address(0)
        ) {
            revert Errors.ZeroAddress();
        }

        _validateBaseHouseEdge(defaultHouseEdgeBps_);

        settlementRouter = settlementRouter_;
        vrfHub = vrfHub_;
        referralRegistry = referralRegistry_;
        referralEngine = referralEngine_;

        refundTimeoutSeconds = refundTimeoutSeconds_;
        emit RefundTimeoutSet(refundTimeoutSeconds_);

        // Affiliate markup starts disabled (SSOT v1.6 section 4); enabling it goes through the delay.
        defaultHouseEdgeBps = defaultHouseEdgeBps_;
        emit BaseHouseEdgeActivated(0, defaultHouseEdgeBps_);

        // schedule id 1 is created and activated at deployment
        uint32 id = _createReferralConfig(l0Bps_, l1Bps_, l2Bps_, holdbackBps_);
        activeReferralConfigId = id;
        emit ActiveReferralConfigSet(0, id);
    }

    function riskInPaused(uint64 poolId) public view override returns (bool) {
        SSOTTypes.Pool memory p = _casinoPool(poolId);
        return !p.active || IBank(p.bank).riskInPaused();
    }

    // --- governance ---

    function setRefundTimeout(uint256 seconds_) external onlyGov {
        refundTimeoutSeconds = seconds_;
        emit RefundTimeoutSet(seconds_);
    }

    // Base edge: queued, then activated by anyone once EDGE_CHANGE_DELAY has passed. Bets snapshot the edge at
    // acceptance, so a change never reaches a bet that was already accepted.

    function queueBaseHouseEdge(uint16 bps) external override onlyGov {
        _validateBaseHouseEdge(bps);
        uint64 activatesAt = uint64(block.timestamp + HouseEdgeLib.EDGE_CHANGE_DELAY);
        pendingBaseHouseEdge = PendingEdgeChange({bps: bps, activatesAt: activatesAt});
        emit BaseHouseEdgeQueued(defaultHouseEdgeBps, bps, activatesAt);
    }

    function activateBaseHouseEdge() external override {
        PendingEdgeChange memory pending = _readyChange(pendingBaseHouseEdge);
        uint16 old = defaultHouseEdgeBps;
        defaultHouseEdgeBps = pending.bps;
        delete pendingBaseHouseEdge;
        emit BaseHouseEdgeActivated(old, pending.bps);
    }

    function cancelBaseHouseEdge() external override onlyGov {
        PendingEdgeChange memory pending = pendingBaseHouseEdge;
        if (pending.activatesAt == 0) revert NoPendingEdgeChange();
        delete pendingBaseHouseEdge;
        emit BaseHouseEdgeChangeCancelled(defaultHouseEdgeBps, pending.bps);
    }

    // Markup cap: a decrease protects players and applies at once (superseding any queued increase);
    // an increase is queued like a base-edge change.

    function setMaxAffiliateDeltaBps(uint16 bps) external override onlyGov {
        if (bps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS) revert Errors.InvalidBps(bps);
        uint16 old = maxAffiliateDeltaBps;
        if (bps <= old) {
            maxAffiliateDeltaBps = bps;
            delete pendingMaxAffiliateDelta;
            emit MaxAffiliateDeltaSet(old, bps);
            return;
        }
        uint64 activatesAt = uint64(block.timestamp + HouseEdgeLib.EDGE_CHANGE_DELAY);
        pendingMaxAffiliateDelta = PendingEdgeChange({bps: bps, activatesAt: activatesAt});
        emit MaxAffiliateDeltaQueued(old, bps, activatesAt);
    }

    function activateMaxAffiliateDelta() external override {
        PendingEdgeChange memory pending = _readyChange(pendingMaxAffiliateDelta);
        uint16 old = maxAffiliateDeltaBps;
        maxAffiliateDeltaBps = pending.bps;
        delete pendingMaxAffiliateDelta;
        emit MaxAffiliateDeltaSet(old, pending.bps);
    }

    function cancelMaxAffiliateDelta() external override onlyGov {
        PendingEdgeChange memory pending = pendingMaxAffiliateDelta;
        if (pending.activatesAt == 0) revert NoPendingEdgeChange();
        delete pendingMaxAffiliateDelta;
        emit MaxAffiliateDeltaChangeCancelled(maxAffiliateDeltaBps, pending.bps);
    }

    // Referral schedules are versioned: a new schedule is a new id, and activation applies to bets accepted
    // afterwards.

    function createReferralConfig(uint16 l0Bps, uint16 l1Bps, uint16 l2Bps, uint16 holdbackBps)
        external
        override
        onlyGov
        returns (uint32 id)
    {
        id = _createReferralConfig(l0Bps, l1Bps, l2Bps, holdbackBps);
    }

    function setActiveReferralConfig(uint32 id) external override onlyGov {
        if (!_refCfg[id].exists) revert UnknownReferralConfig(id);
        uint32 old = activeReferralConfigId;
        activeReferralConfigId = id;
        emit ActiveReferralConfigSet(old, id);
    }

    function getReferralConfig(uint32 id)
        external
        view
        override
        returns (uint16 l0Bps, uint16 l1Bps, uint16 l2Bps, uint16 holdbackBps)
    {
        ReferralSchedule storage c = _refCfg[id];
        if (!c.exists) revert UnknownReferralConfig(id);
        return (c.l0Bps, c.l1Bps, c.l2Bps, c.holdbackBps);
    }

    // --- pricing ---

    function getAffiliateHouseEdge(address affiliate) public view override returns (uint16) {
        uint16 v = affiliateHouseEdgeBps[affiliate];
        return v == 0 ? defaultHouseEdgeBps : v;
    }

    function setAffiliateHouseEdge(uint16 houseEdgeBps) external override {
        uint16 def = defaultHouseEdgeBps;
        if (houseEdgeBps < def) revert HouseEdgeTooLow(houseEdgeBps, def);

        uint16 maxAllowed = _maxAffiliateHouseEdge(def);
        if (houseEdgeBps > maxAllowed) revert HouseEdgeTooHigh(houseEdgeBps, maxAllowed);

        uint16 old = affiliateHouseEdgeBps[msg.sender];
        affiliateHouseEdgeBps[msg.sender] = houseEdgeBps;
        emit AffiliateHouseEdgeSet(msg.sender, old, houseEdgeBps);
    }

    // --- referral registry ---

    function bindReferrer(address referrer) external override {
        IReferralRegistry(referralRegistry).bindFor(msg.sender, referrer);
        emit ReferrerBound(msg.sender, referrer);
    }

    function referrerOf(address player) external view override returns (address) {
        return IReferralRegistry(referralRegistry).referrerOf(player);
    }

    // --- games ---

    function registerGame(bytes32 gameId, address module) external override onlyGov {
        if (module == address(0)) revert Errors.ZeroAddress();
        if (gameModule[gameId] != address(0)) revert Errors.InvalidConfig();
        gameModule[gameId] = module;
        emit GameRegistered(gameId, module);
    }

    function getBet(uint256 betId) external view override returns (SSOTTypes.Bet memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return b;
    }

    function getBetTerminal(uint256 betId) external view override returns (SSOTTypes.BetTerminal memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return betTerminals[betId];
    }

    function getBetParams(uint256 betId) external view override returns (bytes memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return betParams[betId];
    }

    function getBetRandomWords(uint256 betId) external view override returns (uint256[] memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        bytes memory data = betRandomData[betId];
        if (data.length == 0) return new uint256[](0);
        return abi.decode(data, (uint256[]));
    }

    function getDeltaSkyline(uint256 betId) external view override returns (bytes memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return betDeltaSkyline[betId];
    }

    function getBetReferralPayees(uint256 betId) external view override returns (address l1, address l2) {
        if (bets[betId].state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        ReferralPayees memory payees = betReferralPayees[betId];
        return (payees.l1, payees.l2);
    }

    function nextPositionIdHint() external view override returns (uint256) {
        return ISettlementRouter(settlementRouter).nextPositionId();
    }

    // ---------------------------------------------------------------------
    // Risk-In: placeBet (player=msg.sender)
    // ---------------------------------------------------------------------

    uint32 internal constant MAX_BET_COUNT = 100;

    function quoteVRFFee(uint32 betCount) public view override returns (uint256 fee, uint32 callbackGasLimit) {
        // Callback gas scales with betCount (multi-roll). Keep a safe cap.
        uint32 cb = uint32(300_000 + uint256(betCount) * 20_000);
        if (cb > 2_000_000) cb = 2_000_000;
        callbackGasLimit = cb;
        fee = IVRFHub(vrfHub).quote(cb, 3, 1);
    }

    function placeBet(
        bytes32 gameId,
        uint64 poolId,
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        address affiliate,
        uint16 maxHouseEdgeBps
    ) external payable override nonReentrant returns (uint256 positionId) {
        SSOTTypes.Pool memory pool_ = _casinoPool(poolId);
        if (!pool_.active || IBank(pool_.bank).riskInPaused()) revert RiskInPaused(poolId);
        if (stakeSpec.amountPerRoll == 0) revert Errors.InsufficientBalance();
        if (stakeSpec.betCount == 0 || stakeSpec.betCount > MAX_BET_COUNT) revert Errors.InvalidConfig();

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        if (stake == 0) revert Errors.InsufficientBalance();

        address player = msg.sender;

        address asset = pool_.asset;
        address bank_ = pool_.bank;

        address module = gameModule[gameId];
        if (module == address(0)) revert UnknownGame(gameId);

        IGameModule(module).validate(params, stakeSpec);
        uint256 reserved = IGameModule(module).maxPayout(params, stakeSpec);
        if (reserved == 0) revert Errors.InsufficientBalance();

        bytes32 paramsHash = keccak256(
            abi.encode(params, stakeSpec.amountPerRoll, stakeSpec.betCount, stakeSpec.stopGain, stakeSpec.stopLoss)
        );

        // Normalize player-specified maxHouseEdgeBps for auditability.
        // (0 => defaultHouseEdgeBps; >MAX_HOUSE_EDGE_BPS => MAX_HOUSE_EDGE_BPS)
        uint16 usedMaxHE = maxHouseEdgeBps;
        if (usedMaxHE == 0) usedMaxHE = defaultHouseEdgeBps;
        if (usedMaxHE > HouseEdgeLib.MAX_HOUSE_EDGE_BPS) usedMaxHE = HouseEdgeLib.MAX_HOUSE_EDGE_BPS;

        // Referral payees (after best-effort first-touch binding) + pricing snapshot + skyline
        (address pricingAff, address l1, address l2) = _snapshotReferral(player, affiliate);
        uint16 baseHE = defaultHouseEdgeBps;
        (uint16 effectiveHE, bytes memory skyline) = _computeSkyline(pricingAff, baseHE);
        if (effectiveHE > usedMaxHE) revert HouseEdgeTooHigh(effectiveHE, usedMaxHE);
        bytes32 skylineHash = keccak256(skyline);

        uint32 cfgId = activeReferralConfigId;

        bytes32 snapshotHash = keccak256(
            abi.encodePacked(
                gameId,
                module,
                poolId,
                asset,
                bank_,
                block.chainid,
                cfgId,
                pricingAff,
                baseHE,
                effectiveHE,
                usedMaxHE,
                skylineHash,
                l1,
                l2
            )
        );

        positionId = ISettlementRouter(settlementRouter)
            .openPosition(poolId, player, stake, reserved, snapshotHash, effectiveHE);
        betDeltaSkyline[positionId] = skyline;
        if (l1 != address(0)) betReferralPayees[positionId] = ReferralPayees({l1: l1, l2: l2});

        SSOTTypes.Bet storage b = bets[positionId];
        b.betId = positionId;
        b.gameId = gameId;
        b.player = player;
        b.asset = asset;
        b.bank = bank_;
        b.stake = stake;
        b.reserved = reserved;

        b.amountPerRoll = stakeSpec.amountPerRoll;
        b.betCount = stakeSpec.betCount;
        b.stopGain = stakeSpec.stopGain;
        b.stopLoss = stakeSpec.stopLoss;

        b.pricingAffiliate = pricingAff;
        b.baseHouseEdgeBps = baseHE;
        b.effectiveHouseEdgeBps = effectiveHE;
        b.maxHouseEdgeBps = usedMaxHE;
        b.referralConfigId = cfgId;
        b.deltaSkylineHash = skylineHash;

        b.snapshotHash = snapshotHash;
        b.paramsHash = paramsHash;
        b.placedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.Held;

        betParams[positionId] = params;

        // --- VRF fee: charged in native token (refactored parity) ---
        (uint256 requiredFee, uint32 cb) = quoteVRFFee(stakeSpec.betCount);
        if (msg.value < requiredFee) revert IVRFHub.InsufficientVRFFee(msg.value, requiredFee);

        (uint256 requestId, uint256 charged) =
            IVRFHub(vrfHub).requestRandomWords{value: msg.value}(address(this), positionId, cb, 3, 1, player);
        b.vrfFeePaid = msg.value;
        b.vrfFeeCharged = charged;
        b.vrfCallbackGasLimit = cb;
        b.requestId = requestId;
        b.vrfRequestedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.PendingVRF;
        requestToBetId[requestId] = positionId;

        emit BetPlaced(
            positionId,
            gameId,
            player,
            poolId,
            asset,
            bank_,
            stake,
            reserved,
            stakeSpec.amountPerRoll,
            stakeSpec.betCount,
            stakeSpec.stopGain,
            stakeSpec.stopLoss,
            msg.value,
            charged,
            cb,
            requestId,
            snapshotHash,
            paramsHash,
            pricingAff,
            baseHE,
            effectiveHE,
            usedMaxHE,
            cfgId,
            skylineHash
        );
    }

    // ---------------------------------------------------------------------
    // VRF callback
    // ---------------------------------------------------------------------

    function onRandomWords(uint256 requestId, uint256[] calldata randomWords) external override {
        if (msg.sender != vrfHub) revert NotVRFHub();
        uint256 betId = requestToBetId[requestId];
        if (betId == 0) return;

        SSOTTypes.Bet storage b = bets[betId];
        if (b.state != SSOTTypes.BetState.PendingVRF) return;

        bytes32 rh = keccak256(abi.encode(randomWords));
        b.randomHash = rh;
        b.state = SSOTTypes.BetState.RandomReady;
        betRandomData[betId] = abi.encode(randomWords);

        // C1/C2 hygiene: requestId is only meaningful while PendingVRF.
        // Clear mapping ASAP (even though VRFHub deactivates requests on first fulfill).
        requestToBetId[requestId] = 0;
        _detachRequestIfOwned(requestId);

        emit BetRandomReady(betId, requestId, rh);
    }

    // ---------------------------------------------------------------------
    // Debt-Out: finalize (permissionless)
    // ---------------------------------------------------------------------

    function finalize(uint256 betId) external override nonReentrant {
        SSOTTypes.Bet storage b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        if (b.state != SSOTTypes.BetState.RandomReady) revert BadState(betId, b.state, SSOTTypes.BetState.RandomReady);

        address module = gameModule[b.gameId];
        if (module == address(0)) revert UnknownGame(b.gameId);

        uint256[] memory randomWords = abi.decode(betRandomData[betId], (uint256[]));
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: b.amountPerRoll, betCount: b.betCount, stopGain: b.stopGain, stopLoss: b.stopLoss
        });
        uint256 payoutGross;
        uint256 refundAmount;
        try IGameModule(module).resolve(betParams[betId], spec, betId, randomWords) returns (
            uint256 resolvedPayoutGross,
            uint256 resolvedRefundAmount
        ) {
            payoutGross = resolvedPayoutGross;
            refundAmount = resolvedRefundAmount;
        } catch {
            _refundInvalidRandomReadyBet(betId, b);
            return;
        }
        if (refundAmount > b.stake) {
            _refundInvalidRandomReadyBet(betId, b);
            return;
        }
        // reserved must cover total owed (payoutGross + refundAmount)
        if (payoutGross > b.reserved || refundAmount > b.reserved - payoutGross) {
            _refundInvalidRandomReadyBet(betId, b);
            return;
        }

        // ---- Fee-on-payout ----
        uint256 feeOnPayout = 0;
        uint256 payoutNet = payoutGross;
        if (payoutGross > 0) {
            feeOnPayout = Math.mulDiv(payoutGross, uint256(b.effectiveHouseEdgeBps), BPS);
            if (feeOnPayout > payoutGross) feeOnPayout = payoutGross;
            payoutNet = payoutGross - feeOnPayout;
        }

        uint256 usedTurnover = b.stake - refundAmount;

        // ---- house-edge allocation (turnover-based, SSOT v1.6) ----
        (Allocation memory alloc, IReferralEngine.Plan memory planB, IReferralEngine.Plan memory planD) =
            _allocate(betId, b, usedTurnover);
        uint256 protocolFeeAccrual = alloc.protocolFee;

        // ---- convert plans to XP awards ----
        SSOTTypes.XPAward[] memory awards = _plansToAwards(b.player, planB, planD);

        b.resolvedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.Settled;
        betTerminals[betId] = SSOTTypes.BetTerminal({
            state: SSOTTypes.BetState.Settled,
            payoutGross: payoutGross,
            payoutNet: payoutNet,
            feeOnPayout: feeOnPayout,
            protocolFeeAccrual: protocolFeeAccrual,
            refundAmount: refundAmount
        });

        // clear request mapping to prevent any late transport artifacts
        _clearRequest(b);

        ISettlementRouter(settlementRouter)
            .settlePosition(betId, payoutGross, payoutNet, refundAmount, protocolFeeAccrual, awards);

        emit HouseEdgeAllocated(
            betId,
            usedTurnover,
            b.effectiveHouseEdgeBps,
            alloc.edge,
            alloc.operatorShare,
            alloc.edge - alloc.operatorShare,
            alloc.protocolFee,
            alloc.r0,
            alloc.r1,
            alloc.r2,
            alloc.markup
        );
        emit BetFinalized(betId, payoutGross, payoutNet, feeOnPayout, protocolFeeAccrual);
    }

    // ---------------------------------------------------------------------
    // Debt-Out: refund (permissionless)
    // ---------------------------------------------------------------------

    function refund(uint256 betId) external override nonReentrant {
        SSOTTypes.Bet storage b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        if (b.state != SSOTTypes.BetState.PendingVRF) revert BadState(betId, b.state, SSOTTypes.BetState.PendingVRF);

        uint256 readyAt = uint256(b.placedAt) + refundTimeoutSeconds;
        if (block.timestamp < readyAt) revert RefundNotReady(betId, block.timestamp, readyAt);

        b.resolvedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.Refunded;
        betTerminals[betId] = SSOTTypes.BetTerminal({
            state: SSOTTypes.BetState.Refunded,
            payoutGross: 0,
            payoutNet: 0,
            feeOnPayout: 0,
            protocolFeeAccrual: 0,
            refundAmount: b.stake
        });

        uint256 requestId = b.requestId;
        if (requestId != 0) {
            requestToBetId[requestId] = 0;
            _detachRequestIfOwned(requestId);
        }

        ISettlementRouter(settlementRouter).refundPosition(betId, b.stake);

        emit BetRefunded(betId, b.stake);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _validateBaseHouseEdge(uint16 bps) internal pure {
        if (bps == 0 || bps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS) revert Errors.InvalidBps(bps);
    }

    function _readyChange(PendingEdgeChange storage change) internal view returns (PendingEdgeChange memory pending) {
        pending = change;
        if (pending.activatesAt == 0) revert NoPendingEdgeChange();
        if (block.timestamp < pending.activatesAt) revert EdgeChangeNotReady(pending.activatesAt);
    }

    function _createReferralConfig(uint16 l0Bps, uint16 l1Bps, uint16 l2Bps, uint16 holdbackBps)
        internal
        returns (uint32 id)
    {
        if (holdbackBps > BPS) revert Errors.InvalidBps(holdbackBps);
        uint256 rates = uint256(l0Bps) + uint256(l1Bps) + uint256(l2Bps);
        if (rates > HouseEdgeLib.MAX_REFERRAL_BPS) revert Errors.InvalidBps(rates);

        id = _nextRefCfgId++;
        _refCfg[id] =
            ReferralSchedule({l0Bps: l0Bps, l1Bps: l1Bps, l2Bps: l2Bps, holdbackBps: holdbackBps, exists: true});
        emit ReferralConfigCreated(id, l0Bps, l1Bps, l2Bps, holdbackBps);
    }

    function _maxAffiliateHouseEdge(uint16 def) internal view returns (uint16) {
        uint256 maxAllowed = uint256(def) + uint256(maxAffiliateDeltaBps);
        return maxAllowed > HouseEdgeLib.MAX_HOUSE_EDGE_BPS ? HouseEdgeLib.MAX_HOUSE_EDGE_BPS : uint16(maxAllowed);
    }

    function _poolRegistry() internal view returns (IPoolRegistry) {
        return IPoolRegistry(ISettlementRouter(settlementRouter).poolRegistry());
    }

    function _pool(uint64 poolId) internal view returns (SSOTTypes.Pool memory p) {
        IPoolRegistry registry = _poolRegistry();
        try registry.pool(poolId) returns (SSOTTypes.Pool memory pool_) {
            return pool_;
        } catch {
            revert UnknownPool(poolId);
        }
    }

    function _casinoPool(uint64 poolId) internal view returns (SSOTTypes.Pool memory p) {
        p = _pool(poolId);
        if (p.domain != SSOTTypes.PoolDomain.Casino) {
            revert WrongPoolDomain(poolId, p.domain);
        }
    }

    function _clearRequest(SSOTTypes.Bet storage b) internal {
        uint256 requestId = b.requestId;
        if (requestId != 0) {
            requestToBetId[requestId] = 0;
            _detachRequestIfOwned(requestId);
        }
    }

    function _refundInvalidRandomReadyBet(uint256 betId, SSOTTypes.Bet storage b) internal {
        b.resolvedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.Refunded;
        betTerminals[betId] = SSOTTypes.BetTerminal({
            state: SSOTTypes.BetState.Refunded,
            payoutGross: 0,
            payoutNet: 0,
            feeOnPayout: 0,
            protocolFeeAccrual: 0,
            refundAmount: b.stake
        });

        _clearRequest(b);
        ISettlementRouter(settlementRouter).refundPosition(betId, b.stake);

        emit BetRefunded(betId, b.stake);
    }

    function _detachRequestIfOwned(uint256 requestId) internal {
        if (requestId == 0) return;

        try IVRFHub(vrfHub).getRequest(requestId) returns (IVRFHub.RequestInfo memory request) {
            if (request.hub == address(this)) {
                try IVRFHub(vrfHub).detach(requestId) {} catch {}
            }
        } catch {}
    }

    /// @dev Resolves the referral payees a bet is accepted under. If the player has no referrer, the affiliate
    ///      hint is bound first-touch on a best-effort basis. A hint that cannot be bound still prices the bet
    ///      (skyline), but pays no referral reward.
    function _snapshotReferral(address player, address affiliate)
        internal
        returns (address pricingAff, address l1, address l2)
    {
        IReferralRegistry registry = IReferralRegistry(referralRegistry);
        l1 = registry.referrerOf(player);
        if (l1 == address(0) && affiliate != address(0) && affiliate != player) {
            try registry.bindFor(player, affiliate) {} catch {}
            l1 = registry.referrerOf(player);
        }
        if (l1 != address(0)) {
            l2 = registry.referrerOf(l1);
            // The registry's anti-cycle check rules this out; stay safe against a registry that does not.
            if (l2 == player || l2 == l1) l2 = address(0);
        }
        pricingAff = l1 != address(0) ? l1 : affiliate;
    }

    function _computeSkyline(address pricingAff, uint16 baseHE)
        internal
        view
        returns (uint16 effectiveHE, bytes memory skyline)
    {
        effectiveHE = baseHE;
        uint16 maxAllowed = _maxAffiliateHouseEdge(baseHE);
        if (maxAllowed <= baseHE) return (effectiveHE, skyline); // markup disabled

        address[6] memory payeesTmp;
        uint16[6] memory incBpsTmp;
        uint8 k = 0;

        address cur = pricingAff;
        for (uint8 i = 0; i < MAX_SKYLINE_SEGMENTS && cur != address(0); ++i) {
            uint16 heCur = affiliateHouseEdgeBps[cur];
            // A stored edge may predate a lower cap or base edge; it never prices above the current cap.
            if (heCur > maxAllowed) heCur = maxAllowed;
            if (heCur > effectiveHE) {
                payeesTmp[k] = cur;
                incBpsTmp[k] = heCur - effectiveHE;
                effectiveHE = heCur;
                unchecked {
                    ++k;
                }
            }
            cur = IReferralRegistry(referralRegistry).referrerOf(cur);
        }

        if (k > 0) {
            skyline = new bytes(uint256(k) * 22);
            for (uint8 j = 0; j < k; ++j) {
                uint256 o = uint256(j) * 22;
                bytes20 p = bytes20(payeesTmp[j]);
                uint16 inc = incBpsTmp[j];
                for (uint8 b = 0; b < 20; ++b) {
                    skyline[o + b] = p[b];
                }
                skyline[o + 20] = bytes1(uint8(inc >> 8));
                skyline[o + 21] = bytes1(uint8(inc));
            }
        }
    }

    /// @dev SSOT v1.6 section 2. Everything here depends only on usedTurnover and the acceptance snapshot
    ///      (edges, schedule id, payees, skyline); the Bank's turnover state only decides the XP buckets.
    function _allocate(uint256 betId, SSOTTypes.Bet storage b, uint256 usedTurnover)
        internal
        view
        returns (Allocation memory alloc, IReferralEngine.Plan memory planB, IReferralEngine.Plan memory planD)
    {
        alloc.edge = HouseEdgeLib.turnoverEdge(usedTurnover, b.effectiveHouseEdgeBps);
        alloc.operatorShare = HouseEdgeLib.operatorShare(alloc.edge);
        uint256 baseEdge = HouseEdgeLib.turnoverEdge(usedTurnover, b.baseHouseEdgeBps);
        uint256 markupEdge = alloc.edge - baseEdge;

        ReferralPayees memory payees = betReferralPayees[betId];
        bool refer = baseEdge > 0 && payees.l1 != address(0);
        if (!refer && markupEdge == 0) {
            alloc.protocolFee = alloc.operatorShare;
            return (alloc, planB, planD);
        }

        ReferralSchedule storage cfg = _refCfg[b.referralConfigId];
        // eligibility uses turnover AFTER this bet
        uint256 turnoverAfter = IBank(b.bank).playerTurnover(b.player) + usedTurnover;
        uint256 minTurnover = IBank(b.bank).minPlayerTurnoverForUnlock();

        if (refer) {
            planB = IReferralEngine(referralEngine)
                .splitBase(
                    IReferralEngine.BaseInput({
                        baseEdge: baseEdge,
                        l0Bps: cfg.l0Bps,
                        l1Bps: cfg.l1Bps,
                        l2Bps: cfg.l2Bps,
                        l1: payees.l1,
                        l2: payees.l2,
                        holdbackBps: cfg.holdbackBps,
                        minTurnover: minTurnover,
                        playerTurnover: turnoverAfter
                    })
                );
            alloc.r0 = planB.playerRakeback;
            alloc.r1 = _planAmount(planB, 0);
            alloc.r2 = _planAmount(planB, 1);
        }

        if (markupEdge > 0) {
            planD = IReferralEngine(referralEngine)
                .splitDelta(
                    betDeltaSkyline[betId],
                    IReferralEngine.DeltaPolicy({
                        markupBudget: HouseEdgeLib.operatorShare(markupEdge),
                        holdbackBps: cfg.holdbackBps,
                        minTurnover: minTurnover,
                        playerTurnover: turnoverAfter
                    })
                );
            uint256 k = planD.payees.length;
            for (uint256 i = 0; i < k; ++i) {
                alloc.markup += _planAmount(planD, i);
            }
        }

        // Cannot underflow: r0 + r1 + r2 <= floor(E_b / 2) and markup <= floor((E - E_b) / 2), so their sum is
        // at most floor(E / 2) = operatorShare.
        alloc.protocolFee = alloc.operatorShare - alloc.r0 - alloc.r1 - alloc.r2 - alloc.markup;
    }

    function _planAmount(IReferralEngine.Plan memory plan, uint256 i) internal pure returns (uint256) {
        if (i >= plan.payees.length || plan.payees[i] == address(0)) return 0;
        return plan.immediate[i] + plan.locked[i] + plan.holdback[i];
    }

    function _plansToAwards(address player, IReferralEngine.Plan memory basePlan, IReferralEngine.Plan memory deltaPlan)
        internal
        pure
        returns (SSOTTypes.XPAward[] memory awards)
    {
        // Upper bound: 1 (L0) + 2 (L1, L2) + 6 (skyline) = 9
        SSOTTypes.XPAward[] memory tmp = new SSOTTypes.XPAward[](9);
        uint256 n = 0;

        // L0 rakeback: immediately claimable by the player
        if (basePlan.playerRakeback > 0) {
            tmp[n++] = SSOTTypes.XPAward({
                payee: player,
                sourcePlayer: player,
                accrued: basePlan.playerRakeback,
                locked: 0,
                holdback: 0,
                reason: REASON_REF_L0
            });
        }

        n = _appendPlanAward(tmp, n, player, basePlan, 0, REASON_REF_L1);
        n = _appendPlanAward(tmp, n, player, basePlan, 1, REASON_REF_L2);
        uint256 k = deltaPlan.payees.length;
        for (uint256 i = 0; i < k; ++i) {
            n = _appendPlanAward(tmp, n, player, deltaPlan, i, REASON_REF_MARKUP);
        }

        awards = new SSOTTypes.XPAward[](n);
        for (uint256 i = 0; i < n; ++i) {
            awards[i] = tmp[i];
        }
    }

    function _appendPlanAward(
        SSOTTypes.XPAward[] memory tmp,
        uint256 n,
        address sourcePlayer,
        IReferralEngine.Plan memory plan,
        uint256 i,
        bytes32 reason
    ) internal pure returns (uint256) {
        if (i >= plan.payees.length) return n;
        address payee = plan.payees[i];
        if (payee == address(0)) return n;

        uint256 accrued = plan.immediate[i];
        uint256 locked = plan.locked[i];
        uint256 holdback = plan.holdback[i];
        if (accrued == 0 && locked == 0 && holdback == 0) return n;

        tmp[n++] = SSOTTypes.XPAward({
            payee: payee,
            sourcePlayer: sourcePlayer,
            accrued: accrued,
            locked: locked,
            holdback: holdback,
            reason: reason
        });
        return n;
    }
}
