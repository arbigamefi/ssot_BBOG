// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {GasBurnerModule} from "../utils/LaunchFixture.sol";

interface IUsdcBlacklist {
    function blacklister() external view returns (address);
    function blacklist(address account) external;
    function isBlacklisted(address account) external view returns (bool);
}

/// @notice Certificate v5 (launch candidate §10, ADR-0037 §10): the void branch with the pinned Base Sepolia USDC.
///         VoidBet.t.sol measures it with a mock token; here every token call goes to the real proxy and
///         implementation on a local fork of the pinned block. A module that burns all its gas makes the settlement
///         attempt spend its whole VOID_SETTLEMENT_GAS, so the rest of the transaction is the void branch on the
///         reserve: VOID_RESERVE_GAS must cover it twice. Run isolated, so the figures are transaction-level with
///         cold state (lastCallGas is the gross gas before refunds, test/toolchain/IsolatedGasAccounting.t.sol):
///
///   script/tools/with-ops-rpc.sh alchemy base-sepolia bash -c \
///     'VOID_USDC_FORK=true NFT_GAS_RPC_URL="$OPS_RPC_URL" forge test --isolate --match-path test/fork/VoidBetUsdcFork.t.sol -vv'
///
///         The VRF wrapper is the mock: the first callback only has to leave the result unbooked.
contract VoidBetUsdcForkTest is Test {
    uint256 private constant PINNED_BLOCK = 47_657_524;
    bytes32 private constant PINNED_HASH = 0x5a75e3c5fbaaa54dd1e67075af773668d43757b4e5de71f788ee69837650b872;
    address private constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address private constant GOV = address(0xA11CE);
    address private constant LP = address(0x1B);
    address private constant PLAYER = address(0xB0B);
    address private constant KEEPER = address(0xBEEF);
    uint64 private constant POOL = 1;
    uint32 private constant CALLBACK_GAS = 2_447_746;
    bytes32 private constant GAME_BURN = keccak256("BURN");

    IERC20 private token = IERC20(USDC);
    MockVRFV2PlusWrapper private wrapper;
    VRFHub private vrf;
    GameHub private hub;
    Bank private bank;
    LiquidityVault private vault;
    SettlementRouter private router;
    uint256 private betId;

    function setUp() public {
        if (!vm.envOr("VOID_USDC_FORK", false)) return;
        vm.createSelectFork(vm.envString("NFT_GAS_RPC_URL"), PINNED_BLOCK);
        vm.roll(PINNED_BLOCK + 1);
        assertEq(blockhash(PINNED_BLOCK), PINNED_HASH, "pinned fork block identity");
        vm.roll(PINNED_BLOCK);
        PoolRegistry registry = new PoolRegistry(GOV);
        router = new SettlementRouter(address(registry));
        wrapper = new MockVRFV2PlusWrapper();
        vrf = new VRFHub(address(wrapper), address(router));
        ReferralRegistry refs = new ReferralRegistry(GOV);
        hub = new GameHub(
            address(router),
            address(vrf),
            address(refs),
            address(new DefaultReferralEngine()),
            GOV,
            3600,
            200,
            1000,
            2000,
            500,
            3000
        );
        bank = new Bank(USDC, GOV, 6000, 6, 10_000);
        vault = LiquidityVault(bank.vault());
        vm.startPrank(GOV);
        refs.setBinderOnce(address(hub));
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(vrf));
        registry.registerPool(POOL, USDC, address(bank), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(address(hub), true);
        registry.setHubAllowedForPool(POOL, address(hub), true);
        hub.registerGame(GAME_BURN, address(new GasBurnerModule()), 25, CALLBACK_GAS);
        vm.stopPrank();

        deal(USDC, LP, 10_000e6);
        vm.startPrank(LP);
        token.approve(address(vault), type(uint256).max);
        vault.addDeposit(10_000e6);
        vm.stopPrank();
        deal(USDC, PLAYER, 1_000e6);
        vm.deal(PLAYER, 1 ether);
        vm.prank(PLAYER);
        token.approve(address(hub), type(uint256).max);

        SSOTTypes.StakeSpec memory spec =
            SSOTTypes.StakeSpec({amountPerRoll: 10e6, betCount: 1, stopGain: 0, stopLoss: 0});
        (uint256 fee,) = hub.quoteVRFFee(GAME_BURN, 1, tx.gasprice);
        vm.prank(PLAYER);
        betId = hub.placeBet{value: fee}(GAME_BURN, POOL, abi.encode(true, uint8(50)), spec, address(0), 0);
        uint256[] memory words = new uint256[](1);
        words[0] = 7;
        wrapper.fulfillTo(address(vrf), hub.getBet(betId).requestId, words);
        assertEq(vrf.unbookedResultCount(address(bank)), 1, "the first callback left the result unbooked");
        vm.prank(GOV);
        hub.openVoidWindow(POOL);
        vm.warp(vm.getBlockTimestamp() + hub.VOID_DELAY());
    }

    function test_voidBranchWithPinnedUsdcFitsTheReserveTwice() public {
        vm.skip(!vm.envOr("VOID_USDC_FORK", false), "requires the pinned Base Sepolia fork (VOID_USDC_FORK)");
        _measure("issuer healthy");
    }

    /// P5a with the real issuer: the void still completes while USDC blocks the Vault.
    function test_voidBranchWhileUsdcBlocksTheVault() public {
        vm.skip(!vm.envOr("VOID_USDC_FORK", false), "requires the pinned Base Sepolia fork (VOID_USDC_FORK)");
        IUsdcBlacklist usdc = IUsdcBlacklist(USDC);
        vm.prank(usdc.blacklister());
        usdc.blacklist(address(vault));
        assertTrue(usdc.isBlacklisted(address(vault)));
        _measure("Vault blocked by the issuer");
    }

    function _measure(string memory label) private {
        uint256 callGas = _smallestPassingCallGas();
        uint256 before = bank.playerPayable(PLAYER);
        vm.prank(KEEPER);
        assertTrue(hub.voidBet{gas: callGas}(betId), "voided");
        uint256 used = vm.lastCallGas().gasTotalUsed;
        assertEq(uint256(hub.getBet(betId).state), uint256(SSOTTypes.BetState.Voided));
        assertEq(bank.playerPayable(PLAYER) - before, 10e6, "the stake became a player payable");
        assertEq(vrf.unbookedResultCount(address(bank)), 0);
        emit log(label);
        emit log_named_uint("smallest passing voidBet call gas", callGas);
        emit log_named_uint("transaction gas (gross, isolated)", used);
        if (used > hub.VOID_SETTLEMENT_GAS()) {
            uint256 outside = used - hub.VOID_SETTLEMENT_GAS();
            emit log_named_uint("gas outside the spent attempt (void branch and intrinsic)", outside);
            assertLe(2 * outside, hub.VOID_RESERVE_GAS(), "the reserve covers twice the void branch");
        } else {
            fail("not isolated: run with --isolate for transaction-level gas");
        }
    }

    /// Smallest call gas at which voidBet passes its gas check, by bisection; the state is restored each time.
    function _smallestPassingCallGas() private returns (uint256 high) {
        uint256 low = 10_000_000;
        high = 12_000_000;
        while (high - low > 1) {
            uint256 mid = (low + high) / 2;
            uint256 snap = vm.snapshotState();
            vm.prank(KEEPER);
            (bool ok,) = address(hub).call{gas: mid}(abi.encodeCall(hub.voidBet, (betId)));
            assertTrue(vm.revertToState(snap));
            if (ok) high = mid;
            else low = mid;
        }
    }
}
