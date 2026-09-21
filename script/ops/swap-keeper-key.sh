#!/usr/bin/env bash
# Read a dedicated keeper key from stdin, never argv or environment.
# Atomic replacement creates no old-key backup. Rollback uses operator custody.
set -euo pipefail
exec 3<&0
exec python3 - "${1:?usage: swap-keeper-key.sh <env-filename>}" <<'PY'
import fcntl
import os
import re
import stat
import sys
import tempfile


def refuse(message):
    raise ValueError(message)


def transform(source, key):
    # Reject Compose aliases and multiline values instead of leaving an
    # effective old declaration or accidentally editing another quoted value.
    if b'\r' in source.replace(b'\r\n', b''):
        refuse('bare carriage returns are not supported')
    lines = source.splitlines(keepends=True)
    matches = []
    assignment = re.compile(rb'(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*(?:=|:)[ \t]*(.*)')
    for i, line in enumerate(lines):
        content = line.rstrip(b'\r\n').strip(b' \t')
        if not content or content.startswith(b'#'):
            continue
        match = assignment.fullmatch(content)
        if match is None:
            if re.fullmatch(rb'[A-Za-z_][A-Za-z0-9_]*', content) and content != b'KEEPER_PRIVATE_KEY':
                continue  # Compose permits unrelated unset-variable declarations.
            refuse(f'unsupported env syntax at line {i + 1}')
        name, value = match.groups()
        if value.startswith(b"'") and not re.fullmatch(rb"'(?:[^'\\]|\\.)*'[ \t]*(?:#.*)?", value):
            refuse(f'multiline or ambiguous quoted value at line {i + 1}')
        if value.startswith(b'"') and not re.fullmatch(rb'"(?:[^"\\]|\\.)*"[ \t]*(?:#.*)?', value):
            refuse(f'multiline or ambiguous quoted value at line {i + 1}')
        if name == b'KEEPER_PRIVATE_KEY':
            if not line.startswith(b'KEEPER_PRIVATE_KEY='):
                refuse(f'noncanonical KEEPER_PRIVATE_KEY declaration at line {i + 1}')
            matches.append(i)
    if len(matches) != 1:
        refuse(f'expected exactly 1 KEEPER_PRIVATE_KEY line, found {len(matches)}')
    i = matches[0]
    ending = b'\r\n' if lines[i].endswith(b'\r\n') else b'\n' if lines[i].endswith(b'\n') else b''
    lines[i] = b'KEEPER_PRIVATE_KEY=' + key + ending
    return b''.join(lines)


temporary = None
replaced = False
try:
    filename = sys.argv[1]
    if filename in ('.', '..') or os.path.basename(filename) != filename:
        refuse('env filename must be a basename')
    with os.fdopen(3, 'rb') as incoming:
        raw_key = incoming.read(4097)
    key = raw_key.strip()
    if len(raw_key) > 4096 or not re.fullmatch(rb'0x[0-9a-fA-F]{64}', key):
        refuse('key must be one 0x + 64 hex value on stdin')
    if not 0 < int(key, 16) < 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141:
        refuse('key is outside the secp256k1 scalar range')
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
        updated = transform(source, key)
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
    print('ok: 1 line replaced atomically; no old-key backup created')
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
