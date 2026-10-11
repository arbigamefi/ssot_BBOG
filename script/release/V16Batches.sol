// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/StdJson.sol";
import {Sentinel} from "../../src/access/Sentinel.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";

/// @notice The two timelock operations that turn a deployment into a release (ADR-0037 §9, decision D1).
///
///         - Wiring: scheduled by the Safe after deployment and executed by anyone 72 hours later. It binds the
///           referral registry, each Bank's router, randomness consumer, guardian and sentinel and every Bank
///           parameter that differs from its constructor default, registers the pools, the hub, its routes and the
///           eight certified games, and ends with every pool inactive: LPs can deposit, nobody can bet.
///         - Activation: a second operation, `setPoolActive(pool, true)` for every pool, with the wiring as its
///           predecessor, so it can never execute before the wiring.
///
///         Both are derived from the deployment snapshot alone. The deployment script, the Safe's batch files, the fork
///         rehearsal, release verification and the drift monitor therefore build the same calls and the same
///         operation ids, which the snapshot records and the release digest signs.
library V16Batches {
    using stdJson for string;

    VmSafe private constant vm = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 internal constant WIRING_SALT = keccak256("ARBIGAMEFI_V16_WIRING");
    bytes32 internal constant ACTIVATION_SALT = keccak256("ARBIGAMEFI_V16_ACTIVATION");
    /// Bank constructor defaults (src/core/Bank.sol): the withdrawal buffer starts at the risk reserve, the holdback
    /// vests over 30 days and no turnover is required before an unlock.
    uint256 internal constant BANK_DEFAULT_HOLDBACK_VESTING_SECONDS = 30 days;
    uint256 internal constant BANK_DEFAULT_MIN_PLAYER_TURNOVER = 0;

    struct Batch {
        address[] targets;
        uint256[] values;
        bytes[] payloads;
        bytes32 predecessor;
        bytes32 salt;
    }

    /// The certified games in registration order, with their snapshot module keys.
    function games() internal pure returns (string[8] memory names, string[8] memory moduleKeys) {
        names = [string("DICE"), "COIN_TOSS", "ROULETTE", "KENO", "PLINKO", "SIC_BO", "SLOTS", "BACCARAT"];
        moduleKeys = [
            string("moduleDice"),
            "moduleCoinToss",
            "moduleRoulette",
            "moduleKeno",
            "modulePlinko",
            "moduleSicBo",
            "moduleSlots",
            "moduleBaccarat"
        ];
    }

    function wiring(string memory snap) internal pure returns (Batch memory b) {
        uint256 pools = _poolCount(snap);
        address safe = snap.readAddress(".gov");
        address registry = snap.readAddress(".poolRegistry");
        address hub = snap.readAddress(".gameHub");
        _allocate(b, 4 + 10 * pools + 8);
        uint256 n;
        n = _push(b, n, snap.readAddress(".refRegistry"), abi.encodeCall(ReferralRegistry.setBinderOnce, (hub)));
        for (uint256 i; i < pools; ++i) {
            address bank = _bank(snap, i);
            n = _push(
                b, n, bank, abi.encodeCall(Bank.setSettlementRouterOnce, (snap.readAddress(".settlementRouter")))
            );
            n = _push(b, n, bank, abi.encodeCall(Bank.setRandomnessConsumerOnce, (snap.readAddress(".vrfHub"))));
            n = _push(b, n, bank, abi.encodeCall(Bank.setGuardian, (snap.readAddress(".guardian"))));
        }
        n = _push(b, n, registry, abi.encodeCall(Sentinel.setSentinel, (safe)));
        n = _push(b, n, hub, abi.encodeCall(Sentinel.setSentinel, (safe)));
        for (uint256 i; i < pools; ++i) {
            n = _push(b, n, _bank(snap, i), abi.encodeCall(Sentinel.setSentinel, (safe)));
        }
        for (uint256 i; i < pools; ++i) {
            n = _bankParameters(b, n, snap, i);
        }
        for (uint256 i; i < pools; ++i) {
            n = _push(
                b,
                n,
                registry,
                abi.encodeCall(
                    PoolRegistry.registerPool,
                    (_poolId(snap, i), _poolValue(snap, ".poolAsset_", i), _bank(snap, i), SSOTTypes.PoolDomain.Casino)
                )
            );
        }
        n = _push(b, n, registry, abi.encodeCall(PoolRegistry.setHubRegistered, (hub, true)));
        for (uint256 i; i < pools; ++i) {
            n = _push(b, n, registry, abi.encodeCall(PoolRegistry.setHubAllowedForPool, (_poolId(snap, i), hub, true)));
        }
        (string[8] memory names, string[8] memory moduleKeys) = games();
        for (uint256 g; g < names.length; ++g) {
            n = _push(
                b,
                n,
                hub,
                abi.encodeCall(
                    GameHub.registerGame,
                    (
                        keccak256(bytes(names[g])),
                        snap.readAddress(string.concat(".", moduleKeys[g])),
                        _uint32(snap, string.concat(".gameMaxBetCount_", names[g])),
                        _uint32(snap, string.concat(".gameCallbackGasLimit_", names[g]))
                    )
                )
            );
        }
        // registerPool admits a pool active; the release opens it only with the activation operation.
        for (uint256 i; i < pools; ++i) {
            n = _push(b, n, registry, abi.encodeCall(PoolRegistry.setPoolActive, (_poolId(snap, i), false)));
        }
        _truncate(b, n);
        b.salt = WIRING_SALT;
    }

    function activation(string memory snap) internal pure returns (Batch memory b) {
        uint256 pools = _poolCount(snap);
        address registry = snap.readAddress(".poolRegistry");
        _allocate(b, pools);
        uint256 n;
        for (uint256 i; i < pools; ++i) {
            n = _push(b, n, registry, abi.encodeCall(PoolRegistry.setPoolActive, (_poolId(snap, i), true)));
        }
        b.predecessor = id(wiring(snap));
        b.salt = ACTIVATION_SALT;
    }

    /// TimelockController.hashOperationBatch.
    function id(Batch memory b) internal pure returns (bytes32) {
        return keccak256(abi.encode(b.targets, b.values, b.payloads, b.predecessor, b.salt));
    }

    /// Bank parameters that the constructor does not already set to the release value.
    function _bankParameters(Batch memory b, uint256 n, string memory snap, uint256 i) private pure returns (uint256) {
        address bank = _bank(snap, i);
        uint256 buffer = _poolUint(snap, ".poolBankWithdrawalBufferBps_", i);
        if (buffer != _poolUint(snap, ".poolBankRiskReserveBps_", i)) {
            n = _push(b, n, bank, abi.encodeCall(Bank.setWithdrawalBufferBps, (buffer)));
        }
        uint256 turnover = _poolUint(snap, ".poolBankMinTurnoverForUnlock_", i);
        if (turnover != BANK_DEFAULT_MIN_PLAYER_TURNOVER) {
            n = _push(b, n, bank, abi.encodeCall(Bank.setMinPlayerTurnoverForUnlock, (turnover)));
        }
        uint256 vesting = _poolUint(snap, ".poolBankHoldbackVestingSeconds_", i);
        if (vesting != BANK_DEFAULT_HOLDBACK_VESTING_SECONDS) {
            n = _push(b, n, bank, abi.encodeCall(Bank.setHoldbackVestingSeconds, (vesting)));
        }
        return n;
    }

    function _poolCount(string memory snap) private pure returns (uint256 pools) {
        pools = snap.readUint(".numPools");
        require(pools >= 1 && pools <= 32, "numPools out of range");
    }

    function _bank(string memory snap, uint256 i) private pure returns (address) {
        return _poolValue(snap, ".poolBank_", i);
    }

    function _poolId(string memory snap, uint256 i) private pure returns (uint64) {
        uint256 value = _poolUint(snap, ".poolId_", i);
        require(value != 0 && value <= type(uint64).max, "poolId out of range");
        return uint64(value);
    }

    function _poolValue(string memory snap, string memory key, uint256 i) private pure returns (address) {
        return snap.readAddress(string.concat(key, vm.toString(i)));
    }

    function _poolUint(string memory snap, string memory key, uint256 i) private pure returns (uint256) {
        return snap.readUint(string.concat(key, vm.toString(i)));
    }

    function _uint32(string memory snap, string memory key) private pure returns (uint32) {
        uint256 value = snap.readUint(key);
        require(value <= type(uint32).max, string.concat(key, " out of range"));
        return uint32(value);
    }

    function _allocate(Batch memory b, uint256 capacity) private pure {
        b.targets = new address[](capacity);
        b.values = new uint256[](capacity);
        b.payloads = new bytes[](capacity);
    }

    function _push(Batch memory b, uint256 n, address target, bytes memory payload) private pure returns (uint256) {
        b.targets[n] = target;
        b.payloads[n] = payload;
        return n + 1;
    }

    function _truncate(Batch memory b, uint256 n) private pure {
        address[] memory targets = b.targets;
        uint256[] memory values = b.values;
        bytes[] memory payloads = b.payloads;
        assembly ("memory-safe") {
            mstore(targets, n)
            mstore(values, n)
            mstore(payloads, n)
        }
    }
}
