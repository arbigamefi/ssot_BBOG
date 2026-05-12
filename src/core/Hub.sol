// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IHub} from "./interfaces/IHub.sol";
import {IBank} from "./interfaces/IBank.sol";
import {IBankRegistry} from "./interfaces/IBankRegistry.sol";
import {IVRFHub} from "./interfaces/IVRFHub.sol";
import {IGameModule} from "./interfaces/IGameModule.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {Governable} from "../access/Governable.sol";
import {Errors} from "../libs/Errors.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IReferralRegistry} from "../engines/referral/IReferralRegistry.sol";
import {IReferralEngine} from "../engines/referral/IReferralEngine.sol";

/// @notice Single Hub (BetRegistry SSOT) + skyline pricing + referral orchestration.
///
/// Option 1 (institutional):
/// - player = msg.sender (no relayer / no delegated betting)
/// - affiliate hint is used for best-effort first-touch binding + skyline pricing
/// - bet snapshots pricing/referral config to prevent retroactive changes
contract Hub is IHub, Governable, ReentrancyGuard {

    uint16 internal constant BPS = 10_000;
    uint8 internal constant MAX_SKYLINE_SEGMENTS = 6;
    uint16 internal constant MAX_HOUSE_EDGE = 10_000;

    address public immutable override bankRegistry;
    address public immutable override vrfHub;

    address public immutable override referralRegistry;
    address public immutable override referralEngine;

    uint256 public override nextBetId = 1;
    uint256 public override refundTimeoutSeconds;

    // pricing
    uint16 public override defaultHouseEdgeBps;
    uint16 public override maxAffiliateDeltaBps;
    mapping(address => uint16) public override affiliateHouseEdgeBps; // 0 => unset

    // referral config snapshot
    struct ReferralConfig {
        uint16 baseBudgetBps;
        uint16 deltaBudgetBps;
        uint16 holdbackBps;
        uint16[6] levelBps; // L0..L5
        uint8 levels;        // includes L0
    }

    mapping(uint32 => ReferralConfig) internal _refCfg;
    uint32 internal _nextRefCfgId = 1;
    uint32 public override activeReferralConfigId;

    mapping(bytes32 => address) public override gameModule;

    mapping(uint256 => SSOTTypes.Bet) internal bets;
    mapping(uint256 => bytes) internal betParams;
    mapping(uint256 => bytes) internal betRandomData;
    mapping(uint256 => bytes) internal betDeltaSkyline;

    mapping(uint256 => uint256) public requestToBetId;

    bytes32 internal constant REASON_PLAYER_KICK = keccak256("PLAYER_KICK");
    bytes32 internal constant REASON_REF_BASE = keccak256("REF_BASE");
    bytes32 internal constant REASON_REF_DELTA = keccak256("REF_DELTA");

    constructor(
        address bankRegistry_,
        address vrfHub_,
        address referralRegistry_,
        address referralEngine_,
        address gov_,
        uint256 refundTimeoutSeconds_,
        uint16 defaultHouseEdgeBps_,
        uint16 maxAffiliateDeltaBps_,
        // initial referral config
        uint16 baseBudgetBps_,
        uint16 deltaBudgetBps_,
        uint16 holdbackBps_,
        uint16[6] memory levelBps_,
        uint8 levels_
    ) Governable(gov_) {
        if (bankRegistry_ == address(0) || vrfHub_ == address(0) || referralRegistry_ == address(0) || referralEngine_ == address(0)) {
            revert Errors.ZeroAddress();
        }

        if (defaultHouseEdgeBps_ == 0 || defaultHouseEdgeBps_ > MAX_HOUSE_EDGE) {
            revert Errors.InvalidConfig();
        }
        _validateReferralConfig(baseBudgetBps_, deltaBudgetBps_, holdbackBps_, levelBps_, levels_);

        bankRegistry = bankRegistry_;
        vrfHub = vrfHub_;
        referralRegistry = referralRegistry_;
        referralEngine = referralEngine_;

        refundTimeoutSeconds = refundTimeoutSeconds_;
        emit RefundTimeoutSet(refundTimeoutSeconds_);

        defaultHouseEdgeBps = defaultHouseEdgeBps_;
        maxAffiliateDeltaBps = maxAffiliateDeltaBps_;

        // config id 1 is created at deployment
        uint32 id = _nextRefCfgId++;
        _refCfg[id] = ReferralConfig({
            baseBudgetBps: baseBudgetBps_,
            deltaBudgetBps: deltaBudgetBps_,
            holdbackBps: holdbackBps_,
            levelBps: levelBps_,
            levels: levels_
        });
        activeReferralConfigId = id;
    }

    function bankFor(address asset) public view override returns (address) {
        return IBankRegistry(bankRegistry).bankFor(asset);
    }

    function riskInPaused(address asset) public view override returns (bool) {
        address b = IBankRegistry(bankRegistry).bankFor(asset);
        if (b == address(0)) revert UnknownAsset(asset);
        return IBank(b).riskInPaused();
    }

    // --- governance ---

    function setRiskInPaused(address asset, bool paused) external onlyGov {
        address b = IBankRegistry(bankRegistry).bankFor(asset);
        if (b == address(0)) revert UnknownAsset(asset);
        BankLike(b).setRiskInPaused(paused);
        emit RiskInPausedSet(asset, paused);
    }

    /// @notice Convenience: pause/unpause risk-in for all registered assets.
    /// @dev May be gas-heavy if many assets are registered.
    function setRiskInPausedAll(bool paused) external onlyGov {
        uint256 n = IBankRegistry(bankRegistry).assetsLength();
        for (uint256 i = 0; i < n; i++) {
            address a = IBankRegistry(bankRegistry).assetAt(i);
            address b = IBankRegistry(bankRegistry).bankFor(a);
            if (b != address(0)) {
                BankLike(b).setRiskInPaused(paused);
                emit RiskInPausedSet(a, paused);
            }
        }
    }

    function setRefundTimeout(uint256 seconds_) external onlyGov {
        refundTimeoutSeconds = seconds_;
        emit RefundTimeoutSet(seconds_);
    }

    function setDefaultHouseEdgeBps(uint16 bps) external onlyGov {
        if (bps == 0 || bps > MAX_HOUSE_EDGE) revert Errors.InvalidConfig();
        defaultHouseEdgeBps = bps;
    }

    function setMaxAffiliateDeltaBps(uint16 bps) external onlyGov {
        if (bps > MAX_HOUSE_EDGE) revert Errors.InvalidBps(bps);
        maxAffiliateDeltaBps = bps;
    }

    function createReferralConfig(
        uint16 baseBudgetBps_,
        uint16 deltaBudgetBps_,
        uint16 holdbackBps_,
        uint16[6] calldata levelBps_,
        uint8 levels_
    ) external override onlyGov returns (uint32 id) {
        _validateReferralConfig(baseBudgetBps_, deltaBudgetBps_, holdbackBps_, levelBps_, levels_);
        id = _nextRefCfgId++;
        _refCfg[id] = ReferralConfig({
            baseBudgetBps: baseBudgetBps_,
            deltaBudgetBps: deltaBudgetBps_,
            holdbackBps: holdbackBps_,
            levelBps: levelBps_,
            levels: levels_
        });
    }

    function setActiveReferralConfig(uint32 id) external override onlyGov {
        ReferralConfig storage cfg = _refCfg[id];
        if (id == 0 || cfg.levels == 0) revert Errors.InvalidConfig();
        activeReferralConfigId = id;
    }

    function getReferralConfig(uint32 id)
        external
        view
        override
        returns (
            uint16 baseBudgetBps,
            uint16 deltaBudgetBps,
            uint16 holdbackBps,
            uint16[6] memory levelBps,
            uint8 levels
        )
    {
        ReferralConfig storage c = _refCfg[id];
        baseBudgetBps = c.baseBudgetBps;
        deltaBudgetBps = c.deltaBudgetBps;
        holdbackBps = c.holdbackBps;
        levelBps = c.levelBps;
        levels = c.levels;
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
        gameModule[gameId] = module;
        emit GameRegistered(gameId, module);
    }

    function getBet(uint256 betId) external view override returns (SSOTTypes.Bet memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return b;
    }

    function getBetParams(uint256 betId) external view override returns (bytes memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return betParams[betId];
    }

    function getDeltaSkyline(uint256 betId) external view override returns (bytes memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return betDeltaSkyline[betId];
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
        address asset,
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        address affiliate,
        uint16 maxHouseEdgeBps
    ) external payable override nonReentrant returns (uint256 betId) {
        if (riskInPaused(asset)) revert RiskInPaused(asset);
        if (stakeSpec.amountPerRoll == 0) revert Errors.InsufficientBalance();
        if (stakeSpec.betCount == 0 || stakeSpec.betCount > MAX_BET_COUNT) revert Errors.InvalidConfig();

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        if (stake == 0) revert Errors.InsufficientBalance();

        address player = msg.sender;

        address bank_ = IBankRegistry(bankRegistry).bankFor(asset);
        if (bank_ == address(0)) revert UnknownAsset(asset);

        address module = gameModule[gameId];
        if (module == address(0)) revert UnknownGame(gameId);

        IGameModule(module).validate(params, stakeSpec);
        uint256 reserved = IGameModule(module).maxPayout(params, stakeSpec);
        if (reserved == 0) revert Errors.InsufficientBalance();

        betId = nextBetId++;
        bytes32 paramsHash = keccak256(abi.encode(params, stakeSpec.amountPerRoll, stakeSpec.betCount, stakeSpec.stopGain, stakeSpec.stopLoss));

        // Normalize player-specified maxHouseEdgeBps for auditability.
        // (0 => defaultHouseEdgeBps; >MAX => MAX)
        uint16 usedMaxHE = maxHouseEdgeBps;
        if (usedMaxHE == 0) usedMaxHE = defaultHouseEdgeBps;
        if (usedMaxHE > MAX_HOUSE_EDGE) usedMaxHE = MAX_HOUSE_EDGE;

        // Compute pricing snapshot + skyline
        (address pricingAff, uint16 baseHE, uint16 effectiveHE, bytes memory skyline) = _computeSkylineAndHE(
            player,
            affiliate,
            usedMaxHE
        );
        bytes32 skylineHash = keccak256(skyline);
        betDeltaSkyline[betId] = skyline;

        uint32 cfgId = activeReferralConfigId;

        bytes32 snapshotHash = keccak256(
            abi.encodePacked(gameId, module, asset, bank_, block.chainid, cfgId, pricingAff, baseHE, effectiveHE, usedMaxHE, skylineHash)
        );

        SSOTTypes.Bet storage b = bets[betId];
        b.betId = betId;
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

        betParams[betId] = params;

        IBank(bank_).holdBet(betId, player, stake, reserved, snapshotHash);

        // --- VRF fee: charged in native token (refactored parity) ---
        (uint256 requiredFee, uint32 cb) = quoteVRFFee(stakeSpec.betCount);
        if (msg.value < requiredFee) revert IVRFHub.InsufficientVRFFee(msg.value, requiredFee);

        (uint256 requestId, uint256 charged) = IVRFHub(vrfHub).requestRandomWords{value: msg.value}(
            address(this),
            betId,
            cb,
            3,
            1,
            player
        );
        b.vrfFeePaid = msg.value;
        b.vrfFeeCharged = charged;
        b.vrfCallbackGasLimit = cb;
        b.requestId = requestId;
        b.vrfRequestedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.PendingVRF;
        requestToBetId[requestId] = betId;

        emit BetPlaced(
            betId,
            gameId,
            player,
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
        try IVRFHub(vrfHub).detach(requestId) { } catch { }

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
            amountPerRoll: b.amountPerRoll,
            betCount: b.betCount,
            stopGain: b.stopGain,
            stopLoss: b.stopLoss
        });
        (uint256 payoutGross, uint256 refundAmount) = IGameModule(module).resolve(betParams[betId], spec, betId, randomWords);
        if (refundAmount > b.stake) {
            b.resolvedAt = uint64(block.timestamp);
            b.state = SSOTTypes.BetState.Refunded;

            _clearRequest(b);
            IBank(b.bank).refundBet(betId, b.stake);

            emit BetRefunded(betId, b.stake);
            return;
        }
        // reserved must cover total owed (payoutGross + refundAmount)
        if (payoutGross + refundAmount > b.reserved) revert Errors.InsufficientBalance();

        // ---- Fee-on-payout ----
        uint256 feeOnPayout = 0;
        uint256 payoutNet = payoutGross;
        if (payoutGross > 0) {
            feeOnPayout = Math.mulDiv(payoutGross, uint256(b.effectiveHouseEdgeBps), BPS);
            if (feeOnPayout > payoutGross) feeOnPayout = payoutGross;
            payoutNet = payoutGross - feeOnPayout;
        }

        uint256 usedTurnover = b.stake - refundAmount;

        // eligibility uses turnover AFTER this bet
        uint256 turnoverAfter = IBank(b.bank).playerTurnover(b.player) + usedTurnover;
        uint256 minTurnover = IBank(b.bank).minPlayerTurnoverForUnlock();

        ReferralConfig storage cfg = _refCfg[b.referralConfigId];

        // ---- budgets (turnover-based) ----
        uint256 baseHEAmt = Math.mulDiv(usedTurnover, uint256(b.baseHouseEdgeBps), BPS);
        uint256 baseBudget = Math.mulDiv(baseHEAmt, uint256(cfg.baseBudgetBps), BPS);
        if (baseBudget > baseHEAmt) baseBudget = baseHEAmt;
        uint256 nonBudgetBase = baseHEAmt - baseBudget;

        uint256 deltaBudget = 0;
        uint256 nonBudgetDelta = 0;
        if (b.effectiveHouseEdgeBps > b.baseHouseEdgeBps) {
            uint256 deltaHE = uint256(b.effectiveHouseEdgeBps) - uint256(b.baseHouseEdgeBps);
            uint256 deltaHEAmt = Math.mulDiv(usedTurnover, deltaHE, BPS);
            deltaBudget = Math.mulDiv(deltaHEAmt, uint256(cfg.deltaBudgetBps), BPS);
            if (deltaBudget > deltaHEAmt) deltaBudget = deltaHEAmt;
            nonBudgetDelta = deltaHEAmt - deltaBudget;
        }

        // ---- referral plans ----
        IReferralEngine.Plan memory planB;
        IReferralEngine.Plan memory planD;

        if (baseBudget > 0 && cfg.levels > 0) {
            uint8 maxUplines = cfg.levels > 0 ? (cfg.levels - 1) : 0;
            address[] memory uplines = _buildUplines(b.player, maxUplines);

            IReferralEngine.BaseInput memory bi = IReferralEngine.BaseInput({
                baseBudget: baseBudget,
                levelBps: cfg.levelBps,
                levels: cfg.levels,
                uplines: uplines,
                holdbackBps: cfg.holdbackBps,
                minTurnover: minTurnover,
                playerTurnover: turnoverAfter
            });
            planB = IReferralEngine(referralEngine).splitBase(bi);
        }

        if (deltaBudget > 0) {
            IReferralEngine.DeltaPolicy memory pol = IReferralEngine.DeltaPolicy({
                deltaBudget: deltaBudget,
                holdbackBps: cfg.holdbackBps,
                minTurnover: minTurnover,
                playerTurnover: turnoverAfter
            });
            bytes memory skyline = betDeltaSkyline[betId];
            planD = IReferralEngine(referralEngine).splitDelta(skyline, pol);
        }

        uint256 protocolFeeAccrual = nonBudgetBase + nonBudgetDelta + planB.sink + planD.sink;

        // ---- convert plans to XP awards ----
        SSOTTypes.XPAward[] memory awards = _plansToAwards(b.player, planB, planD);

        b.resolvedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.Settled;

        // clear request mapping to prevent any late transport artifacts
        _clearRequest(b);

        IBank(b.bank).settleBet(
            betId,
            payoutGross,
            payoutNet,
            refundAmount,
            protocolFeeAccrual,
            awards
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

        uint256 requestId = b.requestId;
        if (requestId != 0) {
            requestToBetId[requestId] = 0;
            try IVRFHub(vrfHub).detach(requestId) { } catch { }
        }

        IBank(b.bank).refundBet(betId, b.stake);

        emit BetRefunded(betId, b.stake);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _validateReferralConfig(
        uint16 baseBudgetBps_,
        uint16 deltaBudgetBps_,
        uint16 holdbackBps_,
        uint16[6] memory levelBps_,
        uint8 levels_
    ) internal pure {
        if (holdbackBps_ > BPS) revert Errors.InvalidBps(holdbackBps_);
        if (baseBudgetBps_ > BPS || deltaBudgetBps_ > BPS) {
            revert Errors.InvalidBps(uint256(baseBudgetBps_) + uint256(deltaBudgetBps_));
        }
        if (levels_ > 6) revert Errors.InvalidConfig();

        uint256 sumLevels;
        for (uint8 i = 0; i < levels_; ++i) {
            sumLevels += uint256(levelBps_[i]);
        }
        if (sumLevels > BPS) revert Errors.InvalidBps(sumLevels);
    }

    function _maxAffiliateHouseEdge(uint16 def) internal view returns (uint16) {
        uint16 delta = maxAffiliateDeltaBps;
        if (delta == 0) return def;
        uint256 maxAllowed = uint256(def) + uint256(delta);
        return maxAllowed > MAX_HOUSE_EDGE ? MAX_HOUSE_EDGE : uint16(maxAllowed);
    }

    function _clearRequest(SSOTTypes.Bet storage b) internal {
        uint256 requestId = b.requestId;
        if (requestId != 0) {
            requestToBetId[requestId] = 0;
            try IVRFHub(vrfHub).detach(requestId) { } catch { }
        }
    }

    function _computeSkylineAndHE(
        address player,
        address affiliate,
        uint16 maxHouseEdgeBps
    ) internal returns (address pricingAff, uint16 baseHE, uint16 effectiveHE, bytes memory skyline) {
        if (maxHouseEdgeBps == 0) maxHouseEdgeBps = defaultHouseEdgeBps;
        if (maxHouseEdgeBps > MAX_HOUSE_EDGE) maxHouseEdgeBps = MAX_HOUSE_EDGE;

        // First-touch: if player has no referrer and affiliate is provided, try binding.
        pricingAff = IReferralRegistry(referralRegistry).referrerOf(player);
        if (pricingAff == address(0)) {
            if (affiliate != address(0) && affiliate != player) {
                try IReferralRegistry(referralRegistry).bindFor(player, affiliate) { } catch { }
            }
            pricingAff = IReferralRegistry(referralRegistry).referrerOf(player);
            if (pricingAff == address(0)) pricingAff = affiliate;
        }

        baseHE = defaultHouseEdgeBps;
        uint16 curMax = baseHE;

        address[6] memory payeesTmp;
        uint16[6] memory incBpsTmp;
        uint8 k = 0;

        address cur = pricingAff;
        for (uint8 i = 0; i < MAX_SKYLINE_SEGMENTS && cur != address(0); ++i) {
            uint16 heCur = affiliateHouseEdgeBps[cur];
            if (heCur > curMax) {
                uint16 inc = heCur - curMax;
                payeesTmp[k] = cur;
                incBpsTmp[k] = inc;
                curMax = heCur;
                unchecked { ++k; }
            }
            cur = IReferralRegistry(referralRegistry).referrerOf(cur);
        }

        effectiveHE = curMax;
        if (effectiveHE > maxHouseEdgeBps) revert HouseEdgeTooHigh(effectiveHE, maxHouseEdgeBps);

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

    function _buildUplines(address player, uint8 maxUplines) internal view returns (address[] memory uplines) {
        if (maxUplines == 0) return new address[](0);
        uplines = new address[](maxUplines);
        uint8 filled = 0;

        address cur = IReferralRegistry(referralRegistry).referrerOf(player);
        for (uint8 i = 0; i < maxUplines; ++i) {
            if (cur == address(0)) break;
            bool dup = false;
            for (uint8 j = 0; j < filled; ++j) {
                if (uplines[j] == cur) {
                    dup = true;
                    break;
                }
            }
            if (!dup) {
                uplines[filled] = cur;
                unchecked { ++filled; }
            }
            cur = IReferralRegistry(referralRegistry).referrerOf(cur);
        }

        assembly ("memory-safe") {
            mstore(uplines, filled)
        }
    }

    function _plansToAwards(
        address player,
        IReferralEngine.Plan memory basePlan,
        IReferralEngine.Plan memory deltaPlan
    ) internal pure returns (SSOTTypes.XPAward[] memory awards) {
        // Upper bound: 1 (playerKick) + 5 (base uplines) + 6 (skyline) = 12
        SSOTTypes.XPAward[] memory tmp = new SSOTTypes.XPAward[](12);
        uint256 n = 0;

        // player kickback (accrued to player)
        if (basePlan.playerKick > 0) {
            tmp[n++] = SSOTTypes.XPAward({
                payee: player,
                sourcePlayer: player,
                accrued: basePlan.playerKick,
                locked: 0,
                holdback: 0,
                reason: REASON_PLAYER_KICK
            });
        }

        n = _appendPlanAwards(tmp, n, player, basePlan, REASON_REF_BASE);
        n = _appendPlanAwards(tmp, n, player, deltaPlan, REASON_REF_DELTA);

        awards = new SSOTTypes.XPAward[](n);
        for (uint256 i = 0; i < n; ++i) {
            awards[i] = tmp[i];
        }
    }

    function _appendPlanAwards(
        SSOTTypes.XPAward[] memory tmp,
        uint256 n,
        address sourcePlayer,
        IReferralEngine.Plan memory plan,
        bytes32 reason
    ) internal pure returns (uint256) {
        uint256 len = plan.payees.length;
        for (uint256 i = 0; i < len; ++i) {
            address payee = plan.payees[i];
            if (payee == address(0)) continue;

            uint256 accrued = plan.immediate[i];
            uint256 locked = plan.locked[i];
            uint256 holdback = plan.holdback[i];
            if (accrued == 0 && locked == 0 && holdback == 0) continue;

            tmp[n++] = SSOTTypes.XPAward({
                payee: payee,
                sourcePlayer: sourcePlayer,
                accrued: accrued,
                locked: locked,
                holdback: holdback,
                reason: reason
            });
        }
        return n;
    }
}

interface BankLike {
    function setRiskInPaused(bool paused) external;
}
