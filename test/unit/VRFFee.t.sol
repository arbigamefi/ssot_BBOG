// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

contract VRFFee is Test {
    MockERC20 asset;
    Bank bank;
    PoolRegistry poolRegistry;
    SettlementRouter router;
    GameHub hub;
    VRFHub vrf;
    address gov = address(0xA11CE);
    address alice = address(0xBEEF);

    bytes32 constant GAME_COIN = keccak256("COIN_TOSS");

    function setUp() external {
        asset = new MockERC20("Asset", "AST", 18);
        vrf = new VRFHub(address(this), gov);

        bank = new Bank(address(asset), gov, 1000, "LP", "LP", 18);
        poolRegistry = new PoolRegistry(gov);
        router = new SettlementRouter(address(poolRegistry));

        ReferralRegistry refReg = new ReferralRegistry(gov);
        DefaultReferralEngine refEng = new DefaultReferralEngine();

        hub = new GameHub(
            address(router), address(vrf), address(refReg), address(refEng), gov, 3600, 200, 1000, 2000, 500, 3000
        );

        vm.startPrank(gov);
        poolRegistry.registerPool(1, address(asset), address(bank), SSOTTypes.PoolDomain.Casino);
        poolRegistry.setHubRegistered(address(hub), true);
        poolRegistry.setHubAllowedForPool(1, address(hub), true);
        bank.setSettlementRouterOnce(address(router));
        refReg.setBinderOnce(address(hub));
        vm.stopPrank();

        CoinTossModule coin = new CoinTossModule();
        vm.prank(gov);
        hub.registerGame(GAME_COIN, address(coin));

        // seed liquidity + player funds
        asset.mint(gov, 10_000 ether);
        vm.startPrank(gov);
        asset.approve(address(bank), type(uint256).max);
        bank.deposit(5_000 ether, gov);
        vm.stopPrank();

        asset.mint(alice, 100 ether);
        vm.prank(alice);
        asset.approve(address(bank), type(uint256).max);

        vm.deal(alice, 10 ether);
        vm.txGasPrice(0);
    }

    function test_vrf_fee_overpay_refunds_best_effort() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 1 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = hub.quoteVRFFee(1);

        uint256 ethBefore = alice.balance;

        vm.prank(alice);
        hub.placeBet{value: fee + 1}(GAME_COIN, 1, abi.encode(true), spec, address(0), 10_000);

        uint256 ethAfter = alice.balance;
        assertEq(ethBefore - ethAfter, fee, "overpay should be refunded (gas price=0)");
    }

    function test_vrf_fee_underpay_reverts() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 1 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = hub.quoteVRFFee(1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InsufficientVRFFee.selector, fee - 1, fee));
        hub.placeBet{value: fee - 1}(GAME_COIN, 1, abi.encode(true), spec, address(0), 10_000);
    }
}
