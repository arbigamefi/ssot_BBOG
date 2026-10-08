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
from export_frontend_abis import REQUIRED_CONTRACTS, pool_instances
from validate_frontend_artifacts import _validate_abis


class CurrentAbiTests(unittest.TestCase):
    def inventory(self, directory):
        address = lambda n: '0x' + format(n, '040x')
        manifest = {"addresses": {key: address(i + 1) for i, (_, _, key) in enumerate(REQUIRED_CONTRACTS)
                                  if not key.startswith("__")},
                    "pools": [{"poolId": 1, "domain": "Casino", "asset": address(40),
                               "bank": address(41), "vault": address(42)}]}
        rows = []
        for name, qualified, key in REQUIRED_CONTRACTS:
            filename = f"{name}.abi.json"
            abi = [{"type": "function", "name": "fixtureFunction", "inputs": [], "outputs": [], "stateMutability": "view"}]
            artifact = directory / "out" / Path(qualified.split(":")[0]).name / f"{name}.json"
            artifact.parent.mkdir(parents=True, exist_ok=True)
            artifact.write_text(json.dumps({"abi": abi}))
            data = json.dumps({"contract": name, "abi": abi}).encode()
            (directory / filename).write_bytes(data)
            rows.append({"name": name, "addressKey": key, "address": manifest["addresses"].get(key),
                         "abiFile": filename, "abiSha256": hashlib.sha256(data).hexdigest()})
        rows.extend(pool_instances(manifest))
        return {"contracts": rows}, manifest

    def validate(self, inventory, directory, manifest):
        _validate_abis(inventory, directory / "index.json", manifest, directory / "out")

    def test_current_inventory_matches_compiled_source_and_pool_identities(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            inventory, manifest = self.inventory(directory)
            self.validate(inventory, directory, manifest)

    def test_modified_bank_or_vault_abi_rejected_even_with_recomputed_inventory_hash(self):
        for name in ("Bank", "LiquidityVault"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp:
                directory = Path(temp)
                inventory, manifest = self.inventory(directory)
                target = directory / f"{name}.abi.json"
                target.write_text(json.dumps({"contract": name, "abi": []}))
                next(row for row in inventory["contracts"] if row["name"] == name)["abiSha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
                with self.assertRaisesRegex(SystemExit, f"differs from current source build: {name}"):
                    self.validate(inventory, directory, manifest)

    def test_missing_current_interface_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            inventory, manifest = self.inventory(directory)
            inventory["contracts"] = [row for row in inventory["contracts"] if row["name"] != "IGameModule"]
            with self.assertRaisesRegex(SystemExit, "missing current ABIs"):
                self.validate(inventory, directory, manifest)

    def test_per_pool_bank_vault_inventory_cannot_be_omitted_forged_or_duplicated(self):
        for name in ("BankInstance", "VaultInstance"):
            for field in ("missing", "duplicate", "address", "asset", "bank", "vault", "poolId", "abiFile"):
                with self.subTest(name=name, field=field), tempfile.TemporaryDirectory() as temp:
                    directory = Path(temp)
                    inventory, manifest = self.inventory(directory)
                    row = next(item for item in inventory["contracts"] if item["name"] == name)
                    if field == "missing": inventory["contracts"].remove(row)
                    elif field == "duplicate": inventory["contracts"].append(dict(row))
                    elif field == "poolId": row[field] = 2
                    elif field == "abiFile": row[field] = "GameHub.abi.json"
                    else: row[field] = "0x" + "f" * 40
                    with self.assertRaisesRegex(SystemExit, "Bank/Vault instance"):
                        self.validate(inventory, directory, manifest)

    def test_contract_address_identity_is_authenticated(self):
        for field, value in (("address", "0x" + "f" * 40), ("addressKey", "vrfHub")):
            with self.subTest(field=field), tempfile.TemporaryDirectory() as temp:
                directory = Path(temp)
                inventory, manifest = self.inventory(directory)
                inventory["contracts"][0][field] = value
                with self.assertRaisesRegex(SystemExit, "ABI address identity"):
                    self.validate(inventory, directory, manifest)

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

    def test_readonly_accounting_reconciles_both_custodians_and_risk(self):
        source = (ROOT / "frontend/scripts/release-readonly-smoke.mjs").read_text()
        constants = source[source.index("const MAX_BPS"):source.index("let ok = true")]
        functions = source[source.index("function validateBankSSOT"):]
        run = r'''
const ssot = Object.fromEntries(SSOT_FIELDS.map(name => [name, 0n]));
Object.assign(ssot, {bankCash: 51n, vaultCash: 109n, L: 100n, P: 20n, R: 35n, K: 15n, G: 120n,
  PF: 10n, XP: 12n, PP: 5n, bankSurplus: 4n, vaultSurplus: 9n, accountingValid: true,
  riskReserveBps: 1000n, riskReserve: 12n, riskFree: 73n, withdrawalBufferBps: 2000n,
  withdrawalBuffer: 24n, lpFreeCapital: 85n, riskInPaused: false,
  xpAccruedTotal: 3n, xpLockedTotal: 4n, xpHoldbackTotal: 5n});
const totals = {bankCash: 51n, vaultCash: 109n, root: 100n, pendingStake: 20n, totalReserved: 35n, locked: 15n, playerPayableTotal: 5n};
validateBankSSOT(ssot, totals);
// Pausing does not change capital accounting; optional outflow buffer does not constrain NFT LP free capital.
validateBankSSOT({...ssot, riskInPaused: true}, totals);
const reject = (changed, observed, message) => {
  try { validateBankSSOT(changed, observed); throw new Error("invalid snapshot accepted"); }
  catch (error) { if (!error.message.includes(message)) throw error; }
};
for (const key of Object.keys(totals)) reject(ssot, {...totals, [key]: totals[key] + 1n}, "accounting source mismatch");
reject({...ssot, accountingValid: false}, totals, "accounting is invalid");
reject({...ssot, accountingValid: 1}, totals, "must be boolean");
reject({...ssot, G: 121n}, totals, "capital identity");
reject({...ssot, R: 19n}, {...totals, totalReserved: 19n}, "capital identity");
reject({...ssot, K: 16n}, {...totals, locked: 16n}, "capital identity");
reject({...ssot, L: 10n, G: 30n}, {...totals, root: 10n}, "capital identity");
reject({...ssot, L: MAX_TREE_CAPITAL, G: MAX_TREE_CAPITAL + 20n}, {...totals, root: MAX_TREE_CAPITAL}, "capital identity");
reject({...ssot, bankCash: 46n}, {...totals, bankCash: 46n}, "custody cash deficit");
reject({...ssot, vaultCash: 99n}, {...totals, vaultCash: 99n}, "custody cash deficit");
reject({...ssot, bankSurplus: 5n}, totals, "custody surplus identity");
reject({...ssot, vaultSurplus: 10n}, totals, "custody surplus identity");
reject({...ssot, PP: 4n}, {...totals, playerPayableTotal: 4n}, "custody surplus identity");
reject({...ssot, xpLockedTotal: 5n}, totals, "XP bucket identity");
reject({...ssot, riskReserve: 11n}, totals, "risk buffer identity");
reject({...ssot, riskFree: 74n}, totals, "risk buffer identity");
reject({...ssot, withdrawalBuffer: 25n}, totals, "optional outflow buffer identity");
reject({...ssot, lpFreeCapital: 61n}, totals, "LP free capital identity");
reject({...ssot, riskReserveBps: 10001n}, totals, "exceeds");
reject({...ssot, vaultSurplus: -1n}, totals, "negative accounting");
'''
        result = subprocess.run(["node", "-e", constants + functions + run], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
