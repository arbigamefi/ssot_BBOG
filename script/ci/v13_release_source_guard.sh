#!/usr/bin/env bash
set -euo pipefail

if grep -q "totalTurnover" src/core/Bank.sol; then
  cat >&2 <<'MSG'
V13 release/verify targets are disabled for the current source tree.

src/core/Bank.sol contains V14 observability counters, so generating
latest-v13, release-latest-v13, frontend-manifest-latest-v13, or abis-v13
from this checkout would mix V13 release identity with V14 Bank bytecode/ABI.

Use the V14 deployment/release path instead, or checkout the audited V13
source if you intentionally need to reproduce V13 artifacts.
MSG
  exit 1
fi
