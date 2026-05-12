// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Bank} from "../../src/core/Bank.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {IPoolRegistry} from "../../src/core/interfaces/IPoolRegistry.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {Errors} from "../../src/libs/Errors.sol";

contract PoolRegistryTest is Test {
    address internal gov = address(0xA11CE);
    address internal hub = address(0xBEEF);
    address internal otherHub = address(0xCAFE);

    MockERC20 internal usdc;
    MockERC20 internal weth;
    Bank internal usdcBankA;
    Bank internal usdcBankB;
    Bank internal wethBank;
    PoolRegistry internal registry;

    function setUp() external {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);

        usdcBankA = new Bank(address(usdc), gov, 1000, "LP USDC A", "lpUSDC-A", 6);
        usdcBankB = new Bank(address(usdc), gov, 1000, "LP USDC B", "lpUSDC-B", 6);
        wethBank = new Bank(address(weth), gov, 1000, "LP WETH", "lpWETH", 18);

        registry = new PoolRegistry(gov);
    }

    function test_registerPool_success_andGetters() external {
        vm.prank(gov);
        registry.registerPool(1, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        SSOTTypes.Pool memory pool = registry.pool(1);
        assertEq(pool.asset, address(usdc));
        assertEq(pool.bank, address(usdcBankA));
        assertEq(uint256(pool.domain), uint256(SSOTTypes.PoolDomain.Casino));
        assertTrue(pool.active);

        assertEq(registry.poolCount(), 1);
        assertEq(registry.poolIdAt(0), 1);
        assertEq(registry.assetFor(1), address(usdc));
        assertEq(registry.bankFor(1), address(usdcBankA));
        assertEq(uint256(registry.domainFor(1)), uint256(SSOTTypes.PoolDomain.Casino));
        assertTrue(registry.isPoolActive(1));

        uint64[] memory ids = registry.listPoolIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
    }

    function test_registerPool_supportsSameAssetDistinctBanks() external {
        vm.startPrank(gov);
        registry.registerPool(1, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Casino);
        registry.registerPool(2, address(usdc), address(usdcBankB), SSOTTypes.PoolDomain.Sports);
        vm.stopPrank();

        assertEq(registry.assetFor(1), address(usdc));
        assertEq(registry.assetFor(2), address(usdc));
        assertEq(registry.bankFor(1), address(usdcBankA));
        assertEq(registry.bankFor(2), address(usdcBankB));
    }

    function test_registerPool_rejectsInvalidInputs() external {
        vm.startPrank(gov);

        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.registerPool(0, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        vm.expectRevert(Errors.ZeroAddress.selector);
        registry.registerPool(1, address(0), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        vm.expectRevert(Errors.ZeroAddress.selector);
        registry.registerPool(1, address(usdc), address(0), SSOTTypes.PoolDomain.Casino);

        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.registerPool(1, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Unknown);

        vm.expectRevert(Errors.InvalidConfig.selector);
        registry.registerPool(1, address(weth), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        vm.stopPrank();
    }

    function test_registerPool_rejectsDuplicatePoolIdAndBankReuse() external {
        vm.startPrank(gov);
        registry.registerPool(1, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.PoolAlreadyRegistered.selector, uint64(1)));
        registry.registerPool(1, address(usdc), address(usdcBankB), SSOTTypes.PoolDomain.Sports);

        vm.expectRevert(
            abi.encodeWithSelector(IPoolRegistry.BankAlreadyRegistered.selector, address(usdcBankA), uint64(1))
        );
        registry.registerPool(2, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Sports);
        vm.stopPrank();
    }

    function test_governanceOnlyMutations() external {
        vm.expectRevert(Errors.Unauthorized.selector);
        registry.registerPool(1, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        vm.prank(gov);
        registry.registerPool(1, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        vm.expectRevert(Errors.Unauthorized.selector);
        registry.setPoolActive(1, false);

        vm.expectRevert(Errors.Unauthorized.selector);
        registry.setHubRegistered(hub, true);

        vm.expectRevert(Errors.Unauthorized.selector);
        registry.setHubAllowedForPool(1, hub, true);
    }

    function test_poolActiveAndUnknownPool() external {
        vm.prank(gov);
        registry.registerPool(1, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        vm.prank(gov);
        registry.setPoolActive(1, false);
        assertFalse(registry.isPoolActive(1));

        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.UnknownPool.selector, uint64(2)));
        registry.pool(2);

        vm.prank(gov);
        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.UnknownPool.selector, uint64(2)));
        registry.setPoolActive(2, true);
    }

    function test_hubRegistrationAndPoolAllowlist() external {
        vm.startPrank(gov);
        registry.registerPool(1, address(usdc), address(usdcBankA), SSOTTypes.PoolDomain.Casino);

        vm.expectRevert(abi.encodeWithSelector(IPoolRegistry.HubNotRegistered.selector, hub));
        registry.setHubAllowedForPool(1, hub, true);

        registry.setHubRegistered(hub, true);
        registry.setHubAllowedForPool(1, hub, true);
        vm.stopPrank();

        assertTrue(registry.isRegisteredHub(hub));
        assertTrue(registry.isHubAllowedForPool(1, hub));
        assertFalse(registry.isRegisteredHub(otherHub));
        assertFalse(registry.isHubAllowedForPool(1, otherHub));

        vm.startPrank(gov);
        registry.setHubAllowedForPool(1, hub, false);
        registry.setHubRegistered(hub, false);
        vm.stopPrank();

        assertFalse(registry.isRegisteredHub(hub));
        assertFalse(registry.isHubAllowedForPool(1, hub));
    }
}
