#!/usr/bin/env python3
"""Run a command on a pseudo-terminal and answer its prompts (test/fixtures/deploy-rehearsal.sh):

    drive_terminal.py <answers.json> <command...>

answers.json is a list of [prompt substring, line to type] pairs; each is typed once, when its prompt first appears.
The command's output goes to stdout as it arrives; the exit status is the command's (timeout after an hour)."""
import json, os, pty, select, sys, time
answers = json.load(open(sys.argv[1]))
pid, fd = pty.fork()
if pid == 0:
    os.execvp(sys.argv[2], sys.argv[2:])
seen, done = b'', set()
deadline = time.monotonic() + 3600
while True:
    ready = select.select([fd], [], [], 0.2)[0]
    if ready:
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            chunk = b''
        if chunk:
            sys.stdout.buffer.write(chunk); sys.stdout.flush()
            seen += chunk
            for i, (prompt, answer) in enumerate(answers):
                if i not in done and prompt.encode() in seen:
                    done.add(i)
                    os.write(fd, answer.encode() + b'\n')
            continue
    finished, status = os.waitpid(pid, os.WNOHANG)
    if finished:
        sys.exit(os.waitstatus_to_exitcode(status))
    if time.monotonic() > deadline:
        sys.exit('timeout')
