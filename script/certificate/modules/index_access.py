#!/usr/bin/env python3
"""M1 companion: attributes every unknown-address memory access recorded in module-bounds.json.

    python3 index_access.py <build directory>      (in the directory holding module-bounds.json)

The interpreter charges no memory expansion for an MLOAD/MSTORE whose address is unknown, which is sound only when
such an access stays inside memory that is already allocated. For each recorded access this proves that its
address was computed by a bounds-checked memory array index subroutine: the access is preceded by a return
JUMPDEST, the last `PUSH2 x; JUMP` before it targets a functionDebugData entry point, and that subroutine checks
`index < bound` (JUMPI to a Panic(0x32) site) before returning `base + index * 32`. Source maps come from the
build's compiler output (build.py), whose runtimes equal out/. Port of certificate v4's keno_index_access.py,
which recompiled the sealed input to obtain the same source maps. Writes index-access.json.
"""
import hashlib
import json
import sys
from pathlib import Path

B = Path.cwd()


def disasm(code):
    pcs, insns, pc = {}, [], 0
    while pc < len(code):
        op = code[pc]
        n = op - 0x5f if 0x60 <= op <= 0x7f else 0
        pcs[pc] = len(insns)
        insns.append((pc, op, int.from_bytes(code[pc + 1:pc + 1 + n], 'big') if n else None))
        pc += 1 + n
    return pcs, insns


def srcmap(s):
    entries, prev = [], ['', '', '', '', '']
    for item in s.split(';'):
        cur = prev[:]
        for k, p in enumerate(item.split(':')):
            if p != '':
                cur[k] = p
        entries.append(cur)
        prev = cur
    return entries


def main():
    build = Path(sys.argv[1])
    bounds = json.loads((B / 'module-bounds.json').read_text())
    result, total = {'modules': {}}, 0
    for name, rec in bounds.items():
        o = json.loads((build / f'{name}-solc-output.json').read_text())
        ids = {v['id']: p for p, v in o['sources'].items()}
        db = next(cs[name] for cs in o['contracts'].values() if name in cs)['evm']['deployedBytecode']
        code = bytes.fromhex(db['object'])
        assert hashlib.sha256(code).hexdigest() == rec['runtimeSha256'], name
        pcs, insns = disasm(code)
        sm = srcmap(db['sourceMap'])
        entry = {d['entryPoint']: n for n, d in db['functionDebugData'].items() if d.get('entryPoint') is not None}
        out_acc = []
        for a in rec.get('unknownAddressMemoryAccesses', []):
            pc = a['pc']
            i = pcs[pc]
            assert insns[i][1] in (0x51, 0x52) and insns[i - 1][1] == 0x5b, f'{name} pc {pc}: not a return point'
            j = i - 2                                      # last PUSH2 x; JUMP before the return JUMPDEST
            while not (insns[j][1] == 0x56 and insns[j - 1][1] == 0x61):
                j -= 1
            target = insns[j - 1][2]
            sub = entry.get(target)
            assert sub is not None, f'{name} pc {pc}: call target {target} is not a functionDebugData entry'
            # JUMPDEST; SWAP1; PUSH1 bound; DUP2; LT; ISZERO; PUSH2 panic; JUMPI; PUSH1 5; SHL; ADD; SWAP1
            k = pcs[target]
            body = [insns[k + t] for t in range(12)]
            ops = [b[1] for b in body]
            assert ops == [0x5b, 0x90, 0x60, 0x81, 0x10, 0x15, 0x61, 0x57, 0x60, 0x1b, 0x01, 0x90] and body[8][2] == 5, \
                f'{name} pc {pc}: unexpected subroutine shape {ops}'
            bound, panic_pc = body[2][2], body[6][2]
            panic = [insns[pcs[panic_pc] + t] for t in range(12)]
            # JUMPDEST; PUSH4 0x4e487b71; PUSH1 0xe0; SHL; PUSH0; MSTORE; PUSH1 0x32; PUSH1 0x04; MSTORE; PUSH1 0x24; PUSH0; REVERT
            assert panic[0][1] == 0x5b and panic[1][1] == 0x63 and panic[1][2] == 0x4e487b71 and panic[6][1] == 0x60 \
                and panic[6][2] == 0x32 and panic[11][1] == 0xfd, f'{name} pc {pc}: JUMPI target is not Panic(0x32)'
            s, l, f, _, _ = sm[i]
            out_acc.append({'pc': pc, 'opcode': 'MLOAD' if insns[i][1] == 0x51 else 'MSTORE', 'subroutine': sub,
                            'subroutineEntryPoint': target, 'indexBound': bound, 'panicSite': panic_pc,
                            'panicCode': '0x32', 'sourceMapFile': ids.get(int(f)) if int(f) >= 0 else None,
                            'sourceMapOffset': int(s), 'sourceMapLength': int(l)})
        result['modules'][name] = {'accesses': out_acc}
        total += len(out_acc)
    (B / 'index-access.json').write_text(json.dumps(result, indent=2) + '\n')
    for name, rec in result['modules'].items():
        for a in rec['accesses']:
            print(name, a['pc'], a['opcode'], '->', a['subroutine'], 'bound', a['indexBound'], 'panic at', a['panicSite'])
    print('attributed accesses:', total)


if __name__ == '__main__':
    main()
