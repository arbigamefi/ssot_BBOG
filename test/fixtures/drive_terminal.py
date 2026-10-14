#!/usr/bin/env python3
"""Run a command on a pseudo-terminal and answer its prompts (test/fixtures/deploy-rehearsal.sh):

    drive_terminal.py <answers.json> <command...>

answers.json is a list of [prompt substring, line to type] pairs; each is typed once, when its prompt first appears.
The command's output goes to stdout as it arrives. The exit status is the command's (128 + the signal if a signal
ended it), but 1 if it exited 0 without asking every prompt, 124 after DRIVE_TERMINAL_TIMEOUT_SECONDS (3,600) of
running, checked on every pass whether or not output keeps coming, and 128 + the signal when a TERM, HUP or INT to
this driver ended the run. However the run ends, the command's process group is then stopped: TERM, then KILL after
DRIVE_TERMINAL_GRACE_SECONDS (5), and the command is reaped. Signals arriving while it ends wait for that cleanup, and
a failed cleanup is reported without hiding the run's status (a run that would exit 0 exits 1)."""
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


def reap(pid, state):
    if not state['reaped']:
        try:
            state['reaped'] = os.waitpid(pid, os.WNOHANG)[0] != 0
        except ChildProcessError:
            state['reaped'] = True


def group_left(pid):
    """Whether a process of the command's group is left. Between a KILL and the reap macOS can answer EPERM for the
    group: that counts as left."""
    try:
        os.killpg(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def stop(pid, state):
    """TERM the process group, KILL it after the grace period; reap the command."""
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(pid, sig)
        except ProcessLookupError:
            break
        except PermissionError:
            pass
        end = time.monotonic() + GRACE
        while time.monotonic() < end:
            reap(pid, state)
            if not group_left(pid):
                return
            time.sleep(0.05)
    if not state['reaped']:
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass
        state['reaped'] = True


def drive(pid, fd, answers, state):
    seen, done = b'', set()
    deadline = time.monotonic() + TIMEOUT
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
            state['reaped'] = True
            code = exit_code(status)
            missing = [prompt for i, (prompt, _) in enumerate(answers) if i not in done]
            if code == 0 and missing:
                print(f'drive_terminal: the command exited 0 without asking {missing}', file=sys.stderr)
                return 1
            return code


def main():
    answers = json.load(open(sys.argv[1]))
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(sys.argv[2], sys.argv[2:])
    state = {'reaped': False, 'ending': False}

    def on_signal(signum, frame):
        # The first signal ends the run and names its status; later ones wait for the cleanup.
        if not state['ending']:
            state['ending'] = True
            raise SystemExit(128 + signum)

    code = 1
    try:
        for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
            signal.signal(sig, on_signal)
        code = drive(pid, fd, answers, state)
    except SystemExit as ended:
        code = ended.code
    finally:
        state['ending'] = True
        try:
            stop(pid, state)
        except OSError as error:
            print(f'drive_terminal: stopping the command failed: {error}', file=sys.stderr)
            code = code or 1
    return code


if __name__ == '__main__':
    sys.exit(main())
