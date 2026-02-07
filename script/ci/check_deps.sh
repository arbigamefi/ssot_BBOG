#!/usr/bin/env bash
set -euo pipefail

# Fast, offline dependency presence check.
# We distribute this repo as a zip without vendored dependencies.
# Run `make deps` to install pinned deps under ./lib.

missing=0
for d in "lib/forge-std" "lib/openzeppelin-contracts" "lib/chainlink-brownie-contracts"; do
  if [[ ! -d "${d}" ]]; then
    echo "Missing dependency directory: ${d}" >&2
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  echo "" >&2
  echo "Run: make deps" >&2
  exit 1
fi

exit 0
