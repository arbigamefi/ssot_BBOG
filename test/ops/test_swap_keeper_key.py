"""Exercise the deployed shell entry point using synthetic keys only."""
import os
from pathlib import Path
import resource
import signal
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "script/ops/swap-keeper-key.sh"
OLD = "0x" + "1" * 64
NEW = "0x" + "2" * 64


class SwapKeeperKeyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.path = self.directory / "keeper.env"
        self.original = f"# config\nKEEPER_PRIVATE_KEY={OLD}\nOTHER=value\n".encode()
        self.path.write_bytes(self.original)

    def run_swap(self, key=NEW, filename="keeper.env", limit=None, extra_env=None):
        def constrain():
            signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
            resource.setrlimit(resource.RLIMIT_FSIZE, (limit, limit))
        return subprocess.run(
            ["bash", str(SCRIPT), filename], input=key.encode(), capture_output=True,
            env={**os.environ, "KEEPER_ENV_DIR": str(self.directory), **(extra_env or {})},
            preexec_fn=constrain if limit is not None else None, timeout=5,
        )

    def assert_rejected(self, **kwargs):
        before = self.path.read_bytes()
        result = self.run_swap(**kwargs)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertNotIn(OLD.encode(), result.stdout + result.stderr)
        self.assertNotIn(NEW.encode(), result.stdout + result.stderr)
        self.assertFalse(list(self.directory.glob("*.bak*")))
        self.assertFalse(list(self.directory.glob(".*.swap-*")))

    def test_success_has_no_old_key_copy_and_mode_600(self):
        result = self.run_swap(key=" \t" + NEW + "\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.path.read_bytes(), self.original.replace(OLD.encode(), NEW.encode()))
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        for file in self.directory.iterdir():
            self.assertNotIn(OLD.encode(), file.read_bytes())
        self.assertNotIn(NEW.encode(), result.stdout + result.stderr)

    def test_crlf_and_no_final_newline_preserved(self):
        self.path.write_bytes(f"# unchanged\r\nKEEPER_PRIVATE_KEY={OLD}".encode())
        self.assertEqual(self.run_swap().returncode, 0)
        self.assertEqual(self.path.read_bytes(), f"# unchanged\r\nKEEPER_PRIVATE_KEY={NEW}".encode())

    def test_invalid_or_multiline_key_leaves_original(self):
        for key in ["", "0x12", "0x" + "0" * 64, "0x" + "f" * 64, NEW + "\n" + OLD]:
            with self.subTest(key_length=len(key)):
                self.assert_rejected(key=key)

    def test_effective_compose_aliases_cannot_leave_old_key(self):
        for alias in ["export KEEPER_PRIVATE_KEY=", " KEEPER_PRIVATE_KEY=", "KEEPER_PRIVATE_KEY =", "KEEPER_PRIVATE_KEY:"]:
            with self.subTest(alias=alias):
                self.path.write_bytes(self.original + f"{alias}{OLD}\n".encode())
                self.assert_rejected()

    def test_zero_duplicate_and_quoted_fake_assignments_rejected(self):
        for source in [b"OTHER=value\n", self.original * 2, f"OTHER='first\nKEEPER_PRIVATE_KEY={OLD}\nlast'\n".encode()]:
            self.path.write_bytes(source)
            self.assert_rejected()

    def test_comments_and_similar_variables_preserved(self):
        extra = b"#KEEPER_PRIVATE_KEY=placeholder\nKEEPER_PRIVATE_KEY_BACKUP=placeholder\nQUOTED='normal value'\n"
        self.path.write_bytes(self.original + extra)
        self.assertEqual(self.run_swap().returncode, 0)
        self.assertTrue(self.path.read_bytes().endswith(extra))

    def test_disk_limit_is_nonzero_and_never_truncates_original(self):
        self.path.write_bytes(self.original + b"LARGE=" + b"x" * 20000 + b"\n")
        self.assert_rejected(limit=1024)
        self.assert_rejected(limit=0)

    def test_alias_and_path_traversal_rejected(self):
        self.assert_rejected(filename="../keeper.env")
        linked = self.directory / "linked.env"
        linked.symlink_to(self.path)
        self.assert_rejected(filename=linked.name)
        linked.unlink()
        os.link(self.path, linked)
        self.assert_rejected()

    def test_escaped_quote_and_bare_cr_fake_declarations_rejected(self):
        for source in [
            b"OTHER='prefix\\'\nKEEPER_PRIVATE_KEY=" + OLD.encode() + b"\nOTHER2=suffix'\n",
            b"OTHER=value\rKEEPER_PRIVATE_KEY=" + OLD.encode() + b"\n",
        ]:
            self.path.write_bytes(source)
            self.assert_rejected()

    def test_normal_compose_unset_and_quoted_forms_preserved(self):
        extra = b"UNSET\nOTHER=\"x\"#comment\nQUOTE='Let\\'s go!'\n"
        self.path.write_bytes(self.original + extra)
        result = self.run_swap()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.path.read_bytes().endswith(extra))

    def test_fifo_target_rejected_without_blocking(self):
        self.path.unlink()
        os.mkfifo(self.path)
        result = self.run_swap()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b'regular file', result.stderr)

    def test_fsync_and_rename_failure_leave_original(self):
        hook = self.directory / "sitecustomize.py"
        for action in ["fsync", "replace"]:
            hook.write_text("import os\ndef fail(*args, **kwargs): raise OSError('injected')\nos." + action + " = fail\n")
            self.assert_rejected(extra_env={"PYTHONPATH": str(self.directory), "PYTHONDONTWRITEBYTECODE": "1"})

    def test_post_replace_failure_reports_installed(self):
        (self.directory / "sitecustomize.py").write_text(
            "import os,stat\nreal=os.fsync\ndef fail(fd):\n"
            " if stat.S_ISDIR(os.fstat(fd).st_mode): raise OSError('injected')\n"
            " return real(fd)\nos.fsync=fail\n"
        )
        result = self.run_swap(extra_env={"PYTHONPATH": str(self.directory), "PYTHONDONTWRITEBYTECODE": "1"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"replacement installed; durability unconfirmed", result.stderr)
        self.assertIn(NEW.encode(), self.path.read_bytes())
        self.assertNotIn(OLD.encode(), self.path.read_bytes())


if __name__ == "__main__":
    unittest.main()
