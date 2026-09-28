# Sports result evidence

SportsHub stores hashes, not source payloads. Preserve the exact bytes and interpretation that
produce each hash before submitting a market or result. This operating policy does not itself admit
Sports pools or authorize public traffic; see [Sports operations](runbooks/sportsbook-ops.md).

| On-chain field | Material to retain |
| --- | --- |
| `rulebookHash` | Event/market identity, outcome mapping, lock/finality rules, cancellation/postponement/correction and void policy |
| `resultSourceHash` | Provider identity, event ID, observed result/status, source timestamp and exact source bundle |
| `evidenceHash` | Archived payload references/hashes, reporter observations and the evidence preimage |
| `challengeReasonHash` | Disputed facts, relevant rulebook provision and supporting evidence |
| `arbitrationDecisionHash` | Decision type, reasoning, evidence references and responsible arbitrator |

Choose a deterministic encoding for every bundle and retain its exact preimage plus the tool/version
used to hash it. If JSON is used, specify key ordering, whitespace and numeric representation; the
contract does not canonicalize documents for the operator. A preimage cannot contain its own final
hash. Store derived hashes and transaction references separately.

Before a proposal, check the outcome against the published rulebook, source timestamp, market and
reporter set. Recompute the signed digest using:

```text
SportsHub.hashResultPayload(marketId, winningOutcomeId, resultSourceHash, evidenceHash, observedAt)
```

Preserve the reporter signatures and quorum used for that digest. Provider disagreement, corrections,
missing results and outage handling must have a stated owner and policy. An odds quote is not result
evidence; the current [The Odds API integration](sportsbook-provider-the-odds-api.md) only supplies
odds to the application and does not generate a result proposal.

For a challenge, preserve the reason preimage before sending. An arbitrator's uphold/reopen/void
action must link to its decision evidence. Governance's challenged-market void route is available
only after the current challenge timeout and needs a nonzero reason hash. Retain the final market and
ticket receipts, including player transfer or payable evidence. Do not describe repeated reopening
or missing reporting as having a guaranteed total deadline.
