#!/usr/bin/env bash
set -euo pipefail

# Workaround for a long-standing Foundry `forge script` issue where the
# broadcaster may error with messages like:
#   "Failed to decode constructor arguments" / "buffer overrun while deserializing"
# even though transactions are broadcast successfully.
#
# Clearing build/cache artifacts (and optionally broadcast cache) is the most
# reliable mitigation across Foundry versions.

# Keep `broadcast/` by default.
#
# Why: deleting broadcast traces makes it harder to debug deployments, and the
# decode bug is intermittent. If you hit decode/constructor-args issues, rerun
# with CLEAN_BROADCAST=1.
CLEAN_BROADCAST="${CLEAN_BROADCAST:-0}"

rm -rf out cache

if [[ "$CLEAN_BROADCAST" == "1" ]]; then
  rm -rf broadcast
fi

echo "Cleaned Foundry artifacts (out/, cache/)" >&2
if [[ "$CLEAN_BROADCAST" == "1" ]]; then
  echo "Cleaned Foundry broadcast cache (broadcast/)" >&2
else
  echo "Preserved Foundry broadcast cache (broadcast/)" >&2
fi
