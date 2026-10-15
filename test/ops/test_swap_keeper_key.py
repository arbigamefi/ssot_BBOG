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

    def test_a_trace_never_shows_either_key(self):
        result = self.run_swap(extra_env={"SHELLOPTS": "xtrace"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(b"set +xv", result.stderr)  # traced until the script turned it off
        self.assertNotIn(OLD.encode(), result.stdout + result.stderr)
        self.assertNotIn(NEW.encode(), result.stdout + result.stderr)

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


HTTP_OLD = "https://base-sepolia.infura.io/v3/" + "a" * 32
WS_OLD = "wss://base-sepolia.g.alchemy.com/v2/" + "b" * 32
INFURA_KEY = "c" * 32
ALCHEMY_KEY = "Dd_" + "d" * 29
HTTP_NEW = "https://base-sepolia.infura.io/v3/" + INFURA_KEY
WS_NEW = "wss://base-sepolia.g.alchemy.com/v2/" + ALCHEMY_KEY
SECRETS = (HTTP_OLD, WS_OLD, INFURA_KEY, ALCHEMY_KEY, "a" * 32, "b" * 32, OLD)


class SwapKeeperRpcTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.path = self.directory / "keeper.env"
        self.original = (f"KEEPER_CHAIN_ID=84532\nKEEPER_RPC_HTTP={HTTP_OLD}\nKEEPER_RPC_WS={WS_OLD}\n"
                         f"KEEPER_PRIVATE_KEY={OLD}\n").encode()
        self.path.write_bytes(self.original)

    def run_rpc(self, text, args=("--rpc", "keeper.env")):
        return subprocess.run(["bash", str(SCRIPT), *args], input=text.encode(), capture_output=True,
                              env={**os.environ, "KEEPER_ENV_DIR": str(self.directory)}, timeout=5)

    def assert_silent(self, result):
        for secret in SECRETS:
            self.assertNotIn(secret.encode(), result.stdout + result.stderr)

    def assert_rejected(self, text, args=("--rpc", "keeper.env")):
        before = self.path.read_bytes()
        result = self.run_rpc(text, args)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.path.read_bytes(), before)
        self.assert_silent(result)
        self.assertFalse(list(self.directory.glob(".*.swap-*")))

    def test_both_endpoints_are_replaced_in_one_write_and_nothing_else(self):
        result = self.run_rpc(f"KEEPER_RPC_WS={WS_NEW}\r\nKEEPER_RPC_HTTP={HTTP_NEW}\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(b"ok: 2 lines replaced atomically", result.stdout)
        self.assertEqual(self.path.read_bytes(), self.original.replace(HTTP_OLD.encode(), HTTP_NEW.encode())
                         .replace(WS_OLD.encode(), WS_NEW.encode()))
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o600)
        self.assert_silent(result)

    def test_partial_duplicate_foreign_or_unsafe_input_changes_nothing(self):
        for text in [f"KEEPER_RPC_HTTP={HTTP_NEW}\n",
                     f"KEEPER_RPC_HTTP={HTTP_NEW}\nKEEPER_RPC_HTTP={HTTP_NEW}\nKEEPER_RPC_WS={WS_NEW}\n",
                     f"KEEPER_RPC_HTTP={HTTP_NEW}\nKEEPER_RPC_WS={WS_NEW}\nKEEPER_PRIVATE_KEY={NEW}\n",
                     f"KEEPER_RPC_HTTP={HTTP_NEW.replace('https', 'http')}\nKEEPER_RPC_WS={WS_NEW}\n",
                     f"KEEPER_RPC_HTTP={HTTP_NEW}\nKEEPER_RPC_WS={WS_NEW.replace('wss', 'ws')}\n",
                     f"KEEPER_RPC_HTTP={HTTP_NEW} #x\nKEEPER_RPC_WS={WS_NEW}\n",
                     f"KEEPER_RPC_HTTP={HTTP_NEW}$HOME\nKEEPER_RPC_WS={WS_NEW}\n",
                     f"KEEPER_RPC_HTTP='{HTTP_NEW}'\nKEEPER_RPC_WS={WS_NEW}\n",
                     f"KEEPER_RPC_HTTP={HTTP_NEW}\nKEEPER_RPC_WS={WS_NEW}${{X}}\n",
                     f"KEEPER_RPC_HTTP={HTTP_NEW}\nKEEPER_RPC_WS={WS_NEW}\"\n",
                     f"KEEPER_RPC_HTTP=https://base-sepolia.infura.io/\nKEEPER_RPC_WS={WS_NEW}\n", ""]:
            with self.subTest(text=text[:40]):
                self.assert_rejected(text)

    def test_the_file_must_declare_each_endpoint_exactly_once(self):
        both = f"KEEPER_RPC_HTTP={HTTP_NEW}\nKEEPER_RPC_WS={WS_NEW}\n"
        self.path.write_bytes(self.original.replace(f"KEEPER_RPC_WS={WS_OLD}\n".encode(), b""))
        self.assert_rejected(both)
        self.path.write_bytes(self.original + f"export KEEPER_RPC_WS={WS_OLD}\n".encode())
        self.assert_rejected(both)
        self.path.write_bytes(self.original)
        self.assert_rejected(both, args=("--rpc",))
        self.assert_rejected(both, args=("--rpc", "keeper.env", "extra"))


SSH = r'''#!/usr/bin/env bash
printf '%s\n' "$@" > "$STUB_SSH_ARGS"
set -- $2
KEEPER_ENV_DIR="$STUB_ENV_DIR" exec bash "$STUB_SWAP" "$3" "$4"
'''


class SendKeeperRpcTests(unittest.TestCase):
    DRIVER = Path(__file__).resolve().parents[2] / "script/ops/send-keeper-rpc.sh"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base = Path(self.tmp.name)
        self.env_dir, stubs = base / "env", base / "stubs"
        self.env_dir.mkdir()
        stubs.mkdir()
        self.keeper = self.env_dir / "keeper.primary.env"
        self.keeper.write_text(f"KEEPER_RPC_HTTP={HTTP_OLD}\nKEEPER_RPC_WS={WS_OLD}\nKEEPER_PRIVATE_KEY={OLD}\n")
        self.dotenv = base / ".env"
        self.dotenv.write_text(f"INFURA_API_KEY_OPS={'e' * 32}\nINFURA_API_KEY_PROD_KEEPER={INFURA_KEY}\n"
                               f"ALCHEMY_API_KEY_OPS={'f' * 32}\nALCHEMY_API_KEY_PROD_KEEPER='{ALCHEMY_KEY}'\n")
        (stubs / "ssh").write_text(SSH)
        (stubs / "ssh").chmod(0o755)
        self.ssh_args = base / "ssh-args"
        self.env = {**os.environ, "PATH": f"{stubs}{os.pathsep}{os.environ['PATH']}", "OPS_ENV_FILE": str(self.dotenv),
                    "STUB_SSH_ARGS": str(self.ssh_args), "STUB_ENV_DIR": str(self.env_dir), "STUB_SWAP": str(SCRIPT)}

    def send(self, *args, env=None):
        return subprocess.run(["bash", str(self.DRIVER), *args], capture_output=True, env={**self.env, **(env or {})},
                              timeout=10)

    def test_the_prod_keeper_keys_reach_the_env_file_and_nowhere_else(self):
        result = self.send("root@prod.invalid", "base-sepolia")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.keeper.read_text(),
                         f"KEEPER_RPC_HTTP={HTTP_NEW}\nKEEPER_RPC_WS={WS_NEW}\nKEEPER_PRIVATE_KEY={OLD}\n")
        self.assertEqual(self.ssh_args.read_text(),
                         "root@prod.invalid\nbash /opt/arbigamefi/ops/swap-keeper-key.sh --rpc keeper.primary.env\n")
        for secret in (INFURA_KEY, ALCHEMY_KEY, "e" * 32, "f" * 32):
            self.assertNotIn(secret.encode(), result.stdout + result.stderr)
        self.assertIn(b"now use the PROD_KEEPER keys (base-sepolia)", result.stdout)

    def test_a_trace_never_shows_the_keys(self):
        result = self.send("root@prod.invalid", "base-sepolia", env={"SHELLOPTS": "xtrace"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(b"set +xv", result.stderr)  # traced until the script turned it off
        for secret in (INFURA_KEY, ALCHEMY_KEY, "e" * 32, "f" * 32):
            self.assertNotIn(secret.encode(), result.stdout + result.stderr)

    def test_mainnet_uses_the_mainnet_hosts(self):
        self.keeper.write_text(self.keeper.read_text().replace("base-sepolia", "base-mainnet"))
        self.assertEqual(self.send("prod", "base", "keeper.primary.env").returncode, 0)
        self.assertIn(f"KEEPER_RPC_HTTP=https://base-mainnet.infura.io/v3/{INFURA_KEY}\n", self.keeper.read_text())
        self.assertIn(f"KEEPER_RPC_WS=wss://base-mainnet.g.alchemy.com/v2/{ALCHEMY_KEY}\n", self.keeper.read_text())

    def test_refused_before_ssh_without_both_keys_or_with_bad_arguments(self):
        original = self.keeper.read_text()
        self.dotenv.write_text(f"INFURA_API_KEY_PROD_KEEPER={INFURA_KEY}\nALCHEMY_API_KEY_OPS={'f' * 32}\n")
        result = self.send("prod", "base-sepolia")
        self.assertEqual(result.returncode, 65)
        self.assertNotIn(INFURA_KEY.encode(), result.stdout + result.stderr)
        for args in [("prod", "mainnet"), ("prod", "base-sepolia", "../keeper.env"), ("prod",)]:
            self.assertEqual(self.send(*args).returncode, 64)
        self.assertFalse(self.ssh_args.exists())
        self.assertEqual(self.keeper.read_text(), original)


if __name__ == "__main__":
    unittest.main()
