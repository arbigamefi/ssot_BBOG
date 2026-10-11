# Functions shared by the operator scripts in script/release (run_preflight.sh, prepare_deploy_copy.sh,
# broadcast_v16.sh, release_v16.sh). Source it from bash; it defines functions only and changes no state.

# Refuse a directory with a .env in it or in any directory above it: forge loads a .env it finds in the project or
# above, and the repository root's .env holds API keys.
no_env_above() { # directory
  local d
  d=$(cd "$1" && pwd -P) || return 1
  while :; do
    if [[ -e "$d/.env" ]]; then
      echo "$d/.env exists at or above $1" >&2
      return 1
    fi
    [[ "$d" == / ]] && return 0
    d=$(dirname "$d")
  done
}

# An isolated copy of one commit for forge: `git archive` of the commit, with the pinned libraries copied from the
# repository's lib/ and their compiled subtrees checked against the copy's deps.lock. The directory must not exist.
make_copy() { # repository root, commit, new directory
  local root=$1 commit=$2 dir=$3 name want sub got
  [[ ! -e "$dir" ]] || { echo "$dir exists; a copy is never reused" >&2; return 1; }
  mkdir -p "$(dirname "$dir")" && no_env_above "$(dirname "$dir")" || return 1
  (umask 077 && mkdir "$dir") || return 1
  git -C "$root" archive "$commit" | tar -x -C "$dir" || return 1
  rm -rf "$dir/lib" && mkdir "$dir/lib" || return 1
  for name in FORGE_STD:forge-std OPENZEPPELIN_CONTRACTS:openzeppelin-contracts \
    CHAINLINK_BROWNIE_CONTRACTS:chainlink-brownie-contracts; do
    cp -R "$root/lib/${name#*:}" "$dir/lib/" || return 1
    want=$(sed -n "s/^${name%%:*}_SHA256=//p" "$dir/deps.lock")
    sub=$(sed -n "s/^${name%%:*}_SUBTREE=//p" "$dir/deps.lock")
    got=$(cd "$dir/lib/${name#*:}/$sub" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 |
      shasum -a 256 | cut -c1-64)
    [[ -n "$want" && "$got" == "$want" ]] || { echo "dependency digest differs: ${name#*:}/$sub" >&2; return 1; }
  done
  no_env_above "$dir"
}

# Python defining replace(data): the RPC URL in OPERATOR_REDACT_URL becomes <rpc-url>, and every piece of it at least
# 12 characters long (the key, wherever a provider puts it) <rpc-key>.
redaction_python() {
  cat << 'PY'
import os, urllib.parse
url = os.environ["OPERATOR_REDACT_URL"]
parts = urllib.parse.urlsplit(url)
pieces = parts.path.split("/") + [value for _, value in urllib.parse.parse_qsl(parts.query)]
pieces += [parts.username or "", parts.password or ""]
secrets = sorted({url, *(piece for piece in pieces if len(piece) >= 12)} - {""}, key=len, reverse=True)
def replace(data):
    for secret in secrets:
        data = data.replace(secret.encode(), b"<rpc-url>" if secret == url else b"<rpc-key>")
    return data
PY
}

# Run a command with its output, stdout and stderr together, in a log with the RPC URL and its key replaced. Logs are
# files, which script/tools/with-ops-rpc.sh cannot redact. Returns the command's status.
redacted() { # log, url, command...
  local log=$1 url=$2
  shift 2
  "$@" < /dev/null 2>&1 | OPERATOR_REDACT_URL="$url" python3 -I -c "$(redaction_python)
import sys
sys.stdout.buffer.write(replace(sys.stdin.buffer.read()))" > "$log"
  return "${PIPESTATUS[0]}"
}

# Replace the RPC URL and its key, as in a log, in every file under a directory. forge keeps a script's "sensitive
# values", the RPC of each transaction, in cache/<script>/<chain>/ of the project for `forge script --resume`; a gated
# broadcast is never resumed, so the key need not stay on disk.
scrub_rpc() { # directory, url
  [[ -d "$1" ]] || return 0
  OPERATOR_REDACT_URL="$2" python3 -I -c "$(redaction_python)
import pathlib, sys
for path in pathlib.Path(sys.argv[1]).rglob('*'):
    if path.is_file() and not path.is_symlink():
        data = path.read_bytes()
        if replace(data) != data:
            path.write_bytes(replace(data))" "$1"
}

# Ask on the terminal for the password of a keystore until `cast wallet address` unlocks it to the expected address,
# at most three times, and leave it in <directory>/password (0600 in a 0700 directory the caller removes). forge's own
# prompt reports a wrong password only as "no wallets available", and it cannot be seen through the RPC wrapper's
# redacting pipe; this prompt writes to the terminal itself. Messages start with "<step>:"; every refusal ends with
# "<nothing done>". Returns 1 without a confirmed password.
unlock_keystore() { # step, role, expected address, nothing done, directory, wallet name, wallet arguments...
  local step=$1 role=$2 expected=$3 nothing=$4 dir=$5 name=$6 k got password
  shift 6
  if ! { : < /dev/tty; } 2>/dev/null; then
    echo "$step: no terminal to read the keystore password from; $nothing"
    return 1
  fi
  for k in 1 2 3; do
    printf 'Keystore password for %s (attempt %d of 3): ' "$name" "$k" > /dev/tty
    IFS= read -rs password < /dev/tty || password=
    printf '\n' > /dev/tty
    (umask 077 && printf '%s' "$password" > "$dir/password")
    password=
    if got=$(cast wallet address "$@" --password-file "$dir/password" 2> "$dir/error"); then
      [[ "$(printf '%s' "$got" | tr '[:upper:]' '[:lower:]')" == "$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')" ]] &&
        return 0
      echo "$step: the keystore holds $got, not $role $expected; $nothing"
      return 1
    fi
    if ! grep -q 'Failed to decrypt keystore' "$dir/error"; then
      echo "$step: cast cannot open the keystore; $nothing"
      sed 's/^/  | /' "$dir/error"
      return 1
    fi
    echo "$step: wrong password for $name (attempt $k of 3)"
  done
  echo "$step: $nothing"
  return 1
}
