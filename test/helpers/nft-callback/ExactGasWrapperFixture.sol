// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol";

/// @dev Transport fixture. Exact-gas assembly and coordinator request-gas arithmetic follow the
/// pinned Chainlink wrapper, but pricing/storage are synthetic. Its total gas is NOT real wrapper gas.
contract ExactGasWrapperFixture {
    struct Request {
        address consumer;
        uint32 gasLimit;
    }
    mapping(uint256 => Request) public requests;
    uint256 public lastRequestId;
    uint32 public constant COORDINATOR_MAX_GAS = 2_500_000;
    uint32 public constant WRAPPER_OVERHEAD = 13_400;
    uint32 public constant MAX_CONSUMER_GAS = 2_447_746;
    event ConsumerDelivery(uint256 indexed requestId, bool success, uint256 gasUsed);

    function link() external pure returns (address) {
        return address(0);
    }

    function calculateRequestPriceNative(uint32, uint32) external pure returns (uint256) {
        return 1e14;
    }

    function estimateRequestPriceNative(uint32, uint32, uint256) external pure returns (uint256) {
        return 1e14;
    }

    function requestRandomWordsInNative(uint32 gasLimit, uint16, uint32 numWords, bytes calldata)
        external
        payable
        returns (uint256 id)
    {
        require(msg.value == 1e14 && numWords == 1, "fixture request");
        require(gasLimit + gasLimit / 63 + 1 + WRAPPER_OVERHEAD <= COORDINATOR_MAX_GAS, "coordinator budget");
        id = ++lastRequestId;
        requests[id] = Request(msg.sender, gasLimit);
    }

    function deliver(uint256 id, uint256 word) external returns (bool ok, uint256 callGas) {
        Request memory r = requests[id];
        require(r.consumer != address(0), "no request");
        delete requests[id];
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        bytes memory data =
            abi.encodeWithSelector(VRFV2PlusWrapperConsumerBase.rawFulfillRandomWords.selector, id, words);
        uint256 beforeGas = gasleft();
        ok = _callWithExactGas(r.gasLimit, r.consumer, data);
        callGas = beforeGas - gasleft();
        emit ConsumerDelivery(id, ok, callGas);
    }

    // Test-only diagnostic bypass: measures successful consumer work beyond the live gas ceiling.
    // It does not assert that the coordinator would accept a request with this budget.
    function diagnosticDelivery(uint256 id, uint256 word, uint256 gasLimit)
        external
        returns (bool ok, uint256 callGas)
    {
        Request memory r = requests[id];
        require(r.consumer != address(0), "no request");
        delete requests[id];
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        bytes memory data =
            abi.encodeWithSelector(VRFV2PlusWrapperConsumerBase.rawFulfillRandomWords.selector, id, words);
        uint256 beforeGas = gasleft();
        ok = _callWithExactGas(gasLimit, r.consumer, data);
        callGas = beforeGas - gasleft();
        emit ConsumerDelivery(id, ok, callGas);
    }

    function repeatFulfillment(address consumer, uint256 id, uint256[] calldata words) external {
        VRFV2PlusWrapperConsumerBase(consumer).rawFulfillRandomWords(id, words);
    }

    function _callWithExactGas(uint256 gasAmount, address target, bytes memory data) private returns (bool success) {
        assembly ("memory-safe") {
            let g := gas()
            if lt(g, 5000) { revert(0, 0) }
            g := sub(g, 5000)
            if iszero(gt(sub(g, div(g, 64)), gasAmount)) { revert(0, 0) }
            if iszero(extcodesize(target)) { revert(0, 0) }
            success := call(gasAmount, target, 0, add(data, 0x20), mload(data), 0, 0)
        }
    }
}
