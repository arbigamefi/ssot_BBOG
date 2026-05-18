// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import {GameHub} from "../../src/core/GameHub.sol";
import {ISettlementRouter} from "../../src/core/interfaces/ISettlementRouter.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

interface IERC20GameHubCanary {
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

interface IBankGameHubCanary {
    function totalAssets() external view returns (uint256);
    function totalReserved() external view returns (uint256);
    function riskInPaused() external view returns (bool);
}

interface IVRFHubAdapterViewCanary {
    function adapter() external view returns (address);
}

interface IChainlinkAdapterCanary {
    function requestGasPriceWei() external view returns (uint256);
}

/// @notice Public-testnet GameHub canary helper.
/// @dev Default mode places one low-stake Dice bet and validates GameHub/Router/VRF/Bank state.
///      `CANARY_MODE=finalize` finalizes an existing RandomReady casino bet.
///      `CANARY_MODE=refund` refunds an existing PendingVRF casino bet after refund timeout.
///      `CANARY_MODE=status` prints the current chain state for an existing casino bet.
///      Optional role key:
///      - CANARY_PLAYER_PRIVATE_KEY
///      Unset player key falls back to PRIVATE_KEY for bootstrap rehearsals.
///      The wrapper script simulates by default; set BROADCAST=1 there to send transactions.
contract GameHubCanaryV13 is Script {
    using stdJson for string;

    uint64 internal constant DEFAULT_CASINO_POOL_ID = 1;
    bytes32 internal constant GAME_DICE = keccak256("DICE");

    struct CanaryConfig {
        uint256 privateKey;
        uint256 playerPrivateKey;
        address player;
        address asset;
        address casinoBank;
        GameHub gameHub;
        ISettlementRouter settlementRouter;
        IVRFHub vrfHub;
        address adapter;
        uint256 requestGasPriceWei;
        uint64 poolId;
        uint256 stake;
        uint32 betCount;
        uint8 diceCap;
        uint256 stopGain;
        uint256 stopLoss;
        uint16 maxHouseEdgeBps;
        uint256 vrfFeeBufferBps;
        uint256 positionId;
    }

    function run() external {
        string memory mode = vm.envOr("CANARY_MODE", string("place"));
        bytes32 modeHash = keccak256(bytes(mode));

        if (modeHash == keccak256("place")) {
            _placeCanary();
            return;
        }

        if (modeHash == keccak256("finalize")) {
            _finalizeCanary();
            return;
        }

        if (modeHash == keccak256("refund")) {
            _refundCanary();
            return;
        }

        if (modeHash == keccak256("status")) {
            _statusCanary();
            return;
        }

        revert("unsupported CANARY_MODE");
    }

    function _placeCanary() internal {
        CanaryConfig memory cfg = _readPlaceConfig();
        _validatePlaceConfig(cfg);
        _logPlaceConfig(cfg);

        uint256 positionId = _broadcastPlace(cfg);
        _validatePlaced(cfg, positionId);

        SSOTTypes.Bet memory bet = cfg.gameHub.getBet(positionId);
        console2.log("  CANARY_POSITION_ID", positionId);
        console2.log("  CANARY_REQUEST_ID", bet.requestId);
        console2.log("  betState", uint256(bet.state));
    }

    function _finalizeCanary() internal {
        CanaryConfig memory cfg = _readExistingPositionConfig();
        _logExistingPositionConfig("finalize", cfg);
        _validateFinalizeConfig(cfg);

        SSOTTypes.Bet memory beforeBet = cfg.gameHub.getBet(cfg.positionId);
        uint256 reservedBefore = IBankGameHubCanary(cfg.casinoBank).totalReserved();

        vm.broadcast(cfg.playerPrivateKey);
        cfg.gameHub.finalize(cfg.positionId);

        SSOTTypes.Bet memory afterBet = cfg.gameHub.getBet(cfg.positionId);
        SSOTTypes.Position memory position = cfg.settlementRouter.getPosition(cfg.positionId);
        require(afterBet.state == SSOTTypes.BetState.Settled, "bet not settled");
        require(position.state == SSOTTypes.PositionState.Settled, "position not settled");
        require(
            IBankGameHubCanary(cfg.casinoBank).totalReserved() + beforeBet.reserved == reservedBefore,
            "reserve not released"
        );

        console2.log("  finalizedPositionId", cfg.positionId);
        console2.log("  resolvedAt", afterBet.resolvedAt);
    }

    function _refundCanary() internal {
        CanaryConfig memory cfg = _readExistingPositionConfig();
        _logExistingPositionConfig("refund", cfg);
        _validateRefundConfig(cfg);

        SSOTTypes.Bet memory beforeBet = cfg.gameHub.getBet(cfg.positionId);
        uint256 reservedBefore = IBankGameHubCanary(cfg.casinoBank).totalReserved();

        vm.broadcast(cfg.playerPrivateKey);
        cfg.gameHub.refund(cfg.positionId);

        SSOTTypes.Bet memory afterBet = cfg.gameHub.getBet(cfg.positionId);
        SSOTTypes.Position memory position = cfg.settlementRouter.getPosition(cfg.positionId);
        require(afterBet.state == SSOTTypes.BetState.Refunded, "bet not refunded");
        require(position.state == SSOTTypes.PositionState.Refunded, "position not refunded");
        require(
            IBankGameHubCanary(cfg.casinoBank).totalReserved() + beforeBet.reserved == reservedBefore,
            "reserve not released"
        );

        console2.log("  refundedPositionId", cfg.positionId);
        console2.log("  resolvedAt", afterBet.resolvedAt);
    }

    function _statusCanary() internal view {
        CanaryConfig memory cfg = _readExistingPositionConfig();
        _logExistingPositionConfig("status", cfg);

        SSOTTypes.Bet memory bet = cfg.gameHub.getBet(cfg.positionId);
        SSOTTypes.Position memory position = cfg.settlementRouter.getPosition(cfg.positionId);
        console2.log("  betState", uint256(bet.state));
        console2.log("  positionState", uint256(position.state));
        console2.log("  stake", bet.stake);
        console2.log("  reserved", bet.reserved);
        console2.log("  requestId", bet.requestId);
        console2.log("  randomHash");
        console2.logBytes32(bet.randomHash);
        console2.log("  placedAt", bet.placedAt);
        console2.log("  vrfRequestedAt", bet.vrfRequestedAt);
        console2.log("  resolvedAt", bet.resolvedAt);

        if (bet.requestId != 0) {
            IVRFHub.RequestInfo memory request = cfg.vrfHub.getRequest(bet.requestId);
            console2.log("  vrfRequestHub", request.hub);
            console2.log("  vrfRequestBetId", request.betId);
            console2.log("  vrfRequestActive", request.active);
            console2.log("  vrfFeePaid", request.feePaid);
            console2.log("  vrfFeeCharged", request.feeCharged);
        }
    }

    function _readPlaceConfig() internal view returns (CanaryConfig memory cfg) {
        _readBaseConfig(cfg);
        cfg.stake = vm.envOr("CANARY_STAKE", uint256(10_000));
        cfg.betCount = uint32(vm.envOr("CANARY_BET_COUNT", uint256(1)));
        cfg.diceCap = uint8(vm.envOr("CANARY_DICE_CAP", uint256(50)));
        cfg.stopGain = vm.envOr("CANARY_STOP_GAIN", uint256(0));
        cfg.stopLoss = vm.envOr("CANARY_STOP_LOSS", uint256(0));
        cfg.maxHouseEdgeBps = uint16(vm.envOr("CANARY_MAX_HOUSE_EDGE_BPS", uint256(0)));
        cfg.vrfFeeBufferBps = vm.envOr("CANARY_VRF_FEE_BUFFER_BPS", uint256(5_000));
    }

    function _readExistingPositionConfig() internal view returns (CanaryConfig memory cfg) {
        _readBaseConfig(cfg);
        cfg.positionId = vm.envUint("CANARY_POSITION_ID");
        require(cfg.positionId != 0, "missing position id");
    }

    function _readBaseConfig(CanaryConfig memory cfg) internal view {
        cfg.privateKey = vm.envUint("PRIVATE_KEY");
        cfg.playerPrivateKey = vm.envOr("CANARY_PLAYER_PRIVATE_KEY", cfg.privateKey);
        cfg.player = vm.addr(cfg.playerPrivateKey);

        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v13.json"));
        string memory json = vm.readFile(snapshotPath);

        cfg.poolId = uint64(vm.envOr("CANARY_POOL_ID", json.readUint(".poolId_0")));
        cfg.asset = json.readAddress(".poolAsset_0");
        cfg.casinoBank = json.readAddress(".poolBank_0");
        cfg.gameHub = GameHub(json.readAddress(".gameHub"));
        cfg.settlementRouter = ISettlementRouter(cfg.gameHub.settlementRouter());
        cfg.vrfHub = IVRFHub(cfg.gameHub.vrfHub());
        cfg.adapter = IVRFHubAdapterViewCanary(address(cfg.vrfHub)).adapter();
        if (cfg.adapter != address(0)) {
            cfg.requestGasPriceWei = IChainlinkAdapterCanary(cfg.adapter).requestGasPriceWei();
        }

        uint256 snapshotDomain = json.readUint(".poolDomain_0");
        require(snapshotDomain == uint256(SSOTTypes.PoolDomain.Casino), "snapshot pool 0 not casino");
        require(cfg.poolId == DEFAULT_CASINO_POOL_ID || cfg.poolId == json.readUint(".poolId_0"), "unexpected pool id");
    }

    function _validatePlaceConfig(CanaryConfig memory cfg) internal view {
        require(address(cfg.gameHub) != address(0), "missing game hub");
        require(address(cfg.settlementRouter) != address(0), "missing settlement router");
        require(address(cfg.vrfHub) != address(0), "missing vrf hub");
        require(cfg.adapter != address(0), "missing vrf adapter");
        require(cfg.requestGasPriceWei != 0, "adapter gas price unset");
        require(cfg.asset != address(0), "missing asset");
        require(cfg.casinoBank != address(0), "missing casino bank");
        require(cfg.gameHub.gameModule(GAME_DICE) != address(0), "dice not registered");
        require(!cfg.gameHub.riskInPaused(cfg.poolId), "gamehub risk-in paused");
        require(!IBankGameHubCanary(cfg.casinoBank).riskInPaused(), "bank risk-in paused");
        require(cfg.stake != 0, "stake=0");
        require(cfg.betCount != 0, "betCount=0");
        require(cfg.diceCap >= 1 && cfg.diceCap <= 99, "bad dice cap");

        uint256 totalStake = cfg.stake * uint256(cfg.betCount);
        require(IERC20GameHubCanary(cfg.asset).balanceOf(cfg.player) >= totalStake, "player asset balance low");

        (uint256 fee,) = cfg.gameHub.quoteVRFFee(cfg.betCount);
        require(cfg.player.balance >= _bufferedVrfFee(fee, cfg.vrfFeeBufferBps), "player native balance low");
    }

    function _validateFinalizeConfig(CanaryConfig memory cfg) internal view {
        SSOTTypes.Bet memory bet = cfg.gameHub.getBet(cfg.positionId);
        require(bet.state == SSOTTypes.BetState.RandomReady, "bet not random ready");
        require(bet.bank == cfg.casinoBank, "wrong bank");
        require(bet.asset == cfg.asset, "wrong asset");
        require(bet.player != address(0), "missing player");
    }

    function _validateRefundConfig(CanaryConfig memory cfg) internal view {
        SSOTTypes.Bet memory bet = cfg.gameHub.getBet(cfg.positionId);
        require(bet.state == SSOTTypes.BetState.PendingVRF, "bet not pending vrf");
        require(bet.bank == cfg.casinoBank, "wrong bank");
        require(bet.asset == cfg.asset, "wrong asset");

        uint256 readyAt = uint256(bet.placedAt) + cfg.gameHub.refundTimeoutSeconds();
        require(block.timestamp >= readyAt, "refund not ready");
    }

    function _logPlaceConfig(CanaryConfig memory cfg) internal view {
        (uint256 fee, uint32 callbackGasLimit) = cfg.gameHub.quoteVRFFee(cfg.betCount);
        console2.log("GameHub v1.3 canary");
        console2.log("  mode", "place");
        console2.log("  gameHub", address(cfg.gameHub));
        console2.log("  settlementRouter", address(cfg.settlementRouter));
        console2.log("  vrfHub", address(cfg.vrfHub));
        console2.log("  adapter", cfg.adapter);
        console2.log("  requestGasPriceWei", cfg.requestGasPriceWei);
        console2.log("  casinoPoolId", cfg.poolId);
        console2.log("  asset", cfg.asset);
        console2.log("  casinoBank", cfg.casinoBank);
        console2.log("  player", cfg.player);
        console2.log("  gameId");
        console2.logBytes32(GAME_DICE);
        console2.log("  stakePerRoll", cfg.stake);
        console2.log("  betCount", cfg.betCount);
        console2.log("  diceCap", cfg.diceCap);
        console2.log("  vrfFee", fee);
        console2.log("  vrfFeeBufferBps", cfg.vrfFeeBufferBps);
        console2.log("  vrfFeePaid", _bufferedVrfFee(fee, cfg.vrfFeeBufferBps));
        console2.log("  vrfCallbackGasLimit", callbackGasLimit);
        console2.log("  bankAssets", IBankGameHubCanary(cfg.casinoBank).totalAssets());
        console2.log("  bankReserved", IBankGameHubCanary(cfg.casinoBank).totalReserved());
    }

    function _logExistingPositionConfig(string memory mode, CanaryConfig memory cfg) internal view {
        console2.log("GameHub v1.3 canary");
        console2.log("  mode", mode);
        console2.log("  gameHub", address(cfg.gameHub));
        console2.log("  settlementRouter", address(cfg.settlementRouter));
        console2.log("  vrfHub", address(cfg.vrfHub));
        console2.log("  adapter", cfg.adapter);
        console2.log("  requestGasPriceWei", cfg.requestGasPriceWei);
        console2.log("  casinoPoolId", cfg.poolId);
        console2.log("  asset", cfg.asset);
        console2.log("  casinoBank", cfg.casinoBank);
        console2.log("  caller", cfg.player);
        console2.log("  CANARY_POSITION_ID", cfg.positionId);
        console2.log("  bankAssets", IBankGameHubCanary(cfg.casinoBank).totalAssets());
        console2.log("  bankReserved", IBankGameHubCanary(cfg.casinoBank).totalReserved());
    }

    function _broadcastPlace(CanaryConfig memory cfg) internal returns (uint256 positionId) {
        uint256 totalStake = cfg.stake * uint256(cfg.betCount);
        uint256 allowance = IERC20GameHubCanary(cfg.asset).allowance(cfg.player, cfg.casinoBank);
        (uint256 fee,) = cfg.gameHub.quoteVRFFee(cfg.betCount);
        uint256 feePaid = _bufferedVrfFee(fee, cfg.vrfFeeBufferBps);

        SSOTTypes.StakeSpec memory stakeSpec = SSOTTypes.StakeSpec({
            amountPerRoll: cfg.stake, betCount: cfg.betCount, stopGain: cfg.stopGain, stopLoss: cfg.stopLoss
        });

        bytes memory params = abi.encode(true, cfg.diceCap);

        vm.startBroadcast(cfg.playerPrivateKey);
        if (allowance < totalStake) {
            IERC20GameHubCanary(cfg.asset).approve(cfg.casinoBank, type(uint256).max);
        }
        positionId = cfg.gameHub.placeBet{value: feePaid}(
            GAME_DICE, cfg.poolId, params, stakeSpec, address(0), cfg.maxHouseEdgeBps
        );
        vm.stopBroadcast();
    }

    function _bufferedVrfFee(uint256 fee, uint256 bufferBps) internal pure returns (uint256) {
        require(bufferBps <= 10_000, "vrf fee buffer too high");
        return fee + (fee * bufferBps) / 10_000;
    }

    function _validatePlaced(CanaryConfig memory cfg, uint256 positionId) internal view {
        SSOTTypes.Bet memory bet = cfg.gameHub.getBet(positionId);
        SSOTTypes.Position memory position = cfg.settlementRouter.getPosition(positionId);
        IVRFHub.RequestInfo memory request = cfg.vrfHub.getRequest(bet.requestId);

        require(bet.state == SSOTTypes.BetState.PendingVRF, "bet not pending vrf");
        require(position.state == SSOTTypes.PositionState.Held, "position not held");
        require(position.ownerHub == address(cfg.gameHub), "wrong owner hub");
        require(position.poolId == cfg.poolId, "wrong pool id");
        require(position.player == cfg.player, "wrong position player");
        require(position.asset == cfg.asset, "wrong position asset");
        require(position.bank == cfg.casinoBank, "wrong position bank");
        require(bet.player == cfg.player, "wrong bet player");
        require(bet.asset == cfg.asset, "wrong bet asset");
        require(bet.bank == cfg.casinoBank, "wrong bet bank");
        require(bet.stake == cfg.stake * uint256(cfg.betCount), "wrong stake");
        require(bet.requestId != 0, "missing request id");
        require(request.hub == address(cfg.gameHub), "wrong request hub");
        require(request.betId == positionId, "wrong request bet id");
        require(request.payer == cfg.player, "wrong request payer");
        require(request.active, "request not active");
    }
}
