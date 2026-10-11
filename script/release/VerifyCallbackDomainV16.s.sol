// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";
import {CertifiedRuntime} from "./CertifiedRuntime.sol";

/// @notice Fails unless a v1.6 snapshot lies inside its chain's certified first-callback domain:
///         - the certificate for that chain is accepted;
///         - every game uses the certified consumer gas and at most the certified round count;
///         - every module runs its certified runtime;
///         - every casino pool's minimum bet is at or above the floor that keeps each position's k > 0;
///         - every casino pool carries the Owner's policy values (minimum bet, risk reserve, withdrawal buffer);
///         - the VRF wrapper and every casino pool's asset are the certified provider and token.
///         script/release/verify_callback_provider.py checks the live token implementation and provider gas
///         parameters against the same file; script/release/verify_governance.py replays GameRegistered so that
///         the registered game set is exactly the certified eight. With RPC_URL set, `run` also forks the chain and
///         compares the deployed core runtimes and their immutable wiring with the certified build
///         (CertifiedRuntime; audit 2026-10-10 F-01). Without RPC_URL that part is skipped with a WARNING, or
///         refused when CALLBACK_REQUIRE_FORK=1 (the fork release gate sets it; fix review R-2).
///         Outside this domain the first-callback certificate says nothing; see
///         docs/audit/first-callback-gas-certificate-2026-10-07.md and ADR-0034 (amendment 2026-10-07).
contract VerifyCallbackDomainV16 is Script {
    using stdJson for string;

    uint256 internal constant CASINO_DOMAIN = 1; // SSOTTypes.PoolDomain.Casino

    function run() external {
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v16.json"));
        string memory snap = _readFileOrDie(snapshotPath);
        string memory domainPath = vm.envOr(
            "CALLBACK_DOMAIN_PATH",
            string.concat("script/release/first-callback-domain-", vm.toString(snap.readUint(".chainId")), ".json")
        );
        string memory dom = _readFileOrDie(domainPath);
        verify(snap, dom);
        string memory rpc = vm.envOr("RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            require(
                !vm.envOr("CALLBACK_REQUIRE_FORK", false),
                "CALLBACK_REQUIRE_FORK is set but RPC_URL is empty: deployed core runtimes cannot be verified"
            );
            console2.log("WARNING: RPC_URL not set; deployed core runtimes were NOT verified (offline mode)");
        }
        console2.log("OK v1.6 snapshot inside the certified first-callback domain");
        console2.log("snapshot:", snapshotPath);
        console2.log("domain:", domainPath);
        if (bytes(rpc).length == 0) return;
        uint256 forkBlock = vm.envOr("CALLBACK_FORK_BLOCK", uint256(0));
        if (forkBlock != 0) vm.createSelectFork(rpc, forkBlock);
        else vm.createSelectFork(rpc);
        require(block.chainid == snap.readUint(".chainId"), "RPC is on another chain");
        CertifiedRuntime.verify(snap, dom);
        console2.log("OK deployed core runtimes and wiring match the certified build at block", block.number);
    }

    function verify(string memory snap, string memory dom) public pure {
        require(dom.readUint(".chainId") == snap.readUint(".chainId"), "certificate is for another chain");
        require(
            keccak256(bytes(dom.readString(".status"))) == keccak256("CERTIFIED"),
            "first-callback certificate not accepted"
        );
        uint256 gasLimit = dom.readUint(".consumerCallbackGasLimit");
        uint256 maxCount = dom.readUint(".maxBetCountCeiling");
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
        for (uint256 g; g < games.length; ++g) {
            require(
                snap.readUint(string.concat(".gameCallbackGasLimit_", games[g])) == gasLimit,
                "callback gas limit is not the certified value"
            );
            uint256 count = snap.readUint(string.concat(".gameMaxBetCount_", games[g]));
            require(count != 0 && count <= maxCount, "round count outside the certified range");
            require(
                snap.readBytes32(string.concat(".codeHash_", modules[g]))
                    == dom.readBytes32(string.concat(".moduleCodeHashes.", modules[g])),
                "module runtime is not the certified code"
            );
        }
        require(
            snap.readAddress(".vrfWrapper") == dom.readAddress(".providerReference.wrapper"),
            "VRF wrapper is not the certified provider"
        );
        uint256 floor = dom.readUint(".casinoMinBetAmountFloor");
        uint256 policyMinBet = dom.readUint(".ownerPolicy.casinoMinBetAmount");
        uint256 policyReserve = dom.readUint(".ownerPolicy.riskReserveBps");
        uint256 policyBuffer = dom.readUint(".ownerPolicy.withdrawalBufferBps");
        require(policyMinBet >= floor, "Owner policy minimum bet below the certified floor");
        address token = dom.readAddress(".token.proxy");
        uint256 numPools = snap.readUint(".numPools");
        for (uint256 i; i < numPools; ++i) {
            string memory suffix = vm.toString(i);
            // Every pool of the release is a casino pool, so every pool lies inside the callback domain.
            require(snap.readUint(string.concat(".poolDomain_", suffix)) == CASINO_DOMAIN, "pool is not a casino pool");
            require(
                snap.readUint(string.concat(".poolBankMinBetAmount_", suffix)) >= floor,
                "casino minimum bet below the certified floor"
            );
            require(
                snap.readAddress(string.concat(".poolAsset_", suffix)) == token, "casino asset is not the certified token"
            );
            // Owner decisions, not certificate mathematics: 0.01 USDC per round, 60% retained, 10% buffer.
            require(
                snap.readUint(string.concat(".poolBankMinBetAmount_", suffix)) == policyMinBet,
                "casino minimum bet is not the Owner policy value"
            );
            require(
                snap.readUint(string.concat(".poolBankRiskReserveBps_", suffix)) == policyReserve,
                "risk reserve is not the Owner policy value"
            );
            require(
                snap.readUint(string.concat(".poolBankWithdrawalBufferBps_", suffix)) == policyBuffer,
                "withdrawal buffer is not the Owner policy value"
            );
        }
    }

    function _readFileOrDie(string memory path) internal view returns (string memory) {
        try vm.readFile(path) returns (string memory contents) {
            require(bytes(contents).length != 0, "file empty");
            return contents;
        } catch {
            revert(string.concat("missing file: ", path));
        }
    }
}
