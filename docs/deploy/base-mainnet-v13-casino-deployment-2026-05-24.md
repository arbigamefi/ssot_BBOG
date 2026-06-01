# Base mainnet v1.3 casino deployment - 2026-05-24

Status: **CONTRACTS DEPLOYED; PUBLIC RISK-IN STILL NO-GO**

This record captures the public Base mainnet deployment and release sync evidence for the v1.3
casino-only launch path. It does not authorize public traffic or casino risk-in by itself.

## Scope

- Chain: Base mainnet (`8453`)
- Deployment mode: casino-only v1.3
- Sportsbook public risk-in: disabled
- Broadcast env: `.base-mainnet-v13-casino.env` (ignored; not committed)
- Release block: `46404343`
- Release digest:
  `0x06ca8fe7253f40e0548e7dd01f2397a4dc51ba2dfae200cc8722bcb9884b5060`
- Release package:
  `dist/ssot-release-base-mainnet-v13-2026-05-24-0x06ca8fe7.tar.gz`

## Deployed contracts

| Contract | Address |
| --- | --- |
| `ChainlinkV2PlusWrapperAdapter` | `0x4A923eACBdF8Ca3571c5dbf4B182AEC5418736A6` |
| `VRFHub` | `0xe441dF37b6c3717A4126d201D9130ffa65eC866D` |
| `PoolRegistry` | `0x7E92e8C162c811fa8b676B7222844fe9a1005479` |
| `SettlementRouter` | `0xd9d1B9f9D47922D776f5A4A05eeB4D5b802E05d7` |
| `ReferralRegistry` | `0x139F850D11f0FA6fbDbFA6c7024806bB822c336f` |
| `DefaultReferralEngine` | `0x1c7f605d39c66f64Fe6576d54e27A87825397A20` |
| `GameHub` | `0x9CACb3250CC648D711C14F0d39cF1EEa3B1D1Ef9` |
| Casino `Bank` pool `1` | `0x3ed89faE1708DD24df1c95B61edeDdCDe9E2D07f` |
| Asset | Base mainnet USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Game modules

| Game | Module |
| --- | --- |
| Dice | `0x0830D84d99D9aC933D9C99ab3B4f49352Af56ab7` |
| Coin Toss | `0x7E9d358c94227148B5f7542DA66475277D9DA0b3` |
| Roulette | `0xE6761b26D6B9b6C0cd7F240c3Fa08B65340c84F5` |
| Keno | `0x84e6d3DB39E1b0E0386d8F4e3222926dB32A75c9` |
| Plinko | `0x1b5Bfeb5DD456a02470E56Da83F331502BF04635` |
| Sic Bo | `0x868db226D75138B8f242B02FEcFa054FfA56Bf17` |
| Slots | `0x29E4A7b05670E5430eB0F5ef2823E6eDffa742Eb` |
| Baccarat | `0xB1754C8505B1f901Ba9FDb286d631d523640B7c0` |

## Verification performed

Deployment broadcast:

```bash
set -a
source .base-mainnet-v13-casino.env
set +a
CLEAN_BROADCAST=1 bash script/ci/clean_foundry.sh
FOUNDRY_PROFILE=default forge script script/DeployV13.s.sol:DeployV13 --rpc-url "$RPC_URL" --broadcast -vvv
```

Release lock and package:

```bash
TAG_NAME=base-mainnet-v13-2026-05-24 make release-v13
STRICT=1 make release-check
```

Frontend release sync:

```bash
pnpm -C frontend ssot:sync -- --from ../dist/ssot-release-base-mainnet-v13-2026-05-24-0x06ca8fe7.tar.gz
pnpm -C frontend check:mainnet-release
RPC_URL=<base-mainnet-rpc> pnpm -C frontend smoke:release-readonly -- --chain-id 8453
```

Release artifact tracking:

```bash
git add -f deployments/... dist/ssot-release-base-mainnet-v13-2026-05-24-0x06ca8fe7.tar.gz
make release-artifacts-tracked-v13
```

Basescan source verification:

```bash
set -a
source .base-mainnet-v13-casino.env
set +a
FOUNDRY_PROFILE=default bash deployments/verify/verify-8453-46404343-v13.sh
```

Post-sync quality gates:

```bash
pnpm -C frontend typecheck
pnpm -C frontend test
```

Observed results:

- `DeployV13` broadcast completed successfully on chain `8453`.
- Core deployed contract bytecode was present for adapter, `VRFHub`, `PoolRegistry`,
  `SettlementRouter`, `GameHub`, and pool `1` bank.
- Basescan source verification returned `Pass - Verified` for:
  - `ChainlinkV2PlusWrapperAdapter`;
  - `VRFHub`;
  - `PoolRegistry`;
  - `SettlementRouter`;
  - `ReferralRegistry`;
  - `DefaultReferralEngine`;
  - `GameHub`;
  - casino pool `1` `Bank`;
  - `DiceModule`;
  - `CoinTossModule`;
  - `RouletteModule`;
  - `KenoModule`;
  - `PlinkoModule`;
  - `SicBoModule`;
  - `SlotsModule`;
  - `BaccaratModule`.
- `release-check` verified the v1.3 release digest and signer.
- `ssot:sync` generated `frontend/packages/ssot/src/release/embedded/chain-8453.json`, Base
  mainnet release ABIs, and a fixture bundle mirror.
- `check:mainnet-release` passed with required embedded chain id `8453`.
- `smoke:release-readonly -- --chain-id 8453` passed and confirmed:
  - RPC chain id `8453`;
  - every core casino contract has bytecode;
  - every game module mapping points to bytecode;
  - `GameHub.quoteVRFFee(1)` returns a fee and gas limit;
  - Base mainnet USDC decimals are `6`;
  - pool `1` registry rows match the embedded release;
  - pool `1` bank has bytecode;
  - `Bank.getSSOT()` is readable;
  - `GameHub.riskInPaused(1) == false`.
- `frontend typecheck` passed.
- `frontend test` passed: 5 workspace packages, including web `62` files / `272` tests.

## Remaining NO-GO items before public casino risk-in

- `frontend/apps/web/.env.local` must be present before public risk-in. `casino-mainnet-frontend-readiness-v13` requires a
  production web env with `NEXT_PUBLIC_CHAIN_ID=8453`, `NEXT_PUBLIC_ENV=production`, a browser-safe
  RPC setting, `NEXT_PUBLIC_SENTRY_RELEASE`, and `NEXT_PUBLIC_SENTRY_DSN`.
- `casino-mainnet-gonogo-v13` currently fails at the missing web env check. This is expected.
- Managed Postgres for the durable bet index is not recorded here.
- Primary and backup casino keeper production deployment evidence is not recorded here.
- Initial casino bank liquidity and bankroll owner sign-off are not recorded here.
- Approved `casino.frontend-access.v1` evidence is not recorded here. Public web risk-in must remain
  disabled until that memo passes `REQUIRE_APPROVED=1`.
- Mainnet small-stake canary is not recorded here. Use
  `docs/deploy/base-mainnet-casino-canary-template.md` after web env, keeper, Postgres, and bank
  liquidity are ready.
