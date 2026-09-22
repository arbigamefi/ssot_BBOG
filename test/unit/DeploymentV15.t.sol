// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {SafeGovernance} from "../../script/common/SafeGovernance.sol";
import {DeployV15} from "../../script/DeployV15.s.sol";
import {V15Snapshot} from "../../script/release/V15Snapshot.sol";
import {ReleaseDigestV15} from "../../script/release/ReleaseDigestV15.s.sol";
import {VerifyReleaseV15} from "../../script/release/VerifyReleaseV15.s.sol";
import {Governable} from "../../src/access/Governable.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {Errors} from "../../src/libs/Errors.sol";

// Configuration mock only: these tests do not claim to prove actual Safe quorum/signature execution.
contract SafeConfigMockV15 {
    uint256 public threshold = 2;
    address public guard;

    function setGuard(address value) external {
        guard = value;
    }

    function getStorageAt(uint256 slot, uint256) external view returns (bytes memory) {
        if (slot == 0) return abi.encode(address(this));
        if (slot == uint256(keccak256("guard_manager.guard.address"))) return abi.encode(guard);
        return abi.encode(address(0));
    }
    bool public moduleEnabled;

    function getOwners() external pure returns (address[] memory owners) {
        owners = new address[](3);
        owners[0] = address(11);
        owners[1] = address(12);
        owners[2] = address(13);
    }

    function getThreshold() external view returns (uint256) {
        return threshold;
    }

    function setThreshold(uint256 value) external {
        threshold = value;
    }

    function setModule() external {
        moduleEnabled = true;
    }

    function getModulesPaginated(address, uint256) external view returns (address[] memory modules, address next) {
        modules = new address[](moduleEnabled ? 1 : 0);
        if (moduleEnabled) modules[0] = address(99);
        return (modules, address(1));
    }
}

contract DeployHarnessV15 is DeployV15 {
    string public snapshot;

    function _shouldWriteArtifacts() internal pure override returns (bool) {
        return true;
    }
    function _logDeployment(DeployConfig memory, PoolConfig[] memory, Deployed memory) internal pure override {}

    function _writeArtifacts(DeployConfig memory cfg, PoolConfig[] memory pools, Deployed memory deployed)
        internal
        override
    {
        snapshot = _snapshotJson(cfg, pools, deployed);
    }
}

contract SnapshotVerifierV15 {
    function verify(string memory snap, bool accepted) external view {
        V15Snapshot.verify(snap, accepted);
    }
}

contract DigestHarnessV15 is ReleaseDigestV15 {
    using stdJson for string;

    function digest(string memory snap) external pure returns (bytes32) {
        return _digestPools(_digestStatic(snap), snap, snap.readUint(".numPools"));
    }
}

