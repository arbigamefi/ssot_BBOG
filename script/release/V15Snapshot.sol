// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/StdJson.sol";
import {Governable} from "../../src/access/Governable.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {SportsHub} from "../../src/core/SportsHub.sol";
import {SportsRiskEngine} from "../../src/core/SportsRiskEngine.sol";
import {ChainlinkV2PlusWrapperAdapter} from "../../src/adapters/chainlink/ChainlinkV2PlusWrapperAdapter.sol";
import {SafeGovernance} from "../common/SafeGovernance.sol";

/// @dev Shared target enumeration prevents acceptance packages and release checks diverging.
library V15Snapshot {
    using stdJson for string;
    VmSafe private constant vm = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    function targets(string memory snap) internal pure returns (address[] memory list) {
        require(
            keccak256(bytes(snap.readString(".architectureVersion"))) == keccak256("v1.5-safe-governance"), "not v1.5"
        );
        uint256 pools = snap.readUint(".numPools");
        require(pools > 0 && pools <= 32, "bad pool count");
        bool sports = snap.readUint(".sportsEnabled") == 1;
        list = new address[](5 + pools + (sports ? 2 : 0));
        list[0] = snap.readAddress(".adapter");
        list[1] = snap.readAddress(".vrfHub");
        list[2] = snap.readAddress(".poolRegistry");
        list[3] = snap.readAddress(".refRegistry");
        list[4] = snap.readAddress(".gameHub");
        for (uint256 i; i < pools; ++i) {
            list[5 + i] = snap.readAddress(string.concat(".poolBank_", vm.toString(i)));
        }
        if (sports) {
            list[5 + pools] = snap.readAddress(".sportsRiskEngine");
            list[6 + pools] = snap.readAddress(".sportsHub");
        }
        for (uint256 i; i < list.length; ++i) {
            require(list[i] != address(0), "zero governance target");
            for (uint256 j; j < i; ++j) {
                require(list[i] != list[j], "duplicate governance target");
            }
        }
    }

    function verify(string memory snap, bool accepted) internal view {
        require(snap.readUint(".chainId") == block.chainid, "wrong chain");
        address safe = snap.readAddress(".gov");
        SafeGovernance.validate(
            safe,
            snap.readBytes32(".safeOwnersHash"),
            snap.readBytes32(".safeCodeHash"),
            snap.readBytes32(".safeControlHash")
        );
        address bootstrap = snap.readAddress(".bootstrapGovernance");
        require(bootstrap != safe && bootstrap != address(0), "invalid bootstrap");
        string[17] memory keys = [
            string("adapter"),
            "vrfHub",
            "poolRegistry",
            "settlementRouter",
            "refRegistry",
            "refEngine",
            "gameHub",
            "sportsRiskEngine",
            "sportsHub",
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
            if (target == address(0)) {
                require((i == 7 || i == 8) && snap.readUint(".sportsEnabled") == 0, "missing contract");
            } else {
                require(
                    target.code.length != 0
                        && target.codehash == snap.readBytes32(string.concat(".codeHash_", keys[i])),
                    "runtime code mismatch"
                );
            }
        }
        address[] memory list = targets(snap);
        for (uint256 i; i < list.length; ++i) {
            Governable target = Governable(list[i]);
            require(list[i].code.length != 0, "target has no code");
            bool done = target.governance() == safe && target.pendingGovernance() == address(0);
            bool pending = target.governance() == bootstrap && target.pendingGovernance() == safe;
            require(accepted ? done : (done || pending), "governance not ready");
        }
        uint256 pools = snap.readUint(".numPools");
        PoolRegistry registry = PoolRegistry(snap.readAddress(".poolRegistry"));
        require(registry.poolCount() == pools, "pool count mismatch");
        _verifyConfiguration(snap);
        for (uint256 i; i < pools; ++i) {
            Bank bank = Bank(list[5 + i]);
            string memory suffix = vm.toString(i);
            uint64 poolId = uint64(snap.readUint(string.concat(".poolId_", suffix)));
            require(
                registry.poolIdAt(i) == poolId && registry.bankFor(poolId) == address(bank), "pool binding mismatch"
            );
            uint256 domain = snap.readUint(string.concat(".poolDomain_", suffix));
            require(
                uint256(registry.domainFor(poolId)) == domain && registry.isPoolActive(poolId), "pool status mismatch"
            );
            address hub = snap.readAddress(domain == 1 ? ".gameHub" : ".sportsHub");
            require(
                registry.isRegisteredHub(hub) && registry.isHubAllowedForPool(poolId, hub), "hub permission mismatch"
            );
            if (domain == 2) {
                require(
                    SportsRiskEngine(snap.readAddress(".sportsRiskEngine")).currentRiskHashForPool(poolId)
                        == snap.readBytes32(string.concat(".poolSportsRiskHash_", suffix)),
                    "sports risk mismatch"
                );
            }
            require(
                address(bank).codehash == snap.readBytes32(string.concat(".codeHash_poolBank_", vm.toString(i))),
                "bank code mismatch"
            );
            require(bank.guardian() == snap.readAddress(".guardian"), "guardian mismatch");
            require(bank.paused(), "risk-in must remain paused until launch");
            require(bank.asset() == snap.readAddress(string.concat(".poolAsset_", vm.toString(i))), "asset mismatch");
            require(bank.settlementRouter() == snap.readAddress(".settlementRouter"), "router mismatch");
            require(
                bank.riskReserveBps() == snap.readUint(string.concat(".poolBankRiskReserveBps_", suffix))
                    && bank.withdrawalBufferBps()
                        == snap.readUint(string.concat(".poolBankWithdrawalBufferBps_", suffix))
                    && bank.minPlayerTurnoverForUnlock()
                        == snap.readUint(string.concat(".poolBankMinTurnoverForUnlock_", suffix))
                    && bank.holdbackVestingSeconds()
                        == snap.readUint(string.concat(".poolBankHoldbackVestingSeconds_", suffix)),
                "bank risk configuration mismatch"
            );
        }
    }

    function _verifyConfiguration(string memory snap) private view {
        GameHub hub = GameHub(snap.readAddress(".gameHub"));
        require(
            hub.defaultHouseEdgeBps() == snap.readUint(".defaultHouseEdgeBps")
                && hub.maxAffiliateDeltaBps() == snap.readUint(".maxAffiliateDeltaBps")
                && hub.refundTimeoutSeconds() == snap.readUint(".refundTimeoutSeconds"),
            "game configuration mismatch"
        );
        (uint16 base, uint16 delta, uint16 holdback, uint16[6] memory bps, uint8 levels) =
            hub.getReferralConfig(hub.activeReferralConfigId());
        require(
            base == snap.readUint(".refBaseBudgetBps") && delta == snap.readUint(".refDeltaBudgetBps")
                && holdback == snap.readUint(".refHoldbackBps") && levels == snap.readUint(".refLevels"),
            "referral configuration mismatch"
        );
        for (uint256 i; i < 6; ++i) {
            require(
                bps[i] == snap.readUint(string.concat(".refLevel", vm.toString(i), "Bps")), "referral levels mismatch"
            );
        }
        string[8] memory games =
            [string("DICE"), "COIN_TOSS", "ROULETTE", "KENO", "PLINKO", "SIC_BO", "SLOTS", "BACCARAT"];
        string[8] memory modules = [
            string("moduleDice"),
            "moduleCoinToss",
            "moduleRoulette",
            "moduleKeno",
            "modulePlinko",
            "moduleSicBo",
            "moduleSlots",
            "moduleBaccarat"
        ];
        for (uint256 i; i < games.length; ++i) {
            require(
                hub.gameModule(keccak256(bytes(games[i]))) == snap.readAddress(string.concat(".", modules[i])),
                "game module mismatch"
            );
        }
        ChainlinkV2PlusWrapperAdapter adapter = ChainlinkV2PlusWrapperAdapter(payable(snap.readAddress(".adapter")));
        require(
            adapter.vrfHub() == snap.readAddress(".vrfHub")
                && adapter.requestGasPriceWei() == snap.readUint(".requestGasPriceWei")
                && address(VRFHub(payable(snap.readAddress(".vrfHub"))).adapter()) == address(adapter),
            "VRF configuration mismatch"
        );
        if (snap.readUint(".sportsEnabled") == 1) {
            SportsHub sports = SportsHub(snap.readAddress(".sportsHub"));
            require(
                sports.riskEngine() == snap.readAddress(".sportsRiskEngine")
                    && sports.oddsSignerSetHash() == snap.readBytes32(".sportsOddsSignerSetHash")
                    && sports.resultReporterSetHash() == snap.readBytes32(".sportsResultReporterSetHash")
                    && sports.resultReporterThreshold() == snap.readUint(".sportsResultReporterThreshold")
                    && sports.resultChallengeTimeoutSeconds() == snap.readUint(".sportsResultChallengeTimeoutSeconds"),
                "sports configuration mismatch"
            );
        }
    }
}
