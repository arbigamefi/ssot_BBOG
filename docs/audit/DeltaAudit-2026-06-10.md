> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# ArbiGameFi SSOT — Smart Contract Delta Security Assessment

| Field         | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Client        | ArbiGameFi (FanSwapOrg)                                                                    |
| Codebase      | `arbigamefi_ssot_project_all` (Foundry monorepo, contracts under `src/`)                   |
| Audit type    | Delta security assessment + system re-verification                                         |
| Baseline      | `FullAudit-2026-05-21.md` + `FullAudit-2026-05-Closure.md` (all findings closed)           |
| Review HEAD   | `3bb7cc2c67b42725529620b1e4c4925d76e82519` (2026-06-10)                                    |
| Delta window  | All `src/` changes after the 2026-05-21 baseline (4 commits, listed in §3)                 |
| Toolchain     | Foundry / forge 1.5.1-stable; solc 0.8.24; optimizer on (runs=20000); via-IR; EVM `cancun` |
| Reviewer      | AI-assisted review (Claude Opus 4.8), human-owned process                                  |
| Report date   | 2026-06-10                                                                                 |
| Report status | Final for the stated scope                                                                 |

---

## 1. Disclaimer

This assessment is a time-boxed, best-effort review of the source code at the stated
commit. It is not a guarantee of correctness, a warranty of fitness, or an endorsement
of the business model. Smart contracts deployed to public networks carry irreducible
risk; only formally verified code with formally verified compilers — and even then,
correct deployment parameters — can approach the absence of defects. Findings are
limited to the scope in §3. On-chain deployment state was **not** independently
verified against a live RPC during this review (see AGF-04).

This report was produced with AI assistance and reviewed against repository test and
documentation evidence. It should be read together with the prior human-process audit
artifacts under `docs/audit/`.

**Scope boundary.** This is a contract / deployment-readiness assessment. It
is **not** a product-level UI/UX acceptance review; frontend application
findings live in the companion report, and visual/interaction acceptance is a
separate workstream.

---

## 2. Executive Summary

The delta window contains four contract commits: three on `Bank.sol`
(observability counters, the risk-reserve/withdrawal-buffer split per ADR-0031,
and a constructor decimals hardening) and one on `GameHub.sol` (random-ready
liveness closure, matching the 2026-05-21 audit addendum).

**No Critical, High, or Medium severity issues were identified in the delta.**

The Bank changes are well-formed and, notably, **repair two latent defects** that
predate the delta window:

1. `maxWithdraw(owner)` previously ignored `owner` and returned the pool-wide
   outflow cap — an EIP-4626 semantic violation for integrators. It now returns
   `min(cap, ownerAssets)`.
2. The ERC-4626 `Deposit`/`Withdraw` events were declared but never emitted.
   All four flows (`deposit`/`mint`/`withdraw`/`redeem`) now emit them
   (ADR-0030), which also unblocks event-based LP-ledger indexing.

The accounting invariants that protect funds — `NAV = B − PF − XP`, `NAV ≥ R`,
risk-in gated by `riskReserveBps` (A4R), optional outflows gated by
`withdrawalBufferBps` against pre-outflow NAV (A4) — were re-verified by manual
review and by the full proof suite at HEAD:

- Full Foundry suite: **27 suites, 130 passed / 0 failed / 1 skipped** (the skip
  is `test/fork/*` auto-skipping without an RPC env, per ADR-0023).
- Invariant suites: **7/7 pass** at 256 runs × 128,000 calls each, including
  router/bank reserve equivalence and cross-pool isolation.
- `BankObservability.t.sol`: **6/6 pass**, directly covering every delta behavior.

The most material risk found is **not in the Solidity** but at the
contract↔consumer boundary: `getSSOT()` grew from a 14-field to a 20-field
struct with six fields inserted mid-struct. A stale ABI on any consumer
mis-decodes every field after index 7. We verified the frontend's published
per-chain ABIs and embedded release manifests are aligned (20-field) for both
Base (8453) and Base Sepolia (84532); residual staleness exists only in
non-runtime artifacts (AGF-03) and one operator runbook (AGF-01, already fixed
in the uncommitted working tree). A CI drift guard for exactly this class of
bug (`script/ci/check_bank_abi_drift.py`) is present, uncommitted, in the
working tree and was reviewed favorably (§8.3).