contract DeploymentV15Test is Test {
    using stdJson for string;
    DeployHarnessV15 deployer;
    SafeConfigMockV15 safe;
    SnapshotVerifierV15 verifier;
    MockERC20 asset;
    address bootstrap;
    address guardian = address(77);

    function setUp() public {
        bootstrap = vm.addr(0xBEEF);
        vm.deal(bootstrap, 100 ether);
        safe = new SafeConfigMockV15();
        asset = new MockERC20("Test USD", "TUSD", 6);
        deployer = new DeployHarnessV15();
        verifier = new SnapshotVerifierV15();
        _configureEnv();
    }

    // Foundry environment variables are process-wide, outside EVM snapshots.
    // This deployment suite runs with --threads 1 and restores its inputs per case.
    modifier isolatedEnv() {
        _configureEnv();
        _;
        _configureEnv();
    }

    function _configureEnv() internal {
        vm.setEnv("DEPLOYER", vm.toString(bootstrap));
        vm.setEnv("CHAIN_ID", vm.toString(block.chainid));
        vm.setEnv("GOV", vm.toString(address(safe)));
        vm.setEnv("GUARDIAN", vm.toString(guardian));
        vm.setEnv("KEEPER_ADDRESS", vm.toString(address(78)));
        vm.setEnv("RELEASE_SIGNER", vm.toString(address(79)));
        vm.setEnv("SAFE_CODE_HASH", vm.toString(address(safe).codehash));
        vm.setEnv(
            "SAFE_CONTROL_HASH",
            vm.toString(
                keccak256(abi.encode(address(safe), address(safe).codehash, address(0), address(0), bytes32(0)))
            )
        );
        vm.setEnv("SAFE_OWNERS_HASH", vm.toString(keccak256(abi.encode(safe.getOwners(), uint256(2)))));
        vm.setEnv("VRF_WRAPPER", vm.toString(address(asset)));
        vm.setEnv("NUM_POOLS", "2");
        vm.setEnv("POOL_ASSET_0", vm.toString(address(asset)));
        vm.setEnv("POOL_ASSET_1", vm.toString(address(asset)));
        vm.setEnv("POOL_DOMAIN_0", "1");
        vm.setEnv("POOL_DOMAIN_1", "1");
        vm.setEnv("SPORTS_DERIVE_ROLE_SET_HASHES", "false");
        vm.setEnv("POOL_ID_0", "1");
        vm.setEnv("POOL_ID_1", "3");
        vm.setEnv("DEFAULT_HOUSE_EDGE_BPS", "200");
        vm.setEnv("WRITE_DRY_RUN_ARTIFACTS", "false");
    }

    function _deploy() internal returns (string memory snap, address[] memory targets) {
        deployer.run();
        snap = deployer.snapshot();
        targets = V15Snapshot.targets(snap);
    }

    function testNominationIsNotAcceptanceAndOldSignerLosesAuthority() public isolatedEnv {
        (string memory snap, address[] memory list) = _deploy();
        assertEq(list.length, 7);
        assertEq(snap.readAddress(".gov"), address(safe));
        assertEq(snap.readAddress(".bootstrapGovernance"), bootstrap);
        verifier.verify(snap, false);
        vm.expectRevert("governance not ready");
        verifier.verify(snap, true);
        for (uint256 i; i < list.length; ++i) {
            assertEq(Governable(list[i]).governance(), bootstrap);
            assertEq(Governable(list[i]).pendingGovernance(), address(safe));
            vm.expectRevert(Errors.Unauthorized.selector);
            Governable(list[i]).acceptGovernance();
            vm.prank(address(safe));
            Governable(list[i]).acceptGovernance();
            vm.prank(bootstrap);
            vm.expectRevert(Errors.Unauthorized.selector);
            Governable(list[i]).transferGovernance(bootstrap);
        }
        verifier.verify(snap, true);
        Bank bank = Bank(list[5]);
        assertTrue(bank.paused());
        assertEq(bank.guardian(), guardian);
        vm.prank(guardian);
        vm.expectRevert(Errors.Unauthorized.selector);
        bank.setRiskInPaused(false);
        vm.prank(address(safe));
        bank.setRiskInPaused(false);
        assertFalse(bank.paused());
        vm.prank(guardian);
        bank.setRiskInPaused(true);
        verifier.verify(snap, true);
    }

    function testPartialSafeAcceptanceCanResumeButCannotRelease() public isolatedEnv {
        (string memory snap, address[] memory list) = _deploy();
        vm.prank(address(safe));
        Governable(list[0]).acceptGovernance();
        verifier.verify(snap, false);
        vm.expectRevert("governance not ready");
        verifier.verify(snap, true);
        for (uint256 i = 1; i < list.length; ++i) {
            vm.prank(address(safe));
            Governable(list[i]).acceptGovernance();
        }
        verifier.verify(snap, true);
    }

    function testRuntimeMutationFailsEvenWithCorrectGovernance() public isolatedEnv {
        (string memory snap, address[] memory list) = _deploy();
        vm.etch(list[4], hex"60006000fd");
        vm.expectRevert("runtime code mismatch");
        verifier.verify(snap, false);
    }

    function testBootstrapCannotSilentlyChangeRefundTimeout() public isolatedEnv {
        (string memory snap,) = _deploy();
        vm.prank(bootstrap);
        GameHub(snap.readAddress(".gameHub")).setRefundTimeout(snap.readUint(".refundTimeoutSeconds") + 1);
        vm.expectRevert("game configuration mismatch");
        verifier.verify(snap, false);
    }

    function testBankRiskDriftBlocksAcceptancePreparation() public isolatedEnv {
        (string memory snap, address[] memory list) = _deploy();
        vm.prank(bootstrap);
        Bank(list[5]).setWithdrawalBufferBps(777);
        vm.expectRevert("bank risk configuration mismatch");
        verifier.verify(snap, false);
    }

    function testDisabledPoolCannotPassReleaseGate() public isolatedEnv {
        (string memory snap,) = _deploy();
        vm.prank(bootstrap);
        PoolRegistry(snap.readAddress(".poolRegistry")).setPoolActive(1, false);
        vm.expectRevert("pool status mismatch");
        verifier.verify(snap, false);
    }

    function testBankRuntimeMutationFails() public isolatedEnv {
        (string memory snap, address[] memory list) = _deploy();
        // Keep getters accessible while changing bytecode, to exercise the explicit runtime binding.
        vm.etch(list[5], bytes.concat(list[5].code, hex"00"));
        vm.expectRevert("bank code mismatch");
        verifier.verify(snap, false);
    }

    function testWrongChainFailsBeforeBroadcast() public isolatedEnv {
        vm.setEnv("CHAIN_ID", "8453");
        vm.expectRevert("CHAIN_ID mismatch");
        deployer.run();
    }

    function testEOACannotMasqueradeAsSafe() public isolatedEnv {
        vm.setEnv("GOV", vm.toString(address(900)));
        vm.expectRevert("Safe code mismatch");
        deployer.run();
    }

    function testThresholdAndOwnerConfigurationAreBound() public isolatedEnv {
        safe.setThreshold(1);
        vm.expectRevert("2-of-3 Safe required");
        deployer.run();
        safe.setThreshold(2);
        vm.setEnv("SAFE_OWNERS_HASH", vm.toString(bytes32(uint256(1))));
        vm.expectRevert("Safe owners mismatch");
        deployer.run();
    }

    function testModuleCannotBypassQuorumPolicy() public isolatedEnv {
        safe.setModule();
        vm.expectRevert("Safe modules not allowed");
        deployer.run();
    }

    function testBpsInputCannotWrapIntoValidValue() public isolatedEnv {
        vm.setEnv("DEFAULT_HOUSE_EDGE_BPS", "65536");
        vm.expectRevert("DEFAULT_HOUSE_EDGE_BPS out of range");
        deployer.run();
    }

    function testGuardConfigurationCannotDrift() public isolatedEnv {
        safe.setGuard(address(55));
        vm.expectRevert("Safe guard not allowed");
        deployer.run();
    }

    function testControlHashCannotBeSubstituted() public isolatedEnv {
        vm.setEnv("SAFE_CONTROL_HASH", vm.toString(bytes32(uint256(1))));
        vm.expectRevert("Safe controls mismatch");
        deployer.run();
    }

    function testReleaseDigestBindsAuthorityAndRuntime() public isolatedEnv {
        (string memory snap,) = _deploy();
        DigestHarnessV15 digest = new DigestHarnessV15();
        bytes32 original = digest.digest(snap);
        vm.serializeJson("tampered-v15", snap);
        string memory changed = vm.serializeAddress("tampered-v15", "guardian", address(100));
        assertNotEq(digest.digest(changed), original);
        vm.serializeJson("tampered-v15", snap);
        changed = vm.serializeAddress("tampered-v15", "releaseSigner", address(101));
        assertNotEq(digest.digest(changed), original);
        vm.serializeJson("tampered-v15", snap);
        changed = vm.serializeBytes32("tampered-v15", "codeHash_poolBank_0", bytes32(uint256(1)));
        assertNotEq(digest.digest(changed), original);
        vm.serializeJson("tampered-v15", snap);
        changed = vm.serializeString("tampered-v15", "architectureVersion", "v1.4-bank-observability");
        vm.expectRevert("not a v1.5 snapshot");
        digest.digest(changed);
    }

    function testSportsTargetsAreIncludedAndBanksRemainPaused() public isolatedEnv {
        vm.setEnv("POOL_DOMAIN_1", "2");
        vm.setEnv("SPORTS_DERIVE_ROLE_SET_HASHES", "true");
        vm.setEnv("SPORTS_ODDS_SIGNER", vm.toString(address(81)));
        vm.setEnv("SPORTS_RESULT_REPORTER", vm.toString(address(82)));
        vm.setEnv("SPORTS_MAX_STAKE", "1000000");
        vm.setEnv("SPORTS_MAX_PAYOUT", "2000000");
        vm.setEnv("SPORTS_MAX_MARKET_RESERVED", "10000000");
        vm.setEnv("SPORTS_MAX_OUTCOME_RESERVED", "10000000");
        vm.setEnv("SPORTS_MAX_EVENT_RESERVED", "10000000");
        vm.setEnv("SPORTS_ODDS_SIGNER_SET_HASH", vm.toString(bytes32(uint256(1))));
        vm.setEnv("SPORTS_RESULT_REPORTER_SET_HASH", vm.toString(bytes32(uint256(2))));
        (string memory snap, address[] memory list) = _deploy();
        assertEq(list.length, 9);
        (,,, bytes32 initialOdds, bytes32 initialReporters) =
            abi.decode(snap.readBytes(".ctorArgs_sportsHub"), (address, address, address, bytes32, bytes32));
        assertEq(initialOdds, bytes32(uint256(1)));
        assertEq(initialReporters, bytes32(uint256(2)));
        assertNotEq(snap.readBytes32(".sportsOddsSignerSetHash"), initialOdds);
        assertEq(list[7], snap.readAddress(".sportsRiskEngine"));
        assertEq(list[8], snap.readAddress(".sportsHub"));
        verifier.verify(snap, false);
        for (uint256 i; i < list.length; ++i) {
            vm.prank(address(safe));
            Governable(list[i]).acceptGovernance();
        }
        verifier.verify(snap, true);
    }
}
