// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test, Vm} from "forge-std/Test.sol";

contract GasAccountingSink {
    uint256 public slot = 1;

    function noop() external {}

    function clear() external {
        slot = 0;
    }
}

/// @notice Pins how the Foundry release in deps.lock reports an isolated call, which the isolated admission gate and
///         certificate v5 rely on: `vm.lastCallGas().gasTotalUsed` includes the 21,000 intrinsic gas and is counted
///         before storage refunds (Foundry 1.5.1 subtracted the refund). Run with --isolate (make test-casino-admission).
contract IsolatedGasAccountingTest is Test {
    GasAccountingSink internal sink;

    function setUp() public {
        sink = new GasAccountingSink();
    }

    function test_isolatedCallGasIncludesIntrinsicGasAndPrecedesRefunds() public {
        // forge-std 1.14 predates the cheatcode, so call it directly.
        (bool ok, bytes memory isolated) = address(vm).staticcall(abi.encodeWithSignature("isIsolateMode()"));
        require(ok, "Foundry without isIsolateMode(); see FOUNDRY_VERSION in deps.lock");
        if (!abi.decode(isolated, (bool))) vm.skip(true);

        sink.noop();
        Vm.Gas memory noop = vm.lastCallGas();
        sink.clear();
        Vm.Gas memory clear = vm.lastCallGas();

        assertGe(noop.gasTotalUsed, 21_000, "intrinsic gas included");
        assertLt(noop.gasTotalUsed, 22_000, "a call with no work");
        assertEq(clear.gasRefunded, 4_800, "one cleared slot");
        assertGe(clear.gasTotalUsed, noop.gasTotalUsed + 4_800, "counted before the refund");
    }
}
