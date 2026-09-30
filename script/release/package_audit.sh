#!/usr/bin/env bash
set -euo pipefail

# The source audit precedes deployment. Archive one complete, clean Git revision;
# deployment attestations are separate release artifacts, never prerequisites.
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo "audit package requires a clean, committed source tree" >&2
  exit 1
fi
REVISION=$(git rev-parse HEAD)
TREE=$(git rev-parse 'HEAD^{tree}')
NAME="ssot-audit-${REVISION}"
mkdir -p dist
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir "$STAGE/$NAME"
git archive HEAD | tar -xf - -C "$STAGE/$NAME"
printf '%s\n' "$REVISION" > "$STAGE/$NAME/SOURCE_REVISION"
printf '%s\n' "$TREE" > "$STAGE/$NAME/SOURCE_TREE"
cat > "$STAGE/$NAME/AUDIT_VERIFY.md" <<'DOC'
# Source audit bundle

SOURCE_REVISION and SOURCE_TREE identify the reviewed Git commit and tree.
MANIFEST.sha256 covers the exported tracked files, including frontend source,
ABI inventory, dependency locks, tests, workflow gates and audit documentation.
It records package integrity, not evidence that every test passed.

No deployment or release signature is required for a source audit. A subsequent
release must pass its own signed snapshot, manifest and live governance checks.

Verify with `sha256sum -c MANIFEST.sha256`, install pinned contract dependencies
with `make deps`, then run `make pr`. Install frontend dependencies with
`pnpm -C frontend install --frozen-lockfile`; run its typecheck and tests.
The isolated Bank/SDK integration is `bash script/ci/bank_sdk_integration.sh`.
See docs/audit/v1.6-audit-scope.md for the scope and outstanding acceptance gates.
DOC
python3 - "$STAGE/$NAME" <<'PY'
import hashlib
import sys
from pathlib import Path
root = Path(sys.argv[1])
lines = []
for path in sorted(root.rglob('*')):
    if path.is_file():
        lines.append(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(root)}')
(root / 'MANIFEST.sha256').write_text('\n'.join(lines) + '\n')
PY
tar -czf "dist/$NAME.tar.gz" -C "$STAGE" "$NAME"
echo "wrote: dist/$NAME.tar.gz"
