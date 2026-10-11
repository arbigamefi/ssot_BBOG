#!/usr/bin/env bash
set -euo pipefail

# Install the solc build pinned in deps.lock where Forge looks for it, and refuse it unless its SHA-256 matches.
# foundry.toml compiles offline, so Forge never downloads a compiler by itself. install_deps.sh calls this script.

cd "$(dirname "$0")/../.."

lock_value() { # name -> value of `name=` in deps.lock, or fail
  local value
  value=$(sed -n "s/^$1=//p" deps.lock)
  if [ -z "$value" ]; then echo "deps.lock has no $1" >&2; exit 1; fi
  printf '%s' "$value"
}

version=$(lock_value SOLC_VERSION)
case "$(uname -s)" in
  Linux) platform=linux-amd64; key=SOLC_LINUX_AMD64; dir="${XDG_DATA_HOME:-$HOME/.local/share}/svm" ;;
  Darwin) platform=macosx-amd64; key=SOLC_MACOSX_AMD64; dir="$HOME/Library/Application Support/svm" ;;
  *) echo "no pinned solc build for $(uname -s)" >&2; exit 1 ;;
esac
# Forge's solc manager prefers an existing ~/.svm over the platform data directory.
if [ -d "$HOME/.svm" ]; then dir="$HOME/.svm"; fi
build=$(lock_value "${key}_BUILD")
want=$(lock_value "${key}_SHA256")
target="$dir/$version/solc-$version"

digest() { shasum -a 256 "$1" | cut -c1-64; }

if [ -f "$target" ] && [ "$(digest "$target")" = "$want" ]; then
  echo "  solc $version ($platform) sha256 $want: $target" >&2
  exit 0
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
curl -fsSL --retry 3 "https://binaries.soliditylang.org/$platform/$build" -o "$tmp"
got=$(digest "$tmp")
if [ "$got" != "$want" ]; then
  echo "solc $build differs from deps.lock" >&2
  echo "  expected $want" >&2
  echo "  got      $got" >&2
  exit 1
fi
mkdir -p "$(dirname "$target")"
install -m 0755 "$tmp" "$target"
echo "  installed solc $version ($platform) sha256 $want: $target" >&2
