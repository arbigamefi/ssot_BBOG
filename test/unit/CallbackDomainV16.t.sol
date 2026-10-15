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
        uint256 secondMinBet;
        uint256 secondDomain;
        address wrapper;
        address casinoAsset;
        uint256 riskReserveBps;
        uint256 withdrawalBufferBps;
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
    /// The committed domain, certified since the independent review accepted certificate v5 (2026-10-15).
    string internal committed;
    /// The committed domain as it read before that review, to exercise the refusal of an unaccepted certificate.
    string internal pending;
    uint256 internal nonce;

    function setUp() public {
        verifier = new VerifyCallbackDomainV16();
        committed = vm.readFile("script/release/first-callback-domain-84532.json");
        pending = vm.replace(committed, '"status": "CERTIFIED"', '"status": "PENDING_INDEPENDENT_REVIEW"');
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
            10_000,
            1,
            committed.readAddress(".providerReference.wrapper"),
            committed.readAddress(".token.proxy"),
            6000,
            1000
        );
    }

    /// A snapshot with the release keys the verifier reads: two casino pools.
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
        vm.serializeUint(obj, "poolBankRiskReserveBps_0", s.riskReserveBps);
        vm.serializeUint(obj, "poolBankWithdrawalBufferBps_0", s.withdrawalBufferBps);
        vm.serializeAddress(obj, "poolAsset_0", s.casinoAsset);
        vm.serializeUint(obj, "poolDomain_1", s.secondDomain);
        vm.serializeUint(obj, "poolBankRiskReserveBps_1", s.riskReserveBps);
        vm.serializeUint(obj, "poolBankWithdrawalBufferBps_1", s.withdrawalBufferBps);
        vm.serializeAddress(obj, "poolAsset_1", s.casinoAsset);
        json = vm.serializeUint(obj, "poolBankMinBetAmount_1", s.secondMinBet);
    }

    function _rejects(Snap memory s, string memory dom, string memory reason) internal {
        string memory snap = _json(s);
        vm.expectRevert(bytes(reason));
        verifier.verify(snap, dom);
    }

    function test_committedDomainPinsCurrentModuleRuntimesAndParameters() public view {
        assertEq(committed.readUint(".chainId"), 84532);
        // Certificate v5 covers the launch candidate's runtimes; its independent review accepted it on 2026-10-15.
        assertEq(committed.readString(".status"), "CERTIFIED");
        assertEq(
            committed.readString(".certificateSeal.sha256"),
            "5726389a84ea2348d3801328914e2cbf85354314bde83466cbce9d078f79f674"
        );
        assertEq(committed.readUint(".consumerCallbackGasLimit"), 2_447_746);
        assertEq(committed.readUint(".maxBetCountCeiling"), 25);
        assertEq(committed.readUint(".casinoMinBetAmountFloor"), 99);
        assertEq(committed.readUint(".ownerPolicy.casinoMinBetAmount"), 10_000);
        assertEq(committed.readUint(".ownerPolicy.riskReserveBps"), 6000);
        assertEq(committed.readUint(".ownerPolicy.withdrawalBufferBps"), 1000);
        bytes32[8] memory h = _runtimeHashes();
        for (uint256 g; g < modules.length; ++g) {
            assertEq(committed.readBytes32(string.concat(".moduleCodeHashes.", modules[g])), h[g], modules[g]);
        }
    }

    /// The core pins are the compiled artifacts of this build: hash, length and the immutable slot layout. The set of
    /// pinned offsets equals the set of immutable references in the artifact (fix review I-1), and the artifact holds
    /// a zero placeholder at each of them.
    function test_committedDomainPinsCurrentCoreRuntimes() public view {
        string[8] memory core = [
            string("VRFHub"),
            "GameHub",
            "SettlementRouter",
            "PoolRegistry",
            "ReferralRegistry",
            "DefaultReferralEngine",
            "Bank",
            "LiquidityVault"
        ];
        for (uint256 c; c < core.length; ++c) {
            string memory base = string.concat(".coreRuntimes.", core[c]);
            bytes memory compiled = vm.getDeployedCode(committed.readString(string.concat(base, ".artifact")));
            assertEq(
                keccak256(compiled), committed.readBytes32(string.concat(base, ".keccakWithImmutablesZeroed")), core[c]
            );
            assertEq(compiled.length, committed.readUint(string.concat(base, ".runtimeBytes")), core[c]);
            uint256[] memory expected =
                _sorted(_artifactSlots(vm.readFile(string.concat("out/", core[c], ".sol/", core[c], ".json"))));
            uint256[] memory pinned = _sorted(_pinnedSlots(base));
            assertEq(pinned.length, expected.length, string.concat(core[c], " immutable slot count"));
            for (uint256 i; i < expected.length; ++i) {
                assertEq(pinned[i], expected[i], string.concat(core[c], " immutable slot offsets"));
                if (i != 0) assertTrue(expected[i] != expected[i - 1], "artifact slots are distinct");
                bytes32 word;
                uint256 at = expected[i];
                assembly ("memory-safe") {
                    word := mload(add(add(compiled, 32), at))
                }
                assertEq(word, bytes32(0), "artifact has a placeholder at every pinned slot");
            }
        }
    }

    /// Every `start` of every immutable reference in a compiled artifact; each reference is one 32-byte word.
    function _artifactSlots(string memory artifact) internal view returns (uint256[] memory slots) {
        if (!vm.keyExistsJson(artifact, ".deployedBytecode.immutableReferences")) return slots;
        string[] memory ids = vm.parseJsonKeys(artifact, ".deployedBytecode.immutableReferences");
        uint256 n;
        for (uint256 pass; pass < 2; ++pass) {
            if (pass == 1) slots = new uint256[](n);
            n = 0;
            for (uint256 i; i < ids.length; ++i) {
                string memory refs = string.concat(".deployedBytecode.immutableReferences.", ids[i]);
                for (uint256 r; vm.keyExistsJson(artifact, string.concat(refs, "[", vm.toString(r), "]")); ++r) {
                    string memory item = string.concat(refs, "[", vm.toString(r), "]");
                    assertEq(vm.parseJsonUint(artifact, string.concat(item, ".length")), 32, "immutable slots are one word");
                    if (pass == 1) slots[n] = vm.parseJsonUint(artifact, string.concat(item, ".start"));
                    ++n;
                }
            }
        }
    }

    /// Every offset the domain file pins for one core contract.
    function _pinnedSlots(string memory base) internal view returns (uint256[] memory slots) {
        uint256 n;
        for (uint256 pass; pass < 2; ++pass) {
            if (pass == 1) slots = new uint256[](n);
            n = 0;
            for (uint256 k; vm.keyExistsJson(committed, string.concat(base, ".immutables[", vm.toString(k), "]")); ++k) {
                uint256[] memory offsets =
                    committed.readUintArray(string.concat(base, ".immutables[", vm.toString(k), "].offsets"));
                for (uint256 j; j < offsets.length; ++j) {
                    if (pass == 1) slots[n] = offsets[j];
                    ++n;
                }
            }
        }
    }

    function _sorted(uint256[] memory a) internal pure returns (uint256[] memory) {
        for (uint256 i = 1; i < a.length; ++i) {
            uint256 v = a[i];
            uint256 j = i;
            while (j > 0 && a[j - 1] > v) {
                a[j] = a[j - 1];
                --j;
            }
            a[j] = v;
        }
        return a;
    }

    /// The seals the domain file cites, the certificate's and its independent review's, are copied into the
    /// repository, so the citations are checkable without dist/.
    function test_committedDomainCitesTheSealedCertificateAndItsReview() public view {
        string memory seal = vm.readFile("script/release/certificates/first-callback-v5/CERTIFICATE-v5.sha256");
        assertEq(
            sha256(bytes(seal)), vm.parseBytes32(string.concat("0x", committed.readString(".certificateSeal.sha256")))
        );
        assertEq(committed.readString(".certificateSeal.version"), "v5");
        string memory review =
            vm.readFile("script/release/certificates/first-callback-v5/independent-review.MANIFEST.sha256");
        assertEq(
            sha256(bytes(review)),
            vm.parseBytes32(string.concat("0x", committed.readString(".certificateSeal.reviewSha256")))
        );
        assertEq(
            committed.readString(".certificateSeal.review"),
            "independent-review-certificate-v5-2026-10-15/MANIFEST.sha256"
        );
        assertEq(committed.readString(".certificateSeal.certifiedOn"), "2026-10-15");
    }

    function test_snapshotInsideCertifiedDomainPasses() public {
        verifier.verify(_json(_good()), committed);
        Snap memory s = _good();
        s.kenoRounds = 1;
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
        s.casinoMinBet = 99; // k > 0 still holds, but the Owner fixed 0.01 USDC per round (audit F-02)
        _rejects(s, committed, "casino minimum bet is not the Owner policy value");
        s = _good();
        s.riskReserveBps = 0;
        _rejects(s, committed, "risk reserve is not the Owner policy value");
        s = _good();
        s.withdrawalBufferBps = 999;
        _rejects(s, committed, "withdrawal buffer is not the Owner policy value");
        s = _good();
        s.wrapper = address(0xBAD);
        _rejects(s, committed, "VRF wrapper is not the certified provider");
        s = _good();
        s.casinoAsset = address(0xBAD);
        _rejects(s, committed, "casino asset is not the certified token");
        s = _good();
        s.secondDomain = 0; // every pool must be a casino pool, so none escapes these checks
        _rejects(s, committed, "pool is not a casino pool");
        s = _good();
        s.secondMinBet = 99;
        _rejects(s, committed, "casino minimum bet is not the Owner policy value");
    }
}
