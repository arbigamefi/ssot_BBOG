"""Current ABI generation and import boundaries; no RPC or deployment fixtures."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "script/release"))
from export_frontend_abis import REQUIRED_CONTRACTS
from validate_frontend_artifacts import _validate_abis


class CurrentAbiTests(unittest.TestCase):
    def inventory(self, directory):
        rows = []
        for name, _, _ in REQUIRED_CONTRACTS:
            filename = f"{name}.abi.json"
            source = ROOT / "frontend/packages/ssot/src/abis/contracts" / filename
            data = source.read_bytes()
            (directory / filename).write_bytes(data)
            rows.append({"name": name, "abiFile": filename, "abiSha256": hashlib.sha256(data).hexdigest()})
        return {"contracts": rows}

    def test_current_inventory_matches_single_source(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            _validate_abis(self.inventory(directory), directory / "index.json")

    def test_modified_abi_is_rejected_even_with_recomputed_inventory_hash(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            inventory = self.inventory(directory)
            bank = directory / "Bank.abi.json"
            raw = json.loads(bank.read_text())
            raw["abi"] = [entry for entry in raw["abi"] if entry.get("name") != "requestRedeem"]
            bank.write_text(json.dumps(raw))
            next(row for row in inventory["contracts"] if row["name"] == "Bank")["abiSha256"] = hashlib.sha256(bank.read_bytes()).hexdigest()
            with self.assertRaisesRegex(SystemExit, "differs from current source build: Bank"):
                _validate_abis(inventory, directory / "index.json")

    def test_missing_current_interface_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            inventory = self.inventory(directory)
            inventory["contracts"] = [row for row in inventory["contracts"] if row["name"] != "IGameModule"]
            with self.assertRaisesRegex(SystemExit, "missing current ABIs"):
                _validate_abis(inventory, directory / "index.json")

    def test_source_generation_needs_no_manifest_and_loads_in_node(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            for name, qualified, _ in REQUIRED_CONTRACTS:
                artifact = directory / "out" / Path(qualified.split(":")[0]).name / f"{name}.json"
                artifact.parent.mkdir(parents=True, exist_ok=True)
                artifact.write_text(json.dumps({"abi": [{"type": "error", "name": "FixtureOnly", "inputs": []}]}))
            destination = directory / "abis/contracts"
            command = [sys.executable, str(ROOT / "script/release/export_frontend_abis.py"), "--source-only", "--out", str(directory / "out"), "--dest", str(destination)]
            subprocess.run(command, cwd=directory, check=True, capture_output=True)
            self.assertFalse((destination / "index.json").exists())
            self.assertFalse((directory / "deployments").exists())
            script = 'import { getContractAbis } from ' + json.dumps((destination.parent / "index.mjs").as_uri()) + '; console.log(Object.keys(getContractAbis()).length);'
            result = subprocess.run(["node", "--input-type=module", "-e", script], check=True, capture_output=True, text=True)
            self.assertEqual(int(result.stdout), len(REQUIRED_CONTRACTS))
            # An incomplete build must fail before removing the previous generated source.
            (directory / "out/IGameModule.sol/IGameModule.json").unlink()
            before = (destination / "Bank.abi.json").read_bytes()
            failure = subprocess.run(command, cwd=directory, capture_output=True)
            self.assertNotEqual(failure.returncode, 0)
            self.assertEqual((destination / "Bank.abi.json").read_bytes(), before)

    def test_readonly_accounting_reconciles_debts_and_historical_risk(self):
        script = ROOT / "frontend/scripts/release-readonly-smoke.mjs"
        source = script.read_text()
        constants = source[source.index("const MAX_BPS"):source.index("let ok = true")]
        functions = source[source.index("function validateBankSSOT"):]
        run = r'''
const ssot = Object.fromEntries(SSOT_FIELDS.map(name => [name, 0n]));
ssot.B = 145n; ssot.NAV = 100n; ssot.R = 15n;
ssot.riskFree = 85n; ssot.withdrawable = 85n; ssot.riskInPaused = false;
// P=20 covers 10 old reserves plus 10 released but unpaid recovery; active R=15.
validateBankSSOT(ssot, 20n, 5n, 20n, 15n, 25n);
const reject = (args, message) => {
  try { validateBankSSOT(ssot, ...args); throw new Error("invalid snapshot accepted"); }
  catch (error) { if (!error.message.includes(message)) throw error; }
};
reject([20n, 5n, 0n, 15n, 25n], "NAV identity failed");
reject([20n, 5n, 20n, 14n, 25n], "reserve allocation");
reject([20n, 5n, 20n, 15n, 36n], "reserve allocation");
ssot.R = 101n;
reject([20n, 5n, 20n, 101n, 111n], "below its reserved obligations");
'''
        subprocess.run(["node", "-e", constants + functions + run], check=True, capture_output=True)


if __name__ == "__main__":
    unittest.main()
