// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ChainlinkV2PlusWrapperAdapter} from "../../src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

/// @notice Optional fork test that exercises the real Chainlink VRF v2.5 Wrapper on a fork.
///
/// How to run:
/// - Provide FORK_RPC_URL and FORK_VRF_WRAPPER
/// - Optionally provide FORK_BLOCK_NUMBER and FORK_EXPECT_CHAIN_ID
///
/// Example (Sepolia):
///   FORK_RPC_URL=... \
///   FORK_VRF_WRAPPER=0x195f15F2d49d693cE265b4fB0fdDbE15b1850Cc1 \
///   FORK_EXPECT_CHAIN_ID=11155111 \
///   forge test --match-path "test/fork/*" -vvv
contract ForkChainlinkWrapperAdapter is Test {
    MockERC20 asset;
    Bank bank;
    PoolRegistry poolRegistry;
    SettlementRouter router;
    GameHub hub;
    VRFHub vrf;

    ChainlinkV2PlusWrapperAdapter adapter;

    address gov = address(0xA11CE);
    address alice = address(0xBEEF);

    bytes32 constant GAME_COIN = keccak256("COIN_TOSS");

    function setUp() external {
        bool required = vm.envOr("FORK_REQUIRED", false);

        string memory rpc = vm.envOr("FORK_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            if (required) revert("FORK_RPC_URL required");
            vm.skip(true);
        }

        uint256 blockNumber = vm.envOr("FORK_BLOCK_NUMBER", uint256(0));
        if (blockNumber == 0) {
            vm.createSelectFork(rpc);
        } else {
            vm.createSelectFork(rpc, blockNumber);
        }

        uint256 expectChainId = vm.envOr("FORK_EXPECT_CHAIN_ID", uint256(0));
        if (expectChainId != 0) {
            assertEq(block.chainid, expectChainId, "unexpected fork chainid");
        }

        address wrapper = vm.envOr("FORK_VRF_WRAPPER", address(0));
        if (wrapper == address(0)) {
            if (required) revert("FORK_VRF_WRAPPER required");
            vm.skip(true);
        }

        // Deploy adapter first, then VRFHub with coordinator == adapter.
        adapter = new ChainlinkV2PlusWrapperAdapter(wrapper, gov);
        vrf = new VRFHub(address(adapter), gov);

        vm.startPrank(gov);
        adapter.setVRFHub(address(vrf));
        adapter.setRequestGasPriceWei(vm.envOr("FORK_REQUEST_GAS_PRICE_WEI", uint256(0)));
        vrf.setAdapter(address(adapter));
        vm.stopPrank();

        asset = new MockERC20("ForkAsset", "FAST", 18);
        bank = new Bank(address(asset), gov, 1000, "LP", "LP", 18);

        poolRegistry = new PoolRegistry(gov);
        router = new SettlementRouter(address(poolRegistry));

        ReferralRegistry refReg = new ReferralRegistry(gov);
        DefaultReferralEngine refEng = new DefaultReferralEngine();

        uint16[6] memory levelBps;
        levelBps[1] = 10_000;
        hub = new GameHub(
            address(router),
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
        poolRegistry.registerPool(1, address(asset), address(bank), SSOTTypes.PoolDomain.Casino);
        poolRegistry.setHubRegistered(address(hub), true);
        poolRegistry.setHubAllowedForPool(1, address(hub), true);
        bank.setSettlementRouterOnce(address(router));
        refReg.setBinderOnce(address(hub));
        vm.stopPrank();

        CoinTossModule coin = new CoinTossModule();
        vm.prank(gov);
        hub.registerGame(GAME_COIN, address(coin));

        // Seed liquidity + player funds
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

    function test_fork_placeBet_requests_wrapper() external {
        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 1 ether, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = hub.quoteVRFFee(1);

        vm.prank(alice);
        uint256 betId = hub.placeBet{value: fee}(GAME_COIN, 1, abi.encode(true), spec, address(0), 10_000);

        SSOTTypes.Bet memory b = hub.getBet(betId);
        assertGt(b.requestId, 0, "requestId should be nonzero");
        assertEq(uint8(b.state), uint8(SSOTTypes.BetState.PendingVRF), "bet should be pending VRF");
        assertEq(b.vrfFeeCharged, fee, "charged should match quoted fee");
    }
}
