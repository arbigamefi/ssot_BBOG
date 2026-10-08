// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {Bank} from "../../src/core/Bank.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {IBank} from "../../src/core/interfaces/IBank.sol";
import {IGameHub} from "../../src/core/interfaces/IGameHub.sol";
import {ISettlementRouter} from "../../src/core/interfaces/ISettlementRouter.sol";
import {IVRFHub} from "../../src/core/interfaces/IVRFHub.sol";
import {ILiquidityVaultBank} from "../../src/core/interfaces/ILiquidityVaultBank.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {DefaultReferralEngine} from "../../src/engines/referral/DefaultReferralEngine.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {BlacklistToken} from "../mocks/BlacklistToken.sol";
import {ExactGasWrapperFixture} from "../helpers/nft-callback/ExactGasWrapperFixture.sol";

/// @notice Independent composition review: only token and wrapper transport are models.
contract NftAccountingCompositionReviewTest is Test {
    address private constant GOV = address(0xA11CE);
    address private constant PLAYER = address(0xBEEF);
    uint48 private constant FIRST = uint48(1) << 40;
    bytes32 private constant GAME = keccak256("COIN");
    BlacklistToken private token;
    PoolRegistry private registry;
    SettlementRouter private router;
    ExactGasWrapperFixture private wrapper;
    VRFHub private consumer;
    GameHub private hub;
    Bank private bankA;
    Bank private bankB;
    LiquidityVault private vaultA;
    LiquidityVault private vaultB;

    function setUp() public {
        token = new BlacklistToken();
        registry = new PoolRegistry(GOV);
        router = new SettlementRouter(address(registry));
        wrapper = new ExactGasWrapperFixture();
        consumer = new VRFHub(address(wrapper), address(router));
        bankA = new Bank(address(token), GOV, 1_000, 6, 1e6);
        bankB = new Bank(address(token), GOV, 1_000, 6, 1e6);
        vaultA = LiquidityVault(bankA.vault());
        vaultB = LiquidityVault(bankB.vault());
        ReferralRegistry refs = new ReferralRegistry(GOV);
        hub = new GameHub(
            address(router),
            address(consumer),
            address(refs),
            address(new DefaultReferralEngine()),
            GOV,
            1 hours,
            200,
            0,
            0,
            0,
            0
        );
        vm.startPrank(GOV);
        bankA.setSettlementRouterOnce(address(router));
        bankB.setSettlementRouterOnce(address(router));
        bankA.setRandomnessConsumerOnce(address(consumer));
        bankB.setRandomnessConsumerOnce(address(consumer));
        registry.registerPool(1, address(token), address(bankA), SSOTTypes.PoolDomain.Casino);
        registry.registerPool(2, address(token), address(bankB), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(address(hub), true);
        registry.setHubAllowedForPool(1, address(hub), true);
        registry.setHubAllowedForPool(2, address(hub), true);
        refs.setBinderOnce(address(hub));
        hub.registerGame(GAME, address(new CoinTossModule()), 1, 2_447_746);
        token.mint(GOV, 5_000e6);
        token.approve(address(vaultA), type(uint256).max);
        token.approve(address(vaultB), type(uint256).max);
        vaultA.addDeposit(1_000e6);
        vaultB.addDeposit(1_000e6);
        vm.stopPrank();
        token.mint(PLAYER, 100e6);
        vm.prank(PLAYER);
        token.approve(address(hub), type(uint256).max);
        vm.deal(PLAYER, 1 ether);
        vm.warp(block.timestamp + 1 days);
    }

    function _place(uint64 poolId) private returns (uint256) {
        SSOTTypes.StakeSpec memory spec = SSOTTypes.StakeSpec(1e6, 1, type(uint256).max, type(uint256).max);
        (uint256 fee,) = hub.quoteVRFFee(GAME, 1, tx.gasprice);
        vm.prank(PLAYER);
        return hub.placeBet{value: fee}(GAME, poolId, abi.encode(true), spec, address(0), 200);
    }

    function _receiveWhileHubDeliveryFails(uint256 betId, uint256 seed) private {
        uint256 requestId = hub.getBet(betId).requestId;
        vm.mockCallRevert(
            address(hub), abi.encodeWithSelector(IGameHub.onRandomWords.selector), bytes("delivery fault")
        );
        (bool ok,) = wrapper.deliver(requestId, seed);
        assertTrue(ok, "outer callback must persist receipt");
        vm.clearMockedCalls();
        assertEq(consumer.getRequest(requestId).seed, seed);
        assertEq(uint256(consumer.getRequest(requestId).state), uint256(IVRFHub.RequestState.Received));
        assertEq(uint256(hub.getBet(betId).state), uint256(SSOTTypes.BetState.PendingVRF));
    }

    function _assertCovered(Bank subject) private view {
        SSOTTypes.SSOT memory s = subject.getSSOT();
        assertTrue(s.accountingValid);
        assertEq(s.K, s.R - s.P);
        assertEq(s.bankCash, s.P + s.PF + s.XP + s.PP);
        assertEq(s.vaultCash, s.L);
        assertEq(s.G, s.L + s.P);
    }

    function _assertAStillFenced() private {
        assertEq(uint8(vaultA.depositState(FIRST).status), uint8(ILiquidityVaultBank.LPStatus.UnbookedResult));
        bytes memory reason =
            abi.encodeWithSelector(LiquidityVault.LPUnavailable.selector, ILiquidityVaultBank.LPStatus.UnbookedResult);
        vm.startPrank(GOV);
        vm.expectRevert(reason);
        vaultA.addDeposit(1e6);
        vm.expectRevert(reason);
        vaultA.withdrawDeposit(FIRST, 1e12);
        vm.stopPrank();
    }

    function test_ackOneOfTwoResultsKeepsSameBankFencedAndOtherBankUsable() public {
        uint256 first = _place(1);
        uint256 second = _place(1);
        uint256 other = _place(2);
        _receiveWhileHubDeliveryFails(first, 0);
        _receiveWhileHubDeliveryFails(second, 12345);
        assertEq(consumer.unbookedResultCount(address(bankA)), 2);
        assertEq(consumer.unbookedResultCount(address(bankB)), 0);
        _assertAStillFenced();

        vm.startPrank(GOV);
        vaultB.addDeposit(100e6);
        vaultB.withdrawDeposit(FIRST, 1e11);
        vm.stopPrank();
        hub.finalize(first);
        assertEq(consumer.unbookedResultCount(address(bankA)), 1);
        assertEq(bankA.openHolds(), 1);
        _assertAStillFenced();
        _assertCovered(bankA);

        (bool ok,) = wrapper.deliver(hub.getBet(other).requestId, 54321);
        assertTrue(ok);
        assertEq(uint256(hub.getBet(other).state), uint256(SSOTTypes.BetState.Settled));
        assertEq(consumer.unbookedResultCount(address(bankB)), 0);
        assertEq(consumer.unbookedResultCount(address(bankA)), 1);
        hub.finalize(second);
        assertEq(consumer.unbookedResultCount(address(bankA)), 0);
        assertEq(bankA.openHolds(), 0);
        assertEq(uint8(vaultA.depositState(FIRST).status), uint8(ILiquidityVaultBank.LPStatus.Ready));
        _assertCovered(bankA);
        _assertCovered(bankB);
    }

    function test_governanceCannotRebindOrUnpauseAwayAnUnbookedResult() public {
        uint256 bet = _place(1);
        _receiveWhileHubDeliveryFails(bet, 42);
        VRFHub replacement = new VRFHub(address(wrapper), address(router));
        vm.startPrank(GOV);
        bankA.setRiskInPaused(true);
        bankA.setRiskInPaused(false);
        vm.expectRevert(ISettlementRouter.InvalidConsumerBinding.selector);
        bankA.setRandomnessConsumerOnce(address(replacement));
        registry.setHubAllowedForPool(1, address(hub), false);
        registry.setHubRegistered(address(hub), false);
        vm.stopPrank();
        assertEq(router.settlementConsumer(address(bankA)), address(consumer));
        assertEq(consumer.unbookedResultCount(address(bankA)), 1);
        _assertAStillFenced();
        hub.finalize(bet);
        assertEq(consumer.unbookedResultCount(address(bankA)), 0);
        _assertCovered(bankA);
    }

    function test_recordedCutoffIsNotSuppliedByHubAndCannotMoveToLaterDeposit() public {
        uint256 bet = _place(1);
        (,,, uint48 cutoff, bool open) = bankA.holds(bet);
        assertEq(cutoff, FIRST);
        assertTrue(open);
        vm.prank(GOV);
        uint48 later = vaultA.addDeposit(500e6);
        vm.expectRevert(LiquidityVault.OnlyBank.selector);
        vaultA.applySettlement(later, 1e6, 1e6, 0);
        vm.expectRevert(IBank.NotSettlementRouter.selector);
        bankA.settleBet(bet, 0, 0, 0, 0, new SSOTTypes.XPAward[](0));
        (bool ok,) = wrapper.deliver(hub.getBet(bet).requestId, 12345);
        assertTrue(ok);
        assertEq(uint256(hub.getBet(bet).state), uint256(SSOTTypes.BetState.Settled));
        (,,, uint48 afterCutoff, bool afterOpen) = bankA.holds(bet);
        assertEq(afterCutoff, cutoff);
        assertFalse(afterOpen);
        assertEq(vaultA.nodeWithdrawView(later), 500e6, "covered old range excludes new leaf");
        _assertCovered(bankA);
    }

    function test_wrongHubCannotRequestOrAcknowledgeAnotherPoolsResult() public {
        uint256 bet = _place(1);
        vm.prank(address(vaultB));
        vm.expectRevert(abi.encodeWithSelector(IVRFHub.InvalidRequestBinding.selector, bet));
        consumer.requestRandomWords(bet, 2_447_746, 3);
        _receiveWhileHubDeliveryFails(bet, 99);
        uint256 requestId = hub.getBet(bet).requestId;
        vm.prank(address(vaultB));
        vm.expectRevert(IVRFHub.NotOwningHub.selector);
        consumer.acknowledge(requestId);
        assertEq(consumer.unbookedResultCount(address(bankA)), 1);
        _assertAStillFenced();
        _assertCovered(bankA);
        _assertCovered(bankB);
    }
}
