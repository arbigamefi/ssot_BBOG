// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";

/// @notice Every contract the release deploys, the governance timelock of ADR-0037 included, must fit the EIP-170
///         runtime limit. Forge's test EVM does not enforce it, so a contract that grows past the limit passes every
///         other test and fails only when it is deployed. Each must also keep a 1 KB margin, so an audit fix cannot
///         push it over the limit.
contract ContractSizesTest is Test {
    uint256 internal constant EIP170_RUNTIME_LIMIT = 24_576;
    uint256 internal constant SIZE_MARGIN = 1_024;

    function test_deployedContractsFitEip170() external view {
        string[17] memory artifacts = [
            "GovernanceTimelock.sol:GovernanceTimelock",
            "GameHub.sol:GameHub",
            "Bank.sol:Bank",
            "SettlementRouter.sol:SettlementRouter",
            "PoolRegistry.sol:PoolRegistry",
            "VRFHub.sol:VRFHub",
            "ReferralRegistry.sol:ReferralRegistry",
            "DefaultReferralEngine.sol:DefaultReferralEngine",
            "LiquidityVault.sol:LiquidityVault",
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
            assertLe(vm.getDeployedCode(artifacts[i]).length, EIP170_RUNTIME_LIMIT - SIZE_MARGIN, artifacts[i]);
        }
    }
}
