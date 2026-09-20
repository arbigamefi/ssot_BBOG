# Runbook: Move the keeper off the governance EOA

Swap `KEEPER_PRIVATE_KEY` from the shared deployer/governance EOA to a dedicated,
bounded-balance keeper account — on both chains, without any on-chain
transaction.

## Scope

- **Applies to:** the production keepers on `45.77.243.138`
  (`keeper-primary`, chain 8453; `keeper-testnet-primary`, chain 84532).
- **Does not touch:** contracts, governance, release artifacts, or the bet index.
- **Downtime:** one keeper restart per chain. Settlement is permissionless, so
  even an extended outage cannot strand funds — players can finalize their own
  bets.

## Why

`docs/ops/runbooks/casino-keeper-production.md` already states the rule:

> `KEEPER_PRIVATE_KEY` — Dedicated bounded-balance keeper EOA. Never reuse
> deployer or governance keys.

Production does not follow it. Verified 2026-09-20:

```
Bank (USDC) 0x597266…2c77  governance() = 0xc8eC9920…24B1b684
Bank (WETH) 0xf63c7c…2955  governance() = 0xc8eC9920…24B1b684
keeper-primary          signer          = 0xc8eC9920…24B1b684
keeper-testnet-primary  signer          = 0xc8eC9920…24B1b684
```

One EOA is the deployer, the governance of every mainnet contract, the signer of
the release lock, **and** the hot wallet in a container on an internet-facing
host.

It does not need to be. Every function the keeper writes is unguarded:

```solidity
function finalize(uint256 betId)        external override nonReentrant
function finalizeResult(uint64 marketId) external override
function settleTicket(uint256 ticketId)  external override nonReentrant
function refundTicket(uint256 ticketId)  external override nonReentrant
```

No `onlyGov`, no role, no allowlist — `grep -rniE "keeper|onlyKeeper|allowlist" src/**/*.sol`
returns one code comment and nothing else. The keeper needs gas and nothing else,
so the swap is a configuration change with no on-chain counterpart.

## Prerequisites

### Facts confirmed before writing this

| Check | Result |
| --- | --- |
| Anything pinning the keeper address (`KEEPER_ADDRESS`/`_ACCOUNT`/`_SIGNER`) | none, in any of the three containers |
| `0xc8eC…b684` in repo config | only as `gov` / `deployer` / `signer` in release artifacts — records of who deployed and signed, unaffected by this swap |
| `KEEPER_PRIVATE_KEY` lines to edit | exactly 1 in each of the two env files |
| Mainnet settlement history | **zero** — 0 bets on chain 8453; all 182 indexed bets are 84532 |
| `cast` on the server | not installed — verify the new address from the keeper's own startup log |

Because mainnet has never settled a bet, the mainnet swap carries no risk to
in-flight work. Do mainnet first anyway: it is the account that matters.

### Gas sizing

Measured from three real finalize receipts on 84532: **271,007 / 271,331 /
462,056 gas**. At Base mainnet's 0.005 gwei basefee plus L1 data fee for a
36-byte calldata, that is roughly **0.000005 ETH per settlement**.

| | |
| --- | --- |
| Fund the new mainnet EOA with | **0.01 ETH** (~2,000 settlements; 0.005 is also defensible) |
| Fund the new testnet EOA with | any faucet amount; the current EOA holds 0.28 Sepolia ETH |
| Leave on the old EOA | mainnet balance is 0.0014 ETH — sweep it later or leave it, it is noise |

Use **two separate keys**, one per chain. A testnet key lives in the same kind
of file with the same exposure; there is no reason for a testnet compromise to
reach mainnet, and a second key costs nothing.

## Step 0 — Generate the keys (operator only)

Run locally. The private keys must never be pasted into a chat, a ticket, or a
shell history file.

```bash
cast wallet new
```

Record each address. You will need them in Step 3 to confirm the swap took.

## Step 1 — Fund the new mainnet EOA

Send 0.01 ETH on Base mainnet to the new mainnet address. Confirm:

```bash
cast balance --rpc-url https://base-rpc.publicnode.com <NEW_MAINNET_ADDRESS> --ether
```

