# Keno Module Upgrade · Base Sepolia · 2026-05-20

| Field | Value |
| --- | --- |
| Chain | Base Sepolia `84532` |
| GameHub | `0x9FD191e27A411d5d37c903199E835808c66e0357` |
| Game ID | `0xb4aacd27778fcc813ac1737807c34d5d4193c514f0d91a0caeeada2d6752baf0` |
| Previous Keno module | `0x0105b62C29480B630309db018aAb9DAbd1071d93` |
| New Keno module | `0xe0883dce4038B1c070CBbA3AD6E46a859Bc6DD0E` |
| Upgrade block | `41760321` |
| Release digest | `0x2a3db090c24089944a0f23df63eb970c89c6f3529970c85c29b8cf3de9aba176` |

## Scope

This was a Keno-only module replacement. No `GameHub`, `Bank`, `VRFHub`, `SettlementRouter`, sportsbook, or other casino module was redeployed.

The upgrade changed Keno from the old large-board rule set to:

- board size: 15 numbers;
- draw count: 5 numbers;
- max player picks: 5 numbers;
- maximum displayed payout: `500.5x`.

## Transactions

| Action | Tx |
| --- | --- |
| Deploy `KenoModule` | `0x08ac1a5ae3a8cc3ae12353b6896c5101cdd03718b24c32e3900d817ad314f2b2` |
| `GameHub.registerGame(KENO, newModule)` | `0xa01fc5e34d18c48c98f6675aeb660636f3e122b9648f64ffedf76f05b106f033` |
| Canary `placeBet` | `0xa499c785fc931610798663d1067713b666811c502f7b0f16b26429fca17985e6` |
| Canary VRF callback / `BetRandomReady` | `0x05ca873d42f8281391a5de5352bcd12744b2b5daabacba09e71bfac863f28fa2` |
| Canary keeper `finalize` / `BetFinalized` | `0x0fd52b961a4bc9ad90c334da7c8c376b9e378c0815120d0ebabb94591090585c` |

## Readbacks

`GameHub.gameModule(KENO)` after upgrade:

```text
0xe0883dce4038B1c070CBbA3AD6E46a859Bc6DD0E
```

Canary bet:

| Field | Value |
| --- | --- |
| Bet ID | `130` |
| Params | `0x000000000000000000000000000000000000000000000000000000000000001f` |
| Selection | `1, 2, 3, 4, 5` |
| Stake | `0.01 USDC` |
| Request ID | `35237345399468934658961152472115376039473934249240202849387124717014230190153` |
| Random hash | `0x03633df9ce9f396d5bdbbc5e71b702fae456ae5d331b1860432a7fa717d4b733` |
| Final state | `Settled` |
| Payout gross | `0.011122 USDC` |
| Payout net | `0.010900 USDC` |
| Protocol fee accrual | `0.000200 USDC` |
| Refund | `0` |

## Commands

```bash
set -a
. ./.env
set +a

FOUNDRY_PROFILE=default forge script \
  script/ops/KenoModuleUpgradeV13.s.sol:KenoModuleUpgradeV13 \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vvv

python3 script/release/apply_keno_upgrade_v13.py
make release-frontend-manifest-v13
make release-golden-vectors-v13
make release-digest-v13 release-verify-v13
make release-notes-v13 release-abis-v13 release-package-v13
pnpm -C frontend ssot:sync -- --from ../dist/ssot-release-chain-84532-41760321-0x2a3db090.tar.gz
pnpm -C frontend check:release
pnpm -C frontend smoke:release-readonly
```

## Verification

- `GameHub.gameModule(KENO)` matches the new module.
- New `KenoModule` is verified on BaseScan.
- `pnpm -C frontend check:release` passed.
- `pnpm -C frontend smoke:release-readonly` passed and confirmed Keno mapping/bytecode.
- `pnpm -C frontend typecheck` passed.
- `pnpm -C frontend test` passed.
- `pnpm -C frontend/apps/web build` passed.
- `forge test` passed: 121 passed, 0 failed, 1 skipped.
