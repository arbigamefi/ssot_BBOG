// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/StdJson.sol";
import {GovernanceTimelock} from "../../src/access/GovernanceTimelock.sol";
import {Governable} from "../../src/access/Governable.sol";
import {Sentinel} from "../../src/access/Sentinel.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";
import {SafeGovernance} from "../common/SafeGovernance.sol";
import {V16Batches} from "./V16Batches.sol";

/// @dev The live checks of a v1.6 release at one block, shared by the deployment rehearsal, the timelock batch
///      preparation and release verification so they cannot diverge. Complete role, operation and authorization
///      histories need event replay and are checked by script/release/verify_governance.py.
library V16Snapshot {
    using stdJson for string;

    VmSafe private constant vm = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    enum Mode {
        /// Deployed, wiring not executed yet.
        Deployed,
        /// The pre-launch release state that signing and the Release Gate require (ADR-0037 §9): the wiring executed,
        /// the activation not executed, every pool registered and inactive, every Bank unpaused, the hub registered
        /// and allowed for every pool and no game disabled.
        Release,
        /// A deployed release at any later time, as the frontend import and the drift monitor check it. Changes that
        /// only reduce risk are accepted: a paused Bank, an inactive pool, a deregistered hub or route, a disabled
        /// game. An active pool requires the release's activation operation to have executed.
        Live
    }

    function targets(string memory snap) internal pure returns (address[] memory list) {
        require(
            keccak256(bytes(snap.readString(".architectureVersion"))) == keccak256("v1.6-nft-liquidity"), "not v1.6"
        );
        uint256 pools = snap.readUint(".numPools");
        require(pools > 0 && pools <= 32, "bad pool count");
        list = new address[](3 + pools);
        list[0] = snap.readAddress(".poolRegistry");
        list[1] = snap.readAddress(".refRegistry");
        list[2] = snap.readAddress(".gameHub");
        for (uint256 i; i < pools; ++i) {
            list[3 + i] = snap.readAddress(string.concat(".poolBank_", vm.toString(i)));
        }
        for (uint256 i; i < list.length; ++i) {
            require(list[i] != address(0), "zero governance target");
            for (uint256 j; j < i; ++j) {
                require(list[i] != list[j], "duplicate governance target");
            }
        }
    }

    function verify(string memory snap, Mode mode) internal view {
        require(snap.readUint(".chainId") == block.chainid, "wrong chain");
        address safe = snap.readAddress(".gov");
        SafeGovernance.validate(
            safe,
            snap.readBytes32(".safeOwnersHash"),
            snap.readBytes32(".safeCodeHash"),
            snap.readBytes32(".safeControlHash")
        );
        SafeGovernance.validateGuardian(
            snap.readAddress(".guardian"),
            safe,
            snap.readBytes32(".guardianOwnersHash"),
            snap.readBytes32(".guardianCodeHash"),
            snap.readBytes32(".guardianControlHash")
        );
        _verifyCode(snap);
        GovernanceTimelock timelock = GovernanceTimelock(payable(snap.readAddress(".governanceTimelock")));
        _verifyTimelock(snap, timelock);
        address[] memory list = targets(snap);
        for (uint256 i; i < list.length; ++i) {
            require(list[i].code.length != 0, "target has no code");
            require(
                Governable(list[i]).governance() == address(timelock)
                    && Governable(list[i]).pendingGovernance() == address(0),
                "governance is not the release timelock"
            );
        }
        _verifyConfiguration(snap);
        uint256 pools = snap.readUint(".numPools");
        for (uint256 i; i < pools; ++i) {
            _verifyBank(snap, i);
        }

        bytes32 wiringId = V16Batches.id(V16Batches.wiring(snap));
        bytes32 activationId = V16Batches.id(V16Batches.activation(snap));
        require(
            wiringId == snap.readBytes32(".wiringOperationId")
                && activationId == snap.readBytes32(".activationOperationId"),
            "timelock operations differ from the release"
        );
        bool wired = timelock.isOperationDone(wiringId);
        if (mode == Mode.Deployed) {
            // The activation has the wiring as its predecessor, so it cannot have executed either.
            require(!wired, "wiring already executed");
            require(PoolRegistry(snap.readAddress(".poolRegistry")).poolCount() == 0, "pool registered before wiring");
            return;
        }
        require(wired, "wiring not executed");
        bool launched = timelock.isOperationDone(activationId);
        require(mode != Mode.Release || !launched, "activation executed: the release state is pre-launch");
        _verifyWiring(snap, mode, launched);
    }

    function _verifyCode(string memory snap) private view {
        string[15] memory keys = [
            string("governanceTimelock"),
            "vrfHub",
            "poolRegistry",
            "settlementRouter",
            "refRegistry",
            "refEngine",
            "gameHub",
            "moduleDice",
            "moduleCoinToss",
            "moduleRoulette",
            "moduleKeno",
            "modulePlinko",
            "moduleSicBo",
            "moduleSlots",
            "moduleBaccarat"
        ];
        for (uint256 i; i < keys.length; ++i) {
            address target = snap.readAddress(string.concat(".", keys[i]));
            require(target != address(0), "missing contract");
            require(
                target.code.length != 0 && target.codehash == snap.readBytes32(string.concat(".codeHash_", keys[i])),
                "runtime code mismatch"
            );
        }
    }

    /// The roles a release grants (ADR-0037 §2). Membership is not enumerable on chain; verify_governance.py replays
    /// RoleGranted and RoleRevoked to prove that nobody else holds a role.
    function _verifyTimelock(string memory snap, GovernanceTimelock timelock) private view {
        address safe = snap.readAddress(".gov");
        address guardian = snap.readAddress(".guardian");
        address deployer = snap.readAddress(".deployer");
        require(
            timelock.getMinDelay() == snap.readUint(".timelockMinDelay")
                && timelock.getMinDelay() == timelock.MIN_DELAY(),
            "timelock delay differs from the release"
        );
        require(
            timelock.hasRole(timelock.PROPOSER_ROLE(), safe) && timelock.hasRole(timelock.CANCELLER_ROLE(), safe)
                && timelock.hasRole(timelock.CANCELLER_ROLE(), guardian)
                && timelock.hasRole(timelock.EXECUTOR_ROLE(), address(0))
                && timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(timelock)),
            "timelock roles differ from the release"
        );
        require(
            !timelock.hasRole(timelock.PROPOSER_ROLE(), guardian)
                && !timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), safe)
                && !timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), guardian),
            "timelock roles differ from the release"
        );
        require(
            !timelock.hasRole(timelock.PROPOSER_ROLE(), deployer)
                && !timelock.hasRole(timelock.CANCELLER_ROLE(), deployer)
                && !timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), deployer),
            "deployer holds a timelock role"
        );
    }

    /// Construction-time values: the Bank, its Vault and asset as deployed.
    function _verifyBank(string memory snap, uint256 i) private view {
        string memory suffix = vm.toString(i);
        Bank bank = Bank(snap.readAddress(string.concat(".poolBank_", suffix)));
        require(address(bank).codehash == snap.readBytes32(string.concat(".codeHash_poolBank_", suffix)), "bank code mismatch");
        require(bank.asset() == snap.readAddress(string.concat(".poolAsset_", suffix)), "asset mismatch");
        uint256 decimals = snap.readUint(string.concat(".poolAssetDecimals_", suffix));
        require(bank.assetDecimals() == decimals, "bank precision mismatch");
        require(IERC20Metadata(bank.asset()).decimals() == decimals, "asset precision mismatch");
        require(bank.vault() == snap.readAddress(string.concat(".poolVault_", suffix)), "vault mismatch");
        require(
            bank.vault().codehash == snap.readBytes32(string.concat(".codeHash_poolVault_", suffix)),
            "vault code mismatch"
        );
        require(
            bank.riskReserveBps() == snap.readUint(string.concat(".poolBankRiskReserveBps_", suffix))
                && bank.minBetAmount() == snap.readUint(string.concat(".poolBankMinBetAmount_", suffix)),
            "bank risk configuration mismatch"
        );
    }

    function _verifyWiring(string memory snap, Mode mode, bool launched) private view {
        address safe = snap.readAddress(".gov");
        PoolRegistry registry = PoolRegistry(snap.readAddress(".poolRegistry"));
        GameHub hub = GameHub(snap.readAddress(".gameHub"));
        require(
            ReferralRegistry(snap.readAddress(".refRegistry")).binder() == address(hub), "referral binder mismatch"
        );
        require(registry.sentinel() == safe && hub.sentinel() == safe, "sentinel is not the Safe");
        uint256 pools = snap.readUint(".numPools");
        require(registry.poolCount() == pools, "pool count mismatch");
        bool release = mode == Mode.Release;
        for (uint256 i; i < pools; ++i) {
            string memory suffix = vm.toString(i);
            Bank bank = Bank(snap.readAddress(string.concat(".poolBank_", suffix)));
            uint64 poolId = uint64(snap.readUint(string.concat(".poolId_", suffix)));
            require(
                registry.poolIdAt(i) == poolId && registry.bankFor(poolId) == address(bank), "pool binding mismatch"
            );
            require(snap.readUint(string.concat(".poolDomain_", suffix)) == 1, "not a casino pool");
            require(uint256(registry.domainFor(poolId)) == 1, "pool status mismatch");
            bool active = registry.isPoolActive(poolId);
            require(!(release && active), "pool active before the release activation");
            require(!active || launched, "pool active without the release activation");
            bool routed = registry.isRegisteredHub(address(hub)) && registry.isHubAllowedForPool(poolId, address(hub));
            require(!release || routed, "hub permission mismatch");
            require(bank.sentinel() == safe, "sentinel is not the Safe");
            require(bank.guardian() == snap.readAddress(".guardian"), "guardian mismatch");
            require(!(release && bank.paused()), "Bank paused in the release state");
            require(bank.settlementRouter() == snap.readAddress(".settlementRouter"), "router mismatch");
            require(
                SettlementRouter(bank.settlementRouter()).settlementConsumer(address(bank))
                    == snap.readAddress(".vrfHub"),
                "consumer mismatch"
            );
            require(
                bank.withdrawalBufferBps() == snap.readUint(string.concat(".poolBankWithdrawalBufferBps_", suffix))
                    && bank.minPlayerTurnoverForUnlock()
                        == snap.readUint(string.concat(".poolBankMinTurnoverForUnlock_", suffix))
                    && bank.holdbackVestingSeconds()
                        == snap.readUint(string.concat(".poolBankHoldbackVestingSeconds_", suffix)),
                "bank risk configuration mismatch"
            );
        }
        (string[8] memory games, string[8] memory modules) = V16Batches.games();
        for (uint256 i; i < games.length; ++i) {
            bytes32 gameId = keccak256(bytes(games[i]));
            require(hub.gameModule(gameId) == snap.readAddress(string.concat(".", modules[i])), "game module mismatch");
            require(
                hub.gameMaxBetCount(gameId) == snap.readUint(string.concat(".gameMaxBetCount_", games[i]))
                    && hub.gameCallbackGasLimit(gameId) == snap.readUint(string.concat(".gameCallbackGasLimit_", games[i])),
                "game admission mismatch"
            );
            require(!(release && hub.gameDisabled(gameId)), "game disabled in the release state");
        }
    }

    function _verifyConfiguration(string memory snap) private view {
        GameHub hub = GameHub(snap.readAddress(".gameHub"));
        require(
            hub.defaultHouseEdgeBps() == snap.readUint(".defaultHouseEdgeBps")
                && hub.refundTimeoutSeconds() == snap.readUint(".refundTimeoutSeconds"),
            "game configuration mismatch"
        );
        require(hub.LP_SHARE_BPS() == snap.readUint(".lpShareBps"), "LP share mismatch");
        // An edge change takes the timelock's 72 hours and 7 more days, and anyone may activate it once due. The
        // release approves only the values above, so nothing may be pending.
        (, uint64 activatesAt) = hub.pendingEdgeChange();
        require(activatesAt == 0, "pending edge change is not part of the release");
        (uint16 l0, uint16 l1, uint16 l2, uint16 holdback) = hub.getReferralConfig(hub.activeReferralConfigId());
        require(
            l0 == snap.readUint(".refL0Bps") && l1 == snap.readUint(".refL1Bps") && l2 == snap.readUint(".refL2Bps")
                && holdback == snap.readUint(".refHoldbackBps"),
            "referral configuration mismatch"
        );
        VRFHub vrf = VRFHub(payable(snap.readAddress(".vrfHub")));
        require(
            vrf.wrapper() == snap.readAddress(".vrfWrapper")
                && vrf.settlementRouter() == snap.readAddress(".settlementRouter"),
            "VRF configuration mismatch"
        );
    }
}
