#!/usr/bin/env python3
"""Module bounds for the composition and the round check M7, computed on the certified build.

    python3 module_bounds.py run [--memory-gib N] [--jobs N]    (in a directory holding modules-solc-output.json)

Main term (as certificate v4): every module fully unrolled at 25 rounds over every admitted params length class (M3),
with the memory accesses through unknown addresses recorded (M1). Writes module-bounds.json.

M7 (certificate v4 errata E4, review R-1): the composition charges the 25-round bound for every round count 1..25,
so the bound must not decrease with the round count. Every module below is checked at every round count 1..25 over
every length class; Keno and Baccarat, whose unrolling grows fastest, at the round counts in SAMPLED with the 32-byte
class (one-word modules give the same bound in every class, M3). Writes module-rounds.json.

Each (module, rounds, length) runs in its own process. Jobs start heaviest first while their estimated peak memory
fits the budget, so the run finishes in about the time of the slowest job instead of the sum.
"""
import hashlib
import json
import os
from pathlib import Path
import resource
import subprocess
import sys
import threading
import time

import pure_module_bound as P

MODULES = ['CoinTossModule', 'DiceModule', 'SlotsModule', 'RouletteModule', 'PlinkoModule', 'SicBoModule',
           'KenoModule', 'BaccaratModule']
ROUNDS = 25
SAMPLED = {'KenoModule': [1, 2, 5, 10, 15, 20, 24], 'BaccaratModule': [1, 2, 3, 4, 5, 6, 7, 10, 15, 20, 24]}
# Peak memory at 25 rounds observed for certificate v4 (GiB); a job at n rounds is estimated at (n / 25)^2 of it.
PEAK_GIB = {'BaccaratModule': 32, 'KenoModule': 11, 'PlinkoModule': 8}


