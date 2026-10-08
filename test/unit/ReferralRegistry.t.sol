// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {Errors} from "../../src/libs/Errors.sol";

contract ReferralRegistryTest is Test {
    ReferralRegistry private registry;

    function setUp() public {
        registry = new ReferralRegistry(address(this));
        registry.setBinderOnce(address(this));
    }

    // Each link is created while its immediate parent is still an unbound root.
    function _chain(uint160 links) private {
        for (uint160 i; i < links; ++i) {
            address player = address(uint160(0x1000) + i);
            vm.prank(player);
            registry.bind(player, address(uint160(0x1001) + i));
        }
    }

    function test_rejectsCycleAtTheLastInspectedNode() public {
        _chain(63);
        address last = address(0x103f);
        vm.prank(last);
        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.bind(last, address(0x1000));
        assertEq(registry.referrerOf(last), address(0));
    }

    function test_rejectsCycleBeyondSearchBudget() public {
        _chain(64);
        address last = address(0x1040);
        vm.prank(last);
        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.bind(last, address(0x1000));
        assertEq(registry.referrerOf(last), address(0));
    }

    function test_acceptsRootReachedOnThe64thStep() public {
        _chain(63);
        registry.bindFor(address(0x2000), address(0x1000));
        assertEq(registry.referrerOf(address(0x2000)), address(0x1000));
    }

    function test_rejectsAcyclicChainBeyondSearchBudget() public {
        _chain(64);
        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.bindFor(address(0x2000), address(0x1000));
        assertEq(registry.referrerOf(address(0x2000)), address(0));
        assertEq(registry.referrerOf(address(0x1040)), address(0), "existing chain remains acyclic");
    }

    function test_firstTouchCannotBeRebound() public {
        registry.bindFor(address(1), address(2));
        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.bindFor(address(1), address(3));
        assertEq(registry.referrerOf(address(1)), address(2));
    }

    function test_rejectsSelfZeroAndUnauthorizedBindings() public {
        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.bindFor(address(1), address(1));
        vm.expectRevert(Errors.ZeroAddress.selector);
        registry.bindFor(address(0), address(1));
        vm.expectRevert(Errors.ZeroAddress.selector);
        registry.bindFor(address(1), address(0));
        vm.prank(address(3));
        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.bind(address(1), address(2));
        vm.prank(address(3));
        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.bindFor(address(1), address(2));
    }
}
