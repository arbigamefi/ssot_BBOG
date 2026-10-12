# First-callback gas certificate tools

These scripts compute the first-callback gas certificate on a checkout: an upper bound on the gas the first VRF
callback needs to settle a k > 0 casino position, compared with the gas the consumer receives at `VRFHub` entry
(2,447,746, `VRFHub.MAX_CALLBACK_GAS`). The domain table is `script/release/first-callback-domain-84532.json`; the
certificate document is `docs/audit/first-callback-gas-certificate-2026-10-07.md`. Certificate v5 covers the
launch candidate (`docs/release/launch-candidate.zh-CN.md` §10); it was computed on freeze commit `1a5e9df00` into
`freeze-2026-10-12/certificate/`, whose seal the domain file cites (copy in `script/release/certificates/
first-callback-v5/`).

```sh
forge build src
python3 script/certificate/certify.py <new output directory>
```

The output directory must not exist. The run takes about 1.5 hours, almost all of it in the module stage (Baccarat
at 25 rounds needs about 32 GiB per process; `--memory-gib` and `--jobs` bound the parallel module jobs). Each
stage copies its scripts next to its outputs and runs there, so the output directory holds the exact code that
produced every file, and `MANIFEST.sha256` lists them all.

## Stages

| Stage | Scripts | Output | What it establishes |
| --- | --- | --- | --- |
| build | `build.py` | `build/BUILD.json`, standard-JSON input and output per contract | The pinned solc, given each Forge artifact's settings and this checkout's sources, emits the artifact's runtime byte for byte (O3) |
| frames | `protocol/frames.py`, `frame_bound.py`, `env_frame_bound.py` | `protocol/frame-bounds.json` | Own-instruction bound of every frame on the path: VRFHub, GameHub outer and child, Router, Bank and its getters, the referral engine, the Vault frame and getters |
| tree | `tree/*` | `tree/suffix-skip-tree-component.json` | The Vault tree component (selector, push, lazy update) over every 40-bit endpoint |
| modules | `modules/module_bounds.py`, `index_access.py`, `concrete_oracle.py` | `module-bounds.json`, `module-rounds.json`, `index-access.json`, `m6-cases.json` | Module bounds at 25 rounds over every params length class (M3), monotone in the round count (M7), unknown-address memory accesses attributed (M1), oracle cases for the gas-for-gas check (M6) |
| ledger | `ledger/ledger.py` | `ledger/ledger.json` | Storage, first-touch, event and account-access charges, split by frame |
| bindings | `bindings/bindings.py` | `bindings/component-bindings.json` | Reused reviewed components still describe this code; constants read from the compiled sources |
| composition | `composition.py` | `composition.json` | Nested EIP-150 composition, four measures, O1/O2, margin floor 50,000, void settlement gas |

M6's EVM side is the Foundry test `test/unit/ModuleGasOracle.t.sol`, which runs with the test suite; the
module stage requires `test/helpers/certificate/m6-cases.json` to equal the cases the oracle produces on the build.

## Frame bounds

All frames are bounded by the exact-bytecode interpreter of certificate v4 under the ledger convention (SLOAD 100,
SSTORE, LOG and account access 0, memory expansion exact), so each storage, event and access charge is priced
once, in the ledger. Unknown values fork every branch they reach; reverting paths are dropped; the bound is the
longest successful path.

The GameHub child (`finalizeFromCallback`) and outer frame (`onRandomWords`) decode dynamic return data and copy a
stored `bytes` value, so with unknown words their loops never close. `env_frame_bound.py` adds a declared
environment: the words each call returns (canonical encodings; every other word unknown) and the stored params
length word. `frames.py` finds the call sites and that load from GameHub's own function table and maximises over
every awards count (0–3, the referral engine's L0, L1, L2) and params length (32–64 bytes). Run on the runtime of
certificate H1 (2026-10-04), the same environment model gives 12,645 for the child and 4,456 for the outer frame, under
the curated bounds of that review (13,092 and 4,541); on Bank's two getters, which need no environment,
`frame_bound.py` reproduces the curated 525 and 1,647 exactly.

## Provenance

Digests of the sealed certificate v4 files are those in its seal `CERTIFICATE-v4.sha256`
(`landing-2026-10-08/certificate-v4/` in the clean-slate archive; a copy is in `script/release/certificates/
first-callback-v4/` at commit `4a5762aa3`); the 2026-10-04 files are members of the superseded archive
(`docs/release/evidence.md`).

| File | Origin | Change |
| --- | --- | --- |
| `modules/pure_module_bound.py` | v4 `modules/pure_module_bound.py` (`fda13e23…`) | none |
| `modules/concrete_oracle.py` | v4 `modules/concrete_oracle.py` (`9a411763…`) | none |
| `protocol/frame_bound.py` | v4 `protocol/frame_bound.py` (`d01a0ee9…`) | none |
| `tree/analyze_success_cfg.py`, `tree/query-cold-joint-dp.py` | v4 (`ab85d5cf…`, `5f9dc0fd…`) | none |
| `tree/analyze_prefix_segments.py`, `tree/analyze_query_segments.py` | v4 (`7b72041a…`, `7eb29c57…`) | Anchors are function-relative and name the forced side of each JUMPI; the runtime is bound through `compiler-identity.json`; the `k == 0` selector segment is gone with that branch (B4) |
| `tree/suffix-skip-joint-dp.py` | v4 (`e36b524c…`) | Runtime digest, size and loop head read from its inputs |
| `modules/module_bounds.py` | v4 `modules/module_bounds_v4.py` (`ce11d75d…`) | Adds M7 (errata E4) and runs each job in its own process under a memory budget |
| `modules/index_access.py` | v4 `modules/keno_index_access.py` (`bcec0ce3…`) | Reads source maps from the build instead of recompiling |
| `test/unit/ModuleGasOracle.t.sol`, `m6-cases.json` | v4 (`7fb91321…`, `36778503…`) | Case path and comment; the cases are byte-identical |
| `ledger/ledger.py` | 2026-10-04 `protocol/fixed-components.py` (`03403be8…`) and the takeover-2026-10-07 frame split | Bank keeps turnover and open holds in one slot (ADR-0037 §5): 453,000 becomes 436,000; event prices from the build's ABIs |
| `bindings/bindings.py` | v4 `bindings/component_bindings.py` (`27f1e51b…`) | Binds reused components (`reused.json`) and reads the composition's constants from the sources |
| `composition.py` | v4 `composition_v4.py` (`991c131c…`) | Same rule, placement and O1/O2; terms from this run's stage outputs; margin floor; void settlement gas |
| `protocol/env_frame_bound.py`, `protocol/frames.py`, `build.py`, `certify.py`, `common.py` | new | |

`reused.json` lists the independently reviewed components taken over unchanged, each with the sealed evidence and
the code it was computed on: the USDC callee bodies (bound to the token runtimes the domain file pins), the
2026-10-04 static module bounds (the secondary measure, bound to unchanged module executable code), the Vault frame
constants and the ledger components.

Certificate v4 reproduces from the archived evidence with `script/certificate/reproduce_first_callback_v4.py` on a
checkout of `4a5762aa3`, the last commit with the v4 contracts; the script was removed from later commits when v5
replaced v4 in the domain file.
