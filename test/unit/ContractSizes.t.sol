// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

/// @notice Every contract `script/DeployV15.s.sol` deploys must fit the EIP-170 runtime limit. Forge's test EVM
///         does not enforce it, so a contract that grows past the limit passes every other test and fails only
///         when it is deployed. The v1.5 GameHub shipped 121 bytes under the limit.
contract ContractSizesTest is Test {
    uint256 internal constant EIP170_RUNTIME_LIMIT = 24_576;

    function test_deployedContractsFitEip170() external view {
        string[18] memory artifacts = [
            "GameHub.sol:GameHub",
            "SportsHub.sol:SportsHub",
            "Bank.sol:Bank",
            "SettlementRouter.sol:SettlementRouter",
            "PoolRegistry.sol:PoolRegistry",
            "VRFHub.sol:VRFHub",
            "SportsRiskEngine.sol:SportsRiskEngine",
            "ReferralRegistry.sol:ReferralRegistry",
            "DefaultReferralEngine.sol:DefaultReferralEngine",
            "ChainlinkV2PlusWrapperAdapter.sol:ChainlinkV2PlusWrapperAdapter",
            "DiceModule.sol:DiceModule",
            "CoinTossModule.sol:CoinTossModule",
            "RouletteModule.sol:RouletteModule",
            "KenoModule.sol:KenoModule",
            "PlinkoModule.sol:PlinkoModule",
            "SicBoModule.sol:SicBoModule",
            "SlotsModule.sol:SlotsModule",
            "BaccaratModule.sol:BaccaratModule"
        ];
        for (uint256 i = 0; i < artifacts.length; ++i) {
            assertLe(vm.getDeployedCode(artifacts[i]).length, EIP170_RUNTIME_LIMIT, artifacts[i]);
        }
    }
}
