# Sportsbook Provider and Evidence Policy

Status: draft production-control policy. This file defines the evidence shape required before a
SportsHub market can be considered production-ready. It does not approve a provider, jurisdiction,
or public launch by itself.

## Scope

This policy applies only to the v1.3 SportsHub MVP scope:

- pre-match fixed-odds singles;
- one Sports pool and one asset during the first canary;
- no live betting, parlays, player props, futures, or shared casino/sports bankroll.

## Hash Surfaces

SportsHub stores hashes, not provider payloads. Operators must preserve the payloads that produced
each hash.

| Field | On-chain use | Required source material |
|---|---|---|
| `rulebookHash` | Stored on market creation and included in signed odds/result payloads. | Canonical market rulebook JSON plus a human-readable rulebook copy. |
| `resultSourceHash` | Included in `proposeResult` and `hashResultPayload(...)`. | Canonical source bundle with provider identity, raw event identity, observed score/status, and provider timestamps. |
| `evidenceHash` | Included in `proposeResult` and `hashResultPayload(...)`. | Canonical evidence bundle with raw provider payload hashes, source URLs, screenshots or archived copies, reporter observations, and operator attestation. |
| `challengeReasonHash` | Included in `challengeResult`. | Incident note explaining why the proposed result is disputed. |
| `arbitrationDecisionHash` | Included in `resolveResultChallenge`. | Signed arbitration decision bundle, including decision type and evidence references. |

The stored result payload digest must be reproducible with:

```text
SportsHub.hashResultPayload(marketId, winningOutcomeId, resultSourceHash, evidenceHash, observedAt)
```

## Canonicalization

For Phase 2, every JSON bundle must be hashed from a canonical single-line JSON representation with
lexicographically sorted keys and no insignificant whitespace.

Reference command:

```bash
canonical_json="$(jq -cS . docs/ops/templates/sportsbook-result-evidence.example.json)"
hash="$(cast keccak "$canonical_json")"
printf '%s\n' "$hash"
```

If a different canonicalization tool is adopted, the tool name, version, command, input file path, and
output hash must be recorded in the incident or market evidence record.

`evidenceHash` must be computed from an evidence preimage that does not contain its own final
`evidenceHash`. Store self-referential values such as `evidenceHash` and `resultPayloadHash` in a
separate sidecar or proposal summary after the evidence preimage is hashed.

The first concrete provider ingestion path is documented in
`docs/ops/sportsbook-provider-the-odds-api.md` and implemented by
`script/ops/sports_provider_evidence.py`. It maps a completed The Odds API score response into
canonical `resultSourceHash` and `evidenceHash` values for the existing SportsHub reporter path.

## Market Rulebook Requirements

Before `createMarket(...)`, operators must publish or archive a rulebook bundle that includes:

- `schemaVersion`;
- sport, league, event identity, market type, and supported outcomes;
- market lock, result finality, and challenge window policy;
- cancellation, postponement, abandonment, stat correction, and provider disagreement handling;
- void/refund policy and non-zero void reason hash procedure;
- expected provider sources and fallback hierarchy;
- operator and approver identities.

The resulting `rulebookHash` must be:

- non-zero;
- included in the market;
- included in every signed odds ticket for that market;
- referenced by result evidence and dispute records.

## Result Evidence Requirements

Before `proposeResult(...)`, reporters must preserve:

- provider name and account/feed identifier;
- provider event identifier and internal `eventId`/`marketId`;
- raw provider payloads or immutable archive links;
- canonical `resultSourceHash`;
- canonical `evidenceHash`;
- `observedAt` source timestamp;
- winning outcome mapping from provider fields to SportsHub outcome IDs;
- reporter set hash and reporter signatures used for the proposal.

For The Odds API football 1X2 ingestion, `script/ops/sports_provider_evidence.py` must be run before
result submission. The generated `result-proposal.env` can be sourced by the football canary so
`FOOTBALL_RESULT_OBSERVED_AT`, `FOOTBALL_RESULT_SOURCE_HASH`, and `FOOTBALL_EVIDENCE_HASH` all come
from the same provider payload.

No result should be proposed if the winning outcome cannot be reproduced from the published rulebook
and preserved source material.

## Challenge And Arbitration Requirements

If a proposed result is disputed:

- `challengeReasonHash` must map to an incident note before `challengeResult(...)` is sent;
- the challenged market must not be directly voided through `voidMarket(...)`;
- `arbitrationDecisionHash` must be non-zero and map to a signed decision bundle before
  `resolveResultChallenge(...)`;
- decision `VoidMarket` is required when no trustworthy corrected result can be produced;
- all final `settleTickets`, `refundTickets`, or `voidTickets` debt-out transactions must be linked
  from the incident record.

## No-Go Conditions

Do not open public SportsHub risk-in when any of the following is true:

- no provider decision or fallback hierarchy exists for the market type;
- a market lacks a reproducible rulebook hash;
- a result source or evidence bundle cannot be reconstructed from archived material;
- a provider correction policy is undefined for the market type;
- an arbitration decision is not signed or cannot be hashed back to `arbitrationDecisionHash`;
- frontend users can place tickets before the rulebook and source policy are published.
