> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# Sportsbook Bankroll and Risk Caps

Status: draft production-control policy. This file defines how SportsHub mainnet canary caps must be
derived from bankroll and loss tolerance. It does not approve a bankroll amount by itself.

## Required Inputs

Before any SportsHub mainnet canary, create an approved memo from
`docs/ops/templates/sportsbook-bankroll-risk-caps.example.json` with:

- chain ID, pool ID, asset address, asset symbol, and asset decimals;
- initial bankroll in raw asset units;
- operator-approved manual loss tolerance in raw asset units;
- `maxStakeRaw`;
- `maxPayoutRaw`;
- `maxOutcomeReservedRaw`;
- `maxMarketReservedRaw`;
- `maxEventReservedRaw`;
- approver, approval timestamp, and storage location.

All amounts must be raw token units, not decimal display units.

## Cap Invariants

The first canary must satisfy:

```text
0 < maxStakeRaw <= maxPayoutRaw
maxPayoutRaw <= maxOutcomeReservedRaw
maxOutcomeReservedRaw <= maxMarketReservedRaw
maxMarketReservedRaw <= maxEventReservedRaw
maxEventReservedRaw <= manualLossToleranceRaw
manualLossToleranceRaw <= initialBankrollRaw
```

This keeps one event's worst-case reserved exposure inside the amount operators explicitly agreed to
supervise.

## Validation

Run the local checker before copying caps into deploy env files:

```bash
make sports-bankroll-caps-check-v13 BANKROLL_CAPS_FILE=docs/ops/templates/sportsbook-bankroll-risk-caps.example.json
```

For production approval, rerun with:

```bash
REQUIRE_APPROVED=1 make sports-bankroll-caps-check-v13 BANKROLL_CAPS_FILE=<approved-memo.json>
```

`REQUIRE_APPROVED=1` must fail unless the memo status is `approved`.

## No-Go Conditions

Do not open SportsHub public risk-in when any of the following is true:

- caps are copied from Base Sepolia or local dry-run values without an asset-decimal memo;
- the memo uses display units instead of raw token units;
- `maxEventReservedRaw` exceeds the approved manual loss tolerance;
- `manualLossToleranceRaw` exceeds the funded bankroll;
- deploy env `SPORTS_MAX_*` values do not match the approved memo;
- a risk cap change is made without rotating odds snapshots to the new `riskHash`.