| Severity      | Count | Open | Resolved | Acknowledged |
| ------------- | ----- | ---- | -------- | ------------ |
| Critical      | 0     | —    | —        | —            |
| High          | 0     | —    | —        | —            |
| Medium        | 0     | —    | —        | —            |
| Low           | 4     | 1    | 1        | 2            |
| Informational | 4     | 2    | 2        | —            |

---

## 3. Scope

### 3.1 Delta commits (full manual review)

| Commit      | Title                                         | Files (contracts)                        |
| ----------- | --------------------------------------------- | ---------------------------------------- |
| `f4d5bd315` | Add Bank observability counters               | `Bank.sol`, `IBank.sol`                  |
| `37d56dcf6` | Split bank risk reserve and withdrawal buffer | `Bank.sol`, `IBank.sol`, `SSOTTypes.sol` |
| `d4631883d` | Harden bank decimals deployment checks        | `Bank.sol`                               |
| `ce2e1c23b` | Close GameHub random-ready liveness gap       | `GameHub.sol`                            |

### 3.2 Supporting contracts (full manual review at HEAD)

- `src/core/Bank.sol` (738 LoC — entire contract, not only the diff)
- `src/core/SettlementRouter.sol` (111 LoC — sole caller of Bank's bet-funds interface)
- `src/core/PoolRegistry.sol` (107 LoC)
- `src/core/interfaces/{IBank,SSOTTypes}.sol`
- `src/libs/AccountingLib.sol`
- `src/access/Governable.sol`

### 3.3 Verification-level review (tests + prior closure relied upon)

`GameHub.sol` (827 LoC, excluding the reviewed delta), `VRFHub.sol`,
`SportsHub.sol`, `SportsRiskEngine.sol`, the eight game modules, referral
engine/registry, and the Chainlink wrapper adapter. These were fully covered by
`FullAudit-2026-05.md` / `FullAudit-2026-05-21.md` (all findings closed) and are
exercised at HEAD by the diff/invariant/unit suites listed in §7. No source
changes occurred in these files inside the delta window.

### 3.4 Out of scope

- Live on-chain deployment state (no RPC during review) — see AGF-04.
- Off-chain systems: keeper, web frontend, Postgres bet index (covered by the
  separate frontend assessment).
- Economic parameter choices (house-edge values, bps levels) as business policy.
- Fee-on-transfer / rebasing ERC-20 assets — explicitly excluded by the threat
  model (`docs/audit/threat-model.md`); the new constructor decimals check
  tightens, but does not replace, this assumption.

---

## 4. Methodology

1. **Documentation-first**: SSOT constitution v1.3, ExecutableSSOT, ADRs
   0002/0003/0007/0012/0030/0031, `invariants-map.md`, `threat-model.md`, prior
   audit reports and their closure files.
2. **Manual line-by-line review** of the delta commits and the full text of the
   contracts in §3.2, checking each change against the documented invariants
   (A1–A4, A4R, B3/B4, E2/E3, LIVE, X1).
3. **Boundary analysis** of the ERC-4626-like surface: rounding directions,
   `maxWithdraw`/`withdraw` and `maxRedeem`/`redeem` consistency, pause
   semantics, allowance handling.
4. **ABI/struct drift analysis**: structural comparison of the `getSSOT` output
   tuple across the compiled artifact (`out/Bank.sol/Bank.json`), the
   frontend-published per-chain ABIs, historical fixture bundles, and
   `deployments/` artifacts; verification of the frontend SDK decode path
   (by-name field access over a viem-decoded tuple).
5. **Dynamic verification**: full Foundry suite, targeted unit suite, and
   invariant suites executed at HEAD (results in §7).

### 4.1 Severity classification

Severity = f(Impact, Likelihood), per common industry practice:

| Impact \ Likelihood | High     | Medium | Low           |
| ------------------- | -------- | ------ | ------------- |
| **High**            | Critical | High   | Medium        |
| **Medium**          | High     | Medium | Low           |
| **Low**             | Medium   | Low    | Informational |

Operational/documentation issues that can cause an incorrect human action during
an incident are classified by the impact of that action.

---

## 5. System Overview (as relevant to the delta)

`Bank` is a single-asset vault with ERC-4626-like share accounting plus the
protocol's accounting source of truth:

- `totalAssets() = NAV = B − PF − XP`, where `B` is the raw token balance,
  `PF` protocol fees payable, `XP` external payables (referral buckets).
  `AccountingLib.nav` reverts on `B < PF + XP` (A2 enforcement).
- Bet funds move only via the immutable, one-time-wired `SettlementRouter`
  (`setSettlementRouterOnce`), which itself only accepts calls from
  governance-registered hubs allowed per pool (`PoolRegistry`).
- **Risk-in** (`holdBet`) requires `NAV − R_after ≥ riskReserveBps × NAV` (A4R).
- **Optional outflows** (LP withdraw/redeem, XP claims, protocol-fee claims)
  require `NAV_after − R ≥ withdrawalBufferBps × NAV_before` (A4) and are
  pause-gated.
- **Debt-out** (`settleBet`/`refundBet`) is never pause-gated (LIVE).
- First-depositor inflation is mitigated with virtual offset reserves
  (`10^decimals`), closed under SEV-01 of the prior audit.

The ADR-0031 delta splits the former single `minLiquidityBps` into
`riskReserveBps` (new-risk gate) and `withdrawalBufferBps` (outflow gate),
initialized equal in the constructor, independently settable by governance,
with `minLiquidityBps()`/`setMinLiquidityBps()` retained as a legacy alias for
the risk-reserve side only.

---

## 6. Findings

### Summary table

| ID     | Title                                                                                   | Severity      | Status                                  |
| ------ | --------------------------------------------------------------------------------------- | ------------- | --------------------------------------- |
| AGF-01 | Solvency runbook used stale 14-field `getSSOT` signature and v13 pointers               | Low           | Resolved (working tree)                 |
| AGF-02 | Legacy `setMinLiquidityBps` silently updates only the risk reserve                      | Low           | Acknowledged (documented)               |
| AGF-03 | Stale unversioned `deployments/` artifacts lag the V14 ABI                              | Low           | Open (required before next release tag) |
| AGF-04 | Release gate must live-verify on-chain `getSSOT`/`getPerformance` shape per active bank | Informational | Resolved (working tree)                 |
| AGF-05 | Bank does not enforce PF/XP accrual conservation; trust is delegated to hubs            | Low           | Acknowledged (by design)                |
| AGF-06 | `totalRefunded` aggregates settle-path partial refunds and refund-path refunds          | Informational | Resolved (working tree)                 |
| AGF-07 | `minPlayerTurnoverForUnlock` is unbounded; governance can freeze locked-XP unlocks      | Informational | Open                                    |
| AGF-08 | `setRiskInPaused` grants the router an authority it never exercises                     | Informational | Open                                    |

---

### AGF-01 — Solvency runbook used stale 14-field `getSSOT` signature and v13 pointers

- **Severity**: Low (operational; High impact if acted on during an incident,
  Low likelihood given the correct signature also appears earlier in the same
  document)
- **Location**: `docs/ops/runbooks/bank-solvency.md` (Appendix; Prerequisites)
- **Status**: **Resolved** — fix present in the uncommitted working tree at
  review time; pending commit.

**Description.** After the ADR-0031 struct change, the runbook's appendix still
instructed operators to call
`getSSOT()((uint256,…×13,bool,…))` — the pre-split 14-field tuple. Decoding the
live 20-field struct against that signature misaligns every field from index 8
onward (e.g. `riskReserveBps` would be read where `riskInPaused` is expected).
During a solvency incident, this yields plausible-looking but wrong
`reserved`/`free` numbers exactly when correct numbers matter most. The same
file pointed to `deployments/latest-v13.json` and used a `bankFor(address)`
helper that does not match the v1.3 `PoolRegistry.bankFor(uint64)` interface.

**Recommendation.** Land the working-tree fix (20-field signature, v14 pointer,
`PoolRegistry`-based lookup). Add the runbook's `cast` snippets to a CI check or
generate them from the ABI to prevent recurrence.

---

### AGF-02 — Legacy `setMinLiquidityBps` silently updates only the risk reserve

- **Severity**: Low (operational drift; no direct fund risk)
- **Location**: `src/core/Bank.sol:141` (`setMinLiquidityBps`)
- **Status**: Acknowledged — behavior is intentional (ADR-0031) and noted in the
  runbook/NatSpec; residual risk is operator habit.

**Description.** Before the split, `setMinLiquidityBps` adjusted the single
buffer governing both risk-in and outflows. After the split it is an alias for
`_setRiskReserveBps` only. An operator following pre-split muscle memory
("raise min liquidity to constrain everything") will tighten new-risk intake
but leave LP/XP/protocol-fee outflows unconstrained — the two bps values drift
apart silently. The view-side alias `minLiquidityBps()` similarly reports only
the risk-reserve side, which legacy dashboards may misread as the outflow
buffer.

**Recommendation.**

1. Keep the working-tree NatSpec `@dev` deprecation on both the setter and the
   view alias: they do **not** affect/report `withdrawalBufferBps`.
2. Emit the existing `RiskReserveBpsSet` (already done) — consider also emitting
   a distinct `LegacyMinLiquidityAliasUsed` event or removing the alias in the
   next ABI-breaking release.
3. Keep the runbook guidance (already present at §"Governance actions") that
   outflow tightening requires `setWithdrawalBufferBps`.

---

### AGF-03 — Stale unversioned `deployments/` artifacts lag the V14 ABI

- **Severity**: Low (release hygiene; no runtime consumer found today, but
  "latest"-named artifacts are an operator-facing trust surface)
- **Location**: `deployments/abis/Bank.abi.json` (14-field `getSSOT`);
  `deployments/release-latest.json` (digest `e0e8bdc3…`, behind the embedded
  frontend digest `eb08b585…` for chain 84532)
- **Status**: **Resolved in working tree** — retired instead of regenerated.

**Description.** The unversioned "latest" artifacts in `deployments/` were not
regenerated after the V14 release. A repo-wide reference search found no code
consuming the unversioned `deployments/abis/` directory (the frontend consumes
`frontend/packages/ssot/src/abis/release/chain-*/`, which is correct at
20 fields for both chains), so nothing is broken at runtime today — but stale
"latest" pointers are exactly how the AGF-01 class of error propagates to
humans and scripts, and the new ABI drift guard (§8.3) currently covers **only
the frontend release ABIs**, so these artifacts sit outside every automated
check.

**Resolution.** The stale unversioned `deployments/abis/` directory and
unversioned latest aliases (`latest.json`, `release-latest.json`,
`frontend-manifest-latest.json`, `golden-vectors-latest.json`,
`release-notes-latest.md`, `verify-latest.sh`) were retired. Current release
workflows must use versioned artifacts only (`abis-v13/`, `abis-v14/`,
`*-latest-v13.*`, `*-latest-v14.*`). Because the unversioned ABI surface no
longer exists, the ABI drift guard intentionally remains scoped to the frontend
release ABIs consumed at runtime.

---

### AGF-04 — Release gate must live-verify on-chain `getSSOT`/`getPerformance` shape per active bank

- **Severity**: Informational (process; becomes High only in a mismatch scenario)
- **Location**: release process (`verify-latest-v14.sh`, `docs/deploy/*`)
- **Status**: **Resolved** — release-gate script present in the uncommitted
  working tree; pending commit.

**Description.** The frontend's embedded manifests declare Base mainnet (8453,
digest `8ae5f98a…`, `isPlaceholder:false`) and Base Sepolia (84532) as V14 and
ship 20-field ABIs. This review had no RPC access, so the assumption "the banks
deployed at the manifest addresses expose the 20-field `getSSOT`" was not
independently confirmed during the audit pass. If any chain still ran a
pre-split Bank, every SDK snapshot read on that chain would revert or
mis-decode.

