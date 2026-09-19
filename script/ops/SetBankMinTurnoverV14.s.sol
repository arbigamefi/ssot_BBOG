// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

interface IERC20SetBankMinTurnoverV14 {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

interface IBankSetBankMinTurnoverV14 {
    function asset() external view returns (address);
    function governance() external view returns (address);
    function decimals() external view returns (uint8);
    function minPlayerTurnoverForUnlock() external view returns (uint256);
    function xpLockedTotal() external view returns (uint256);
    function setMinPlayerTurnoverForUnlock(uint256 turnover_) external;
}

/// @notice Governance op: retune one deployed v1.4 Bank's `minPlayerTurnoverForUnlock`.
///
/// @dev The value is in RAW ASSET UNITS, so it must be rescaled per pool. Writing
///      an 18-decimal literal onto a 6-decimal asset raises the threshold by 1e12
///      and no player ever crosses it, which leaves every referral award stuck in
///      the locked bucket (still counted as XP liability, so it also depresses LP
///      NAV). `_preflight` refuses values whose scaled magnitude is implausible.
///
///      Lowering the threshold is retroactive: `unlockXPLocked` is permissionless
///      and reads the current value, so already-locked awards become sweepable
///      immediately afterwards. See docs/ops/runbooks/bank-min-turnover-retune.md.
///
/// Required env:
///   PRIVATE_KEY              must be the Bank's current governance
///   MIN_TURNOVER_POOL_ID
///   MIN_TURNOVER_VALUE       raw asset units (USDC 20.0 => 20000000)
///
/// Optional env:
///   SNAPSHOT_PATH            defaults to deployments/latest-v14.json
///                            (that pointer is Base Sepolia — pass the mainnet
///                             snapshot explicitly for chain 8453)
///   MIN_TURNOVER_MAX_UNITS   plausibility ceiling in whole units, default 1000000
contract SetBankMinTurnoverV14 is Script {
    using stdJson for string;

    string internal constant DEFAULT_SNAPSHOT_PATH = "deployments/latest-v14.json";
    uint256 internal constant DEFAULT_MAX_UNITS = 1_000_000;

    struct Config {
        string snapshotPath;
        uint256 snapshotChainId;
        uint256 privateKey;
        address broadcaster;
        PoolRegistry poolRegistry;
        uint64 poolId;
        address asset;
        address bank;
        string assetSymbol;
        uint8 assetDecimals;
        uint256 newValue;
        uint256 maxUnits;
    }

    function run() external {
        Config memory cfg = _readConfig();
        _logConfig(cfg);
        _preflight(cfg);

        uint256 before = IBankSetBankMinTurnoverV14(cfg.bank).minPlayerTurnoverForUnlock();

        vm.startBroadcast(cfg.privateKey);
        IBankSetBankMinTurnoverV14(cfg.bank).setMinPlayerTurnoverForUnlock(cfg.newValue);
        vm.stopBroadcast();

        uint256 afterValue = IBankSetBankMinTurnoverV14(cfg.bank).minPlayerTurnoverForUnlock();
        require(afterValue == cfg.newValue, "minPlayerTurnoverForUnlock not applied");

        console2.log("minTurnoverBefore", before);
        console2.log("minTurnoverAfter", afterValue);
        console2.log("xpLockedTotal", IBankSetBankMinTurnoverV14(cfg.bank).xpLockedTotal());
        console2.log("NOTE: sweep locked awards with unlockXPLocked(payee, sourcePlayer)");
    }

    function _readConfig() internal view returns (Config memory cfg) {
        cfg.snapshotPath = vm.envOr("SNAPSHOT_PATH", DEFAULT_SNAPSHOT_PATH);
        string memory snap = vm.readFile(cfg.snapshotPath);

        cfg.snapshotChainId = snap.readUint(".chainId");
        cfg.privateKey = vm.envUint("PRIVATE_KEY");
        cfg.broadcaster = vm.addr(cfg.privateKey);
        cfg.poolRegistry = PoolRegistry(snap.readAddress(".poolRegistry"));
        cfg.poolId = uint64(vm.envUint("MIN_TURNOVER_POOL_ID"));
        cfg.newValue = vm.envUint("MIN_TURNOVER_VALUE");
        cfg.maxUnits = vm.envOr("MIN_TURNOVER_MAX_UNITS", DEFAULT_MAX_UNITS);

        uint256 poolCount = snap.readUint(".numPools");
        bool found;
        for (uint256 i; i < poolCount; i += 1) {
            string memory suffix = vm.toString(i);
            if (uint64(snap.readUint(string.concat(".poolId_", suffix))) == cfg.poolId) {
                cfg.asset = snap.readAddress(string.concat(".poolAsset_", suffix));
                cfg.bank = snap.readAddress(string.concat(".poolBank_", suffix));
                cfg.assetSymbol = snap.readString(string.concat(".poolAssetSymbol_", suffix));
                cfg.assetDecimals = uint8(snap.readUint(string.concat(".poolAssetDecimals_", suffix)));
                found = true;
                break;
            }
        }
        require(found, "MIN_TURNOVER_POOL_ID not found in snapshot");

        // Checked here rather than in _preflight so that _logConfig, which runs
        // first to keep diagnostics available on a failed run, never calls into
        // a zero address and reverts with an opaque decode error.
        require(cfg.poolId != 0, "MIN_TURNOVER_POOL_ID required");
        require(address(cfg.poolRegistry) != address(0), "poolRegistry missing");
        require(cfg.asset != address(0), "asset missing");
        require(cfg.bank != address(0), "bank missing");
    }

    function _preflight(Config memory cfg) internal view {
        require(block.chainid == cfg.snapshotChainId, "RPC chain does not match snapshot chainId");

        SSOTTypes.Pool memory pool = cfg.poolRegistry.pool(cfg.poolId);
        require(pool.domain == SSOTTypes.PoolDomain.Casino, "not a casino pool");
        require(pool.asset == cfg.asset, "registry asset mismatch");
        require(pool.bank == cfg.bank, "registry bank mismatch");
        require(IBankSetBankMinTurnoverV14(cfg.bank).asset() == cfg.asset, "bank asset mismatch");

        // Decimals drive the whole rescaling argument, so prove them on chain
        // instead of trusting the snapshot.
        uint8 onChainDecimals = IERC20SetBankMinTurnoverV14(cfg.asset).decimals();
        require(onChainDecimals == cfg.assetDecimals, "snapshot asset decimals mismatch");
        require(
            IBankSetBankMinTurnoverV14(cfg.bank).decimals() == onChainDecimals,
            "bank share decimals mismatch"
        );

        require(
            IBankSetBankMinTurnoverV14(cfg.bank).governance() == cfg.broadcaster,
            "broadcaster is not Bank governance"
        );

        uint256 current = IBankSetBankMinTurnoverV14(cfg.bank).minPlayerTurnoverForUnlock();
        require(cfg.newValue != current, "MIN_TURNOVER_VALUE already set");

        // Refuse to write another cross-decimals literal.
        uint256 scaledUnits = cfg.newValue / (10 ** uint256(onChainDecimals));
        require(scaledUnits <= cfg.maxUnits, "MIN_TURNOVER_VALUE implausible for this asset decimals");
    }

    /// @dev Renders raw units as a decimal string. Integer division alone would
    ///      print a sub-unit threshold such as 0.005 WETH as "0", which on a
    ///      governance confirmation screen reads as "the gate is being disabled".
    function _formatUnits(uint256 value, uint8 decimals) internal pure returns (string memory) {
        uint256 scale = 10 ** uint256(decimals);
        uint256 whole = value / scale;
        uint256 frac = value % scale;
        if (frac == 0) return vm.toString(whole);

        bytes memory digits = bytes(vm.toString(frac));
        bytes memory padded = new bytes(decimals);
        uint256 lead = uint256(decimals) - digits.length;
        for (uint256 i = 0; i < lead; i += 1) {
            padded[i] = "0";
        }
        for (uint256 i = 0; i < digits.length; i += 1) {
            padded[lead + i] = digits[i];
        }

        uint256 end = padded.length;
        while (end > 0 && padded[end - 1] == "0") {
            end -= 1;
        }
        bytes memory trimmed = new bytes(end);
        for (uint256 i = 0; i < end; i += 1) {
            trimmed[i] = padded[i];
        }

        return string.concat(vm.toString(whole), ".", string(trimmed));
    }

    function _logConfig(Config memory cfg) internal view {
        console2.log("snapshot:", cfg.snapshotPath);
        console2.log("chainId:", block.chainid);
        console2.log("broadcaster:", cfg.broadcaster);
        console2.log("poolId:", cfg.poolId);
        console2.log("asset:", cfg.asset);
        console2.log("assetSymbol:", cfg.assetSymbol);
        console2.log("assetDecimals:", cfg.assetDecimals);
        console2.log("bank:", cfg.bank);
        console2.log("bankGovernance:", IBankSetBankMinTurnoverV14(cfg.bank).governance());
        // The snapshot's own value is deliberately not trusted here: it is the
        // artifact that carried the bad literal in the first place. Read the
        // Bank instead.
        uint256 current = IBankSetBankMinTurnoverV14(cfg.bank).minPlayerTurnoverForUnlock();
        console2.log("currentMinTurnover:", current);
        console2.log(
            string.concat(
                "  currentMinTurnoverUnits: ", _formatUnits(current, cfg.assetDecimals), " ", cfg.assetSymbol
            )
        );
        console2.log("newMinTurnover:", cfg.newValue);
        console2.log(
            string.concat(
                "  newMinTurnoverUnits:     ", _formatUnits(cfg.newValue, cfg.assetDecimals), " ", cfg.assetSymbol
            )
        );
        console2.log("xpLockedTotal:", IBankSetBankMinTurnoverV14(cfg.bank).xpLockedTotal());
    }
}
