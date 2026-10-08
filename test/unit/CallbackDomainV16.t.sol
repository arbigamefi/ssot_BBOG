// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import "forge-std/StdJson.sol";
import {VerifyCallbackDomainV16} from "../../script/release/VerifyCallbackDomainV16.s.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";
import {PlinkoModule} from "../../src/modules/plinko/PlinkoModule.sol";
import {SicBoModule} from "../../src/modules/sicbo/SicBoModule.sol";
import {SlotsModule} from "../../src/modules/slots/SlotsModule.sol";
import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";

/// Release verification must reject any snapshot outside the certified first-callback domain (ADR-0034 amendment
/// 2026-10-07, condition K0-2), and the committed domain table must pin today's module runtimes.
contract CallbackDomainV16Test is Test {
    using stdJson for string;

    struct Snap {
        uint256 chainId;
        uint256 gasLimit;
        uint256 kenoRounds;
        bytes32 kenoCode;
        uint256 casinoMinBet;
        uint256 sportsMinBet;
        address wrapper;
        address casinoAsset;
    }

    string[8] internal games =
        [string("DICE"), "COIN_TOSS", "ROULETTE", "KENO", "PLINKO", "SIC_BO", "SLOTS", "BACCARAT"];
    string[8] internal modules = [
        string("moduleDice"),
        "moduleCoinToss",
        "moduleRoulette",
        "moduleKeno",
        "modulePlinko",
        "moduleSicBo",
        "moduleSlots",
        "moduleBaccarat"
    ];
    VerifyCallbackDomainV16 internal verifier;
    string internal committed;
    string internal pending;
    uint256 internal nonce;

    function setUp() public {
        verifier = new VerifyCallbackDomainV16();
        committed = vm.readFile("script/release/first-callback-domain-84532.json");
        pending = vm.replace(committed, "CERTIFIED", "PENDING_INDEPENDENT_REVIEW");
    }

    function _runtimeHashes() internal pure returns (bytes32[8] memory h) {
        h[0] = keccak256(type(DiceModule).runtimeCode);
        h[1] = keccak256(type(CoinTossModule).runtimeCode);
        h[2] = keccak256(type(RouletteModule).runtimeCode);
        h[3] = keccak256(type(KenoModule).runtimeCode);
        h[4] = keccak256(type(PlinkoModule).runtimeCode);
        h[5] = keccak256(type(SicBoModule).runtimeCode);
        h[6] = keccak256(type(SlotsModule).runtimeCode);
        h[7] = keccak256(type(BaccaratModule).runtimeCode);
    }

    function _good() internal view returns (Snap memory) {
        return Snap(
            84532,
            2_447_746,
            25,
            bytes32(0),
            10_000,
            1,
            committed.readAddress(".providerReference.wrapper"),
            committed.readAddress(".token.proxy")
        );
    }

    /// A snapshot with the release keys the verifier reads: one casino pool and one sports pool.
    function _json(Snap memory s) internal returns (string memory json) {
        string memory obj = string.concat("snap", vm.toString(++nonce));
        bytes32[8] memory h = _runtimeHashes();
        vm.serializeUint(obj, "chainId", s.chainId);
        vm.serializeAddress(obj, "vrfWrapper", s.wrapper);
        for (uint256 g; g < games.length; ++g) {
            bool keno = g == 3;
            vm.serializeUint(obj, string.concat("gameCallbackGasLimit_", games[g]), s.gasLimit);
            vm.serializeUint(obj, string.concat("gameMaxBetCount_", games[g]), keno ? s.kenoRounds : 25);
            vm.serializeBytes32(
                obj, string.concat("codeHash_", modules[g]), keno && s.kenoCode != 0 ? s.kenoCode : h[g]
            );
        }
        vm.serializeUint(obj, "numPools", 2);
        vm.serializeUint(obj, "poolDomain_0", 1);
        vm.serializeUint(obj, "poolBankMinBetAmount_0", s.casinoMinBet);
        vm.serializeAddress(obj, "poolAsset_0", s.casinoAsset);
        vm.serializeUint(obj, "poolDomain_1", 2);
        vm.serializeAddress(obj, "poolAsset_1", address(0xB0B)); // sports pools are outside the callback domain
        json = vm.serializeUint(obj, "poolBankMinBetAmount_1", s.sportsMinBet);
    }

    function _rejects(Snap memory s, string memory dom, string memory reason) internal {
        string memory snap = _json(s);
        vm.expectRevert(bytes(reason));
        verifier.verify(snap, dom);
    }

    function test_committedDomainPinsCurrentModuleRuntimesAndParameters() public view {
        assertEq(committed.readUint(".chainId"), 84532);
        assertEq(committed.readString(".status"), "CERTIFIED");
        assertEq(
            committed.readString(".certificateSeal.sha256"),
            "d67a7083a9f3676514339432cc5f690d3cc4de0253935d431c8d9631f8873491"
        );
        assertEq(committed.readUint(".consumerCallbackGasLimit"), 2_447_746);
        assertEq(committed.readUint(".maxBetCountCeiling"), 25);
        assertEq(committed.readUint(".casinoMinBetAmountFloor"), 99);
        bytes32[8] memory h = _runtimeHashes();
        for (uint256 g; g < modules.length; ++g) {
            assertEq(committed.readBytes32(string.concat(".moduleCodeHashes.", modules[g])), h[g], modules[g]);
        }
    }

    function test_snapshotInsideCertifiedDomainPasses() public {
        verifier.verify(_json(_good()), committed);
        Snap memory s = _good();
        s.kenoRounds = 1;
        s.casinoMinBet = 99; // Dice's tightest coefficient 100/99 still leaves r > s
        s.sportsMinBet = 0; // no VRF callback on sports positions
        verifier.verify(_json(s), committed);
    }

    function test_pendingCertificateFailsReleaseVerification() public {
        _rejects(_good(), pending, "first-callback certificate not accepted");
    }

    function test_rejectsEveryDomainViolation() public {
        Snap memory s = _good();
        s.chainId = 8453; // the Sepolia certificate does not carry over to Base mainnet
        _rejects(s, committed, "certificate is for another chain");
        s = _good();
        s.gasLimit = 2_447_745;
        _rejects(s, committed, "callback gas limit is not the certified value");
        s = _good();
        s.kenoRounds = 26;
        _rejects(s, committed, "round count outside the certified range");
        s = _good();
        s.kenoRounds = 0;
        _rejects(s, committed, "round count outside the certified range");
        s = _good();
        s.kenoCode = keccak256("replacement module");
        _rejects(s, committed, "module runtime is not the certified code");
        s = _good();
        s.casinoMinBet = 98;
        _rejects(s, committed, "casino minimum bet below the certified floor");
        s = _good();
        s.wrapper = address(0xBAD);
        _rejects(s, committed, "VRF wrapper is not the certified provider");
        s = _good();
        s.casinoAsset = address(0xBAD);
        _rejects(s, committed, "casino asset is not the certified token");
    }
}