**Resolution.** `script/ci/v14_bank_live_shape_smoke.py` + `make
bank-live-shape-smoke-v14` are present in the working tree and wired into the
V14 release check. For the supplied release snapshot, the gate walks the
snapshot chain and every active bank in that snapshot, selects a chain-specific
RPC env var, and performs:

1. `cast call $BANK "getSSOT()(…20-field tuple…)"` — must decode cleanly and
   satisfy sanity relations (`riskReserveBps == minLiquidityBps()`,
   `NAV == B − PF − XP`, both bps ≤ 10000, XP buckets sum to XP, reserve/free/
   withdrawal-buffer derived values match);
2. `cast call $BANK "getPerformance()"` — must return the 9-value tuple and
   satisfy basic monotonic sanity (`payoutNet ≤ payoutGross`,
   `betsSettled + betsRefunded ≤ betsHeld`);
3. fail the gate on any revert, decode error, or sanity violation.

The script skips when no chain-specific RPC is configured, and can be made
fail-closed with `BANK_LIVE_SMOKE_REQUIRED=1`. It complements — not replaces —
the static ABI drift check (§8.3): the static check proves the repo is
internally consistent, while the live smoke proves the **deployed bytecode**
matches what the frontend is about to ship against.

---

### AGF-05 — Bank does not enforce PF/XP accrual conservation; trust is delegated to hubs

