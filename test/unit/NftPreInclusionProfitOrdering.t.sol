// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {ExactGasWrapperFixture} from "../helpers/nft-callback/ExactGasWrapperFixture.sol";

/// @notice Conditional ordering evidence, not proof of early knowledge of a real VRF result.
/// @dev Production module/consumer/Hub/router/custody/tree; local wrapper transport and token.
///      Both branches use the same bet, accepted configuration and manually selected losing seed.
contract NftPreInclusionProfitOrderingTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CHARLIE = address(0xCAFE);
    address private constant PLAYER = address(0xBEEF);
    bytes32 private constant GAME = keccak256("COIN_TOSS");
    uint40 private constant ONE = 1e12;
    BlacklistToken private token;
    Bank private bank;
    LiquidityVault private vault;
    ExactGasWrapperFixture private wrapper;
    VRFHub private consumer;
    GameHub private hub;
    CoinTossModule private module;
    uint48 private old;
    uint48 private late;
    uint256 private betId;
    uint256 private seed;

    function setUp() public {
        token = new BlacklistToken();
        PoolRegistry registry = new PoolRegistry(address(this));
        SettlementRouter router = new SettlementRouter(address(registry));
        wrapper = new ExactGasWrapperFixture();
        consumer = new VRFHub(address(wrapper), address(router));
        bank = new Bank(address(token), address(this), 6_000, 6, 10_000);
        vault = LiquidityVault(bank.vault());
        bank.setSettlementRouterOnce(address(router));
        bank.setRandomnessConsumerOnce(address(consumer));
        ReferralRegistry referrals = new ReferralRegistry(address(this));
        hub = new GameHub(
            address(router),
            address(consumer),
            address(referrals),
            address(new DefaultReferralEngine()),
            address(this),
            3600,
            200,
            1000,
            2000,
            500,
            3000
        );
        registry.registerPool(1, address(token), address(bank), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(address(hub), true);
        registry.setHubAllowedForPool(1, address(hub), true);
        referrals.setBinderOnce(address(hub));
        module = new CoinTossModule();
        hub.registerGame(GAME, address(module), 25, 2_447_746);
        old = _deposit(ALICE, 1_000e6);
        vm.warp(block.timestamp + 1 days);
        token.mint(PLAYER, 100e6);
        vm.deal(PLAYER, 1 ether);
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec(100e6, 1, type(uint256).max, type(uint256).max);
        (uint256 fee,) = hub.quoteVRFFee(GAME, 1, tx.gasprice);
        vm.startPrank(PLAYER);
        token.approve(address(hub), 100e6);
        betId = hub.placeBet{value: fee}(GAME, 1, abi.encode(false), spec, address(0), 200);
        vm.stopPrank();
        late = _deposit(BOB, 100e6);
        assertEq(bank.pendingStakeTotal(), 100e6);
        assertEq(bank.totalReserved(), 200e6);
        assertEq(bank.openHolds(), 1);
        uint256[] memory words = new uint256[](1);
        // The test supplies result knowledge. It does not demonstrate real VRF prediction.
        for (; seed < 100; ++seed) {
            words[0] = seed;
            (uint256 gross, uint256 refund) = module.resolve(abi.encode(false), spec, betId, words);
            if (gross == 0 && refund == 0) break;
        }
        assertLt(seed, 100);
    }

    function _deposit(address owner, uint256 amount) private returns (uint48 id) {
        token.mint(owner, amount);
        vm.startPrank(owner);
        token.approve(address(vault), amount);
        id = vault.addDeposit(amount);
        vm.stopPrank();
    }

    function _settleSameResult() private {
        uint256 requestId = hub.getBet(betId).requestId;
        (bool delivered,) = wrapper.deliver(requestId, seed);
        assertTrue(delivered);
        assertEq(uint8(consumer.getRequest(requestId).state), uint8(IVRFHub.RequestState.Terminal));
        assertEq(consumer.getRequest(requestId).seed, seed);
        assertEq(uint8(hub.getBet(betId).state), uint8(SSOTTypes.BetState.Settled));
        assertEq(bank.totalBetsSettled(), 1);
        SSOTTypes.SSOT memory s = bank.getSSOT();
        assertTrue(s.accountingValid);
        assertEq(s.P + s.R + s.K + s.XP + s.PP, 0);
        assertEq(s.PF, 1e6);
        assertEq(token.balanceOf(address(vault)), s.L);
        assertEq(token.balanceOf(address(bank)), s.PF);
    }

    function test_entryBeforeReceiptTransfersOldFallbackProfitFromRetainedLP() public {
        vm.prank(ALICE);
        assertEq(vault.withdrawDeposit(old, ONE), 1_000e6);
        assertEq(vault.nodeWithdrawView(old), 0);
        uint256 checkpoint = vm.snapshotState();

        _settleSameResult();
        uint48 controlNew = _deposit(CHARLIE, 50e6);
        assertEq(vault.nodeWithdrawView(late), 199e6);
        assertEq(vault.nodeWithdrawView(controlNew), 50e6);

        assertTrue(vm.revertToState(checkpoint));
        uint48 enteredBefore = _deposit(CHARLIE, 50e6);
        assertEq(enteredBefore, controlNew);
        uint64 maturity = vault.withdrawAfter(enteredBefore);
        _settleSameResult();
        assertEq(vault.nodeWithdrawView(late), 166e6);
        assertEq(vault.nodeWithdrawView(enteredBefore), 83e6);
        assertEq(vault.withdrawAfter(enteredBefore), maturity);
        assertGt(maturity, block.timestamp, "entry profit is not an immediate cash exit");
        vm.warp(maturity);
        vm.prank(CHARLIE);
        assertEq(vault.withdrawDeposit(enteredBefore, ONE), 83e6);
        assertEq(vault.nodeWithdrawView(late), 166e6);
        assertTrue(bank.getSSOT().accountingValid);
        emit log_named_uint("conditional late-entry gain, raw USDC", 33e6);
    }

    function test_nonemptyOldPrefixExcludesNewCapitalFromOldProfit() public {
        uint48 fresh = _deposit(CHARLIE, 50e6);
        _settleSameResult();
        assertEq(vault.nodeWithdrawView(old), 1_099e6);
        assertEq(vault.nodeWithdrawView(late), 100e6);
        assertEq(vault.nodeWithdrawView(fresh), 50e6);
    }
}
