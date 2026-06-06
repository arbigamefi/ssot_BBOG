// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/StdJson.sol";
import "forge-std/console2.sol";

import {PoolRegistry} from "../../src/core/PoolRegistry.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

interface IERC20SeedCasinoBankV14 {
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

interface IWETHSeedCasinoBankV14 is IERC20SeedCasinoBankV14 {
    function deposit() external payable;
}

interface IBankSeedCasinoBankV14 {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

/// @notice Seed one deployed v1.4 casino Bank with test/prod bankroll assets.
/// @dev Uses raw asset units. Examples:
///      USDC 10.0  => SEED_ASSETS=10000000
///      WETH 0.01 => SEED_ASSETS=10000000000000000 SEED_WRAP_NATIVE=true
///
/// Required env:
///   PRIVATE_KEY
///   SEED_POOL_ID
///   SEED_ASSETS
///
/// Optional env:
///   SNAPSHOT_PATH defaults to deployments/latest-v14.json
///   SEED_RECEIVER defaults to broadcaster
///   SEED_WRAP_NATIVE defaults false; when true, calls asset.deposit{value: SEED_ASSETS}()
contract SeedCasinoBankV14 is Script {
    using stdJson for string;

    string internal constant DEFAULT_SNAPSHOT_PATH = "deployments/latest-v14.json";

    struct Config {
        string snapshotPath;
        uint256 privateKey;
        address broadcaster;
        address receiver;
        PoolRegistry poolRegistry;
        uint64 poolId;
        address asset;
        address bank;
        uint256 assets;
        bool wrapNative;
        string assetSymbol;
        uint8 assetDecimals;
    }

    function run() external {
        Config memory cfg = _readConfig();
        _logConfig(cfg);
        _preflight(cfg);

        uint256 bankAssetsBefore = IBankSeedCasinoBankV14(cfg.bank).totalAssets();
        uint256 bankSupplyBefore = IBankSeedCasinoBankV14(cfg.bank).totalSupply();
        uint256 receiverSharesBefore = IBankSeedCasinoBankV14(cfg.bank).balanceOf(cfg.receiver);

        vm.startBroadcast(cfg.privateKey);
        if (cfg.wrapNative) {
            IWETHSeedCasinoBankV14(cfg.asset).deposit{value: cfg.assets}();
        }
        IERC20SeedCasinoBankV14(cfg.asset).approve(cfg.bank, cfg.assets);
        uint256 shares = IBankSeedCasinoBankV14(cfg.bank).deposit(cfg.assets, cfg.receiver);
        vm.stopBroadcast();

        uint256 bankAssetsAfter = IBankSeedCasinoBankV14(cfg.bank).totalAssets();
        uint256 bankSupplyAfter = IBankSeedCasinoBankV14(cfg.bank).totalSupply();
        uint256 receiverSharesAfter = IBankSeedCasinoBankV14(cfg.bank).balanceOf(cfg.receiver);

        require(bankAssetsAfter >= bankAssetsBefore + cfg.assets, "bank assets not increased");
        require(bankSupplyAfter >= bankSupplyBefore + shares, "bank supply not increased");
        require(receiverSharesAfter >= receiverSharesBefore + shares, "receiver shares not increased");

        console2.log("seededAssets", cfg.assets);
        console2.log("mintedShares", shares);
        console2.log("bankAssetsBefore", bankAssetsBefore);
        console2.log("bankAssetsAfter", bankAssetsAfter);
        console2.log("bankSupplyBefore", bankSupplyBefore);
        console2.log("bankSupplyAfter", bankSupplyAfter);
        console2.log("receiverSharesBefore", receiverSharesBefore);
        console2.log("receiverSharesAfter", receiverSharesAfter);
    }

    function _readConfig() internal view returns (Config memory cfg) {
        cfg.snapshotPath = vm.envOr("SNAPSHOT_PATH", DEFAULT_SNAPSHOT_PATH);
        string memory snap = vm.readFile(cfg.snapshotPath);

        cfg.privateKey = vm.envUint("PRIVATE_KEY");
        cfg.broadcaster = vm.addr(cfg.privateKey);
        cfg.receiver = vm.envOr("SEED_RECEIVER", cfg.broadcaster);
        cfg.poolRegistry = PoolRegistry(snap.readAddress(".poolRegistry"));
        cfg.poolId = uint64(vm.envUint("SEED_POOL_ID"));
        cfg.assets = vm.envUint("SEED_ASSETS");
        cfg.wrapNative = vm.envOr("SEED_WRAP_NATIVE", false);

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
        require(found, "SEED_POOL_ID not found in snapshot");
    }

    function _preflight(Config memory cfg) internal view {
        require(cfg.poolId != 0, "SEED_POOL_ID required");
        require(cfg.assets != 0, "SEED_ASSETS required");
        require(cfg.receiver != address(0), "bad receiver");
        require(address(cfg.poolRegistry) != address(0), "poolRegistry missing");
        require(cfg.asset != address(0), "asset missing");
        require(cfg.bank != address(0), "bank missing");

        SSOTTypes.Pool memory pool = cfg.poolRegistry.pool(cfg.poolId);
        require(pool.domain == SSOTTypes.PoolDomain.Casino, "not a casino pool");
        require(pool.active, "pool inactive");
        require(pool.asset == cfg.asset, "registry asset mismatch");
        require(pool.bank == cfg.bank, "registry bank mismatch");
        require(IBankSeedCasinoBankV14(cfg.bank).asset() == cfg.asset, "bank asset mismatch");

        uint256 balance = IERC20SeedCasinoBankV14(cfg.asset).balanceOf(cfg.broadcaster);
        if (cfg.wrapNative) {
            require(cfg.broadcaster.balance >= cfg.assets, "native balance low for wrapping");
        } else {
            require(balance >= cfg.assets, "asset balance low");
        }
    }

    function _logConfig(Config memory cfg) internal view {
        console2.log("snapshot:", cfg.snapshotPath);
        console2.log("chainId:", block.chainid);
        console2.log("broadcaster:", cfg.broadcaster);
        console2.log("receiver:", cfg.receiver);
        console2.log("poolId:", cfg.poolId);
        console2.log("asset:", cfg.asset);
        console2.log("assetSymbol:", cfg.assetSymbol);
        console2.log("assetDecimals:", cfg.assetDecimals);
        console2.log("bank:", cfg.bank);
        console2.log("assets:", cfg.assets);
        console2.log("wrapNative:", cfg.wrapNative);
        console2.log("nativeBalance:", cfg.broadcaster.balance);
        console2.log("assetBalance:", IERC20SeedCasinoBankV14(cfg.asset).balanceOf(cfg.broadcaster));
        console2.log("assetAllowance:", IERC20SeedCasinoBankV14(cfg.asset).allowance(cfg.broadcaster, cfg.bank));
        console2.log("bankTotalAssets:", IBankSeedCasinoBankV14(cfg.bank).totalAssets());
        console2.log("bankTotalSupply:", IBankSeedCasinoBankV14(cfg.bank).totalSupply());
    }
}
