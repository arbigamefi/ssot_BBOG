// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

/// @notice Fails unless a v1.6 snapshot lies inside its chain's certified first-callback domain:
///         - the certificate for that chain is accepted;
///         - every game uses the certified consumer gas and at most the certified round count;
///         - every module runs its certified runtime;
///         - every casino pool's minimum bet is at or above the floor that keeps each position's k > 0;
///         - the VRF wrapper and every casino pool's asset are the certified provider and token.
///         script/release/verify_callback_provider.py checks the live token implementation and provider gas
///         parameters against the same file; script/release/verify_governance.py replays GameRegistered so that
///         the registered game set is exactly the certified eight.
///         Outside this domain the first-callback certificate says nothing; see
///         docs/audit/first-callback-gas-certificate-2026-10-07.md and ADR-0034 (amendment 2026-10-07).
contract VerifyCallbackDomainV16 is Script {
    using stdJson for string;

    uint256 internal constant CASINO_DOMAIN = 1; // SSOTTypes.PoolDomain.Casino

    function run() external view {
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v16.json"));
        string memory snap = _readFileOrDie(snapshotPath);
        string memory domainPath = vm.envOr(
            "CALLBACK_DOMAIN_PATH",
            string.concat("script/release/first-callback-domain-", vm.toString(snap.readUint(".chainId")), ".json")
        );
        verify(snap, _readFileOrDie(domainPath));
        console2.log("OK v1.6 snapshot inside the certified first-callback domain");
        console2.log("snapshot:", snapshotPath);
        console2.log("domain:", domainPath);
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
        address token = dom.readAddress(".token.proxy");
        uint256 numPools = snap.readUint(".numPools");
        for (uint256 i; i < numPools; ++i) {
            string memory suffix = vm.toString(i);
            if (snap.readUint(string.concat(".poolDomain_", suffix)) == CASINO_DOMAIN) {
                require(
                    snap.readUint(string.concat(".poolBankMinBetAmount_", suffix)) >= floor,
                    "casino minimum bet below the certified floor"
                );
                require(
                    snap.readAddress(string.concat(".poolAsset_", suffix)) == token,
                    "casino asset is not the certified token"
                );
            }
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
