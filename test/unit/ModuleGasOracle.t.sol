// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {DiceModule} from "../../src/modules/dice/DiceModule.sol";
import {CoinTossModule} from "../../src/modules/cointoss/CoinTossModule.sol";
import {RouletteModule} from "../../src/modules/roulette/RouletteModule.sol";
import {KenoModule} from "../../src/modules/keno/KenoModule.sol";
import {PlinkoModule} from "../../src/modules/plinko/PlinkoModule.sol";
import {SicBoModule} from "../../src/modules/sicbo/SicBoModule.sol";
import {SlotsModule} from "../../src/modules/slots/SlotsModule.sol";
import {BaccaratModule} from "../../src/modules/baccarat/BaccaratModule.sol";
import {SSOTTypes} from "../../src/core/interfaces/SSOTTypes.sol";

/// M6 of the first-callback gas certificate: the concrete oracle's gas for each fully concrete case must equal the
/// callee frame's gas as the EVM charges it. `vm.lastCallGas().gasTotalUsed` is the gas the callee frame consumed,
/// which is what the module interpreter prices (it excludes the caller's STATICCALL cost, calldata encoding and
/// return copy). The cases in test/helpers/certificate/m6-cases.json come from
/// script/certificate/modules/concrete_oracle.py gen (seed 20261008); the certificate's module stage regenerates
/// them on the certified build and requires this file unchanged.
contract ModuleGasOracleTest is Test {
    using stdJson for string;

    struct Case {
        string module;
        string kind;
        bytes params;
        uint256 amountPerRoll;
        uint256 betCount;
        uint256 stopGain;
        uint256 stopLoss;
        uint256 betId;
        uint256 word;
        uint256 expectedGas;
        uint256 expectedPayoutGross;
        uint256 expectedRefund;
    }

    mapping(bytes32 => address) internal moduleOf;

    function setUp() public {
        moduleOf[keccak256("DiceModule")] = address(new DiceModule());
        moduleOf[keccak256("CoinTossModule")] = address(new CoinTossModule());
        moduleOf[keccak256("RouletteModule")] = address(new RouletteModule());
        moduleOf[keccak256("KenoModule")] = address(new KenoModule());
        moduleOf[keccak256("PlinkoModule")] = address(new PlinkoModule());
        moduleOf[keccak256("SicBoModule")] = address(new SicBoModule());
        moduleOf[keccak256("SlotsModule")] = address(new SlotsModule());
        moduleOf[keccak256("BaccaratModule")] = address(new BaccaratModule());
    }

    function _read(string memory json, uint256 i, string memory key) internal pure returns (string memory) {
        return string.concat("[", vm.toString(i), "].", key);
    }

    function _case(string memory json, uint256 i) internal pure returns (Case memory c) {
        c.module = json.readString(_read(json, i, "module"));
        c.kind = json.readString(_read(json, i, "kind"));
        c.params = json.readBytes(_read(json, i, "params"));
        c.amountPerRoll = vm.parseUint(json.readString(_read(json, i, "amountPerRoll")));
        c.betCount = json.readUint(_read(json, i, "betCount"));
        c.stopGain = vm.parseUint(json.readString(_read(json, i, "stopGain")));
        c.stopLoss = vm.parseUint(json.readString(_read(json, i, "stopLoss")));
        c.betId = vm.parseUint(json.readString(_read(json, i, "betId")));
        c.word = vm.parseUint(json.readString(_read(json, i, "word")));
        c.expectedGas = json.readUint(_read(json, i, "expectedGas"));
        c.expectedPayoutGross = vm.parseUint(json.readString(_read(json, i, "expectedPayoutGross")));
        c.expectedRefund = vm.parseUint(json.readString(_read(json, i, "expectedRefund")));
    }

    function test_oracleGasEqualsCalleeFrameGas() public {
        string memory json = vm.readFile("test/helpers/certificate/m6-cases.json");
        uint256 n = abi.decode(vm.parseJson(json, "[*].betCount"), (uint256[])).length;
        uint256 mismatches;
        for (uint256 i; i < n; ++i) {
            Case memory c = _case(json, i);
            address module = moduleOf[keccak256(bytes(c.module))];
            require(module != address(0), "unknown module");
            uint256[] memory words = new uint256[](1);
            words[0] = c.word;
            SSOTTypes.StakeSpec memory spec =
                SSOTTypes.StakeSpec(c.amountPerRoll, uint32(c.betCount), c.stopGain, c.stopLoss);
            bytes memory cd = abi.encodeWithSelector(
                bytes4(keccak256("resolve(bytes,(uint256,uint32,uint256,uint256),uint256,uint256[])")),
                c.params,
                spec,
                c.betId,
                words
            );
            (bool ok, bytes memory ret) = module.staticcall(cd);
            Vm.Gas memory g = vm.lastCallGas();
            require(ok, "resolve reverted");
            (uint256 gross, uint256 refund) = abi.decode(ret, (uint256, uint256));
            assertEq(gross, c.expectedPayoutGross, "payoutGross differs from the oracle");
            assertEq(refund, c.expectedRefund, "refund differs from the oracle");
            if (g.gasTotalUsed != c.expectedGas) {
                ++mismatches;
                emit log_named_string("module", c.module);
                emit log_named_string("  kind", c.kind);
                emit log_named_uint("  oracle gas", c.expectedGas);
                emit log_named_uint("  callee gasTotalUsed", g.gasTotalUsed);
                emit log_named_uint("  gasMemoryUsed", g.gasMemoryUsed);
            }
        }
        emit log_named_uint("cases", n);
        emit log_named_uint("gas mismatches", mismatches);
        assertEq(mismatches, 0, "oracle and EVM disagree on callee gas");
    }
}