- **Severity**: Low (requires a governance-registered malicious/buggy hub —
  within the accepted trust model)
- **Location**: `src/core/Bank.sol::settleBet` (PF accrual, XP award loop)
- **Status**: Acknowledged (by design, ADR-0003 / ADR-0029); recorded here as a
  defense-in-depth opportunity.

**Description.** `settleBet` enforces `payoutNet ≤ payoutGross`,
`payoutGross + refundAmount ≤ reserved`, and `refundAmount ≤ stake`, but accepts
`protocolFeeAccrual` and the `xpAwards[]` amounts **without bounding them to
`feeOnPayout`** (or to any function of the bet). Budget conservation
(`ΔPF + ΔXP == house-edge accrual`, invariant P3) is enforced one layer up in
`GameHub.finalize` and proven by the stateful diff suites. Consequences of a
hypothetical rogue hub: inflated `PF`/`XP` deflates NAV until
`AccountingLib.nav` underflow-reverts, bricking risk-in and accounting views
(debt-out stays live), and inflated `xpAccrued` becomes claimable real-asset
outflow up to the withdrawal-buffer cap. Both require the hub to be
governance-registered and pool-allowed in `PoolRegistry`, i.e. a compromised or
unaudited hub — the threat model already treats governance compromise as out of
scope.