def job(name, n, plen):
    code, sel = P.load(name)
    P.UNKNOWN_MEM.clear()
    start = time.time()
    rows = []
    for prm in P.params_domain(name):
        r = P.run(code, sel, n, params=prm, params_len=plen, state_limit=400_000_000)
        rows.append({'params': [None if v == P.U else v for v in prm], **r})
    worst = max(rows, key=lambda r: r['maxSuccessGas'])
    return {'module': name, 'betCount': n, 'paramsLength': plen, 'bound': worst['maxSuccessGas'],
            'worstParams': worst['params'], 'paramsCases': len(rows),
            'abstractStates': sum(r['abstractStates'] for r in rows),
            'unknownAddressMemoryAccesses': sorted({(pc, op) for pc, op in P.UNKNOWN_MEM}),
            'seconds': round(time.time() - start, 1),
            'maxRssMiB': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // (1 << 20 if sys.platform == 'darwin' else 1 << 10)}


def plan():
    jobs = set()
    for name in MODULES:
        for plen in P.params_lengths(name):
            jobs.add((name, ROUNDS, plen))
        if name in SAMPLED:
            plen = 64 if name in P.TWO_WORD else 32
            jobs.update((name, n, plen) for n in SAMPLED[name])
        else:
            jobs.update((name, n, plen) for n in range(1, ROUNDS) for plen in P.params_lengths(name))
    return sorted(jobs, key=lambda j: (-estimate(j), j))


def estimate(j):
    name, n, _ = j
    return max(1.0, PEAK_GIB.get(name, 1) * (n / ROUNDS) ** 2)


def run_all(memory_gib, workers):
    jobs = plan()
    results, lock, cond = {}, threading.Lock(), threading.Condition()
    state = {'memory': 0.0, 'running': 0}

    def worker():
        while True:
            with cond:
                while True:
                    if not jobs:
                        return
                    j = next((j for j in jobs if state['memory'] + estimate(j) <= memory_gib), None)
                    if j is not None and state['running'] < workers:
                        jobs.remove(j)
                        state['memory'] += estimate(j)
                        state['running'] += 1
                        break
                    cond.wait()
            proc = subprocess.run([sys.executable, __file__, 'job', j[0], str(j[1]), str(j[2])],
                                  capture_output=True, text=True)
            with cond:
                state['memory'] -= estimate(j)
                state['running'] -= 1
                cond.notify_all()
            if proc.returncode:
                raise SystemExit(f'module job {j} failed: {proc.stderr[-2000:]}')
            r = json.loads(proc.stdout)
            with lock:
                results[j] = r
                print(json.dumps({k: r[k] for k in ('module', 'betCount', 'paramsLength', 'bound', 'seconds',
                                                    'maxRssMiB')}), flush=True)

    threads = [threading.Thread(target=worker) for _ in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    if len(results) != len(plan()):
        raise SystemExit('module bounds: some jobs did not finish')
    return results


def owner(name, pc):
    o = json.loads((P.B / 'modules-solc-output.json').read_text())
    for cs in o['contracts'].values():
        if name in cs:
            fdd = cs[name]['evm']['deployedBytecode']['functionDebugData']
            best = None
            for entry, fname in sorted((v['entryPoint'], k) for k, v in fdd.items() if v['entryPoint'] is not None):
                if entry <= pc:
                    best = fname
            return best


def summarise(results):
    bounds, rounds = {}, {}
    for name in MODULES:
        code, _ = P.load(name)
        main = [r for (m, n, _), r in results.items() if m == name and n == ROUNDS]
        worst = max(main, key=lambda r: (r['bound'], r['paramsLength']))
        unknown = sorted({(pc, op) for r in main for pc, op in r['unknownAddressMemoryAccesses']})
        bounds[name] = {
            'runtimeSha256': hashlib.sha256(code).hexdigest(), 'betCount': ROUNDS, 'bound': worst['bound'],
            'worstParams': worst['worstParams'], 'worstParamsLength': worst['paramsLength'],
            'byParamsLength': {str(r['paramsLength']): r['bound'] for r in sorted(main, key=lambda r: r['paramsLength'])},
            'unknownAddressMemoryAccesses': [{'opcode': hex(op), 'function': owner(name, pc), 'pc': pc}
                                             for pc, op in unknown],
            'cases': sorted(main, key=lambda r: r['paramsLength'])}
        by_n = {}
        for (m, n, _), r in results.items():
            if m == name:
                by_n[n] = max(by_n.get(n, 0), r['bound'])
        ns = sorted(by_n)
        rounds[name] = {'roundCounts': ns, 'boundByRounds': {str(n): by_n[n] for n in ns},
                        'lengthClasses': 'one (32 or 64 bytes)' if name in SAMPLED else 'all',
                        'nonDecreasing': all(by_n[a] <= by_n[b] for a, b in zip(ns, ns[1:])),
                        'maximumAt25': max(by_n.values()) == by_n[ROUNDS]}
    return bounds, rounds


def main():
    if sys.argv[1] == 'job':
        print(json.dumps(job(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))))
        return
    args = sys.argv[2:]
    memory = float(args[args.index('--memory-gib') + 1]) if '--memory-gib' in args else 90.0
    workers = int(args[args.index('--jobs') + 1]) if '--jobs' in args else max(1, (os.cpu_count() or 2) - 2)
    start = time.time()
    bounds, rounds = summarise(run_all(memory, workers))
    (P.B / 'module-bounds.json').write_text(json.dumps(bounds, indent=2) + '\n')
    (P.B / 'module-rounds.json').write_text(json.dumps(rounds, indent=2) + '\n')
    for name in MODULES:
        print(f"{name:16s} bound {bounds[name]['bound']:>8,}  M7 non-decreasing={rounds[name]['nonDecreasing']} "
              f"max at 25={rounds[name]['maximumAt25']}")
    print(f'module stage {round(time.time() - start)} s')
    if not all(r['nonDecreasing'] and r['maximumAt25'] for r in rounds.values()):
        raise SystemExit('M7 fails: a module bound decreases with the round count')


if __name__ == '__main__':
    main()
