#!/usr/bin/env bash
set -euo pipefail

# Pin dependencies to known versions to minimize supply-chain drift.
# This script is used by CI and is also the recommended local install path.

FORGE_STD_REF="v1.14.0"
OZ_REF="v5.5.0"
CHAINLINK_BC_REF="1.3.0"

if ! command -v forge >/dev/null 2>&1; then
  echo "Error: 'forge' not found. Install Foundry first (https://getfoundry.sh)." >&2
  exit 1
fi

mkdir -p lib

# If the repo was distributed without vendored deps (or with a partial subset),
# reinstall pinned versions to ensure deterministic builds.
rm -rf lib/forge-std lib/openzeppelin-contracts lib/chainlink-brownie-contracts

# Foundry newer versions do not auto-commit on install; the historical `--no-commit`
# flag has been removed.
#
# We also use `--no-git` so this works in zip-distributed repos (no .git directory)
# and avoids submodule drift. `--shallow` keeps it fast.
forge install "foundry-rs/forge-std@${FORGE_STD_REF}" --no-git --shallow
forge install "OpenZeppelin/openzeppelin-contracts@${OZ_REF}" --no-git --shallow
forge install "smartcontractkit/chainlink-brownie-contracts@${CHAINLINK_BC_REF}" --no-git --shallow

# Content pin: the installed trees must match the digests recorded in deps.lock (a tag can move; a digest cannot).
tree_digest() {
  (cd "$1" && find . -type f ! -path './.git/*' -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-64)
}
expect_digest() {
  local name=$1 dir=$2 want
  want=$(sed -n "s/^${name}_SHA256=//p" deps.lock)
  if [ -z "$want" ]; then echo "deps.lock has no ${name}_SHA256" >&2; exit 1; fi
  local got
  got=$(tree_digest "$dir")
  if [ "$got" != "$want" ]; then
    echo "dependency content differs from deps.lock: $dir" >&2
    echo "  expected $want" >&2
    echo "  got      $got" >&2
    exit 1
  fi
}
expect_digest FORGE_STD lib/forge-std
expect_digest OPENZEPPELIN_CONTRACTS lib/openzeppelin-contracts
expect_digest CHAINLINK_BROWNIE_CONTRACTS lib/chainlink-brownie-contracts

echo "Installed deps:" >&2
forge --version >&2
echo "  forge-std: ${FORGE_STD_REF}" >&2
echo "  openzeppelin-contracts: ${OZ_REF}" >&2
echo "  chainlink-brownie-contracts: ${CHAINLINK_BC_REF}" >&2
