> Historical reference: this document includes pre-v1.5 deployment observations or commands. Those tools/artifacts were retired from the working tree. Use the [current deployment workflow](../deploy/v15-release.md) for operations; retrieve historical files from Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`.

# Casino Expansion v1.3 Closeout - 2026-05-13

This closeout captures the current local stage on branch `codex/casino-slots`.

## Scope

This stage is a pre-mainnet cleanup and casino module expansion on top of the v1.3 router topology:

`Bank -> SettlementRouter -> GameHub / SportsHub`

Included local commits:

- `65a95c3cb chore: remove legacy hub compatibility`
- `4133869c1 feat: add slots casino module`
- `8dbeafdc6 feat: add baccarat casino module`
- `f79ed1011 feat: add plinko casino module`
- `57a50acd2 feat: add sic bo casino module`

## Current Casino Set

Router-backed `GameHub` now registers:

- Dice
- Coin Toss
- Roulette
- Keno
- Slots
- Baccarat
- Plinko
- Sic Bo

All added games fit the current casino module rule:

- no custody;
- no lifecycle state;
- deterministic `validate`, `maxPayout`, and `resolve`;
- single VRF seed expanded through canonical `RNG`;
- `GameHub` applies fee-on-payout and routes settlement through `SettlementRouter`.

## Intentionally Not Included

Blackjack and other interactive table games are not included in this stage because they do not fit
the one-shot `IGameModule` model without adding a separate stateful lifecycle surface.

Additional games such as Dragon Tiger or Wheel can be added later, but they should wait until this
stage is reviewed and merged.

## Proof Coverage

Each new game has a module-level reference diff:

- `test/diff/DiffSlots.t.sol`
- `test/diff/DiffBaccarat.t.sol`
- `test/diff/DiffPlinko.t.sol`
- `test/diff/DiffSicBo.t.sol`

Router-backed coverage:

- `test/unit/GameHubE2E.t.sol`
- `test/diff/StatefulSystemDiff.t.sol`
- `test/diff/StatefulSystemDiffAdapter.t.sol`

Latest local gate run after Sic Bo:

- `FOUNDRY_PROFILE=pr forge build`
- `FOUNDRY_PROFILE=pr forge test --match-path test/diff/DiffSicBo.t.sol -vvv`
- `FOUNDRY_PROFILE=pr forge test --match-path test/unit/GameHubE2E.t.sol -vvv`
- `FOUNDRY_PROFILE=pr forge test --match-path test/diff/StatefulSystemDiff.t.sol -vvv`
- `make pr`
- `git diff --check`

`make pr` result:

- unit: 93 passed
- diff: 13 passed
- invariants: 7 passed
- fork: 1 skipped in the local environment

## Release Artifact Status

The code and scripts are ready for a fresh v1.3 deployment snapshot, but this stage has not been
redeployed after adding the new modules.

Before a production or public testnet handoff, regenerate:

- `deployments/latest-v13.json`
- `deployments/verify-latest-v13.sh`
- `deployments/release-latest-v13.json`
- `deployments/release-notes-latest-v13.md`
- `deployments/frontend-manifest-latest-v13.json`
- `deployments/golden-vectors-latest-v13.json`
- frontend ABI export

Expected commands after deployment:

```bash
make release-digest
make release-notes
make release-frontend-manifest
make release-golden-vectors
make release-abis
make release-verify
STRICT=1 make release-check
```

## Remaining Before PR

- Keep this as one stage PR rather than splitting each game into small PRs.
- Push `codex/casino-slots`.
- Open a draft PR with scope: legacy hub cleanup + casino one-shot RNG expansion + v1.3 doc proof cleanup.
