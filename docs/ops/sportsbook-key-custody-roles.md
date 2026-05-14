# Sportsbook Key Custody and Role Control

Status: draft production-control policy. This file defines the custody and role-rotation record
required before SportsHub can use public-money signer, reporter, challenger, arbitrator, keeper, or
governance keys. It does not approve any key by itself.

## Required Roles

The first SportsHub canary must have an approved custody record for:

- governance;
- odds signer;
- result reporter;
- result challenger;
- result arbitrator;
- keeper.

The odds signer signs EIP-712 odds tickets. Result reporters sign or submit result payloads.
Challengers dispute bad results before finality. Arbitrators resolve challenged results. Keepers
finalize results and batch terminalize tickets, but users must still be able to self-terminalize when
the market state permits it.

## Custody Requirements

Before any public-money deployment:

- routine odds and result keys must not be locally generated `.env` keys;
- governance must not be reused as the routine odds signer or routine result reporter;
- each role must have an accountable owner and escalation path;
- each signer-set or reporter-set hash must map to a custody record and approval record;
- rotation and rollback procedures must exist before the role is allowlisted;
- a canary must run after signer-set, reporter-set, threshold, or risk-hash changes.

## Validation

Create a role custody memo from:

```text
docs/ops/templates/sportsbook-role-custody.example.json
```

Run:

```bash
make sports-role-custody-check-v13 ROLE_CUSTODY_FILE=docs/ops/templates/sportsbook-role-custody.example.json
```

For production approval:

```bash
REQUIRE_APPROVED=1 make sports-role-custody-check-v13 ROLE_CUSTODY_FILE=<approved-role-custody.json>
```

`REQUIRE_APPROVED=1` must fail unless the memo status is `approved`, local private keys are rejected,
and role ownership/rotation/rollback fields are filled.

## No-Go Conditions

Do not enable SportsHub public risk-in when any of the following is true:

- any routine role uses a local `.env` private key;
- governance is the routine odds signer or result reporter;
- signer-set or reporter-set hashes do not map to approved off-chain membership records;
- reporter threshold exceeds the number of operational reporters;
- challenger or arbitrator ownership is unclear;
- a role rotation lacks canary evidence and rollback instructions.
