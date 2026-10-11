// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/StdJson.sol";
import {Governable} from "../../src/access/Governable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {SafeGovernance} from "../common/SafeGovernance.sol";

/// @dev Shared target enumeration prevents acceptance packages and release checks diverging.
library V16Snapshot {
    using stdJson for string;
    VmSafe private constant vm = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

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
        string[14] memory keys = [
            string("vrfHub"),
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
            Bank bank = Bank(list[3 + i]);
            string memory suffix = vm.toString(i);
            uint64 poolId = uint64(snap.readUint(string.concat(".poolId_", suffix)));
            require(
                registry.poolIdAt(i) == poolId && registry.bankFor(poolId) == address(bank), "pool binding mismatch"
            );
            uint256 domain = snap.readUint(string.concat(".poolDomain_", suffix));
            require(domain == 1, "not a casino pool");
            require(
                uint256(registry.domainFor(poolId)) == domain && registry.isPoolActive(poolId), "pool status mismatch"
            );
            address hub = snap.readAddress(".gameHub");
            require(
                registry.isRegisteredHub(hub) && registry.isHubAllowedForPool(poolId, hub), "hub permission mismatch"
            );
            require(
                address(bank).codehash == snap.readBytes32(string.concat(".codeHash_poolBank_", vm.toString(i))),
                "bank code mismatch"
            );
            require(bank.guardian() == snap.readAddress(".guardian"), "guardian mismatch");
            require(bank.paused(), "risk-in must remain paused until launch");
            require(bank.asset() == snap.readAddress(string.concat(".poolAsset_", vm.toString(i))), "asset mismatch");
            uint256 decimals = snap.readUint(string.concat(".poolAssetDecimals_", suffix));
            require(bank.assetDecimals() == decimals, "bank precision mismatch");
            require(IERC20Metadata(bank.asset()).decimals() == decimals, "asset precision mismatch");
            require(bank.settlementRouter() == snap.readAddress(".settlementRouter"), "router mismatch");
            require(bank.vault() == snap.readAddress(string.concat(".poolVault_", suffix)), "vault mismatch");
            require(
                bank.vault().codehash == snap.readBytes32(string.concat(".codeHash_poolVault_", suffix)),
                "vault code mismatch"
            );
            require(
                SettlementRouter(bank.settlementRouter()).settlementConsumer(address(bank))
                    == snap.readAddress(".vrfHub"),
                "consumer mismatch"
            );
            require(
                bank.riskReserveBps() == snap.readUint(string.concat(".poolBankRiskReserveBps_", suffix))
                    && bank.withdrawalBufferBps()
                        == snap.readUint(string.concat(".poolBankWithdrawalBufferBps_", suffix))
                    && bank.minBetAmount() == snap.readUint(string.concat(".poolBankMinBetAmount_", suffix))
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
                && hub.refundTimeoutSeconds() == snap.readUint(".refundTimeoutSeconds"),
            "game configuration mismatch"
        );
        require(hub.LP_SHARE_BPS() == snap.readUint(".lpShareBps"), "LP share mismatch");
        // A change the bootstrap queued while it still governed would activate after the Safe takes over, and
        // anyone may activate it. The release approves only the values above, so nothing may be pending, both
        // before acceptance and in the final check after it.
        (, uint64 activatesAt) = hub.pendingEdgeChange();
        require(activatesAt == 0, "pending edge change is not part of the release");
        (uint16 l0, uint16 l1, uint16 l2, uint16 holdback) = hub.getReferralConfig(hub.activeReferralConfigId());
        require(
            l0 == snap.readUint(".refL0Bps") && l1 == snap.readUint(".refL1Bps") && l2 == snap.readUint(".refL2Bps")
                && holdback == snap.readUint(".refHoldbackBps"),
            "referral configuration mismatch"
        );
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
            require(
                hub.gameMaxBetCount(keccak256(bytes(games[i])))
                        == snap.readUint(string.concat(".gameMaxBetCount_", games[i]))
                    && hub.gameCallbackGasLimit(keccak256(bytes(games[i])))
                        == snap.readUint(string.concat(".gameCallbackGasLimit_", games[i])),
                "game admission mismatch"
            );
        }
        VRFHub vrf = VRFHub(payable(snap.readAddress(".vrfHub")));
        require(
            vrf.wrapper() == snap.readAddress(".vrfWrapper")
                && vrf.settlementRouter() == snap.readAddress(".settlementRouter"),
            "VRF configuration mismatch"
        );
    }
}
