// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";

/// @dev Local certificate forks only. The selected domain supplies a fixed block, asset and provider.
abstract contract CallbackDomainFork is Test {
    function selectCallbackDomainFork() internal returns (address asset, address wrapper) {
        uint256 chain = vm.envOr("NFT_GAS_CHAIN_ID", uint256(84_532));
        require(chain == 84_532 || chain == 8453, "unsupported certificate fork chain");
        string memory domain =
            vm.readFile(string.concat("script/release/first-callback-domain-", vm.toString(chain), ".json"));
        require(vm.parseJsonUint(domain, ".chainId") == chain, "domain chain mismatch");
        uint256 target = vm.parseJsonUint(domain, ".providerReference.block");
        // The accepted Sepolia domain predates the blockHash field; its original fixture pin is unchanged.
        bytes32 expectedHash = chain == 84_532
            ? bytes32(0x5a75e3c5fbaaa54dd1e67075af773668d43757b4e5de71f788ee69837650b872)
            : vm.parseJsonBytes32(domain, ".providerReference.blockHash");
        require(vm.envOr("NFT_GAS_BLOCK", target) == target, "refresh domain block AND hash together");
        require(target != 0 && expectedHash != bytes32(0), "empty fork identity");
        vm.createSelectFork(vm.envString("NFT_GAS_RPC_URL"), target);
        assertEq(block.chainid, chain, "certificate fork chain mismatch");
        assertEq(block.number, target, "certificate fork block mismatch");
        vm.roll(target + 1);
        assertEq(blockhash(target), expectedHash, "certificate fork block hash mismatch");
        vm.roll(target);
        asset = vm.parseJsonAddress(domain, ".token.proxy");
        wrapper = vm.parseJsonAddress(domain, ".providerReference.wrapper");
        bytes32 assetHash =
            vm.parseBytes32(string.concat("0x", vm.parseJsonString(domain, ".token.proxyRuntimeSha256")));
        assertEq(sha256(asset.code), assetHash, "certificate token proxy mismatch");
    }
}
