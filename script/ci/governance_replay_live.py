#!/usr/bin/env python3
"""Replay a recorded deployment's governance history on a live RPC: in full, and from a committed checkpoint.

    python3 script/ci/governance_replay_live.py <fixture.json> <rpc-url>

The fixture is a release snapshot plus a fixed, finalized range: `_replayEnd`, the expected checkpoint digest there
(`_expectedCheckpointSha256`) and an anchor checkpoint file with its digest (`_anchorCheckpoint`,
`_anchorCheckpointSha256`). The full replay from the deployment block and the replay from the anchor must both
reproduce the expected digest. Page, call, retry and timing figures are printed; the RPC URL never is.
"""
import collections
import importlib.util
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('verify_governance', ROOT / 'script/release/verify_governance.py')
vg = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(vg)


class CountingRpc(vg.Rpc):
    def __init__(self, url):
        super().__init__(url)
        self.methods = collections.Counter()

    def __call__(self, method, params):
        self.methods[method] += 1
        return super().__call__(method, params)


def replay(url, snap, block, checkpoint=None):
    rpc = CountingRpc(url)
    started = time.monotonic()
    head = rpc('eth_getBlockByNumber', [hex(block), False])
    vg.require(isinstance(head, dict) and isinstance(head.get('hash'), str), 'replay end block unavailable')
    state = vg.verify_permissions(rpc, snap, block, checkpoint)
    document = vg.checkpoint_document(snap, state, block, head['hash'])
    first = snap['blockNumber'] if checkpoint is None else checkpoint['blockNumber'] + 1
    report = {'from': first, 'to': block, 'logPages': rpc.methods['eth_getLogs'], 'calls': rpc.calls,
              'retries': rpc.retries, 'seconds': round(time.monotonic() - started, 1)}
    return vg.checkpoint_digest(document), report


def main():
    fixture_path = Path(sys.argv[1])
    fixture = json.loads(fixture_path.read_text())
    url = sys.argv[2]
    end, expected = fixture['_replayEnd'], fixture['_expectedCheckpointSha256']
    anchor = vg.load_checkpoint(fixture_path.parent / fixture['_anchorCheckpoint'], fixture['_anchorCheckpointSha256'])

    digest, report = replay(url, fixture, end)
    print('full replay', json.dumps(report), flush=True)
    vg.require(digest == expected, 'full replay differs from the recorded checkpoint')
    digest, report = replay(url, fixture, end, anchor)
    print('replay from the anchor checkpoint', json.dumps(report), flush=True)
    vg.require(digest == expected, 'incremental replay differs from the recorded checkpoint')
    print('ok: both replays reproduce checkpoint', expected[:16])


if __name__ == '__main__':
    try:
        main()
    except vg.VerificationError as error:
        sys.exit('governance replay failed: ' + str(error))
