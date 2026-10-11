"""Replace the keeper's two RPC endpoints in its env file, reading them from stdin only.

    python3 set_keeper_rpc_env.py <env-path> <base-sepolia|base-mainnet> < endpoints.json

stdin is one JSON object with KEEPER_RPC_HTTP (Infura) and KEEPER_RPC_WS (Alchemy) for that network. The file must
hold exactly one canonical `NAME=` line for each; both are replaced in one atomic rename that keeps the mode and owner
and leaves no copy of the old values. Nothing derived from a value is ever printed. set-keeper-rpc.sh runs this on the
keeper host; tests run it on synthetic files.
"""
import fcntl
import json
import os
import re
import stat
import sys
import tempfile

NAMES = ('KEEPER_RPC_HTTP', 'KEEPER_RPC_WS')
KEY = r'[0-9A-Za-z_-]{16,128}'


def refuse(message):
    raise ValueError(message)


def endpoints(raw, network):
    if len(raw) > 4096:
        refuse('stdin is too large')
    try:
        values = json.loads(raw)
    except ValueError:
        refuse('stdin is not one JSON object')
    if not isinstance(values, dict) or set(values) != set(NAMES):
        refuse('stdin must name exactly KEEPER_RPC_HTTP and KEEPER_RPC_WS')
    shapes = {'KEEPER_RPC_HTTP': rf'https://{network}\.infura\.io/v3/{KEY}',
              'KEEPER_RPC_WS': rf'wss://{network}\.g\.alchemy\.com/v2/{KEY}'}
    for name, shape in shapes.items():
        if not isinstance(values[name], str) or not re.fullmatch(shape, values[name]):
            refuse(f'{name} is not a {network} endpoint of its provider')
    return {name: values[name].encode() for name in NAMES}


def transform(source, values):
    if b'\r' in source.replace(b'\r\n', b''):
        refuse('bare carriage returns are not supported')
    lines = source.splitlines(keepends=True)
    found = {name: [] for name in NAMES}
    for index, line in enumerate(lines):
        for name in NAMES:
            if line.startswith(name.encode() + b'='):
                found[name].append(index)
            elif re.match(rb'[ \t]*(?:export[ \t]+)?' + name.encode() + rb'[ \t]*[=:]', line):
                refuse(f'noncanonical {name} declaration at line {index + 1}')
    for name, indexes in found.items():
        if len(indexes) != 1:
            refuse(f'expected exactly 1 {name} line, found {len(indexes)}')
        index = indexes[0]
        line = lines[index]
        ending = b'\r\n' if line.endswith(b'\r\n') else b'\n' if line.endswith(b'\n') else b''
        lines[index] = name.encode() + b'=' + values[name] + ending
    return b''.join(lines)


def main():
    temporary = None
    replaced = False
    try:
        if len(sys.argv) != 3 or sys.argv[2] not in ('base-sepolia', 'base-mainnet'):
            refuse('usage: set_keeper_rpc_env.py <env-path> <base-sepolia|base-mainnet>')
        path = os.path.abspath(sys.argv[1])
        values = endpoints(sys.stdin.buffer.read(4097), sys.argv[2])
        directory, filename = os.path.split(path)
        # The same cooperating lock as swap-keeper-key.sh; it holds no secret and is never unlinked.
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
            updated = transform(source, values)
            descriptor, temporary = tempfile.mkstemp(prefix='.' + filename + '.rpc-', dir=directory)
            with os.fdopen(descriptor, 'wb') as output:
                os.fchmod(output.fileno(), stat.S_IMODE(before.st_mode))
                os.fchown(output.fileno(), before.st_uid, before.st_gid)
                output.write(updated)
                output.flush()
                os.fsync(output.fileno())
            # Detect an edit made outside the cooperating lock protocol.
            with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as current:
                now = os.fstat(current.fileno())
                if (now.st_dev, now.st_ino, now.st_nlink) != (before.st_dev, before.st_ino, 1) or current.read() != source:
                    refuse('env changed during replacement; retry from the current file')
            os.replace(temporary, path)
            temporary = None
            replaced = True
            directory_descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_descriptor)
            finally:
                os.close(directory_descriptor)
        print('ok: KEEPER_RPC_HTTP and KEEPER_RPC_WS replaced atomically; no copy of the old values kept')
        print('file: ' + path)
    except Exception as error:
        if temporary is not None:
            try:
                os.unlink(temporary)
            except OSError:
                pass
        # Never echo the source, a value or an arbitrary I/O exception payload.
        detail = str(error) if isinstance(error, ValueError) else type(error).__name__
        state = 'replacement installed; durability unconfirmed' if replaced else 'original file not replaced'
        print(f'aborted: {state}; {detail}', file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
