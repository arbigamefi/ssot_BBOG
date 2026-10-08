"""Mutation evidence must distinguish semantic test failures from broken test execution."""
import importlib.util
import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path


SPEC = importlib.util.spec_from_file_location(
    "v16_mutants", Path(__file__).resolve().parents[1] / "mutation" / "v16_mutants.py"
)
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class MutationClassificationTests(unittest.TestCase):
    def test_unit_failure_is_semantic_evidence(self):
        outcome, failures = RUNNER.classify_mutant(
            1, "[FAIL: assertion failed] testLaterExitSucceeds() (gas: 123)\nSuite result: FAILED\n"
        )
        self.assertEqual(outcome, "killed")
        self.assertEqual(failures, ["testLaterExitSucceeds"])

    def test_multiline_invariant_failure_is_semantic_evidence(self):
        outcome, failures = RUNNER.classify_mutant(
            1, "[FAIL: assertion failed]\n\t[Sequence]\n\t\tinvariant_bank_is_solvent() (runs: 10, calls: 200)\n"
        )
        self.assertEqual(outcome, "killed")
        self.assertEqual(failures, ["invariant_bank_is_solvent"])

    def test_setup_compile_tool_and_empty_suite_are_errors(self):
        cases = [
            (1, "[FAIL: fixture unavailable] setUp() (gas: 0)\nSuite result: FAILED\n"),
            (1, "[FAIL: fixture unavailable] tearDown() (gas: 0)\nSuite result: FAILED\n"),
            (1, "[FAIL: assertion] testValue() (gas: 1)\n[FAIL: fixture] setUp() (gas: 0)\n"),
            (1, "Suite result: FAILED\n"),
            (1, "Compiler run failed: Error (7576): Undeclared identifier\n"),
            (-15, "[FAIL: assertion] testValue() (gas: 1)\n"),
            (2, "[FAIL: assertion] testValue() (gas: 1)\n"),
            (0, "No tests found in project!\n"),
        ]
        for code, output in cases:
            with self.subTest(code=code, output=output):
                self.assertEqual(RUNNER.classify_mutant(code, output)[0], "error")

    def test_executed_green_mutant_survives(self):
        outcome, failures = RUNNER.classify_mutant(0, "[PASS] testValue() (gas: 100)\n")
        self.assertEqual(outcome, "survived")
        self.assertEqual(failures, [])


class MutationRestorationTests(unittest.TestCase):
    def run_fixture(self, effect):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "contract.sol"
            source.write_bytes(b"original\n")
            mutant = {"id": "LOCAL", "guarantee": "fixture", "tests": ["test.sol"],
                      "patches": [("contract.sol", "original", "mutated")]}
            with patch.object(RUNNER, "ROOT", root), patch.object(RUNNER.subprocess, "run",
                    side_effect=lambda *a, **k: effect(source)):
                try:
                    RUNNER.run_mutant(mutant, root)
                finally:
                    self.final_content = source.read_bytes()
                    preimage = root / "source-preimages/contract.sol"
                    self.preimage = preimage.read_bytes() if preimage.exists() else None

    def test_restores_source_after_test_error(self):
        def fail(_source):
            raise OSError("tool failed")
        with self.assertRaises(OSError):
            self.run_fixture(fail)
        self.assertEqual(self.final_content, b"original\n")

    def test_interrupt_restores_source(self):
        def interrupt(_source):
            raise KeyboardInterrupt
        with self.assertRaises(KeyboardInterrupt):
            self.run_fixture(interrupt)
        self.assertEqual(self.final_content, b"original\n")

    def test_preserves_concurrent_user_edit_and_preimage(self):
        def edit(source):
            source.write_bytes(b"user edit\n")
            raise OSError("tool failed")
        with self.assertRaisesRegex(RuntimeError, "Concurrent source changes preserved"):
            self.run_fixture(edit)
        self.assertEqual(self.final_content, b"user edit\n")
        self.assertEqual(self.preimage, b"original\n")


if __name__ == "__main__":
    unittest.main()
