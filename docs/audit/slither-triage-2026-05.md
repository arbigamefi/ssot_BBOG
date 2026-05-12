# Slither Triage - 2026-05-12

Scope: post-audit security-fix working tree after the May 2026 FullAudit fixes.

Commands:

- `FOUNDRY_PROFILE=pr forge test --match-path test/unit/SecurityFixes.t.sol -vv`
- `~/.local/bin/slither . --filter-paths "test/|src/mocks/|lib/" --json /tmp/arbigamefi_slither_after_low.json`

Result summary:

- Security regression tests: 9 passed, 0 failed.
- Slither exit code: non-zero because detectors remain.
- Slither detector count: 86 total.
- Remaining Slither High/Medium buckets:
  - High: `arbitrary-send-erc20` (1), `arbitrary-send-eth` (1), `reentrancy-eth` (2).
  - Medium: `incorrect-equality` (10), `uninitialized-local` (10), `unused-return` (2).
- `reentrancy-no-eth` was removed from the High/Medium set after CEI hardening in `Hub.finalize` and `Hub.refund`.
- No `unused-state` / `constable-states` findings remain for the earlier incomplete `_trackedAssets` approach.

## Validation Rubric

- Is the detector reachable from an untrusted caller without privileged setup?
- Can the caller move value they do not own, bypass a solvency guard, or brick debt-out liveness?
- Does the reported sink run before state is protected by `nonReentrant`, `onlyHub`, request mapping checks, or trusted-governance wiring?
- Is the Slither finding a Solidity-language default/sentinel pattern rather than a real read-before-write or equality bug?
- Does an immediate code change reduce meaningful exploitability without increasing protocol complexity or changing public semantics?

## Closure Table

| ID | Slither detector | Root location | Disposition | Survives? | Evidence / counterevidence |
| --- | --- | --- | --- | --- | --- |
| SL-H1 | `arbitrary-send-erc20` | `src/core/Bank.sol:480` / `safeTransferFrom(player, ...)` | Suppressed | No | `Bank.holdBet` is `onlyHub nonReentrant`; the only production caller is `Hub.placeBet`, which sets `player = msg.sender` before forwarding to Bank. A user approval alone cannot cause Bank to pull arbitrary third-party funds. Exploit requires compromised trusted Hub/governance, which is already out of scope in `docs/audit/threat-model.md`. |
| SL-H2 | `arbitrary-send-eth` | `src/core/VRFHub.sol:115` / adapter fee forward and overpay refund | Suppressed | No | `VRFHub.requestRandomWords` forwards the caller-provided `msg.value` to a governance-configured adapter and refunds overpay to the supplied payer. Direct public calls are self-funded and do not move protocol-owned funds. Bogus Hub callbacks are soft-ignored by `Hub.onRandomWords` unless `requestToBetId[requestId]` is bound. |
| SL-H3 | `reentrancy-eth` | `src/core/VRFHub.sol:164` / `claimRefund` | Suppressed | No | Credit is set to zero before the native-token transfer. A reentrant `claimRefund` observes zero credit. The only post-call write restores credit and reverts when the transfer failed, so it does not create a double-claim path. |
| SL-H4 | `reentrancy-eth` | `src/core/Hub.sol:280` / `placeBet` | Suppressed | No | `placeBet` is `nonReentrant`. Reentry into `placeBet`, `finalize`, or `refund` is blocked. `onRandomWords` only accepts calls from `vrfHub` and ignores request IDs not present in `requestToBetId`; callbacks during provider request creation are not mapped yet and therefore do not settle bets. |
| SL-M1 | `incorrect-equality` | `src/core/Bank.sol:395`, `src/core/Bank.sol:413`, `src/core/Bank.sol:302`, `src/core/Hub.sol:247` | Suppressed | No | These are sentinel, rounding, and schedule-boundary checks: zero balances, unset vesting timestamps, `shares == 0` rounding protection, active holdback schedule end checks, and `BetState.None` existence checks. They are intentional branch guards, not timestamp randomness or price equality assumptions. |
| SL-M2 | `reentrancy-no-eth` | `src/core/Hub.sol:437`, `src/core/Hub.sol:557` | Fixed / hardened | No | `Hub.finalize` and `Hub.refund` now write terminal bet state before external Bank interactions, and clear `requestToBetId` before best-effort `VRFHub.detach`. Slither no longer reports this detector after the CEI hardening. |
| SL-M3 | `uninitialized-local` | `src/core/Bank.sol:547`, `src/core/Hub.sol:503`, `src/core/Hub.sol:596`, `src/core/VRFHub.sol:195`, `src/modules/*` | Suppressed | No | Solidity zero-initializes local variables and memory structs. The flagged accumulators, memory structs, and cached request locals are intentionally zero-started before accumulation/conditional fill. No read-before-write with attacker-controlled stale memory exists. |
| SL-M4 | `unused-return` | `src/modules/cointoss/CoinTossModule.sol:15`, `src/modules/cointoss/CoinTossModule.sol:22` | Suppressed | No | `CoinTossParams.decode(params)` is called for canonical decoding and revert-on-invalid behavior in `validate` and `maxPayout`. The returned boolean is only needed by `resolve`, where it is consumed. |

## Remaining Work

None of the remaining High/Medium Slither rows is a release-blocking funds-safety finding under the current trust model.

Recommended follow-ups:

- Add a NatSpec note near `VRFHub.requestRandomWords` documenting that direct calls are self-funded and bogus request callbacks are soft-ignored.
- Optionally initialize local accumulator variables explicitly to reduce Slither noise, but this is style-only.
- Keep SEV-03 tracked separately from Slither triage; it is not part of this detector set.