**Recommendation.** In a future ABI-breaking release, consider a Bank-level
defensive cap, e.g. `protocolFeeAccrual + Σ(xpAwards) ≤ payoutGross − payoutNet`.
This converts a cross-contract trust assumption into a local invariant at
negligible gas cost (the loop already touches every award). No action required
for the current release.

---

### AGF-06 — `totalRefunded` aggregates settle-path partial refunds and refund-path refunds

- **Severity**: Informational (analytics correctness)
- **Location**: `src/core/Bank.sol::settleBet` and `::refundBet` (both do
  `totalRefunded += refundAmount`)
- **Status**: **Resolved** — NatSpec and metrics canon present in the
  uncommitted working tree; pending commit.

**Description.** The lifetime counter `totalRefunded` increments on **both**
terminal paths: multi-roll early-stop partial refunds inside `settleBet`, and
full refunds inside `refundBet`. This is a reasonable definition ("lifetime
refunded stake"), but a consumer computing GGR or reconciling
`totalBetsRefunded` (which counts only `refundBet` calls) against
`totalRefunded` (which spans both paths) can silently double-count.

**Resolution.** `IBank` NatSpec now states that `totalRefunded` aggregates
settle-path partial refunds and `refundBet` full refunds, while
`totalBetsRefunded` counts only `refundBet` calls. `docs/ops/metrics.md`
records the canonical analytics identities next to the counter inventory:
`totalTurnover = Σ(stake − refundAmount)` over settled bets already nets out
settle-path refunds, and the safe gross house-performance identity is
`GGR_gross = totalTurnover − totalPayoutGross + totalFeeOnPayout`. It also
explicitly warns that `totalTurnover − totalPayoutNet` is the wrong GGR
formula because `payoutNet` already excludes the fee-on-payout.

---

### AGF-07 — `minPlayerTurnoverForUnlock` is unbounded; governance can freeze locked-XP unlocks

- **Severity**: Informational (centralization; no theft path)
- **Location**: `src/core/Bank.sol::setMinPlayerTurnoverForUnlock`
- **Status**: Open

**Description.** Unlike `holdbackVestingSeconds` (bounded to `(0, 365 days]`),
the turnover threshold has no upper bound. Governance can set it to
`type(uint256).max`, permanently gating `unlockXPLocked` for all payees. The
locked amounts remain accounted in `XP` (so NAV never absorbs them — no theft),
but referral counterparties can be frozen indefinitely. This is consistent with
the documented "governance compromise is out of scope" stance, but it is a
stronger unilateral power than the vesting bound suggests elsewhere in the same
contract.

**Recommendation.** Bound the setter (e.g. a governance-set maximum at
construction, or a sane protocol cap), or document the power explicitly in the
constitution's governance-powers section.

---

### AGF-08 — `setRiskInPaused` grants the router an authority it never exercises

- **Severity**: Informational
- **Location**: `src/core/Bank.sol::setRiskInPaused` (allows
  `msg.sender == settlementRouter`); `src/core/SettlementRouter.sol` (no call site)
- **Status**: Open

**Description.** The Bank authorizes the SettlementRouter to toggle risk-in
pause ("router MAY forward governance intent"), but the deployed router code
contains no such call path. The grant is dead code today. Because the router is
immutable and itself permissionless beyond hub gating, the practical risk is
nil; the note is recorded so a future router revision that _does_ forward pause
intent is recognized as a deliberate, previously-reserved capability rather
than new surface.

**Recommendation.** Either document the reserved capability in the router's
interface NatSpec, or drop the allowance in the next ABI-breaking Bank release.

---

## 7. Verification Evidence

All commands executed at review HEAD `3bb7cc2c6` on 2026-06-10.

| Gate                      | Command                                                     | Result                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full contract suite       | `forge test`                                                | 27 suites; **130 passed / 0 failed / 1 skipped** (fork tests auto-skip without RPC, per ADR-0023)                                                                                                |
| Delta-targeted unit suite | `forge test --match-path test/unit/BankObservability.t.sol` | **6/6 passed** — decimals guard; owner-scoped `maxWithdraw` + ERC-4626 events; counters (settle path); counters (bank/asset scoping); buffer-vs-reserve split; buffer accounts for reserved risk |
| Invariants                | `forge test --match-path "test/invariants/*"`               | **7/7 passed**, 256 runs × 128,000 calls each, incl. `invariant_router_reserved_matches_bank_reserved_by_pool`, pool isolation, sports no-early-debt-out                                         |
| ABI structural comparison | scripted `getSSOT` tuple diff (see §8.2)                    | compiled artifact == frontend `chain-8453` == frontend `chain-84532` (20 fields); historical v13 fixtures correctly differ at index 8                                                            |
| Frontend decode path      | manual review `frontend/packages/ssot/src/sdk/create.ts`    | by-name field access with legacy fallbacks (`riskReserve ?? minLiq` etc.); safe for both struct generations                                                                                      |

### 7.1 Manual boundary checks performed (all pass)

- `maxWithdraw → withdraw` consistency under ceil-rounding: for
  `assets = maxWithdraw(owner)`, `convertToShares(assets, Ceil) ≤ balanceOf[owner]`
  (proved via floor/ceil algebra over the virtual-offset conversion).
- `maxRedeem → redeem` consistency under floor-rounding (same approach).
- A4 buffer evaluated on **pre-outflow** NAV: strictly more conservative than
  post-NAV for withdraw/redeem; exactly equivalent for `claimProtocolFees` and
  `claimXPAccrued` (NAV-neutral outflows). Matches `invariants-map.md` A4.
- CEI ordering in `settleBet`/`refundBet`: `h.open = false` and
  `totalReserved -= reserved` precede the player transfer; `nonReentrant` on all
  fund-moving entry points; share ERC-20 has no transfer hooks.
- `holdBet` solvency check evaluated post-stake-pull against `riskReserveBps`
  (A4R); duplicate-hold guard `h.open || h.player != 0` intact.
- Holdback vesting: non-extending aggregate schedule preserved by the delta
  (SEV-03 regression check); `uint64` cast safe under the 365-day bound.
- GameHub delta: `registerGame` overwrite rejection; `resolve` wrapped in
  try/catch with full-stake refund fallback; reserved-coverage check rewritten
  overflow-safe (`payoutGross > reserved || refundAmount > reserved − payoutGross`).

---

## 8. Systemic & Process Observations

### 8.1 Centralization profile (unchanged by delta, restated)

Governance (two-step transfer, `Governable`) can: pause risk-in + optional
outflows per bank; set both bps buffers anywhere in `[0, 10000]` (a 100%
withdrawal buffer is an economic outflow freeze — intended per the solvency
runbook); claim accrued protocol fees (pause-gated, A4-checked, PF-bounded);
set referral gating parameters (see AGF-07); register pools/hubs. Governance
cannot: move the underlying asset directly (`rescueToken` excludes `asset`),
block debt-out, or re-wire the settlement router after first set.

### 8.2 ABI drift as the dominant residual risk class

The delta's only consumer-breaking change was the mid-struct insertion into
`SSOT`. The codebase handled it correctly end-to-end (contract → compiled
artifact → release bundle → frontend ABI → by-name SDK decode with legacy
fallbacks), and the one human-facing artifact that lagged (runbook) is fixed in
the working tree. The structural-comparison methodology used here (normalize
and diff the `getSSOT` output component tree across all artifact generations)
found every stale copy in the repository deterministically.

### 8.3 Review of the (uncommitted) CI drift guard

`script/ci/check_bank_abi_drift.py` + `make bank-abi-drift-check` + CI step
(working tree): compares the normalized `getSSOT` output tuple
(name/type/internalType, recursive components) of every
`frontend/packages/ssot/src/abis/release/chain-*/Bank.abi.json` against
`out/Bank.sol/Bank.json`, failing with a labeled field-path diff. Review
result: **sound and recommended to land**. Suggested extensions (non-blocking):
consider covering `getPerformance` outputs and the `GameHub`/`SettlementRouter`
structs consumed by the SDK.

---

## 9. Conclusion

The four-commit delta is a net security improvement: it adds chain-verifiable
observability, separates the new-risk and outflow buffers exactly as specified
in ADR-0031 with the documented invariants preserved, hardens deployment-time
decimals assumptions, and closes the last open liveness finding from the
2026-05-21 audit. Two latent ERC-4626 conformance defects were repaired in
passing. The full proof suite is green at HEAD.

Remaining work is operational hygiene, not contract risk. The working tree now
contains the runbook fix, ABI drift guard, live per-snapshot/per-active-bank
`getSSOT`/`getPerformance` shape smoke, and counter-semantics documentation
(AGF-01, AGF-03, AGF-04, AGF-06, §8.3). AGF-02/05/07/08 are documented design
choices and next-ABI-break candidates.

---

## Appendix A — `SSOT` struct, v13 → v14

| Index | v13 field                          | v14 field                                                                                        | Note                                            |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| 0–4   | `B,PF,XP,NAV,R`                    | unchanged                                                                                        |                                                 |
| 5–7   | `minLiquidityBps,minLiq,free`      | unchanged (legacy alias of risk-reserve view)                                                    |                                                 |
| 8     | `riskInPaused`                     | `riskReserveBps`                                                                                 | **insertion point** — stale decoders break here |
| 9–13  | `xp*/holdback*/minPlayerTurnover*` | `riskReserve,riskFree,withdrawalBufferBps,withdrawalBuffer,withdrawable`                         |                                                 |
| 14    | —                                  | `riskInPaused`                                                                                   |                                                 |
| 15–19 | —                                  | `xpAccruedTotal,xpLockedTotal,xpHoldbackTotal,holdbackVestingSeconds,minPlayerTurnoverForUnlock` |                                                 |

## Appendix B — Artifact generations found (structural `getSSOT` check)

| Artifact                                              | Fields | Verdict                        |
| ----------------------------------------------------- | ------ | ------------------------------ |
| `out/Bank.sol/Bank.json` (compiled, HEAD)             | 20     | reference                      |
| `frontend/.../abis/release/chain-8453/Bank.abi.json`  | 20     | **match**                      |
| `frontend/.../abis/release/chain-84532/Bank.abi.json` | 20     | **match**                      |
| `deployments/abis-v14/Bank.abi.json`                  | 20     | match                          |
| `deployments/abis-v13/Bank.abi.json`                  | 14     | historical (expected)          |
| unversioned `deployments/abis/Bank.abi.json`          | n/a    | retired (AGF-03)               |
| frontend fixture bundles (7 of 11)                    | 14     | historical fixtures (expected) |

## Appendix C — Prior-audit reliance

- `FullAudit-2026-05.md` — SEV-01…05 closed (`FullAudit-2026-05-Closure.md`).
- `FullAudit-2026-05-21.md` — NEW-H1 (SportsHub challenge freeze) and the
  GameHub liveness Medium closed; closure evidence re-verified at HEAD via
  `SecurityFixes.t.sol` (within the 130-test green run).
- `slither-triage-2026-05.md` — High/Medium detector triage baseline.
- Accepted/deferred from prior cycles and unchanged: SEV-L1 (forced-ETH dust on
  VRFHub), fee-on-transfer/rebase assets out of scope, MEV out of scope.
