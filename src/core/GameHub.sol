// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IGameHub} from "./interfaces/IGameHub.sol";
import {IBank} from "./interfaces/IBank.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {ISettlementRouter} from "./interfaces/ISettlementRouter.sol";
import {IVRFHub} from "./interfaces/IVRFHub.sol";
import {IGameModule} from "./interfaces/IGameModule.sol";
import {SSOTTypes} from "./interfaces/SSOTTypes.sol";
import {Governable} from "../access/Governable.sol";
import {Sentinel} from "../access/Sentinel.sol";
import {Errors} from "../libs/Errors.sol";
import {StakeFunding} from "../libs/StakeFunding.sol";
import {HouseEdgeLib} from "../libs/HouseEdgeLib.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IReferralRegistry} from "../engines/referral/IReferralRegistry.sol";
import {IReferralEngine} from "../engines/referral/IReferralEngine.sol";

/// @notice GameHub = casino-game lifecycle SSOT + two-tier referrals and player rakeback.
///
/// Option 1 (institutional):
/// - player = msg.sender (no relayer / no delegated betting)
/// - affiliate hint is used only for best-effort first-touch binding
/// - bet snapshots pricing, referral schedule and referral payees to prevent retroactive changes
///
/// House-edge allocation (SSOT v1.6, ADR-0032): of the turnover edge E, LPs retain E - O where
/// O = floor(E * (10000 - LP_SHARE_BPS) / 10000). Referral rewards are paid from O, and whatever
/// they do not use accrues as protocol fees. The referral engine computes the allocation from the bet's
/// acceptance snapshot; the SettlementRouter enforces the same bound independently.
contract GameHub is IGameHub, Sentinel, ReentrancyGuard {
    using SafeCast for uint256;

    uint32 public constant override MAX_BET_COUNT = 25;
    uint16 internal constant BPS = 10_000;

    uint16 public constant override LP_SHARE_BPS = HouseEdgeLib.LP_SHARE_BPS;
    uint16 public constant override MAX_REFERRAL_BPS = HouseEdgeLib.MAX_REFERRAL_BPS;
    uint16 public constant override MAX_HOUSE_EDGE_BPS = HouseEdgeLib.MAX_HOUSE_EDGE_BPS;
    uint256 public constant override EDGE_CHANGE_DELAY = HouseEdgeLib.EDGE_CHANGE_DELAY;
    /// @dev The bound also keeps `placedAt + refundTimeoutSeconds` from overflowing and blocking refunds.
    uint256 public constant override MAX_REFUND_TIMEOUT_SECONDS = HouseEdgeLib.MAX_REFUND_TIMEOUT_SECONDS;
    uint256 public constant override MIN_REFUND_TIMEOUT_SECONDS = HouseEdgeLib.MIN_REFUND_TIMEOUT_SECONDS;

    address public immutable override settlementRouter;
    address public immutable override vrfHub;

    address public immutable override referralRegistry;
    address public immutable override referralEngine;

    uint256 public override refundTimeoutSeconds;

    // pricing
    uint16 public override defaultHouseEdgeBps;

    /// @dev activatesAt == 0 means nothing is queued.
    struct PendingEdgeChange {
        uint16 bps;
        uint64 activatesAt;
    }

    PendingEdgeChange internal _pendingEdgeChange;

    /// @dev Immutable once created. Rates are bps of the turnover edge; l0 + l1 + l2 <= MAX_REFERRAL_BPS.
    struct ReferralSchedule {
        uint16 l0Bps; // player rakeback, paid only if the player had a referrer at acceptance
        uint16 l1Bps; // direct referrer
        uint16 l2Bps; // referrer's referrer
        uint16 holdbackBps; // share of L1/L2 amounts that vests linearly
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
    mapping(bytes32 => uint32) public override gameMaxBetCount;
    mapping(bytes32 => uint32) public override gameCallbackGasLimit;
    mapping(uint256 => address) public override betModule;

    uint256 private constant CALLBACK_COMPLETION_GAS = 25_000;

    // ADR-0037 §7 and §10: a void becomes eligible 24 hours after the VRF request inside a window of its Bank, or
    // after 7 days for anyone. The settlement attempt gets exactly VOID_SETTLEMENT_GAS (decision D3); the void
    // branch runs on the reserve; the overhead bounds the work between the gas check and the call.
    uint256 public constant override VOID_DELAY = 24 hours;
    uint256 public constant override PUBLIC_VOID_DELAY = 7 days;
    uint256 public constant override VOID_SETTLEMENT_GAS = 10_000_000;
    uint256 public constant override VOID_RESERVE_GAS = 600_000;
    uint256 public constant override VOID_CALL_OVERHEAD = 5_000;

    /// @dev Accepted amounts are bounded by Bank's 108-bit capital ceiling. Keep checked casts
    ///      at the write boundary; lifecycle state and gross-minus-net fee need no duplicate slots.
    struct StoredBetTerminal {
        uint128 payoutGross;
        uint128 payoutNet;
        uint128 protocolFeeAccrual;
        uint128 refundAmount;
    }

    mapping(uint256 => SSOTTypes.Bet) internal bets;
    mapping(uint256 => StoredBetTerminal) internal betTerminals;
    mapping(uint256 => bytes) internal betParams;
    mapping(uint256 => ReferralPayees) internal betReferralPayees;
    mapping(bytes32 => bool) public override gameDisabled;
    mapping(address => uint64) public override voidCohortEnd;

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

        _validateHouseEdge(defaultHouseEdgeBps_);

        settlementRouter = settlementRouter_;
        vrfHub = vrfHub_;
        referralRegistry = referralRegistry_;
        referralEngine = referralEngine_;

        _setRefundTimeout(refundTimeoutSeconds_);

        defaultHouseEdgeBps = defaultHouseEdgeBps_;
        emit EdgeChangeApplied(0, defaultHouseEdgeBps_);

        // schedule id 1 is created and activated at deployment
        uint32 id = _createReferralConfig(l0Bps_, l1Bps_, l2Bps_, holdbackBps_);
        activeReferralConfigId = id;
        emit ActiveReferralConfigSet(0, id);
    }

    function riskInPaused(uint64 poolId) public view override returns (bool) {
        SSOTTypes.Pool memory p = _pool(poolId);
        return !p.active || IBank(p.bank).riskInPaused();
    }

    // --- governance ---

    function setRefundTimeout(uint256 seconds_) external onlyGov {
        _setRefundTimeout(seconds_);
    }

    function _setRefundTimeout(uint256 seconds_) private {
        if (seconds_ < MIN_REFUND_TIMEOUT_SECONDS || seconds_ > MAX_REFUND_TIMEOUT_SECONDS) {
            revert InvalidRefundTimeout(seconds_);
        }
        refundTimeoutSeconds = seconds_;
        emit RefundTimeoutSet(seconds_);
    }

    // Every house-edge change is delayed; accepted bets retain their snapshot.
    function pendingEdgeChange() external view override returns (uint16 bps, uint64 activatesAt) {
        PendingEdgeChange memory pending = _pendingEdgeChange;
        return (pending.bps, pending.activatesAt);
    }

    function queueEdgeChange(uint16 bps) external override onlyGov {
        _validateHouseEdge(bps);
        uint64 activatesAt = uint64(block.timestamp + HouseEdgeLib.EDGE_CHANGE_DELAY);
        _pendingEdgeChange = PendingEdgeChange({bps: bps, activatesAt: activatesAt});
        emit EdgeChangeQueued(defaultHouseEdgeBps, bps, activatesAt);
    }

    function activateEdgeChange() external override {
        PendingEdgeChange memory pending = _pendingEdgeChange;
        if (pending.activatesAt == 0) revert NoPendingEdgeChange();
        if (block.timestamp < pending.activatesAt) revert EdgeChangeNotReady(pending.activatesAt);
        delete _pendingEdgeChange;
        uint16 old = defaultHouseEdgeBps;
        defaultHouseEdgeBps = pending.bps;
        emit EdgeChangeApplied(old, pending.bps);
    }

    /// @notice Keeps the current edge, so the sentinel may also call it.
    function cancelEdgeChange() external override onlyGovOrSentinel {
        PendingEdgeChange memory pending = _pendingEdgeChange;
        if (pending.activatesAt == 0) revert NoPendingEdgeChange();
        delete _pendingEdgeChange;
        emit EdgeChangeCancelled(defaultHouseEdgeBps, pending.bps);
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

    // --- games ---

    function registerGame(bytes32 gameId, address module, uint32 maxBetCount, uint32 callbackGasLimit)
        external
        override
        onlyGov
    {
        if (module.code.length == 0) revert Errors.InvalidConfig();
        if (
            gameModule[gameId] != address(0) || maxBetCount == 0 || maxBetCount > MAX_BET_COUNT
                || callbackGasLimit < 200_000 || callbackGasLimit > IVRFHub(vrfHub).MAX_CALLBACK_GAS()
        ) revert Errors.InvalidConfig();
        gameModule[gameId] = module;
        gameMaxBetCount[gameId] = maxBetCount;
        gameCallbackGasLimit[gameId] = callbackGasLimit;
        emit GameRegistered(gameId, module, maxBetCount, callbackGasLimit);
    }

    /// @dev Irreversible: registerGame refuses a used gameId, so a restored game needs a new gameId.
    function disableGame(bytes32 gameId) external override onlyGovOrSentinel {
        if (gameModule[gameId] == address(0)) revert UnknownGame(gameId);
        if (gameDisabled[gameId]) revert GameIsDisabled(gameId);
        gameDisabled[gameId] = true;
        emit GameDisabled(gameId, msg.sender);
    }

    function getBet(uint256 betId) external view override returns (SSOTTypes.Bet memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return b;
    }

    function getBetTerminal(uint256 betId) external view override returns (SSOTTypes.BetTerminal memory) {
        SSOTTypes.Bet storage b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        StoredBetTerminal storage terminal = betTerminals[betId];
        return SSOTTypes.BetTerminal({
            state: b.state == SSOTTypes.BetState.Settled || b.state == SSOTTypes.BetState.Refunded
                    || b.state == SSOTTypes.BetState.Voided
                ? b.state
                : SSOTTypes.BetState.None,
            payoutGross: terminal.payoutGross,
            payoutNet: terminal.payoutNet,
            feeOnPayout: uint256(terminal.payoutGross) - uint256(terminal.payoutNet),
            protocolFeeAccrual: terminal.protocolFeeAccrual,
            refundAmount: terminal.refundAmount
        });
    }

    function getBetParams(uint256 betId) external view override returns (bytes memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        return betParams[betId];
    }

    function getBetRandomWords(uint256 betId) external view override returns (uint256[] memory) {
        SSOTTypes.Bet memory b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        // During the request's native-refund callback, placeBet has not bound requestId yet.
        if (b.requestId == 0) return new uint256[](0);
        IVRFHub.RequestInfo memory request = _boundRequest(betId);
        if (
            request.state != IVRFHub.RequestState.Received && request.state != IVRFHub.RequestState.Terminal
                && request.state != IVRFHub.RequestState.Voided
        ) return new uint256[](0);
        uint256[] memory words = new uint256[](1);
        words[0] = request.seed;
        return words;
    }

    function getBetReferralPayees(uint256 betId) external view override returns (address l1, address l2) {
        if (bets[betId].state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        ReferralPayees memory payees = betReferralPayees[betId];
        return (payees.l1, payees.l2);
    }

    // ---------------------------------------------------------------------
    // Risk-In: placeBet (player=msg.sender)
    // ---------------------------------------------------------------------

    // The admitted casino formats contain at most two static ABI words. Bound the bytes stored and
    // later copied during finalization; abi.decode alone accepts arbitrarily long trailing data.
    uint256 internal constant MAX_GAME_PARAMS_BYTES = 64;

    function quoteVRFFee(bytes32 gameId, uint32 betCount, uint256 gasPriceBudget)
        public
        view
        override
        returns (uint256 fee, uint32 callbackGasLimit)
    {
        if (gameModule[gameId] == address(0)) revert UnknownGame(gameId);
        if (gameDisabled[gameId]) revert GameIsDisabled(gameId);
        if (betCount == 0 || betCount > gameMaxBetCount[gameId]) revert Errors.InvalidConfig();
        callbackGasLimit = gameCallbackGasLimit[gameId];
        fee = IVRFHub(vrfHub).quote(callbackGasLimit, gasPriceBudget);
    }

    function placeBet(
        bytes32 gameId,
        uint64 poolId,
        bytes calldata params,
        SSOTTypes.StakeSpec calldata stakeSpec,
        address affiliate,
        uint16 maxHouseEdgeBps
    ) external payable override nonReentrant returns (uint256 positionId) {
        SSOTTypes.Pool memory pool_ = _pool(poolId);
        if (!pool_.active || IBank(pool_.bank).riskInPaused()) revert RiskInPaused(poolId);
        if (stakeSpec.amountPerRoll == 0) revert Errors.InsufficientBalance();
        if (stakeSpec.betCount == 0 || stakeSpec.betCount > gameMaxBetCount[gameId]) revert Errors.InvalidConfig();
        if (params.length > MAX_GAME_PARAMS_BYTES) revert Errors.InvalidConfig();
        uint256 minimum = IBank(pool_.bank).minBetAmount();
        if (stakeSpec.amountPerRoll < minimum) {
            revert IBank.BetAmountBelowMinimum(stakeSpec.amountPerRoll, minimum);
        }

        uint256 stake = stakeSpec.amountPerRoll * uint256(stakeSpec.betCount);
        if (stake == 0) revert Errors.InsufficientBalance();

        address player = msg.sender;

        address asset = pool_.asset;
        address bank_ = pool_.bank;

        address module = gameModule[gameId];
        if (module == address(0)) revert UnknownGame(gameId);
        if (gameDisabled[gameId]) revert GameIsDisabled(gameId);

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

        // Snapshot the fixed house edge and the accepted referral payees.
        (address l1, address l2) = _snapshotReferral(player, affiliate);
        uint16 houseEdge = defaultHouseEdgeBps;
        if (houseEdge > usedMaxHE) revert HouseEdgeTooHigh(houseEdge, usedMaxHE);

        uint32 cfgId = activeReferralConfigId;

        bytes32 snapshotHash = keccak256(
            abi.encodePacked(gameId, module, poolId, asset, bank_, block.chainid, cfgId, houseEdge, usedMaxHE, l1, l2)
        );

        uint256 fundingBalance = StakeFunding.collect(asset, bank_, stake);
        positionId =
            ISettlementRouter(settlementRouter).openPosition(poolId, player, stake, reserved, snapshotHash, houseEdge);
        StakeFunding.finish(asset, bank_, fundingBalance);
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

        b.houseEdgeBps = houseEdge;
        b.maxHouseEdgeBps = usedMaxHE;
        b.referralConfigId = cfgId;

        b.snapshotHash = snapshotHash;
        b.paramsHash = paramsHash;
        b.placedAt = uint64(block.timestamp);
        b.refundDeadline = uint64(block.timestamp + refundTimeoutSeconds);
        b.state = SSOTTypes.BetState.Held;

        betParams[positionId] = params;
        betModule[positionId] = module;

        // --- VRF fee: charged in native token ---
        uint32 cb = gameCallbackGasLimit[gameId];

        (uint256 requestId, uint256 charged) = IVRFHub(vrfHub).requestRandomWords{value: msg.value}(positionId, cb, 3);
        b.vrfFeePaid = msg.value;
        b.vrfFeeCharged = charged;
        b.vrfCallbackGasLimit = cb;
        b.requestId = requestId;
        b.vrfRequestedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.PendingVRF;

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
            l1,
            l2,
            houseEdge,
            usedMaxHE,
            cfgId,
            b.refundDeadline
        );
    }

    // ---------------------------------------------------------------------
    // VRF callback
    // ---------------------------------------------------------------------

    function onRandomWords(uint256 requestId, uint256[] calldata randomWords) external override nonReentrant {
        if (msg.sender != vrfHub) revert NotVRFHub();
        if (randomWords.length != 1) revert InvalidRandomReceipt();
        IVRFHub.RequestInfo memory request = IVRFHub(vrfHub).getRequest(requestId);
        uint256 betId = request.betId;
        _validateRequest(betId, requestId, request);
        if (request.state != IVRFHub.RequestState.Received || request.seed != randomWords[0]) {
            revert InvalidRandomReceipt();
        }
        _recordRandom(betId, requestId, request.seed);
        _attemptCallbackSettlement(betId, request.seed);
    }

    function _recordRandom(uint256 betId, uint256 requestId, uint256 seed) private {
        SSOTTypes.Bet storage b = bets[betId];
        if (b.state == SSOTTypes.BetState.RandomReady) return;
        if (b.state != SSOTTypes.BetState.PendingVRF) revert BadState(betId, b.state, SSOTTypes.BetState.PendingVRF);
        uint256[] memory words = new uint256[](1);
        words[0] = seed;
        bytes memory data = abi.encode(words);
        bytes32 rh = keccak256(data);
        b.randomHash = rh;
        b.state = SSOTTypes.BetState.RandomReady;
        emit BetRandomReady(betId, requestId, rh);
    }

    function _receivedRequest(uint256 betId) private view returns (IVRFHub.RequestInfo memory request) {
        request = _boundRequest(betId);
        if (request.state != IVRFHub.RequestState.Received) revert InvalidRandomReceipt();
    }

    function _boundRequest(uint256 betId) private view returns (IVRFHub.RequestInfo memory request) {
        uint256 requestId = bets[betId].requestId;
        request = IVRFHub(vrfHub).getRequest(requestId);
        _validateRequest(betId, requestId, request);
    }

    function _validateRequest(uint256 betId, uint256 requestId, IVRFHub.RequestInfo memory request) private view {
        SSOTTypes.Bet storage b = bets[betId];
        if (
            betId == 0 || requestId == 0 || b.state == SSOTTypes.BetState.None || b.requestId != requestId
                || request.hub != address(this) || request.betId != betId || request.bank != b.bank
                || request.payer != b.player
        ) revert InvalidRandomReceipt();
    }

    function _attemptCallbackSettlement(uint256 betId, uint256 seed) private {
        bytes memory data = abi.encodeCall(this.finalizeFromCallback, (betId, seed));
        uint256 remaining = gasleft();
        bool ok;
        bytes32 errorPrefix;
        if (remaining > CALLBACK_COMPLETION_GAS) {
            uint256 childGas = remaining - CALLBACK_COMPLETION_GAS;
            // Do not copy unbounded module/token revert data into the durable receipt frame.
            assembly ("memory-safe") {
                ok := call(childGas, address(), 0, add(data, 32), mload(data), 0, 0)
                if iszero(ok) {
                    let n := returndatasize()
                    if gt(n, 32) { n := 32 }
                    mstore(0, 0)
                    returndatacopy(0, 0, n)
                    errorPrefix := mload(0)
                }
            }
        }
        if (!ok) emit CallbackSettlementFailed(betId, errorPrefix);
    }

    /// @dev The guarded callback already authenticated the canonical receipt and seed.
    ///      All terminal effects, including ack, revert together in this only-self child frame.
    function finalizeFromCallback(uint256 betId, uint256 seed) external {
        if (msg.sender != address(this)) revert NotSelf();
        _finalize(betId, seed);
    }

    // ---------------------------------------------------------------------
    // Debt-Out: finalize (permissionless)
    // ---------------------------------------------------------------------

    function finalize(uint256 betId) external override nonReentrant {
        if (bets[betId].state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        IVRFHub.RequestInfo memory request = _receivedRequest(betId);
        _recordRandom(betId, bets[betId].requestId, request.seed);
        _finalize(betId, request.seed);
    }

    function _finalize(uint256 betId, uint256 seed) private {
        SSOTTypes.Bet storage b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        if (b.state != SSOTTypes.BetState.RandomReady) revert BadState(betId, b.state, SSOTTypes.BetState.RandomReady);

        address module = betModule[betId];
        if (module == address(0)) revert UnknownGame(b.gameId);

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = seed;
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({
            amountPerRoll: b.amountPerRoll, betCount: b.betCount, stopGain: b.stopGain, stopLoss: b.stopLoss
        });
        (uint256 payoutGross, uint256 refundAmount) =
            IGameModule(module).resolve(betParams[betId], spec, betId, randomWords);
        if (refundAmount > b.stake) revert InvalidModuleResult();
        // reserved must cover total owed (payoutGross + refundAmount)
        if (payoutGross > b.reserved || refundAmount > b.reserved - payoutGross) {
            revert InvalidModuleResult();
        }

        // ---- Fee-on-payout ----
        uint256 feeOnPayout = 0;
        uint256 payoutNet = payoutGross;
        if (payoutGross > 0) {
            feeOnPayout = Math.mulDiv(payoutGross, uint256(b.houseEdgeBps), BPS);
            if (feeOnPayout > payoutGross) feeOnPayout = payoutGross;
            payoutNet = payoutGross - feeOnPayout;
        }

        uint256 usedTurnover = b.stake - refundAmount;

        // ---- house-edge allocation (turnover-based, SSOT v1.6) and the XP awards that pay it ----
        (IReferralEngine.Allocation memory alloc, SSOTTypes.XPAward[] memory awards) = _allocate(betId, b, usedTurnover);
        uint256 protocolFeeAccrual = alloc.protocolFee;

        b.resolvedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.Settled;
        betTerminals[betId] = StoredBetTerminal({
            payoutGross: payoutGross.toUint128(),
            payoutNet: payoutNet.toUint128(),
            protocolFeeAccrual: protocolFeeAccrual.toUint128(),
            refundAmount: refundAmount.toUint128()
        });

        ISettlementRouter(settlementRouter)
            .settlePosition(betId, payoutGross, payoutNet, refundAmount, protocolFeeAccrual, awards);
        IVRFHub(vrfHub).acknowledge(b.requestId);

        emit HouseEdgeAllocated(
            betId,
            usedTurnover,
            b.houseEdgeBps,
            alloc.edge,
            alloc.operatorShare,
            alloc.edge - alloc.operatorShare,
            alloc.protocolFee,
            alloc.r0,
            alloc.r1,
            alloc.r2
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

        uint256 readyAt = b.refundDeadline;
        if (block.timestamp < readyAt) revert RefundNotReady(betId, block.timestamp, readyAt);
        if (IVRFHub(vrfHub).getRequest(b.requestId).state != IVRFHub.RequestState.Awaiting) {
            revert InvalidRandomReceipt();
        }

        b.resolvedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.Refunded;
        betTerminals[betId] =
            StoredBetTerminal({payoutGross: 0, payoutNet: 0, protocolFeeAccrual: 0, refundAmount: b.stake.toUint128()});

        ISettlementRouter(settlementRouter).refundPosition(betId, b.stake);
        IVRFHub(vrfHub).cancel(b.requestId);

        emit BetRefunded(betId, b.stake);
    }

    // ---------------------------------------------------------------------
    // Void: a received result that can never be booked (ADR-0037 §7)
    // ---------------------------------------------------------------------

    /// @notice One decision per Bank, executed per bet: from now on any bet of the Bank requested at or before this
    ///         block may be voided once it is 24 hours old and its settlement still fails in the void transaction.
    function openVoidWindow(uint64 poolId) external override {
        address bank_ = _pool(poolId).bank;
        if (msg.sender != governance && msg.sender != sentinel && msg.sender != IBank(bank_).guardian()) {
            revert Errors.Unauthorized();
        }
        if (ISettlementRouter(settlementRouter).unbookedResultCount(bank_) == 0) revert NoUnbookedResult(bank_);
        uint64 cohortEnd = uint64(block.timestamp);
        voidCohortEnd[bank_] = cohortEnd;
        emit VoidWindowOpened(poolId, bank_, cohortEnd, msg.sender);
    }

    /// @notice Settles the bet when its settlement succeeds with exactly VOID_SETTLEMENT_GAS, otherwise refunds the
    ///         stake as a player payable. The outcome cannot depend on the caller's gas limit: a call with too
    ///         little gas reverts and never voids. The VRF fee is not refunded.
    function voidBet(uint256 betId) external override nonReentrant returns (bool voided) {
        SSOTTypes.Bet storage b = bets[betId];
        if (b.state == SSOTTypes.BetState.None) revert BetNotFound(betId);
        if (b.state != SSOTTypes.BetState.PendingVRF && b.state != SSOTTypes.BetState.RandomReady) {
            revert BadState(betId, b.state, SSOTTypes.BetState.RandomReady);
        }
        IVRFHub.RequestInfo memory request = _receivedRequest(betId);
        uint256 requestedAt = b.vrfRequestedAt;
        uint256 eligibleAt = requestedAt + (requestedAt <= voidCohortEnd[b.bank] ? VOID_DELAY : PUBLIC_VOID_DELAY);
        if (block.timestamp < eligibleAt) revert VoidNotEligible(betId, block.timestamp, eligibleAt);
        _recordRandom(betId, b.requestId, request.seed);

        bytes memory data = abi.encodeCall(this.finalizeFromCallback, (betId, request.seed));
        uint256 g = gasleft();
        // Without the second term EIP-150 would hand the child less than S whenever R < S / 63.
        if (
            g < VOID_SETTLEMENT_GAS + VOID_RESERVE_GAS + VOID_CALL_OVERHEAD
                || g - g / 64 < VOID_SETTLEMENT_GAS + VOID_CALL_OVERHEAD
        ) revert VoidGasTooLow(g, VOID_SETTLEMENT_GAS + VOID_RESERVE_GAS + VOID_CALL_OVERHEAD);
        bool settled;
        bytes32 errorPrefix;
        assembly ("memory-safe") {
            settled := call(VOID_SETTLEMENT_GAS, address(), 0, add(data, 32), mload(data), 0, 0)
            if iszero(settled) {
                let n := returndatasize()
                if gt(n, 32) { n := 32 }
                mstore(0, 0)
                returndatacopy(0, 0, n)
                errorPrefix := mload(0)
            }
        }
        if (settled) return false;

        // No module, engine, tree write or token transfer: the Bank books the stake as a player payable.
        uint256 stake = b.stake;
        b.resolvedAt = uint64(block.timestamp);
        b.state = SSOTTypes.BetState.Voided;
        betTerminals[betId] =
            StoredBetTerminal({payoutGross: 0, payoutNet: 0, protocolFeeAccrual: 0, refundAmount: stake.toUint128()});
        ISettlementRouter(settlementRouter).voidPosition(betId);
        IVRFHub(vrfHub).acknowledgeVoid(b.requestId);
        emit BetVoided(betId, msg.sender, stake, errorPrefix);
        return true;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _validateHouseEdge(uint16 bps) internal pure {
        if (bps == 0 || bps > HouseEdgeLib.MAX_HOUSE_EDGE_BPS) revert Errors.InvalidBps(bps);
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

    /// @dev Resolves the referral payees a bet is accepted under. If the player has no referrer, the affiliate
    ///      hint is bound first-touch on a best-effort basis. A rejected hint creates no referral payee
    ///      and does not change pricing; betting may still proceed without referral rewards.
    function _snapshotReferral(address player, address affiliate) internal returns (address l1, address l2) {
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
    }

    /// @dev SSOT v1.6 section 2. The allocation depends only on usedTurnover and the acceptance snapshot (house edge,
    ///      schedule id, payees); the Bank's current turnover and unlock threshold decide the XP buckets.
    function _allocate(uint256 betId, SSOTTypes.Bet storage b, uint256 usedTurnover)
        internal
        view
        returns (IReferralEngine.Allocation memory, SSOTTypes.XPAward[] memory)
    {
        ReferralSchedule storage cfg = _refCfg[b.referralConfigId];
        ReferralPayees storage payees = betReferralPayees[betId];
        return IReferralEngine(referralEngine)
            .allocate(
                IReferralEngine.AllocationInput({
                    usedTurnover: usedTurnover,
                    houseEdgeBps: b.houseEdgeBps,
                    player: b.player,
                    l1: payees.l1,
                    l2: payees.l2,
                    l0Bps: cfg.l0Bps,
                    l1Bps: cfg.l1Bps,
                    l2Bps: cfg.l2Bps,
                    holdbackBps: cfg.holdbackBps,
                    minTurnover: IBank(b.bank).minPlayerTurnoverForUnlock(),
                    // eligibility uses turnover AFTER this bet
                    playerTurnover: IBank(b.bank).playerTurnover(b.player) + usedTurnover
                })
            );
    }
}
