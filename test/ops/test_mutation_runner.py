"""Mutation evidence must distinguish semantic test failures from broken test execution."""
import importlib.util
import unittest
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


if __name__ == "__main__":
    unittest.main()
