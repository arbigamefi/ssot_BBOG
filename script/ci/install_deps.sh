#!/usr/bin/env bash
set -euo pipefail

# Install the Solidity dependencies exactly as pinned in deps.lock, then refuse any content drift.
# This script is used by CI and is also the recommended local install path.
#
# Each library is installed at the commit recorded in deps.lock (not at its tag: a tag can be moved), with
# `--no-git` so this works in zip-distributed repos (no .git directory) and avoids submodule drift, and `--shallow`
# to keep it fast. The compiled subtree of each library (the directory the remappings point at) must then match the
# digest recorded in deps.lock; files outside that subtree are never compiled (audit finding F-06).

if ! command -v forge >/dev/null 2>&1; then
  echo "Error: 'forge' not found. Install Foundry first (https://getfoundry.sh)." >&2
  exit 1
fi

# The toolchain is pinned in deps.lock as well; refuse another one before touching lib/.
python3 script/ci/check_toolchain.py

lock_value() { # name -> value of `name=` in deps.lock, or fail
  local value
  value=$(sed -n "s/^$1=//p" deps.lock)
  if [ -z "$value" ]; then echo "deps.lock has no $1" >&2; exit 1; fi
  printf '%s' "$value"
}

# deps.lock names each dependency by the directory forge creates under lib/.
install_pinned() { # NAME in deps.lock, GitHub owner/repo
  local name=$1 repo=$2 commit
  commit=$(lock_value "${name}_COMMIT")
  forge install "${repo}@${commit}" --no-git --shallow
}

# The same command as the comment in deps.lock; run it there to re-pin after a deliberate upgrade.
tree_digest() {
  (cd "$1" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-64)
}
expect_digest() { # NAME in deps.lock, installed directory
  local name=$1 dir=$2 want sub got
  want=$(lock_value "${name}_SHA256")
  sub=$(lock_value "${name}_SUBTREE")
  got=$(tree_digest "$dir/$sub")
  if [ "$got" != "$want" ]; then
    echo "dependency content differs from deps.lock: $dir/$sub" >&2
    echo "  expected $want" >&2
    echo "  got      $got" >&2
    exit 1
  fi
  echo "  $dir/$sub sha256 $got" >&2
}

mkdir -p lib

# If the repo was distributed without vendored deps (or with a partial subset),
# reinstall the pinned commits to ensure deterministic builds.
rm -rf lib/forge-std lib/openzeppelin-contracts lib/chainlink-brownie-contracts

install_pinned FORGE_STD foundry-rs/forge-std
install_pinned OPENZEPPELIN_CONTRACTS OpenZeppelin/openzeppelin-contracts
install_pinned CHAINLINK_BROWNIE_CONTRACTS smartcontractkit/chainlink-brownie-contracts

echo "Installed deps:" >&2
forge --version >&2
echo "  forge-std: $(lock_value FORGE_STD) ($(lock_value FORGE_STD_COMMIT))" >&2
echo "  openzeppelin-contracts: $(lock_value OPENZEPPELIN_CONTRACTS) ($(lock_value OPENZEPPELIN_CONTRACTS_COMMIT))" >&2
echo "  chainlink-brownie-contracts: $(lock_value CHAINLINK_BROWNIE_CONTRACTS) ($(lock_value CHAINLINK_BROWNIE_CONTRACTS_COMMIT))" >&2

expect_digest FORGE_STD lib/forge-std
expect_digest OPENZEPPELIN_CONTRACTS lib/openzeppelin-contracts
expect_digest CHAINLINK_BROWNIE_CONTRACTS lib/chainlink-brownie-contracts

# foundry.toml compiles offline: install the pinned compiler by digest.
bash script/ci/install_solc.sh
