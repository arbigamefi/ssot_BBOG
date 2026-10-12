#!/usr/bin/env python3
"""Term-by-term comparison of two certificate compositions, for reviewers.

    python3 script/certificate/compare.py <older composition json> <newer composition json>

The older one is usually certificate v4's composition-v4.json (dist/landing-2026-10-08/certificate-v4/ in the
clean-slate archive, docs/release/evidence.md). Prints every term, ledger row and measure of both with the
difference; a term present in only one of them is shown as such. Reads only the two files.
"""
import json
import sys


def table(title, a, b):
    print(f'\n{title}')
    print(f"  {'':42s} {'older':>11s} {'newer':>11s} {'difference':>11s}")
    for key in list(a) + [k for k in b if k not in a]:
        x, y = a.get(key), b.get(key)
        diff = f'{y - x:+,}' if isinstance(x, int) and isinstance(y, int) else ''
        fx = f'{x:,}' if isinstance(x, int) else ('—' if x is None else str(x))
        fy = f'{y:,}' if isinstance(y, int) else ('—' if y is None else str(y))
        print(f'  {key:42s} {fx:>11s} {fy:>11s} {diff:>11s}')


def measures(c):
    out = {}
    for r in c['measures']:
        name = f"{r['moduleMeasure'].split(' ')[0]} / {r['boundaryTreatment']}"
        out[f'{name}: requirement'] = r['requirementAtConsumerEntry']
        out[f'{name}: margin'] = r['margin']
    return out


def main():
    old, new = (json.load(open(p)) for p in sys.argv[1:3])
    table('Terms', old['terms'], new['terms'])
    table('Ledger split', old['ledgerSplit'], new['ledgerSplit'])
    table('Ledger split total', {'total': sum(old['ledgerSplit'].values())}, {'total': sum(new['ledgerSplit'].values())})
    table('Module bounds (interpreter)', old['moduleBoundsByModule']['interpreter'],
          {k.replace('Module', ''): v for k, v in new['moduleBoundsByModule']['interpreter'].items()})
    table('Measures', measures(old), measures(new))
    print(f"\nstatus: {old['status']} -> {new['status']}")


if __name__ == '__main__':
    main()