## Step 2 — Swap the mainnet key

On the server. The `sed` edits one line in place; the backup is the rollback.

```bash
cd /opt/arbigamefi/frontend/deploy/docker/env
cp -a keeper.primary.env keeper.primary.env.bak-$(date +%Y%m%d-%H%M%S)
read -rs -p 'new mainnet keeper private key: ' KEEPER_NEW_KEY; echo
export KEEPER_NEW_KEY
python3 - keeper.primary.env <<'PY'
import os, re, sys
k = os.environ.get('KEEPER_NEW_KEY', '').strip()
if not re.fullmatch(r'0x[0-9a-fA-F]{64}', k):
    raise SystemExit('refusing: key must be 0x + 64 hex chars')
p = sys.argv[1]
src = open(p).read()
new, n = re.subn(r'(?m)^KEEPER_PRIVATE_KEY=.*$', 'KEEPER_PRIVATE_KEY=' + k, src)
if n != 1:
    raise SystemExit(f'refusing: expected exactly 1 KEEPER_PRIVATE_KEY line, found {n}')
open(p, 'w').write(new)
print('ok: 1 line replaced')
PY
unset KEEPER_NEW_KEY
chmod 600 keeper.primary.env
wc -l keeper.primary.env    # expect 36
```

Three deliberate choices in that block:

- The key arrives through `read -rs` (not echoed, not written to shell history)
  and is handed to Python through the **environment**, not `argv`.
  `/proc/<pid>/cmdline` is world-readable on Linux and this host has a non-root
  account; `/proc/<pid>/environ` is readable only by the process owner.
- The key is rejected unless it is exactly `0x` + 64 hex characters, so a
  truncated or wrapped paste stops here rather than being written.
- The file is rewritten only when exactly one `KEEPER_PRIVATE_KEY=` line
  matched. Zero matches or two both abort untouched, so the edit cannot land on
  the wrong variable or silently do nothing.

The anchored `(?m)^KEEPER_PRIVATE_KEY=` also leaves `#KEEPER_PRIVATE_KEY=…`
comments and any `KEEPER_PRIVATE_KEY_BACKUP=` style variable alone. All of the
above is covered by the edge cases exercised before this runbook was written:
happy path, short key, no match, double match, and a file with no trailing
newline.

## Step 3 — Restart mainnet and confirm the address

```bash
cd /opt/arbigamefi/frontend
docker compose -f compose.production.yml up -d keeper-primary
docker logs --tail 20 arbigamefi-production-keeper-primary-1 2>&1 \
  | grep -o '"keeper":"0x[0-9a-fA-F]*"'
```

**Gate:** the printed address must equal the new mainnet address from Step 0.
If it does not, restore the backup from Step 2 and restart before going further.

## Step 4 — Repeat for testnet

Same as Steps 2–3 with `keeper.testnet.primary.env` (expect **33** lines) and
`keeper-testnet-primary`. Leave at least ~20 s between the two keeper restarts:
starting both at once makes them race on Postgres schema initialisation and one
will die with `deadlock detected`.

## Step 5 — Verify

```bash
curl -s https://arbigamefi.com/api/healthz | python3 -m json.tool | head -20
docker logs --since 10m arbigamefi-production-keeper-primary-1 2>&1 | grep -cE '"level":"error"|429'
```

Expect `status: ok`, keeper `running`, a fresh `ageMs`, and zero errors. On
84532 confirm a real settlement lands — that chain has live volume, so a new
`finalized_tx_hash` appearing after the swap is the end-to-end proof.

## Rollback

Restore the `.bak-*` file and restart that keeper. Nothing on-chain changed, so
there is no state to unwind.

## After

- The old EOA reverts to being governance-only. It no longer belongs on this
  host in any form.
- Treat it as having been resident on an internet-facing server since deployment
  when deciding whether to rotate governance — that decision is independent of
  this runbook.
- Consider a low-balance alert on the new keeper EOA. Settlement is
  permissionless, so an empty keeper degrades latency rather than safety, but it
  degrades silently.
- Migrating governance to a Safe multisig (R-03) is the change that makes the
  old key's history stop mattering.
