#!/usr/bin/env bash
set -euo pipefail

# Validates a SportsHub role-custody memo before operational roles are used for public-money risk.
#
# Usage:
#   bash script/ci/v13_sports_role_custody_check.sh [memo-json]
#   REQUIRE_APPROVED=1 bash script/ci/v13_sports_role_custody_check.sh <approved-memo-json>

fail() {
  echo "error: $*" >&2
  exit 1
}

if [[ $# -gt 1 ]]; then
  echo "usage: $0 [memo-json]" >&2
  exit 2
fi

MEMO="${1:-${ROLE_CUSTODY_FILE:-docs/ops/templates/sportsbook-role-custody.example.json}}"
[[ -s "$MEMO" ]] || fail "missing or empty file: $MEMO"

command -v python3 >/dev/null 2>&1 || fail "missing command: python3"

REQUIRE_APPROVED="${REQUIRE_APPROVED:-0}" python3 - "$MEMO" <<'PY'
import json
import os
import re
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    memo = json.load(fh)


def fail(message: str) -> None:
    raise SystemExit(f"error: {message}")


def require(container, key, label):
    if not isinstance(container, dict) or key not in container:
        fail(f"missing field: {label}")
    return container[key]


def as_int(value, label):
    if isinstance(value, bool):
        fail(f"{label} must be an integer")
    if isinstance(value, int):
        return value
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        return int(value)
    fail(f"{label} must be an integer")


def require_filled(value, label):
    if not isinstance(value, str) or not value or value == "TBD":
        fail(f"{label} must be filled for approved role custody")


def is_address(value):
    return isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{40}", value)


schema = require(memo, "schemaVersion", "schemaVersion")
if schema != "sportsbook.role-custody.v1":
    fail(f"unsupported schemaVersion: {schema}")

status = require(memo, "status", "status")
if status not in {"draft", "approved"}:
    fail("status must be draft or approved")
require_approved = os.environ.get("REQUIRE_APPROVED") == "1"
if require_approved and status != "approved":
    fail("REQUIRE_APPROVED=1 requires status=approved")

chain_id = as_int(require(memo, "chainId", "chainId"), "chainId")
if chain_id <= 0:
    fail("chainId must be positive")

sports_hub = require(memo, "sportsHub", "sportsHub")
if not is_address(sports_hub) or sports_hub.lower() == "0x0000000000000000000000000000000000000000":
    fail("sportsHub must be a non-zero EVM address")

role_hashes = require(memo, "roleSetHashes", "roleSetHashes")
threshold = as_int(require(role_hashes, "resultReporterThreshold", "roleSetHashes.resultReporterThreshold"), "roleSetHashes.resultReporterThreshold")
if threshold <= 0:
    fail("roleSetHashes.resultReporterThreshold must be positive")

roles = require(memo, "roles", "roles")
required_roles = ["governance", "oddsSigner", "resultReporter", "resultChallenger", "resultArbitrator", "keeper"]
addresses = {}
for role_name in required_roles:
    role = require(roles, role_name, f"roles.{role_name}")
    address = require(role, "address", f"roles.{role_name}.address")
    if not is_address(address) or address.lower() == "0x0000000000000000000000000000000000000000":
        fail(f"roles.{role_name}.address must be a non-zero EVM address")
    addresses[role_name] = address.lower()

    custody_type = require(role, "custodyType", f"roles.{role_name}.custodyType")
    owner = require(role, "owner", f"roles.{role_name}.owner")
    rotation = require(role, "rotationProcedure", f"roles.{role_name}.rotationProcedure")
    rollback = require(role, "rollbackProcedure", f"roles.{role_name}.rollbackProcedure")
    if require_approved:
        require_filled(custody_type, f"roles.{role_name}.custodyType")
        require_filled(owner, f"roles.{role_name}.owner")
        require_filled(rotation, f"roles.{role_name}.rotationProcedure")
        require_filled(rollback, f"roles.{role_name}.rollbackProcedure")
        if custody_type == "local-env":
            fail(f"roles.{role_name}.custodyType must not be local-env")

if require_approved:
    if memo.get("noLocalPrivateKeys") is not True:
        fail("noLocalPrivateKeys must be true for approved role custody")
    if addresses["governance"] in {addresses["oddsSigner"], addresses["resultReporter"]}:
        fail("governance must not be routine odds signer or result reporter")
    operational = [addresses[name] for name in required_roles]
    if len(set(operational)) != len(operational):
        fail("approved role addresses must be unique")

print("v1.3 Sports role custody memo validated:")
print(f"  memo: {path}")
print(f"  status: {status}")
print(f"  chainId: {chain_id}")
print(f"  sportsHub: {sports_hub}")
print(f"  resultReporterThreshold: {threshold}")
for role_name in required_roles:
    print(f"  {role_name}: {addresses[role_name]}")
PY
