// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import {SportsHub} from "../../src/core/SportsHub.sol";

/// @notice Configure operational SportsHub roles on an existing v1.3 deployment.
/// @dev Reads deployments/latest-v13.json by default. Broadcast with BROADCAST=1 in the wrapper.
contract SportsRolesV13 is Script {
    using stdJson for string;

    struct RoleConfig {
        uint256 govPrivateKey;
        address gov;
        SportsHub sportsHub;
        address oddsSigner;
        address resultReporter;
        address resultChallenger;
        address resultArbitrator;
        bytes32 oddsSignerSetHash;
        bytes32 resultReporterSetHash;
        uint8 resultReporterThreshold;
        bool revokeGovSportsRoles;
    }

    function run() external {
        RoleConfig memory cfg = _readConfig();

        _logConfig(cfg);
        _broadcastRoles(cfg);
        _validateRoles(cfg);
    }

    function _readConfig() internal view returns (RoleConfig memory cfg) {
        cfg.govPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory snapshotPath = vm.envOr("SNAPSHOT_PATH", string("deployments/latest-v13.json"));
        string memory json = vm.readFile(snapshotPath);

        cfg.sportsHub = SportsHub(json.readAddress(".sportsHub"));
        cfg.gov = cfg.sportsHub.governance();

        cfg.oddsSigner = vm.envAddress("SPORTS_ODDS_SIGNER");
        cfg.resultReporter = vm.envAddress("SPORTS_RESULT_REPORTER");
        cfg.resultChallenger = vm.envAddress("SPORTS_RESULT_CHALLENGER");
        cfg.resultArbitrator = vm.envAddress("SPORTS_RESULT_ARBITRATOR");
        if (
            cfg.oddsSigner == address(0) || cfg.resultReporter == address(0) || cfg.resultChallenger == address(0)
                || cfg.resultArbitrator == address(0)
        ) {
            revert("missing sports role address");
        }

        uint256 threshold =
            vm.envOr("SPORTS_RESULT_REPORTER_THRESHOLD", uint256(cfg.sportsHub.resultReporterThreshold()));
        if (threshold == 0 || threshold > type(uint8).max) revert("bad reporter threshold");
        cfg.resultReporterThreshold = uint8(threshold);

        cfg.oddsSignerSetHash =
            vm.envOr("SPORTS_ODDS_SIGNER_SET_HASH", _defaultOddsSignerSetHash(cfg.sportsHub, cfg.oddsSigner));
        cfg.resultReporterSetHash = vm.envOr(
            "SPORTS_RESULT_REPORTER_SET_HASH",
            _defaultResultReporterSetHash(cfg.sportsHub, cfg.resultReporter, cfg.resultReporterThreshold)
        );
        cfg.revokeGovSportsRoles = vm.envOr("SPORTS_REVOKE_GOV_SPORTS_ROLES", false);
    }

    function _logConfig(RoleConfig memory cfg) internal view {
        console2.log("Sports role rotation:");
        console2.log("  gov", cfg.gov);
        console2.log("  broadcaster", vm.addr(cfg.govPrivateKey));
        console2.log("  sportsHub", address(cfg.sportsHub));
        console2.log("  oddsSigner", cfg.oddsSigner);
        console2.log("  resultReporter", cfg.resultReporter);
        console2.log("  resultChallenger", cfg.resultChallenger);
        console2.log("  resultArbitrator", cfg.resultArbitrator);
        console2.log("  resultReporterThreshold", cfg.resultReporterThreshold);
        console2.log("  revokeGovSportsRoles", cfg.revokeGovSportsRoles);
        console2.log("  oddsSignerSetHash");
        console2.logBytes32(cfg.oddsSignerSetHash);
        console2.log("  resultReporterSetHash");
        console2.logBytes32(cfg.resultReporterSetHash);
    }

    function _broadcastRoles(RoleConfig memory cfg) internal {
        require(vm.addr(cfg.govPrivateKey) == cfg.gov, "PRIVATE_KEY is not SportsHub governance");

        vm.startBroadcast(cfg.govPrivateKey);

        if (cfg.sportsHub.oddsSignerSetHash() != cfg.oddsSignerSetHash) {
            cfg.sportsHub.setOddsSignerSetHash(cfg.oddsSignerSetHash);
        }
        if (cfg.sportsHub.resultReporterSetHash() != cfg.resultReporterSetHash) {
            cfg.sportsHub.setResultReporterSetHash(cfg.resultReporterSetHash);
        }
        if (cfg.sportsHub.resultReporterThreshold() != cfg.resultReporterThreshold) {
            cfg.sportsHub.setResultReporterThreshold(cfg.resultReporterThreshold);
        }

        if (!cfg.sportsHub.oddsSigner(cfg.oddsSigner)) {
            cfg.sportsHub.setOddsSigner(cfg.oddsSigner, true);
        }
        if (!cfg.sportsHub.resultReporter(cfg.resultReporter)) {
            cfg.sportsHub.setResultReporter(cfg.resultReporter, true);
        }
        if (!cfg.sportsHub.resultChallenger(cfg.resultChallenger)) {
            cfg.sportsHub.setResultChallenger(cfg.resultChallenger, true);
        }
        if (!cfg.sportsHub.resultArbitrator(cfg.resultArbitrator)) {
            cfg.sportsHub.setResultArbitrator(cfg.resultArbitrator, true);
        }

        if (cfg.revokeGovSportsRoles) {
            if (cfg.gov != cfg.oddsSigner && cfg.sportsHub.oddsSigner(cfg.gov)) {
                cfg.sportsHub.setOddsSigner(cfg.gov, false);
            }
            if (cfg.gov != cfg.resultReporter && cfg.sportsHub.resultReporter(cfg.gov)) {
                cfg.sportsHub.setResultReporter(cfg.gov, false);
            }
            if (cfg.gov != cfg.resultChallenger && cfg.sportsHub.resultChallenger(cfg.gov)) {
                cfg.sportsHub.setResultChallenger(cfg.gov, false);
            }
            if (cfg.gov != cfg.resultArbitrator && cfg.sportsHub.resultArbitrator(cfg.gov)) {
                cfg.sportsHub.setResultArbitrator(cfg.gov, false);
            }
        }

        vm.stopBroadcast();
    }

    function _validateRoles(RoleConfig memory cfg) internal view {
        require(cfg.sportsHub.oddsSignerSetHash() == cfg.oddsSignerSetHash, "odds signer set hash mismatch");
        require(cfg.sportsHub.resultReporterSetHash() == cfg.resultReporterSetHash, "result reporter set hash mismatch");
        require(cfg.sportsHub.resultReporterThreshold() == cfg.resultReporterThreshold, "reporter threshold mismatch");
        require(cfg.sportsHub.oddsSigner(cfg.oddsSigner), "odds signer not set");
        require(cfg.sportsHub.resultReporter(cfg.resultReporter), "result reporter not set");
        require(cfg.sportsHub.resultChallenger(cfg.resultChallenger), "result challenger not set");
        require(cfg.sportsHub.resultArbitrator(cfg.resultArbitrator), "result arbitrator not set");
        if (cfg.revokeGovSportsRoles) {
            require(!cfg.sportsHub.oddsSigner(cfg.gov), "gov odds signer still set");
            require(!cfg.sportsHub.resultReporter(cfg.gov), "gov result reporter still set");
            require(!cfg.sportsHub.resultChallenger(cfg.gov), "gov challenger mapping still set");
            require(!cfg.sportsHub.resultArbitrator(cfg.gov), "gov arbitrator mapping still set");
        }

        console2.log("  postOddsSignerSetHash");
        console2.logBytes32(cfg.sportsHub.oddsSignerSetHash());
        console2.log("  postResultReporterSetHash");
        console2.logBytes32(cfg.sportsHub.resultReporterSetHash());
        console2.log("  postReporterThreshold", cfg.sportsHub.resultReporterThreshold());
        console2.log("  postGovOddsSigner", cfg.sportsHub.oddsSigner(cfg.gov));
        console2.log("  postGovResultReporter", cfg.sportsHub.resultReporter(cfg.gov));
        console2.log("  postGovResultChallengerMapping", cfg.sportsHub.resultChallenger(cfg.gov));
        console2.log("  postGovResultArbitratorMapping", cfg.sportsHub.resultArbitrator(cfg.gov));
    }

    function _defaultOddsSignerSetHash(SportsHub sportsHub, address oddsSigner) internal view returns (bytes32) {
        return
            keccak256(abi.encodePacked("BASE_SEPOLIA_SPORTS_ODDS_SIGNER_SET_V1", block.chainid, sportsHub, oddsSigner));
    }

    function _defaultResultReporterSetHash(SportsHub sportsHub, address reporter, uint8 threshold)
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                "BASE_SEPOLIA_SPORTS_RESULT_REPORTER_SET_V1", block.chainid, sportsHub, reporter, threshold
            )
        );
    }
}
