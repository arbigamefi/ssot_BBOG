// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {BankRegistry} from "../../src/core/BankRegistry.sol";
import {Hub} from "../../src/core/Hub.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {ChainlinkV2PlusWrapperAdapter} from "../../src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

contract ChainlinkAdapter is Test {
    MockERC20 asset;
    Bank bank;
    BankRegistry registry;
    Hub hub;
    VRFHub vrf;

    MockVRFV2PlusWrapper wrapper;
    ChainlinkV2PlusWrapperAdapter adapter;

    address gov = address(0xA11CE);
    address alice = address(0xBEEF);

    bytes32 constant GAME_COIN = keccak256("COIN_TOSS");

    function setUp() external {
        asset = new MockERC20("Asset", "AST", 18);

        // Deploy wrapper + adapter first, then VRFHub with coordinator == adapter.
        wrapper = new MockVRFV2PlusWrapper();
        adapter = new ChainlinkV2PlusWrapperAdapter(address(wrapper), gov);
        vrf = new VRFHub(address(adapter), gov);

        vm.startPrank(gov);
        adapter.setVRFHub(address(vrf));
        adapter.setRequestGasPriceWei(0);
        // deterministic pricing: flat base fee, no overhead or per-word fee
        wrapper.setPricing(1e14, 0, 0);
        vrf.setAdapter(address(adapter));
        vm.stopPrank();

        bank = new Bank(address(asset), address(0), gov, 1000, "LP", "LP", 18);
        registry = new BankRegistry(gov);
        vm.prank(gov);
        registry.registerBank(address(asset), address(bank));

        ReferralRegistry refReg = new ReferralRegistry(gov);
        DefaultReferralEngine refEng = new DefaultReferralEngine();

        uint16[6] memory levelBps;
        levelBps[1] = 10_000;
        hub = new Hub(
            address(registry),
            address(vrf),
            address(refReg),
            address(refEng),
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
        bank.setHubOnce(address(hub));
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
        vm.deal(gov, 10 ether);
        vm.txGasPrice(0);
    }

    function test_chainlink_adapter_end_to_end_single_bet() external {
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({amountPerRoll: 1 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee, ) = hub.quoteVRFFee(1);

        vm.prank(alice);
        uint256 betId = hub.placeBet{value: fee}(GAME_COIN, address(asset), abi.encode(true), spec, address(0), 10_000);

        // fulfill through wrapper -> adapter -> vrf -> hub
        uint256 requestId = hub.getBet(betId).requestId;
        uint256[] memory rw = new uint256[](1);
        rw[0] = uint256(keccak256("seed"));
        wrapper.fulfillTo(address(adapter), requestId, rw);

        // finalize permissionless
        vm.prank(address(0xF00D));
        hub.finalize(betId);

        assertEq(uint8(hub.getBet(betId).state), uint8(SSOTTypes.BetState.Settled));
    }

    function test_chainlink_adapter_overpay_refund_still_works() external {
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec({amountPerRoll: 1 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee, ) = hub.quoteVRFFee(1);

        uint256 ethBefore = alice.balance;

        vm.prank(alice);
        hub.placeBet{value: fee + 1}(GAME_COIN, address(asset), abi.encode(true), spec, address(0), 10_000);

        uint256 ethAfter = alice.balance;
        assertEq(ethBefore - ethAfter, fee, "overpay should be refunded (gas price=0)");
    }
}
