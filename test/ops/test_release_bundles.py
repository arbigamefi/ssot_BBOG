"""Exercise archive provenance, safe import and source-only audit packaging."""
import hashlib
import io
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'script/release'))
from import_release_bundle import unpack

REVISION = 'a' * 40


def archive(path, *, revision=REVISION, extra=None):
    files = {name: b'{}' for name in (
        'deployments/latest-v16.json', 'deployments/release-latest-v16.json',
        'deployments/release-notes-latest-v16.md', 'deployments/frontend-manifest-latest-v16.json',
        'deployments/golden-vectors-latest-v16.json', 'abis/index.json')}
    files['SOURCE_REVISION'] = revision.encode() + b'\n'
    files['MANIFEST.sha256'] = ''.join(f'{hashlib.sha256(data).hexdigest()}  {name}\n' for name, data in files.items()).encode()
    with tarfile.open(path, 'w:gz') as out:
        for name, data in files.items():
            info = tarfile.TarInfo(name); info.size = len(data)
            out.addfile(info, io.BytesIO(data))
        if extra:
            info = tarfile.TarInfo(extra[0]); info.type = extra[1]
            info.linkname = '/etc/passwd'
            out.addfile(info)
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ReleaseBundleTests(unittest.TestCase):
    def test_digest_and_source_provenance_before_any_write(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); bundle = root / 'bundle.tar.gz'; target = root / 'stage'
            digest = archive(bundle)
            for expected, revision in [('0' * 64, REVISION), (digest, 'b' * 40)]:
                with self.subTest(expected=expected, revision=revision), self.assertRaises(ValueError):
                    unpack(bundle, expected, target, revision)
                self.assertFalse(target.exists())
            unpack(bundle, digest, target, REVISION)
            self.assertTrue((target / 'abis/index.json').is_file())
            with self.assertRaisesRegex(ValueError, 'must not exist'):
                unpack(bundle, digest, target, REVISION)

    def test_path_traversal_links_and_unlisted_files_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); bundle = root / 'bundle.tar.gz'
            for name, kind in [('../escaped', tarfile.REGTYPE), ('/absolute', tarfile.REGTYPE),
                               ('abis/link', tarfile.SYMTYPE), ('abis/hard', tarfile.LNKTYPE),
                               ('abis/unlisted', tarfile.REGTYPE), ('SOURCE_REVISION', tarfile.REGTYPE)]:
                digest = archive(bundle, extra=(name, kind))
                with self.subTest(name=name), self.assertRaises(ValueError):
                    unpack(bundle, digest, root / 'stage', REVISION)
                self.assertFalse((root / 'stage').exists())

    def test_audit_package_includes_complete_committed_source_without_deployment(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            def git(*args):
                return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()
            git('init', '-q'); git('config', 'user.name', 'Local test'); git('config', 'user.email', 'test@invalid')
            contents = {'src/core/Bank.sol': 'source', 'frontend/apps/web/page.tsx': 'page',
                        'frontend/packages/ssot/src/abis/index.json': 'abi', 'frontend/pnpm-lock.yaml': 'lock',
                        'deps.lock': 'dependencies', 'docs/audit/v1.6-audit-scope.md': 'scope',
                        '.gitignore': 'dist/\n', 'script/release/package_audit.sh': (ROOT / 'script/release/package_audit.sh').read_text()}
            for name, data in contents.items():
                path = root / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(data)
            git('add', '.'); git('commit', '-qm', 'source fixture')
            result = subprocess.run(['bash', 'script/release/package_audit.sh'], cwd=root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            bundle = next((root / 'dist').glob('*.tar.gz'))
            with tarfile.open(bundle) as out:
                prefix = f'ssot-audit-{git("rev-parse", "HEAD")}/'
                members = out.getmembers()
                self.assertEqual(len(members), len({entry.name for entry in members}))
                for entry in members:
                    self.assertTrue(entry.name == prefix.rstrip('/') or entry.name.startswith(prefix), entry.name)
                    self.assertTrue(entry.isfile() or entry.isdir(), entry.name)
                files = {entry.name[len(prefix):] for entry in members if entry.isfile()}
                self.assertEqual(files, set(contents) | {
                    'SOURCE_REVISION', 'SOURCE_TREE', 'AUDIT_VERIFY.md', 'MANIFEST.sha256'})
                manifest = {}
                for line in out.extractfile(prefix + 'MANIFEST.sha256').read().decode().splitlines():
                    digest, name = line.split('  ', 1)
                    self.assertNotIn(name, manifest)
                    manifest[name] = digest
                self.assertEqual(set(manifest), files - {'MANIFEST.sha256'})
                for name, digest in manifest.items():
                    self.assertEqual(hashlib.sha256(out.extractfile(prefix + name).read()).hexdigest(), digest)
                for name, data in contents.items():
                    self.assertEqual(out.extractfile(prefix + name).read().decode(), data)
                self.assertEqual(out.extractfile(prefix + 'SOURCE_REVISION').read().decode().strip(), git('rev-parse', 'HEAD'))
                self.assertEqual(out.extractfile(prefix + 'SOURCE_TREE').read().decode().strip(), git('rev-parse', 'HEAD^{tree}'))
            (root / 'src/core/Bank.sol').write_text('uncommitted')
            result = subprocess.run(['bash', 'script/release/package_audit.sh'], cwd=root, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('clean, committed', result.stderr)


if __name__ == '__main__':
    unittest.main()
