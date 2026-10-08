// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {VmSafe} from "forge-std/Vm.sol";

import {Bank} from "../../src/core/Bank.sol";

/// @dev Explicit local consumer for tests of Bank and Sports settlement that do not request randomness.
contract TestRandomnessConsumer {
    address public immutable settlementRouter;
    mapping(address => uint256) public unbookedResultCount;

    constructor(address router) {
        settlementRouter = router;
    }

    function setUnbooked(address bank, uint256 count) external {
        unbookedResultCount[bank] = count;
    }
}

/// @dev Direct-router fixture for focused Bank boundary tests, separate from real Router integration tests.
abstract contract DirectRouterFixture {
    mapping(address => address) public settlementConsumer;

    function bindRandomnessConsumer(address consumer) external {
        require(Bank(msg.sender).settlementRouter() == address(this), "router binding");
        require(TestRandomnessConsumer(consumer).settlementRouter() == address(this), "consumer binding");
        require(settlementConsumer[msg.sender] == address(0), "already bound");
        settlementConsumer[msg.sender] = consumer;
    }

    function unbookedResultCount(address bank) external view returns (uint256) {
        require(settlementConsumer[bank] != address(0), "consumer not configured");
        return TestRandomnessConsumer(settlementConsumer[bank]).unbookedResultCount(bank);
    }
}

abstract contract BankTestBase is Test, DirectRouterFixture {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }

    function _bindTestConsumer(Bank target) internal {
        TestRandomnessConsumer consumer = new TestRandomnessConsumer(target.settlementRouter());
        (VmSafe.CallerMode mode, address sender,) = vm.readCallers();
        if (mode == VmSafe.CallerMode.RecurrentPrank) {
            require(sender == target.governance(), "wrong setup governor");
            target.setRandomnessConsumerOnce(address(consumer));
        } else {
            vm.prank(target.governance());
            target.setRandomnessConsumerOnce(address(consumer));
        }
    }
}
