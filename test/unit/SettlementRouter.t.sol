// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {IPoolRegistry} from "../../src/core/interfaces/IPoolRegistry.sol";
import {ISettlementRouter} from "../../src/core/interfaces/ISettlementRouter.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract SettlementRouterTest is Test {
    address internal gov = address(0xA11CE);
    address internal hub = address(0xBEEF);
    address internal otherHub = address(0xCAFE);
    address internal player = address(0x1234);

    MockERC20 internal usdc;
    Bank internal bank;
    PoolRegistry internal registry;
    SettlementRouter internal router;

    bytes32 internal constant SNAPSHOT = keccak256("SNAPSHOT");
    // 4% edge on a 100 USDC stake: E = 4 USDC, operator share (PF + XP cap) = 2 USDC.
    uint16 internal constant EDGE_BPS = 400;

    function setUp() external {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        bank = new Bank(address(usdc), gov, 0, "LP USDC", "lpUSDC", 6);
        registry = new PoolRegistry(gov);
        router = new SettlementRouter(address(registry));

        vm.startPrank(gov);
        registry.registerPool(1, address(usdc), address(bank), SSOTTypes.PoolDomain.Casino);
        registry.setHubRegistered(hub, true);
        registry.setHubAllowedForPool(1, hub, true);
        bank.setSettlementRouterOnce(address(router));
        vm.stopPrank();

        usdc.mint(gov, 1_000_000e6);
        usdc.mint(player, 1_000e6);

        vm.startPrank(gov);
        usdc.approve(address(bank), type(uint256).max);
        bank.deposit(500_000e6, gov);
        vm.stopPrank();

        vm.prank(player);
        usdc.approve(address(bank), type(uint256).max);
    }

    function test_openPosition_success() external {
        uint256 positionId = _open(100e6, 250e6);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        assertEq(pos.positionId, 1);
        assertEq(pos.ownerHub, hub);
        assertEq(pos.poolId, 1);
        assertEq(pos.asset, address(usdc));
        assertEq(pos.bank, address(bank));
        assertEq(pos.player, player);
        assertEq(pos.stake, 100e6);
        assertEq(pos.reserved, 250e6);
        assertEq(pos.snapshotHash, SNAPSHOT);
        assertEq(pos.edgeBps, EDGE_BPS);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Held));
        assertEq(router.nextPositionId(), 2);
        assertEq(bank.totalReserved(), 250e6);
        assertEq(usdc.balanceOf(player), 900e6);
    }

    function test_openPosition_rejectsUnregisteredHub() external {
        vm.prank(otherHub);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.HubNotRegistered.selector, otherHub));
        router.openPosition(1, player, 100e6, 250e6, SNAPSHOT, EDGE_BPS);
    }

    function test_openPosition_rejectsHubNotAllowedForPool() external {
        vm.prank(gov);
        registry.setHubRegistered(otherHub, true);

        vm.prank(otherHub);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.HubNotAllowedForPool.selector, uint64(1), otherHub));
        router.openPosition(1, player, 100e6, 250e6, SNAPSHOT, EDGE_BPS);
    }

    function test_openPosition_rejectsInactivePool() external {
        vm.prank(gov);
        registry.setPoolActive(1, false);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.PoolInactive.selector, uint64(1)));
        router.openPosition(1, player, 100e6, 250e6, SNAPSHOT, EDGE_BPS);
    }

    function test_onlyOwnerHubCanSettleOrRefund() external {
        uint256 positionId = _open(100e6, 250e6);

        vm.startPrank(gov);
        registry.setHubRegistered(otherHub, true);
        registry.setHubAllowedForPool(1, otherHub, true);
        vm.stopPrank();

        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        vm.prank(otherHub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.NotOwnerHub.selector, positionId, otherHub, hub));
        router.settlePosition(positionId, 0, 0, 0, 0, awards);

        vm.prank(otherHub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.NotOwnerHub.selector, positionId, otherHub, hub));
        router.refundPosition(positionId, 100e6);
    }

    function test_settlePosition_successAndNoDoubleTerminalization() external {
        uint256 positionId = _open(100e6, 250e6);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        vm.prank(hub);
        router.settlePosition(positionId, 120e6, 118e6, 0, 2e6, awards);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Settled));
        assertEq(bank.totalReserved(), 0);
        assertEq(bank.protocolFeesPayable(), 2e6);
        assertEq(usdc.balanceOf(player), 1_018e6);

        vm.prank(hub);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementRouter.BadPositionState.selector,
                positionId,
                SSOTTypes.PositionState.Settled,
                SSOTTypes.PositionState.Held
            )
        );
        router.settlePosition(positionId, 0, 0, 0, 0, awards);

        vm.prank(hub);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementRouter.BadPositionState.selector,
                positionId,
                SSOTTypes.PositionState.Settled,
                SSOTTypes.PositionState.Held
            )
        );
        router.refundPosition(positionId, 100e6);
    }

    function test_settlePosition_rejectsInvalidPayoutAndRefundBeforeBankCall() external {
        uint256 positionId = _open(100e6, 250e6);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.PayoutNetTooLarge.selector, positionId, 121e6, 120e6));
        router.settlePosition(positionId, 120e6, 121e6, 0, 0, awards);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.RefundTooLarge.selector, positionId, 101e6, 100e6));
        router.settlePosition(positionId, 0, 0, 101e6, 0, awards);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.ReservedTooSmall.selector, positionId, 250e6, 251e6));
        router.settlePosition(positionId, 151e6, 151e6, 100e6, 0, awards);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Held));
        assertEq(bank.totalReserved(), 250e6);
    }

    function test_refundPosition_successAndNoDoubleTerminalization() external {
        uint256 positionId = _open(100e6, 250e6);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        vm.prank(hub);
        router.refundPosition(positionId, 100e6);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Refunded));
        assertEq(bank.totalReserved(), 0);
        assertEq(usdc.balanceOf(player), 1_000e6);

        vm.prank(hub);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementRouter.BadPositionState.selector,
                positionId,
                SSOTTypes.PositionState.Refunded,
                SSOTTypes.PositionState.Held
            )
        );
        router.refundPosition(positionId, 100e6);

        vm.prank(hub);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementRouter.BadPositionState.selector,
                positionId,
                SSOTTypes.PositionState.Refunded,
                SSOTTypes.PositionState.Held
            )
        );
        router.settlePosition(positionId, 0, 0, 0, 0, awards);
    }

    function test_refundPosition_rejectsRefundAboveStakeBeforeBankCall() external {
        uint256 positionId = _open(100e6, 250e6);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.RefundTooLarge.selector, positionId, 101e6, 100e6));
        router.refundPosition(positionId, 101e6);

        SSOTTypes.Position memory pos = router.getPosition(positionId);
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Held));
        assertEq(bank.totalReserved(), 250e6);
    }

    function test_debtOutSettlementAndRefundWorkAfterPoolPause() external {
        uint256 settleId = _open(100e6, 250e6);
        uint256 refundId = _open(100e6, 250e6);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        vm.prank(gov);
        registry.setPoolActive(1, false);

        vm.prank(hub);
        router.settlePosition(settleId, 0, 0, 0, 0, awards);

        vm.prank(hub);
        router.refundPosition(refundId, 100e6);

        assertEq(bank.totalReserved(), 0);
    }

    function test_openPosition_emitsRecordedEdge() external {
        vm.expectEmit(true, true, true, true, address(router));
        emit ISettlementRouter.PositionOpened(
            1, hub, 1, player, address(usdc), address(bank), 100e6, 250e6, SNAPSHOT, EDGE_BPS
        );
        _open(100e6, 250e6);
    }

    function test_openPosition_rejectsEdgeAboveMax() external {
        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.EdgeTooHigh.selector, uint16(501), uint16(500)));
        router.openPosition(1, player, 100e6, 250e6, SNAPSHOT, 501);
    }

    function test_settlePosition_acceptsAllocationAtOperatorShare() external {
        uint256 positionId = _open(100e6, 250e6);
        assertEq(router.allocationCap(positionId, 0), 2e6);

        // 1.2 USDC protocol fee + 0.8 USDC referral XP == the 2 USDC operator share.
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](1);
        awards[0] = _award(0.5e6, 0.3e6);

        vm.prank(hub);
        router.settlePosition(positionId, 0, 0, 0, 1.2e6, awards);

        assertEq(bank.protocolFeesPayable(), 1.2e6);
        assertEq(bank.externalPayablesTotal(), 0.8e6);
    }

    function test_settlePosition_rejectsProtocolFeeAboveOperatorShare() external {
        uint256 positionId = _open(100e6, 250e6);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        vm.prank(hub);
        vm.expectRevert(
            abi.encodeWithSelector(ISettlementRouter.AllocationExceedsCap.selector, positionId, 2e6 + 1, 2e6)
        );
        router.settlePosition(positionId, 0, 0, 0, 2e6 + 1, awards);
    }

    function test_settlePosition_rejectsXpThatTakesTheLpShare() external {
        uint256 positionId = _open(100e6, 250e6);

        // A hub that pays its whole edge out as referral XP, the v1.5 allocation, is refused.
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](2);
        awards[0] = _award(1e6, 1e6);
        awards[1] = _award(1e6, 1e6);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.AllocationExceedsCap.selector, positionId, 4e6, 2e6));
        router.settlePosition(positionId, 0, 0, 0, 0, awards);

        assertEq(uint256(router.getPosition(positionId).state), uint256(SSOTTypes.PositionState.Held));
        assertEq(bank.totalReserved(), 250e6);
    }

    function test_settlePosition_capFollowsUsedTurnoverAfterRefund() external {
        uint256 positionId = _open(100e6, 250e6);
        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);

        // 60 USDC refunded: U = 40, E = 1.6, cap = 0.8.
        assertEq(router.allocationCap(positionId, 60e6), 0.8e6);

        vm.prank(hub);
        vm.expectRevert(
            abi.encodeWithSelector(ISettlementRouter.AllocationExceedsCap.selector, positionId, 0.8e6 + 1, 0.8e6)
        );
        router.settlePosition(positionId, 0, 0, 60e6, 0.8e6 + 1, awards);

        vm.prank(hub);
        router.settlePosition(positionId, 0, 0, 60e6, 0.8e6, awards);
        assertEq(bank.protocolFeesPayable(), 0.8e6);
    }

    function test_zeroEdgePositionCannotAccrueAnything() external {
        vm.prank(hub);
        uint256 positionId = router.openPosition(1, player, 100e6, 250e6, SNAPSHOT, 0);
        assertEq(router.allocationCap(positionId, 0), 0);

        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);
        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.AllocationExceedsCap.selector, positionId, 1, 0));
        router.settlePosition(positionId, 0, 0, 0, 1, awards);

        vm.prank(hub);
        router.settlePosition(positionId, 120e6, 120e6, 0, 0, awards);
        assertEq(bank.protocolFeesPayable(), 0);
    }

    function testFuzz_settlementAcceptedIffWithinOperatorShare(
        uint256 stake,
        uint256 refund,
        uint16 edge,
        uint256 allocated
    ) external {
        stake = bound(stake, 1, 1_000e6);
        refund = bound(refund, 0, stake);
        edge = uint16(bound(edge, 0, 500));
        uint256 cap = ((stake - refund) * edge / 10_000) * 5_000 / 10_000;
        allocated = bound(allocated, 0, cap + 3);

        vm.prank(hub);
        uint256 positionId = router.openPosition(1, player, stake, stake, SNAPSHOT, edge);
        assertEq(router.allocationCap(positionId, refund), cap);

        SSOTTypes.XPAward[] memory awards = new SSOTTypes.XPAward[](0);
        vm.prank(hub);
        if (allocated > cap) {
            vm.expectRevert(
                abi.encodeWithSelector(ISettlementRouter.AllocationExceedsCap.selector, positionId, allocated, cap)
            );
        }
        router.settlePosition(positionId, 0, 0, refund, allocated, awards);
    }

    function test_getPositionRejectsUnknownPosition() external {
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.UnknownPosition.selector, uint256(99)));
        router.getPosition(99);
    }

    function _open(uint256 stake, uint256 reserved) internal returns (uint256 positionId) {
        vm.prank(hub);
        return router.openPosition(1, player, stake, reserved, SNAPSHOT, EDGE_BPS);
    }

    function _award(uint256 accrued, uint256 holdback) internal view returns (SSOTTypes.XPAward memory) {
        return SSOTTypes.XPAward({
            payee: gov, sourcePlayer: player, accrued: accrued, locked: 0, holdback: holdback, reason: bytes32("test")
        });
    }
}
