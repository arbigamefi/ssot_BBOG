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
        assertEq(uint256(pos.state), uint256(SSOTTypes.PositionState.Held));
        assertEq(router.nextPositionId(), 2);
        assertEq(bank.totalReserved(), 250e6);
        assertEq(usdc.balanceOf(player), 900e6);
    }

    function test_openPosition_rejectsUnregisteredHub() external {
        vm.prank(otherHub);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.HubNotRegistered.selector, otherHub));
        router.openPosition(1, player, 100e6, 250e6, SNAPSHOT);
    }

    function test_openPosition_rejectsHubNotAllowedForPool() external {
        vm.prank(gov);
        registry.setHubRegistered(otherHub, true);

        vm.prank(otherHub);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.HubNotAllowedForPool.selector, uint64(1), otherHub));
        router.openPosition(1, player, 100e6, 250e6, SNAPSHOT);
    }

    function test_openPosition_rejectsInactivePool() external {
        vm.prank(gov);
        registry.setPoolActive(1, false);

        vm.prank(hub);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.PoolInactive.selector, uint64(1)));
        router.openPosition(1, player, 100e6, 250e6, SNAPSHOT);
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

    function test_getPositionRejectsUnknownPosition() external {
        vm.expectRevert(abi.encodeWithSelector(ISettlementRouter.UnknownPosition.selector, uint256(99)));
        router.getPosition(99);
    }

    function _open(uint256 stake, uint256 reserved) internal returns (uint256 positionId) {
        vm.prank(hub);
        return router.openPosition(1, player, stake, reserved, SNAPSHOT);
    }
}
