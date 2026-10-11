// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {V16Batches} from "../../script/release/V16Batches.sol";
import {V16ReleaseDigest} from "../../script/release/V16ReleaseDigest.sol";
import {V16Snapshot} from "../../script/release/V16Snapshot.sol";
import {GenerateGoldenVectorsV16} from "../../script/release/GenerateGoldenVectorsV16.s.sol";
import {PrepareTimelockBatchesV16} from "../../script/release/PrepareTimelockBatchesV16.s.sol";
import {GovernanceTimelock} from "../../src/access/GovernanceTimelock.sol";
import {Governable} from "../../src/access/Governable.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {IGameModule} from "../../src/core/interfaces/IGameModule.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {Errors} from "../../src/libs/Errors.sol";
import {ReleaseV16Fixture, SafeConfigMockV16, SnapshotVerifierV16} from "../utils/ReleaseV16Fixture.sol";

contract DigestHarnessV16 {
    function digest(string memory snap) external pure returns (bytes32) {
        return V16ReleaseDigest.snapshotDigest(snap);
    }
}

/// @notice The deployment script and release checks under ADR-0037 decision D1: the timelock governs every contract
///         from construction, the Safe's wiring batch leaves the pools inactive and open to deposits, activation is
///         a second operation, and every check names the first deviation from the release.
/// @dev Runs with --threads 1: the deployment reads process-wide environment variables (ReleaseV16Fixture).
contract DeploymentV16Test is ReleaseV16Fixture {
    using stdJson for string;

    SnapshotVerifierV16 internal verifier;
    address internal constant LP = address(0x1B);

    function setUp() public {
        _setUpRelease();
        verifier = new SnapshotVerifierV16();
    }

    modifier isolatedEnv() {
        _configureEnv();
        _;
        _configureEnv();
    }

    function _registry(string memory snap) internal pure returns (PoolRegistry) {
        return PoolRegistry(snap.readAddress(".poolRegistry"));
    }

    function _hub(string memory snap) internal pure returns (GameHub) {
        return GameHub(snap.readAddress(".gameHub"));
    }

    function _bank(string memory snap, uint256 i) internal pure returns (Bank) {
        return Bank(snap.readAddress(string.concat(".poolBank_", vm.toString(i))));
    }

    function _expectVerifyRevert(string memory snap, V16Snapshot.Mode mode, string memory reason) internal {
        vm.expectRevert(bytes(reason));
        verifier.verify(snap, mode);
    }

    // ---- D1: the deployment holds no power ----

    function testTimelockGovernsFromConstructionAndTheDeployerHoldsNothing() public isolatedEnv {
        string memory snap = _deploy();
        GovernanceTimelock tl = _timelock(snap);
        address[] memory list = V16Snapshot.targets(snap);
        assertEq(list.length, 5);
        for (uint256 i; i < list.length; ++i) {
            assertEq(Governable(list[i]).governance(), address(tl));
            assertEq(Governable(list[i]).pendingGovernance(), address(0));
        }
        assertEq(tl.getMinDelay(), 259_200);
        assertEq(snap.readUint(".timelockMinDelay"), 259_200);
        assertTrue(tl.hasRole(tl.PROPOSER_ROLE(), address(safe)));
        assertTrue(tl.hasRole(tl.CANCELLER_ROLE(), address(safe)));
        assertTrue(tl.hasRole(tl.CANCELLER_ROLE(), address(guardianSafe)));
        assertFalse(tl.hasRole(tl.PROPOSER_ROLE(), address(guardianSafe)));
        assertTrue(tl.hasRole(tl.EXECUTOR_ROLE(), address(0)));
        assertTrue(tl.hasRole(tl.DEFAULT_ADMIN_ROLE(), address(tl)));
        bytes32[4] memory roles = [tl.DEFAULT_ADMIN_ROLE(), tl.PROPOSER_ROLE(), tl.CANCELLER_ROLE(), tl.EXECUTOR_ROLE()];
        for (uint256 i; i < roles.length; ++i) {
            assertFalse(tl.hasRole(roles[i], deployerKey));
        }
        assertFalse(tl.hasRole(tl.DEFAULT_ADMIN_ROLE(), address(safe)));
        assertFalse(tl.hasRole(tl.DEFAULT_ADMIN_ROLE(), address(guardianSafe)));

        // Nothing the deployer sends has any authority.
        vm.startPrank(deployerKey);
        vm.expectRevert(Errors.Unauthorized.selector);
        _registry(snap).setSentinel(deployerKey);
        vm.expectRevert(Errors.Unauthorized.selector);
        _hub(snap).setRefundTimeout(60);
        vm.expectRevert(Errors.Unauthorized.selector);
        _bank(snap, 0).setGuardian(deployerKey);
        vm.expectRevert(Errors.Unauthorized.selector);
        ReferralRegistry(snap.readAddress(".refRegistry")).setBinderOnce(deployerKey);
        V16Batches.Batch memory w = V16Batches.wiring(snap);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, deployerKey, tl.PROPOSER_ROLE()
            )
        );
        tl.scheduleBatch(w.targets, w.values, w.payloads, w.predecessor, w.salt, 259_200);
        vm.stopPrank();

        // Nothing is wired before the timelock executes the batch.
        assertEq(_registry(snap).poolCount(), 0);
        assertEq(_bank(snap, 0).settlementRouter(), address(0));
        assertEq(_registry(snap).sentinel(), address(0));
        verifier.verify(snap, V16Snapshot.Mode.Deployed);
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "wiring not executed");
    }

    function testTheRehearsalBeforeBroadcastLeavesOnlyTheDeployment() public isolatedEnv {
        uint256 before = block.timestamp;
        string memory snap = _deploy();
        GovernanceTimelock tl = _timelock(snap);
        assertEq(block.timestamp, before);
        assertEq(snap.readBytes32(".wiringOperationId"), V16Batches.id(V16Batches.wiring(snap)));
        assertEq(snap.readBytes32(".activationOperationId"), V16Batches.id(V16Batches.activation(snap)));
        assertEq(
            uint8(tl.getOperationState(snap.readBytes32(".wiringOperationId"))),
            uint8(TimelockController.OperationState.Unset)
        );
        assertEq(_registry(snap).poolCount(), 0);
        assertEq(V16Batches.activation(snap).predecessor, snap.readBytes32(".wiringOperationId"));
    }

    function testAWiringThatWouldRevertStopsTheDeployment() public isolatedEnv {
        // GameHub refuses a callback gas below 200,000 only when the batch executes; the rehearsal finds it first.
        vm.setEnv("GAME_CALLBACK_GAS_LIMIT_KENO", "199999");
        vm.expectRevert(Errors.InvalidConfig.selector);
        deployer.run();
    }

    function testDuplicatePoolIdIsRefusedBeforeBroadcast() public isolatedEnv {
        vm.setEnv("POOL_ID_1", "1");
        vm.expectRevert("duplicate POOL_ID");
        deployer.run();
    }

    // ---- The wiring batch and the activation ----

    function testTheWiringLeavesEveryPoolInactiveAndOpenToDeposits() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        verifier.verify(snap, V16Snapshot.Mode.Release);
        verifier.verify(snap, V16Snapshot.Mode.Live);
        _expectVerifyRevert(snap, V16Snapshot.Mode.Deployed, "wiring already executed");
        PoolRegistry registry = _registry(snap);
        assertEq(registry.poolCount(), 2);
        assertFalse(registry.isPoolActive(1));
        assertFalse(registry.isPoolActive(3));
        assertEq(registry.sentinel(), address(safe));
        assertEq(_hub(snap).sentinel(), address(safe));
        Bank bank = _bank(snap, 0);
        assertFalse(bank.paused());
        assertEq(bank.sentinel(), address(safe));
        assertEq(bank.guardian(), address(guardianSafe));
        assertEq(ReferralRegistry(snap.readAddress(".refRegistry")).binder(), address(_hub(snap)));

        LiquidityVault vault = LiquidityVault(bank.vault());
        asset.mint(LP, 1_000e6);
        vm.startPrank(LP);
        asset.approve(address(vault), type(uint256).max);
        vault.addDeposit(1_000e6);
        vm.stopPrank();
        assertEq(asset.balanceOf(address(vault)), 1_000e6);
    }

    function testActivationIsASecondOperationThatNeedsTheWiring() public isolatedEnv {
        string memory snap = _deploy();
        GovernanceTimelock tl = _timelock(snap);
        V16Batches.Batch memory w = V16Batches.wiring(snap);
        V16Batches.Batch memory a = V16Batches.activation(snap);
        // Even scheduled together and both ready, the activation cannot run first.
        _schedule(snap, w);
        _schedule(snap, a);
        vm.warp(block.timestamp + tl.getMinDelay());
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(TimelockController.TimelockUnexecutedPredecessor.selector, V16Batches.id(w)));
        tl.executeBatch(a.targets, a.values, a.payloads, a.predecessor, a.salt);
        _execute(snap, w);
        verifier.verify(snap, V16Snapshot.Mode.Release);
        _execute(snap, a);
        assertTrue(_registry(snap).isPoolActive(1));
        assertTrue(_registry(snap).isPoolActive(3));
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "activation executed: the release state is pre-launch");
        verifier.verify(snap, V16Snapshot.Mode.Live);
    }

    function testRiskReducingChangesFailTheReleaseStateButNotTheLiveCheck() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        vm.prank(address(guardianSafe));
        _bank(snap, 0).setRiskInPaused(true);
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "Bank paused in the release state");
        verifier.verify(snap, V16Snapshot.Mode.Live);
        // Only the timelock unpauses.
        vm.prank(address(guardianSafe));
        vm.expectRevert(Errors.Unauthorized.selector);
        _bank(snap, 0).setRiskInPaused(false);
        _govCall(snap, address(_bank(snap, 0)), abi.encodeCall(Bank.setRiskInPaused, (false)), "unpause");
        verifier.verify(snap, V16Snapshot.Mode.Release);

        vm.prank(address(safe));
        _hub(snap).disableGame(keccak256("DICE"));
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "game disabled in the release state");
        verifier.verify(snap, V16Snapshot.Mode.Live);
    }

    function testADeregisteredHubFailsTheReleaseStateButNotTheLiveCheck() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        vm.prank(address(safe));
        _registry(snap).setHubRegistered(address(_hub(snap)), false);
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "hub permission mismatch");
        verifier.verify(snap, V16Snapshot.Mode.Live);
    }

    function testTheSentinelMayCloseAPoolAfterLaunch() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        _activate(snap);
        vm.prank(address(safe));
        _registry(snap).setPoolActive(1, false);
        verifier.verify(snap, V16Snapshot.Mode.Live);
    }

    // ---- P2: the guardian's veto ----

    function testTheGuardianCancelsAQueuedOperationAndCannotPropose() public isolatedEnv {
        string memory snap = _deploy();
        GovernanceTimelock tl = _timelock(snap);
        V16Batches.Batch memory w = V16Batches.wiring(snap);
        bytes32 id = V16Batches.id(w);
        _schedule(snap, w);
        vm.prank(address(guardianSafe));
        tl.cancel(id);
        assertEq(uint8(tl.getOperationState(id)), uint8(TimelockController.OperationState.Unset));
        vm.warp(block.timestamp + tl.getMinDelay());
        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSelector(
                TimelockController.TimelockUnexpectedOperationState.selector,
                id,
                bytes32(uint256(1) << uint8(TimelockController.OperationState.Ready))
            )
        );
        tl.executeBatch(w.targets, w.values, w.payloads, w.predecessor, w.salt);
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "wiring not executed");

        bytes32 proposer = tl.PROPOSER_ROLE();
        uint256 delay = tl.getMinDelay();
        vm.prank(address(guardianSafe));
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, address(guardianSafe), proposer
            )
        );
        tl.scheduleBatch(w.targets, w.values, w.payloads, w.predecessor, w.salt, delay);

        // The Safe schedules the same batch again and the release proceeds.
        _wire(snap);
        verifier.verify(snap, V16Snapshot.Mode.Release);
    }

    // ---- P6: operations the release does not declare ----

    function testAnUndeclaredActivationFailsBothChecks() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        _govCall(snap, address(_registry(snap)), abi.encodeCall(PoolRegistry.setPoolActive, (1, true)), "early");
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "pool active before the release activation");
        _expectVerifyRevert(snap, V16Snapshot.Mode.Live, "pool active without the release activation");
    }

    function testARoleGrantedToTheDeployerFailsVerification() public isolatedEnv {
        string memory snap = _deploy();
        GovernanceTimelock tl = _timelock(snap);
        _wire(snap);
        _govCall(
            snap, address(tl), abi.encodeCall(IAccessControl.grantRole, (tl.PROPOSER_ROLE(), deployerKey)), "grant"
        );
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "deployer holds a timelock role");
        _expectVerifyRevert(snap, V16Snapshot.Mode.Live, "deployer holds a timelock role");
    }

    function testParameterChangesThroughTheTimelockFailTheRelease() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        _govCall(snap, address(_bank(snap, 0)), abi.encodeCall(Bank.setWithdrawalBufferBps, (777)), "buffer");
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "bank risk configuration mismatch");
        _expectVerifyRevert(snap, V16Snapshot.Mode.Live, "bank risk configuration mismatch");
    }

    function testRefundTimeoutChangeFailsTheRelease() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        _govCall(
            snap,
            address(_hub(snap)),
            abi.encodeCall(GameHub.setRefundTimeout, (snap.readUint(".refundTimeoutSeconds") + 1)),
            "refund"
        );
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "game configuration mismatch");
    }

    function testAQueuedEdgeChangeFailsTheReleaseUntilTheSentinelCancelsIt() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        _govCall(snap, address(_hub(snap)), abi.encodeCall(GameHub.queueEdgeChange, (300)), "edge");
        _expectVerifyRevert(snap, V16Snapshot.Mode.Release, "pending edge change is not part of the release");
        vm.prank(address(safe));
        _hub(snap).cancelEdgeChange();
        verifier.verify(snap, V16Snapshot.Mode.Release);
    }

    function testTamperedOperationIdsFailVerification() public isolatedEnv {
        string memory snap = _deploy();
        vm.serializeJson("tampered-operations", snap);
        string memory changed = vm.serializeBytes32("tampered-operations", "wiringOperationId", bytes32(uint256(1)));
        _expectVerifyRevert(changed, V16Snapshot.Mode.Deployed, "timelock operations differ from the release");
    }

    // ---- Bank parameters ----

    function testDefaultDeploymentSeparatesRiskReserveFromOptionalOutflowBuffer() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        for (uint256 i; i < 2; ++i) {
            string memory suffix = vm.toString(i);
            Bank bank = _bank(snap, i);
            assertEq(bank.riskReserveBps(), 6000);
            assertEq(bank.withdrawalBufferBps(), 1000);
            assertEq(bank.holdbackVestingSeconds(), 86_400);
            assertEq(bank.minPlayerTurnoverForUnlock(), 20e6);
            assertEq(snap.readUint(string.concat(".poolBankRiskReserveBps_", suffix)), 6000);
            assertEq(snap.readUint(string.concat(".poolBankWithdrawalBufferBps_", suffix)), 1000);
        }
        verifier.verify(snap, V16Snapshot.Mode.Release);
    }

    function testExplicitPoolRiskAndOptionalOutflowOverridesRemainIndependent() public isolatedEnv {
        vm.setEnv("NUM_POOLS", "3");
        vm.setEnv("BANK_RISK_RESERVE_BPS_2", "1000");
        vm.setEnv("BANK_WITHDRAWAL_BUFFER_BPS_2", "2500");
        string memory snap = _deploy();
        _wire(snap);
        Bank bank = _bank(snap, 2);
        assertEq(bank.riskReserveBps(), 1000);
        assertEq(bank.withdrawalBufferBps(), 2500);
        assertEq(snap.readUint(".poolBankRiskReserveBps_2"), 1000);
        assertEq(snap.readUint(".poolBankWithdrawalBufferBps_2"), 2500);
        verifier.verify(snap, V16Snapshot.Mode.Release);
    }

    function testBankParametersAtTheirConstructorDefaultsStayOutOfTheWiring() public isolatedEnv {
        vm.setEnv("NUM_POOLS", "3");
        vm.setEnv("BANK_WITHDRAWAL_BUFFER_BPS_2", "6000");
        vm.setEnv("BANK_MIN_TURNOVER_FOR_UNLOCK_2", "0");
        vm.setEnv("BANK_HOLDBACK_VESTING_SECONDS_2", vm.toString(uint256(30 days)));
        string memory snap = _deploy();
        V16Batches.Batch memory w = V16Batches.wiring(snap);
        assertEq(_callsTo(w, address(_bank(snap, 0))), 7);
        assertEq(_callsTo(w, address(_bank(snap, 2))), 4);
        _wire(snap);
        Bank bank = _bank(snap, 2);
        assertEq(bank.withdrawalBufferBps(), 6000);
        assertEq(bank.minPlayerTurnoverForUnlock(), 0);
        assertEq(bank.holdbackVestingSeconds(), 30 days);
        verifier.verify(snap, V16Snapshot.Mode.Release);
    }

    function _callsTo(V16Batches.Batch memory b, address target) internal pure returns (uint256 n) {
        for (uint256 i; i < b.targets.length; ++i) {
            if (b.targets[i] == target) ++n;
        }
    }

    function testGeneratedGoldenVectorsAreAcceptedByAllEightModules() public isolatedEnv {
        string memory snap = _deploy();
        _wire(snap);
        string memory input = "deployments/test-golden-v16-snapshot.json";
        string memory output = "deployments/test-golden-v16-output.json";
        string memory previousInput = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v16.json"));
        string memory previousOutput =
            vm.envOr("VECTORS_OUTPUT_PATH", string("deployments/golden-vectors-latest-v16.json"));
        vm.createDir("deployments", true);
        vm.writeFile(input, snap);
        vm.setEnv("SNAPSHOT_PATH", input);
        vm.setEnv("VECTORS_OUTPUT_PATH", output);
        new GenerateGoldenVectorsV16().run();
        string memory vectors = vm.readFile(output);
        vm.setEnv("SNAPSHOT_PATH", previousInput);
        vm.setEnv("VECTORS_OUTPUT_PATH", previousOutput);
        vm.removeFile(output);
        vm.removeFile(input);

        GameHub hub = _hub(snap);
        for (uint256 i; i < 8; ++i) {
            string memory key = string.concat(".vectors[", vm.toString(i), "]");
            bytes32 gameId = vectors.readBytes32(string.concat(key, ".gameId"));
            bytes memory params = vectors.readBytes(string.concat(key, ".params"));
            SSOTTypes.StakeSpec memory stake = SSOTTypes.StakeSpec({
                amountPerRoll: vectors.readUint(string.concat(key, ".stakeSpec.amountPerRoll")),
                betCount: uint32(vectors.readUint(string.concat(key, ".stakeSpec.betCount"))),
                stopGain: vectors.readUint(string.concat(key, ".stakeSpec.stopGain")),
                stopLoss: vectors.readUint(string.concat(key, ".stakeSpec.stopLoss"))
            });
            IGameModule module = IGameModule(hub.gameModule(gameId));
            module.validate(params, stake);
            assertGt(module.maxPayout(params, stake), 0);
        }
    }

    function testTheSafeFilesScheduleTheReleaseOperations() public isolatedEnv {
        string memory snap = _deploy();
        GovernanceTimelock tl = _timelock(snap);
        string[4] memory paths = [
            string("deployments/test-batches-snapshot.json"),
            "deployments/test-safe-wiring.json",
            "deployments/test-safe-activation.json",
            "deployments/test-timelock-operations.json"
        ];
        string[4] memory keys =
            [string("SNAPSHOT_PATH"), "SAFE_WIRING_BATCH_PATH", "SAFE_ACTIVATION_BATCH_PATH", "TIMELOCK_OPERATIONS_PATH"];
        string[4] memory previous;
        vm.createDir("deployments", true);
        vm.writeFile(paths[0], snap);
        for (uint256 i; i < keys.length; ++i) {
            previous[i] = vm.envOr(keys[i], string(""));
            vm.setEnv(keys[i], paths[i]);
        }
        // The script rehearses both operations; only its files are kept.
        uint256 state = vm.snapshotState();
        new PrepareTimelockBatchesV16().run();
        vm.revertToStateAndDelete(state);
        string memory wiringFile = vm.readFile(paths[1]);
        string memory activationFile = vm.readFile(paths[2]);
        string memory operations = vm.readFile(paths[3]);
        for (uint256 i; i < keys.length; ++i) {
            vm.setEnv(keys[i], previous[i]);
            vm.removeFile(paths[i]);
        }

        V16Batches.Batch memory w = V16Batches.wiring(snap);
        V16Batches.Batch memory a = V16Batches.activation(snap);
        assertEq(wiringFile.readAddress(".transactions[0].to"), address(tl));
        assertEq(wiringFile.readAddress(".meta.createdFromSafeAddress"), address(safe));
        assertEq(
            wiringFile.readBytes(".transactions[0].data"),
            abi.encodeCall(TimelockController.scheduleBatch, (w.targets, w.values, w.payloads, w.predecessor, w.salt, 259_200))
        );
        assertEq(operations.readBytes32(".operations[0].id"), V16Batches.id(w));
        assertEq(operations.readString(".operations[0].state"), "unset");
        assertEq(operations.readBytes32(".operations[1].predecessor"), V16Batches.id(w));
        assertEq(operations.readString(".operations[0].calls[0].function"), "setBinderOnce(address)");

        // Sent as written: the Safe schedules each file, anyone executes the operation once ready.
        bytes[2] memory schedules =
            [wiringFile.readBytes(".transactions[0].data"), activationFile.readBytes(".transactions[0].data")];
        for (uint256 i; i < 2; ++i) {
            vm.prank(address(safe));
            (bool scheduled,) = address(tl).call(schedules[i]);
            assertTrue(scheduled);
            vm.warp(block.timestamp + tl.getMinDelay());
            vm.prank(executor);
            (bool executed,) =
                address(tl).call(operations.readBytes(string.concat(".operations[", vm.toString(i), "].executeCalldata")));
            assertTrue(executed);
            if (i == 0) verifier.verify(snap, V16Snapshot.Mode.Release);
        }
        assertTrue(tl.isOperationDone(V16Batches.id(a)));
        verifier.verify(snap, V16Snapshot.Mode.Live);
    }

    // ---- Runtime code and precision ----

    function testRuntimeMutationFailsEvenWithCorrectGovernance() public isolatedEnv {
        string memory snap = _deploy();
        vm.etch(address(_hub(snap)), hex"60006000fd");
        _expectVerifyRevert(snap, V16Snapshot.Mode.Deployed, "runtime code mismatch");
    }

    function testTimelockRuntimeMutationFails() public isolatedEnv {
        string memory snap = _deploy();
        address tl = address(_timelock(snap));
        vm.etch(tl, bytes.concat(tl.code, hex"00"));
        _expectVerifyRevert(snap, V16Snapshot.Mode.Deployed, "runtime code mismatch");
    }

    function testBankRuntimeMutationFails() public isolatedEnv {
        string memory snap = _deploy();
        address bank = address(_bank(snap, 0));
        // Keep getters accessible while changing bytecode, to exercise the explicit runtime binding.
        vm.etch(bank, bytes.concat(bank.code, hex"00"));
        _expectVerifyRevert(snap, V16Snapshot.Mode.Deployed, "bank code mismatch");
    }

    function testSignedPrecisionMustMatchBankAndAsset() public isolatedEnv {
        string memory snap = _deploy();
        verifier.verify(snap, V16Snapshot.Mode.Deployed);
        vm.serializeJson("bad-precision", snap);
        string memory changed = vm.serializeUint("bad-precision", "poolAssetDecimals_0", 9);
        _expectVerifyRevert(changed, V16Snapshot.Mode.Deployed, "bank precision mismatch");
        // Full uint comparison: values that truncate to the correct uint8 also fail.
        changed = vm.serializeUint("bad-precision", "poolAssetDecimals_0", 262);
        _expectVerifyRevert(changed, V16Snapshot.Mode.Deployed, "bank precision mismatch");
        // Preserve all Bank state and the signed precision, changing only the
        // token's metadata response to exercise the independent asset check.
        vm.etch(address(asset), address(new MockERC20("Test USD", "TUSD", 9)).code);
        _expectVerifyRevert(snap, V16Snapshot.Mode.Deployed, "asset precision mismatch");
    }

    function testSnapshotEmitsOnlyAuthenticatedPrecision() public isolatedEnv {
        string memory snap = _deploy();
        assertEq(snap.readUint(".poolAssetDecimals_0"), 6);
        DigestHarnessV16 digest = new DigestHarnessV16();
        bytes32 original = digest.digest(snap);
        vm.serializeJson("precision-digest", snap);
        string memory changed = vm.serializeUint("precision-digest", "poolAssetDecimals_0", 9);
        assertNotEq(digest.digest(changed), original);
        vm.serializeJson("precision-digest", snap);
        changed = vm.serializeString("precision-digest", "poolAssetSymbol_0", "OTHER");
        assertNotEq(digest.digest(changed), original);
    }

    function testReleaseDigestBindsAuthorityOperationsAndRuntime() public isolatedEnv {
        string memory snap = _deploy();
        DigestHarnessV16 digest = new DigestHarnessV16();
        bytes32 original = digest.digest(snap);
        string[6] memory addressKeys =
            [string("governanceTimelock"), "gov", "guardian", "releaseSigner", "keeper", "deployer"];
        for (uint256 i; i < addressKeys.length; ++i) {
            vm.serializeJson("tampered-v16", snap);
            assertNotEq(digest.digest(vm.serializeAddress("tampered-v16", addressKeys[i], address(100))), original);
        }
        string[7] memory wordKeys = [
            string("guardianOwnersHash"),
            "guardianCodeHash",
            "guardianControlHash",
            "wiringOperationId",
            "activationOperationId",
            "codeHash_governanceTimelock",
            "codeHash_poolBank_0"
        ];
        for (uint256 i; i < wordKeys.length; ++i) {
            vm.serializeJson("tampered-v16", snap);
            assertNotEq(digest.digest(vm.serializeBytes32("tampered-v16", wordKeys[i], bytes32(uint256(1)))), original);
        }
        vm.serializeJson("tampered-v16", snap);
        assertNotEq(digest.digest(vm.serializeUint("tampered-v16", "timelockMinDelay", 259_201)), original);
        vm.serializeJson("tampered-v16", snap);
        string memory changed = vm.serializeString("tampered-v16", "architectureVersion", "tampered-architecture");
        vm.expectRevert("not a v1.6 snapshot");
        digest.digest(changed);
    }

    function testGovernanceTargetsAreTheCasinoContracts() public isolatedEnv {
        string memory snap = _deploy();
        address[] memory list = V16Snapshot.targets(snap);
        assertEq(list.length, 5);
        assertEq(list[0], snap.readAddress(".poolRegistry"));
        assertEq(list[1], snap.readAddress(".refRegistry"));
        assertEq(list[2], snap.readAddress(".gameHub"));
        assertEq(list[3], snap.readAddress(".poolBank_0"));
        assertEq(list[4], snap.readAddress(".poolBank_1"));
    }

    // ---- Safe and guardian configuration, refused before anything is broadcast ----

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
        address[] memory owners = safe.getOwners();
        safe.setOwners(owners, 1);
        vm.expectRevert("2-of-3 Safe required");
        deployer.run();
        safe.setOwners(owners, 2);
        vm.setEnv("SAFE_OWNERS_HASH", vm.toString(bytes32(uint256(1))));
        vm.expectRevert("Safe owners mismatch");
        deployer.run();
    }

    function testModuleCannotBypassQuorumPolicy() public isolatedEnv {
        safe.setModule();
        vm.expectRevert("Safe modules not allowed");
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

    function testTheGuardianMustBeAnIndependentMultisig() public isolatedEnv {
        vm.setEnv("GUARDIAN", vm.toString(address(77)));
        vm.expectRevert("guardian code mismatch");
        deployer.run();
        vm.setEnv("GUARDIAN", vm.toString(address(safe)));
        vm.expectRevert("guardian must be a multisig separate from the Safe");
        deployer.run();
        _configureEnv();

        address[] memory owners = guardianSafe.getOwners();
        guardianSafe.setOwners(owners, 1);
        vm.setEnv("GUARDIAN_OWNERS_HASH", vm.toString(guardianSafe.ownersHash()));
        vm.expectRevert("guardian must be a multisig");
        deployer.run();

        owners[0] = safe.getOwners()[1];
        guardianSafe.setOwners(owners, 2);
        vm.setEnv("GUARDIAN_OWNERS_HASH", vm.toString(guardianSafe.ownersHash()));
        vm.expectRevert("guardian signer is a Safe signer");
        deployer.run();

        owners[0] = address(31);
        guardianSafe.setOwners(owners, 2);
        vm.expectRevert("guardian owners mismatch");
        deployer.run();
        vm.setEnv("GUARDIAN_OWNERS_HASH", vm.toString(guardianSafe.ownersHash()));

        guardianSafe.setModule();
        vm.expectRevert("guardian modules not allowed");
        deployer.run();
    }

    function testBpsInputCannotWrapIntoValidValue() public isolatedEnv {
        vm.setEnv("DEFAULT_HOUSE_EDGE_BPS", "65536");
        vm.expectRevert("DEFAULT_HOUSE_EDGE_BPS out of range");
        deployer.run();
    }

    function testRefundTimeoutAboveOneDayIsRefusedBeforeBroadcast() public isolatedEnv {
        vm.setEnv("REFUND_TIMEOUT_SECONDS", vm.toString(uint256(1 days + 1)));
        vm.expectRevert("REFUND_TIMEOUT_SECONDS above one day");
        deployer.run();
    }
}
