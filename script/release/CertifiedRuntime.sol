// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/StdJson.sol";
import {Bank} from "../../src/core/Bank.sol";
import {GameHub} from "../../src/core/GameHub.sol";
import {LiquidityVault} from "../../src/core/LiquidityVault.sol";
import {SettlementRouter} from "../../src/core/SettlementRouter.sol";
import {VRFHub} from "../../src/core/VRFHub.sol";
import {ReferralRegistry} from "../../src/engines/referral/ReferralRegistry.sol";

interface IWrapperLink {
    function link() external view returns (address);
}

/// @notice Compares the deployed core contracts of a release with the certified build recorded in the chain's
///         first-callback domain file (`coreRuntimes`, written by gen_certified_runtimes.py from the certified
///         artifacts). The first-callback certificate binds the exact bytecode of VRFHub, GameHub,
///         SettlementRouter, Bank, LiquidityVault and the referral engine, not only the eight modules; the governance
///         timelock is pinned with them (ADR-0037 §10).
///
///         For each contract the deployed code must have the certified length; every immutable slot must hold the
///         value the release snapshot assigns to it (so a constructor cannot wire a pinned runtime to a different
///         Vault, Router or asset); the slots are then zeroed and keccak256 of the rest must equal the pin, which is
///         the compiled artifact's deployed bytecode. Contracts without immutables are compared whole. The
///         constructor wiring is also read back through the public getters. Independent audit 2026-10-10, F-01.
library CertifiedRuntime {
    using stdJson for string;

    VmSafe private constant vm = VmSafe(address(uint160(uint256(keccak256("hevm cheat code")))));

    function verify(string memory snap, string memory dom) internal view {
        string memory none = "";
        _check(snap, dom, "GovernanceTimelock", snap.readAddress(".governanceTimelock"), none);
        _check(snap, dom, "VRFHub", snap.readAddress(".vrfHub"), none);
        _check(snap, dom, "GameHub", snap.readAddress(".gameHub"), none);
        _check(snap, dom, "SettlementRouter", snap.readAddress(".settlementRouter"), none);
        _check(snap, dom, "PoolRegistry", snap.readAddress(".poolRegistry"), none);
        _check(snap, dom, "ReferralRegistry", snap.readAddress(".refRegistry"), none);
        _check(snap, dom, "DefaultReferralEngine", snap.readAddress(".refEngine"), none);
        uint256 pools = snap.readUint(".numPools");
        for (uint256 i; i < pools; ++i) {
            string memory suffix = vm.toString(i);
            _check(snap, dom, "Bank", snap.readAddress(string.concat(".poolBank_", suffix)), suffix);
            _check(snap, dom, "LiquidityVault", snap.readAddress(string.concat(".poolVault_", suffix)), suffix);
        }
        _wiring(snap);
    }

    function _wiring(string memory snap) private view {
        address router = snap.readAddress(".settlementRouter");
        address game = snap.readAddress(".gameHub");
        GameHub hub = GameHub(game);
        require(
            hub.settlementRouter() == router && hub.vrfHub() == snap.readAddress(".vrfHub")
                && hub.referralRegistry() == snap.readAddress(".refRegistry")
                && hub.referralEngine() == snap.readAddress(".refEngine"),
            "GameHub wiring differs from the release"
        );
        require(
            SettlementRouter(router).poolRegistry() == snap.readAddress(".poolRegistry"),
            "Router wiring differs from the release"
        );
        VRFHub vrf = VRFHub(payable(snap.readAddress(".vrfHub")));
        require(
            vrf.settlementRouter() == router && vrf.wrapper() == snap.readAddress(".vrfWrapper"),
            "VRFHub wiring differs from the release"
        );
        require(
            ReferralRegistry(snap.readAddress(".refRegistry")).binder() == game,
            "ReferralRegistry binder is not the GameHub"
        );
        uint256 pools = snap.readUint(".numPools");
        for (uint256 i; i < pools; ++i) {
            string memory suffix = vm.toString(i);
            Bank bank = Bank(snap.readAddress(string.concat(".poolBank_", suffix)));
            address vault = snap.readAddress(string.concat(".poolVault_", suffix));
            require(
                bank.vault() == vault && bank.asset() == snap.readAddress(string.concat(".poolAsset_", suffix))
                    && bank.assetDecimals() == snap.readUint(string.concat(".poolAssetDecimals_", suffix)),
                "Bank wiring differs from the release"
            );
            require(
                LiquidityVault(vault).bank() == address(bank) && LiquidityVault(vault).asset() == bank.asset(),
                "Vault wiring differs from the release"
            );
        }
    }

    function _check(string memory snap, string memory dom, string memory name, address target, string memory suffix)
        private
        view
    {
        string memory base = string.concat(".coreRuntimes.", name);
        bytes memory code = target.code;
        require(code.length != 0, string.concat(name, " has no code"));
        require(
            code.length == dom.readUint(string.concat(base, ".runtimeBytes")),
            string.concat(name, " runtime length differs from the certified build")
        );
        for (uint256 k; vm.keyExistsJson(dom, string.concat(base, ".immutables[", vm.toString(k), "]")); ++k) {
            string memory item = string.concat(base, ".immutables[", vm.toString(k), "]");
            bytes32 expected = _expected(snap, dom.readString(string.concat(item, ".value")), suffix);
            uint256[] memory offsets = dom.readUintArray(string.concat(item, ".offsets"));
            for (uint256 j; j < offsets.length; ++j) {
                uint256 at = offsets[j];
                require(at + 32 <= code.length, string.concat(name, " immutable offset outside the code"));
                bytes32 word;
                assembly ("memory-safe") {
                    word := mload(add(add(code, 32), at))
                }
                require(word == expected, string.concat(name, " immutable value differs from the release"));
                assembly ("memory-safe") {
                    mstore(add(add(code, 32), at), 0)
                }
            }
        }
        require(
            keccak256(code) == dom.readBytes32(string.concat(base, ".keccakWithImmutablesZeroed")),
            string.concat(name, " runtime is not the certified code")
        );
    }

    /// @dev Release value of an immutable slot. Pool-scoped names resolve with the pool suffix; `wrapperLink` is
    ///      the LINK token the certified wrapper reports, which the consumer base stores at construction.
    function _expected(string memory snap, string memory value, string memory suffix) private view returns (bytes32) {
        bytes32 key = keccak256(bytes(value));
        if (key == keccak256("wrapperLink")) {
            return _word(IWrapperLink(snap.readAddress(".vrfWrapper")).link());
        }
        if (key == keccak256("poolAssetDecimals")) {
            return bytes32(snap.readUint(string.concat(".poolAssetDecimals_", suffix)));
        }
        if (key == keccak256("poolAsset") || key == keccak256("poolVault") || key == keccak256("poolBank")) {
            return _word(snap.readAddress(string.concat(".", value, "_", suffix)));
        }
        // settlementRouter, vrfHub, refRegistry, refEngine, poolRegistry, vrfWrapper
        return _word(snap.readAddress(string.concat(".", value)));
    }

    function _word(address a) private pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }
}
