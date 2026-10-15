#!/usr/bin/env bash
# Replace keeper secrets in one env file, reading them from stdin, never argv or environment:
#   swap-keeper-key.sh <env-filename>         the dedicated keeper key, one 0x + 64 hex value
#   swap-keeper-key.sh --rpc <env-filename>   one KEEPER_RPC_HTTP=https://... and one KEEPER_RPC_WS=wss://... line
#                                             (script/ops/send-keeper-rpc.sh sends them from the Owner's machine)
# Every named line is replaced in one atomic write, or none is. No backup of the old values is created; rollback uses
# operator custody.
set +xv # a trace or echoed input would print a secret unredacted (an inherited SHELLOPTS, bash -x): both off first
set -euo pipefail
[[ $# -ge 1 ]] || { echo 'usage: swap-keeper-key.sh [--rpc] <env-filename>' >&2; exit 64; }
exec 3<&0
exec python3 - "$@" <<'PY'
import fcntl
import os
import re
import stat
import sys
import tempfile


KEY = b'KEEPER_PRIVATE_KEY'
# Characters a provider URL needs; nothing Compose would quote, interpolate or read as a comment.
RPC = {b'KEEPER_RPC_HTTP': rb'https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?/[A-Za-z0-9._~%+=&?/-]+',
       b'KEEPER_RPC_WS': rb'wss://[A-Za-z0-9.-]+(?::[0-9]{1,5})?/[A-Za-z0-9._~%+=&?/-]+'}


def refuse(message):
    raise ValueError(message)


def transform(source, replacements):
    # Reject Compose aliases and multiline values instead of leaving an
    # effective old declaration or accidentally editing another quoted value.
    if b'\r' in source.replace(b'\r\n', b''):
        refuse('bare carriage returns are not supported')
    lines = source.splitlines(keepends=True)
    matches = {name: [] for name in replacements}
    assignment = re.compile(rb'(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*(?:=|:)[ \t]*(.*)')
    for i, line in enumerate(lines):
        content = line.rstrip(b'\r\n').strip(b' \t')
        if not content or content.startswith(b'#'):
            continue
        match = assignment.fullmatch(content)
        if match is None:
            if re.fullmatch(rb'[A-Za-z_][A-Za-z0-9_]*', content) and content not in replacements:
                continue  # Compose permits unrelated unset-variable declarations.
            refuse(f'unsupported env syntax at line {i + 1}')
        name, value = match.groups()
        if value.startswith(b"'") and not re.fullmatch(rb"'(?:[^'\\]|\\.)*'[ \t]*(?:#.*)?", value):
            refuse(f'multiline or ambiguous quoted value at line {i + 1}')
        if value.startswith(b'"') and not re.fullmatch(rb'"(?:[^"\\]|\\.)*"[ \t]*(?:#.*)?', value):
            refuse(f'multiline or ambiguous quoted value at line {i + 1}')
        if name in replacements:
            if not line.startswith(name + b'='):
                refuse(f'noncanonical {name.decode()} declaration at line {i + 1}')
            matches[name].append(i)
    for name, found in matches.items():
        if len(found) != 1:
            refuse(f'expected exactly 1 {name.decode()} line, found {len(found)}')
        i = found[0]
        ending = b'\r\n' if lines[i].endswith(b'\r\n') else b'\n' if lines[i].endswith(b'\n') else b''
        lines[i] = name + b'=' + replacements[name] + ending
    return b''.join(lines)


def read_replacements(rpc):
    with os.fdopen(3, 'rb') as incoming:
        raw = incoming.read(4097)
    if len(raw) > 4096:
        refuse('standard input is longer than 4096 bytes')
    if not rpc:
        key = raw.strip()
        if not re.fullmatch(rb'0x[0-9a-fA-F]{64}', key):
            refuse('key must be one 0x + 64 hex value on stdin')
        if not 0 < int(key, 16) < 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141:
            refuse('key is outside the secp256k1 scalar range')
        return {KEY: key}
    replacements = {}
    for line in raw.split(b'\n'):
        line = line.strip(b' \t\r')
        if not line:
            continue
        name, _, value = line.partition(b'=')
        if name not in RPC or name in replacements or not re.fullmatch(RPC[name], value):
            replacements = None
            break
        replacements[name] = value
    if replacements is None or set(replacements) != set(RPC):
        refuse('stdin must be one KEEPER_RPC_HTTP=https://... and one KEEPER_RPC_WS=wss://... line')
    return replacements


temporary = None
replaced = False
try:
    rpc = sys.argv[1:2] == ['--rpc']
    if len(sys.argv) != 2 + rpc:
        refuse('usage: swap-keeper-key.sh [--rpc] <env-filename>')
    filename = sys.argv[-1]
    if filename in ('.', '..') or os.path.basename(filename) != filename:
        refuse('env filename must be a basename')
    replacements = read_replacements(rpc)
    directory = os.path.abspath(os.environ.get('KEEPER_ENV_DIR', '/opt/arbigamefi/frontend/deploy/docker/env'))
    path = os.path.join(directory, filename)
    # Stable lock serializes cooperating invocations across renames. It has no
    # secret and must not be unlinked while another invocation may be waiting.
    with os.fdopen(os.open(path + '.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600), 'rb+') as lock:
        lock_stat = os.fstat(lock.fileno())
        if not stat.S_ISREG(lock_stat.st_mode) or lock_stat.st_nlink != 1:
            refuse('lock must be a regular file with one link')
        fcntl.flock(lock, fcntl.LOCK_EX)
        with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as original:
            before = os.fstat(original.fileno())
            if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
                refuse('env must be a regular file with one link')
            source = original.read()
        updated = transform(source, replacements)
        fd, temporary = tempfile.mkstemp(prefix='.' + filename + '.swap-', dir=directory)
        with os.fdopen(fd, 'wb') as output:
            os.fchmod(output.fileno(), 0o600)
            os.fchown(output.fileno(), before.st_uid, before.st_gid)
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        # Detect an operator editing outside the cooperating lock protocol.
        with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as current:
            now = os.fstat(current.fileno())
            if (now.st_dev, now.st_ino, now.st_nlink) != (before.st_dev, before.st_ino, 1) or current.read() != source:
                refuse('env changed during replacement; retry from the current file')
        os.replace(temporary, path)
        temporary = None
        replaced = True
        directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    count = len(replacements)
    print(f'ok: {count} line{"s" if count > 1 else ""} replaced atomically; no backup of the old values created')
    print('file: ' + path)
except Exception as error:
    if temporary is not None:
        try:
            os.unlink(temporary)
        except OSError:
            pass
    # Never echo source, key, or arbitrary I/O exception payloads.
    detail = str(error) if isinstance(error, ValueError) else type(error).__name__
    state = 'replacement installed; durability unconfirmed' if replaced else 'original file not replaced'
    print(f'aborted: {state}; {detail}', file=sys.stderr)
    raise SystemExit(1)
PY
