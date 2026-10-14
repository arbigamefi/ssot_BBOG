#!/usr/bin/env python3
"""Run a command on a pseudo-terminal and answer its prompts (test/fixtures/deploy-rehearsal.sh):

    drive_terminal.py <answers.json> <command...>

answers.json is a list of [prompt substring, line to type] pairs; each is typed once, when its prompt first appears.
The command's output goes to stdout as it arrives. The exit status is the command's (128 + the signal if a signal
ended it), but 1 if it exited 0 without asking every prompt, and 124 after DRIVE_TERMINAL_TIMEOUT_SECONDS (3,600) of
running, checked on every pass whether or not output keeps coming. On any exit, a TERM or HUP to this driver included,
the command's process group is stopped: TERM, then KILL after DRIVE_TERMINAL_GRACE_SECONDS (5), and the command is
reaped."""
import json
import os
import pty
import select
import signal
import sys
import time

TIMEOUT = float(os.environ.get('DRIVE_TERMINAL_TIMEOUT_SECONDS', '3600'))
GRACE = float(os.environ.get('DRIVE_TERMINAL_GRACE_SECONDS', '5'))


def exit_code(status):
    return 128 + os.WTERMSIG(status) if os.WIFSIGNALED(status) else os.WEXITSTATUS(status)


def stop(pid, reaped):
    """TERM the process group, KILL it after the grace period; reap the command unless it was reaped already."""
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(pid, sig)
        except ProcessLookupError:
            break
        end = time.monotonic() + GRACE
        while time.monotonic() < end:
            if not reaped and os.waitpid(pid, os.WNOHANG)[0]:
                reaped = True
            try:
                os.killpg(pid, 0)
            except ProcessLookupError:
                return
            time.sleep(0.05)
    if not reaped:
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass


def main():
    answers = json.load(open(sys.argv[1]))
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(sys.argv[2], sys.argv[2:])
    seen, done, reaped = b'', set(), False
    deadline = time.monotonic() + TIMEOUT
    try:
        for sig in (signal.SIGTERM, signal.SIGHUP):
            signal.signal(sig, lambda signum, frame: sys.exit(128 + signum))
        while True:
            if time.monotonic() > deadline:
                print(f'drive_terminal: timeout after {TIMEOUT:g} s', file=sys.stderr)
                return 124
            ready = select.select([fd], [], [], 0.2)[0]
            chunk = b''
            if ready:
                try:
                    chunk = os.read(fd, 4096)
                except OSError:
                    pass
            if chunk:
                sys.stdout.buffer.write(chunk)
                sys.stdout.flush()
                seen += chunk
                for i, (prompt, answer) in enumerate(answers):
                    if i not in done and prompt.encode() in seen:
                        done.add(i)
                        os.write(fd, answer.encode() + b'\n')
                continue
            finished, status = os.waitpid(pid, os.WNOHANG)
            if finished:
                reaped = True
                code = exit_code(status)
                missing = [prompt for i, (prompt, _) in enumerate(answers) if i not in done]
                if code == 0 and missing:
                    print(f'drive_terminal: the command exited 0 without asking {missing}', file=sys.stderr)
                    return 1
                return code
    finally:
        stop(pid, reaped)


if __name__ == '__main__':
    sys.exit(main())
