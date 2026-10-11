// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {CertifiedRuntime} from "../../script/release/CertifiedRuntime.sol";
import {DeployHarnessV16, SafeConfigMockV16} from "./DeploymentV16.t.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {MockVRFV2PlusWrapper} from "../../src/mocks/MockVRFV2PlusWrapper.sol";

contract CertifiedRuntimeHarness {
    function verify(string memory snap, string memory dom) external view {
        CertifiedRuntime.verify(snap, dom);
    }
}

/// @notice The certified core runtime pins (audit 2026-10-10, F-01) against a real deployment of this build:
///         every pinned contract passes with its immutable slots holding the release values, and a changed byte,
///         a changed immutable value or a different length is rejected. This also proves the immutable slot
///         mapping that gen_certified_runtimes.py derived from the artifacts' AST-id order.
contract CertifiedRuntimeTest is Test {
    using stdJson for string;

    DeployHarnessV16 internal deployer;
    SafeConfigMockV16 internal safe;
    CertifiedRuntimeHarness internal harness;
    MockERC20 internal asset;
    address internal bootstrap;
    string internal dom;
    string internal snap;

    function setUp() public {
        bootstrap = vm.addr(0xBEEF);
        vm.deal(bootstrap, 100 ether);
        safe = new SafeConfigMockV16();
        asset = new MockERC20("Test USD", "TUSD", 6);
        deployer = new DeployHarnessV16();
        harness = new CertifiedRuntimeHarness();
        dom = vm.readFile("script/release/first-callback-domain-84532.json");
        _configureEnv();
        deployer.run();
        snap = deployer.snapshot();
    }

    function _configureEnv() internal {
        vm.setEnv("DEPLOYER", vm.toString(bootstrap));
        vm.setEnv("CHAIN_ID", vm.toString(block.chainid));
        vm.setEnv("GOV", vm.toString(address(safe)));
        vm.setEnv("GUARDIAN", vm.toString(address(77)));
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
        vm.setEnv("VRF_WRAPPER", vm.toString(address(new MockVRFV2PlusWrapper())));
        string[8] memory games =
            [string("DICE"), "COIN_TOSS", "ROULETTE", "KENO", "PLINKO", "SIC_BO", "SLOTS", "BACCARAT"];
        for (uint256 i; i < games.length; ++i) {
            vm.setEnv(string.concat("GAME_MAX_BET_COUNT_", games[i]), "25");
            vm.setEnv(string.concat("GAME_CALLBACK_GAS_LIMIT_", games[i]), "2447746");
        }
        vm.setEnv("NUM_POOLS", "2");
        vm.setEnv("BANK_MIN_BET_AMOUNT_0", "10000");
        vm.setEnv("BANK_MIN_BET_AMOUNT_1", "10000");
        vm.setEnv("POOL_ASSET_0", vm.toString(address(asset)));
        vm.setEnv("POOL_ASSET_1", vm.toString(address(asset)));
        vm.setEnv("POOL_ID_0", "1");
        vm.setEnv("POOL_ID_1", "3");
        vm.setEnv("DEFAULT_HOUSE_EDGE_BPS", "200");
        vm.setEnv("REFUND_TIMEOUT_SECONDS", "3600");
        vm.setEnv("WRITE_DRY_RUN_ARTIFACTS", "false");
    }

    function test_deploymentOfThisBuildMatchesTheCertifiedRuntimes() public view {
        harness.verify(snap, dom);
    }

    function test_everyPinnedImmutableSlotHoldsTheReleaseValue() public view {
        // Each pinned slot of each deployed core contract holds the value the release snapshot assigns to that
        // immutable, and every one of those values (the mock wrapper's LINK token included) is a nonzero word, so a
        // wrong slot mapping cannot hide behind a zero placeholder.
        _slotsMatch("vrfHub", "VRFHub", "");
        _slotsMatch("gameHub", "GameHub", "");
        _slotsMatch("settlementRouter", "SettlementRouter", "");
        _slotsMatch("poolBank_0", "Bank", "0");
        _slotsMatch("poolVault_0", "LiquidityVault", "0");
        _slotsMatch("poolBank_1", "Bank", "1");
        _slotsMatch("poolVault_1", "LiquidityVault", "1");
    }

    function _slotsMatch(string memory key, string memory name, string memory suffix) internal view {
        bytes memory code = snap.readAddress(string.concat(".", key)).code;
        string memory base = string.concat(".coreRuntimes.", name);
        for (uint256 k; vm.keyExistsJson(dom, string.concat(base, ".immutables[", vm.toString(k), "]")); ++k) {
            _slotMatches(code, name, string.concat(base, ".immutables[", vm.toString(k), "]"), suffix);
        }
    }

    function _slotMatches(bytes memory code, string memory name, string memory item, string memory suffix)
        internal
        view
    {
        string memory value = dom.readString(string.concat(item, ".value"));
        bytes32 expected = _expected(value, suffix);
        uint256[] memory offsets = dom.readUintArray(string.concat(item, ".offsets"));
        assertTrue(expected != bytes32(0), string.concat(name, ".", value, " release value is nonzero"));
        for (uint256 j; j < offsets.length; ++j) {
            assertEq(_wordAt(code, offsets[j]), expected, string.concat(name, ".", value));
        }
    }

    function _wordAt(bytes memory code, uint256 at) internal pure returns (bytes32 word) {
        assembly ("memory-safe") {
            word := mload(add(add(code, 32), at))
        }
    }

    function _expected(string memory value, string memory suffix) internal view returns (bytes32) {
        bytes32 key = keccak256(bytes(value));
        if (key == keccak256("wrapperLink")) {
            return bytes32(uint256(uint160(MockVRFV2PlusWrapper(snap.readAddress(".vrfWrapper")).link())));
        }
        if (key == keccak256("poolAssetDecimals")) {
            return bytes32(snap.readUint(string.concat(".poolAssetDecimals_", suffix)));
        }
        if (key == keccak256("poolAsset") || key == keccak256("poolVault") || key == keccak256("poolBank")) {
            return bytes32(uint256(uint160(snap.readAddress(string.concat(".", value, "_", suffix)))));
        }
        return bytes32(uint256(uint160(snap.readAddress(string.concat(".", value)))));
    }

    function test_rejectsAChangedByteInACoreRuntime() public {
        address game = snap.readAddress(".gameHub");
        bytes memory code = game.code;
        // Flip the last byte of the metadata hash: same length, same immutables, different code.
        code[code.length - 1] = bytes1(uint8(code[code.length - 1]) ^ 0x01);
        vm.etch(game, code);
        vm.expectRevert(bytes("GameHub runtime is not the certified code"));
        harness.verify(snap, dom);
    }

    function test_rejectsAChangedImmutableValue() public {
        // A pinned Vault runtime wired to a different asset: the constructor is not pinned, the slot value is.
        address vault = snap.readAddress(".poolVault_0");
        bytes memory code = vault.code;
        uint256 at = dom.readUintArray(".coreRuntimes.LiquidityVault.immutables[0].offsets")[0];
        bytes32 other = bytes32(uint256(uint160(address(0xBAD))));
        assembly ("memory-safe") {
            mstore(add(add(code, 32), at), other)
        }
        vm.etch(vault, code);
        vm.expectRevert(bytes("LiquidityVault immutable value differs from the release"));
        harness.verify(snap, dom);
    }

    function test_rejectsADifferentRuntimeLength() public {
        address router = snap.readAddress(".settlementRouter");
        vm.etch(router, abi.encodePacked(router.code, hex"00"));
        vm.expectRevert(bytes("SettlementRouter runtime length differs from the certified build"));
        harness.verify(snap, dom);
    }

    function test_rejectsAMissingContract() public {
        vm.etch(snap.readAddress(".refEngine"), "");
        vm.expectRevert(bytes("DefaultReferralEngine has no code"));
        harness.verify(snap, dom);
    }
}
