// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatefulSystemDiff} from "./StatefulSystemDiff.t.sol";

import {Bank} from "src/core/Bank.sol";
import {GameHub} from "src/core/GameHub.sol";
import {PoolRegistry} from "src/core/PoolRegistry.sol";
import {SettlementRouter} from "src/core/SettlementRouter.sol";
import {VRFHub} from "src/core/VRFHub.sol";
import {SSOTTypes} from "src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "src/mocks/MockERC20.sol";

import {DefaultReferralEngine} from "src/engines/referral/DefaultReferralEngine.sol";
import {ReferralRegistry} from "src/engines/referral/ReferralRegistry.sol";

import {CoinTossModule} from "src/modules/cointoss/CoinTossModule.sol";
import {DiceModule} from "src/modules/dice/DiceModule.sol";
import {KenoModule} from "src/modules/keno/KenoModule.sol";
import {RouletteModule} from "src/modules/roulette/RouletteModule.sol";

/// @notice Runs the legacy independent stateful accounting model through the v1.3 router path.
contract GameHubStatefulSystemDiff is StatefulSystemDiff {
    uint64 internal constant POOL_A = 1;
    uint64 internal constant POOL_B = 2;

    PoolRegistry internal poolRegistry;
    SettlementRouter internal router;
    GameHub internal gameHub;

    function setUp() public override {
        assetA = new MockERC20("AssetA", "ASTA", 18);
        assetB = new MockERC20("AssetB", "ASTB", 18);

        coordinator = _configureVRFAdapter(gov);
        vrf = new VRFHub(coordinator, gov);

        vm.startPrank(gov);
        _postConfigureVRFAdapter(gov);
        vm.stopPrank();

        bankA = new Bank(address(assetA), gov, 1000, "LP Share ASTA", "LPA", 18);
        bankB = new Bank(address(assetB), gov, 1000, "LP Share ASTB", "LPB", 18);

        poolRegistry = new PoolRegistry(gov);
        router = new SettlementRouter(address(poolRegistry));

        refRegistry = new ReferralRegistry(gov);
        refEngine = new DefaultReferralEngine();

        uint16[6] memory levelBps;
        levelBps[0] = 0;
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
        refRegistry.setBinderOnce(address(gameHub));

        bankA.setHoldbackVestingSeconds(10);
        bankB.setHoldbackVestingSeconds(10);
        bankA.setMinPlayerTurnoverForUnlock(20 ether);
        bankB.setMinPlayerTurnoverForUnlock(20 ether);
        vm.stopPrank();

        dice = new DiceModule();
        coin = new CoinTossModule();
        roulette = new RouletteModule();
        keno = new KenoModule();

        vm.startPrank(gov);
        gameHub.registerGame(GAME_DICE, address(dice));
        gameHub.registerGame(GAME_COIN, address(coin));
        gameHub.registerGame(GAME_ROULETTE, address(roulette));
        gameHub.registerGame(GAME_KENO, address(keno));
        vm.stopPrank();

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

        _postPlayersSetup();

        vm.deal(gov, 100 ether);
        assetA.mint(gov, 20_000 ether);
        assetB.mint(gov, 20_000 ether);
        vm.startPrank(gov);
        assetA.approve(address(bankA), type(uint256).max);
        assetB.approve(address(bankB), type(uint256).max);
        bankA.deposit(10_000 ether, gov);
        bankB.deposit(10_000 ether, gov);
        vm.stopPrank();

        _syncBankModel(address(assetA));
        _syncBankModel(address(assetB));
        for (uint256 i = 0; i < players.length; i++) {
            address p = players[i];
            playerBal[p][address(assetA)] = assetA.balanceOf(p);
            playerBal[p][address(assetB)] = assetB.balanceOf(p);
        }
    }

    function _hubDefaultHouseEdgeBps() internal view override returns (uint16) {
        return gameHub.defaultHouseEdgeBps();
    }

    function _hubRefundTimeoutSeconds() internal view override returns (uint256) {
        return gameHub.refundTimeoutSeconds();
    }

    function _hubQuoteVRFFee(uint32 betCount) internal view override returns (uint256 fee, uint32 callbackGasLimit) {
        return gameHub.quoteVRFFee(betCount);
    }

    function _hubGetBet(uint256 betId) internal view override returns (SSOTTypes.Bet memory) {
        return gameHub.getBet(betId);
    }

    function _hubGetBetParams(uint256 betId) internal view override returns (bytes memory) {
        return gameHub.getBetParams(betId);
    }

    function _hubGameModule(bytes32 gameId) internal view override returns (address) {
        return gameHub.gameModule(gameId);
    }

    function _hubGetReferralConfig(uint32 id)
        internal
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
        return gameHub.getReferralConfig(id);
    }

    function _hubSetAffiliateHouseEdge(address affiliate, uint16 he) internal override returns (bool) {
        vm.prank(affiliate);
        try gameHub.setAffiliateHouseEdge(he) {
            return true;
        } catch {
            return false;
        }
    }

    function _hubPlaceBet(
        address player,
        bytes32 gameId,
        address asset,
        bytes memory params,
        SSOTTypes.StakeSpec memory spec,
        address affiliate,
        uint16 maxHE,
        uint256 msgValue
    ) internal override returns (uint256 betId, bool ok) {
        uint64 poolId = _poolIdForAsset(asset);
        vm.prank(player);
        try gameHub.placeBet{value: msgValue}(gameId, poolId, params, spec, affiliate, maxHE) returns (uint256 id) {
            return (id, true);
        } catch {
            return (0, false);
        }
    }

    function _hubRefund(uint256 betId) internal override {
        gameHub.refund(betId);
    }

    function _hubFinalize(uint256 betId) internal override {
        gameHub.finalize(betId);
    }

    function _poolIdForAsset(address asset) internal view returns (uint64) {
        if (asset == address(assetA)) return POOL_A;
        if (asset == address(assetB)) return POOL_B;
        revert("unknown asset");
    }
}
