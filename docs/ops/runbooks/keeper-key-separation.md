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

| Check                                                                       | Result                                                                                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Anything pinning the keeper address (`KEEPER_ADDRESS`/`_ACCOUNT`/`_SIGNER`) | none, in any of the three containers                                                                                     |
| `0xc8eC…b684` in repo config                                                | only as `gov` / `deployer` / `signer` in release artifacts — records of who deployed and signed, unaffected by this swap |
| `KEEPER_PRIVATE_KEY` lines to edit                                          | exactly 1 in each of the two env files                                                                                   |
| Mainnet settlement history                                                  | **zero** — 0 bets on chain 8453; all 182 indexed bets are 84532                                                          |
| `cast` on the server                                                        | not installed — verify the new address from the keeper's own startup log                                                 |

Because mainnet has never settled a bet, the mainnet swap carries no risk to
in-flight work. Do mainnet first anyway: it is the account that matters.

### Gas sizing

Measured from three real finalize receipts on 84532: **271,007 / 271,331 /
462,056 gas**. At Base mainnet's 0.005 gwei basefee plus L1 data fee for a
36-byte calldata, that is roughly **0.000005 ETH per settlement**.

|                               |                                                                         |
| ----------------------------- | ----------------------------------------------------------------------- |
| Fund the new mainnet EOA with | **0.01 ETH** (~2,000 settlements; 0.005 is also defensible)             |
| Fund the new testnet EOA with | any faucet amount; the current EOA holds 0.28 Sepolia ETH               |
| Leave on the old EOA          | mainnet balance is 0.0014 ETH — sweep it later or leave it, it is noise |

Use **two separate keys**, one per chain. A testnet key lives in the same kind
of file with the same exposure; there is no reason for a testnet compromise to
reach mainnet, and a second key costs nothing.

## Step 0 — Generate the keys (operator only)

Run locally. **Redirect to a file — never let the key reach the terminal.**

```bash
umask 077 && cast wallet new > ~/keeper-mainnet.key && grep Address ~/keeper-mainnet.key
```

That prints only the address. The private key lands in a `600` file and is
never displayed.

> Plain `cast wallet new` prints the private key to stdout. If it is run in a
> terminal that is recorded — a pasted session, a screen share, an AI coding
> assistant, a CI log — that key is burned and must be discarded. This happened
> on the first attempt during the 2026-09-20 execution.

Repeat for `~/keeper-testnet.key`. Use **two separate keys**, one per chain.
Confirm they really are distinct before going further:

```bash
cmp -s ~/keeper-mainnet.key ~/keeper-testnet.key && echo 'SAME FILE - regenerate' || echo distinct
awk '/Private key:/{print ($3 ~ /^0x[0-9a-fA-F]{64}$/) ? "well-formed" : "MALFORMED"}' ~/keeper-mainnet.key
```

Record each address. Step 3 gates on them.

## Step 1 — Fund the new mainnet EOA

Send 0.01 ETH **on Base mainnet, chain id 8453** to the new mainnet address.

**Verify it landed before restarting anything.** During the 2026-09-20
execution the first transfer went to Ethereum mainnet instead of Base, and two
further "already sent" reports had not arrived at all. The address is valid on
every EVM chain, so a wrong-chain send succeeds and simply funds the wrong
place.

```bash
cast balance --rpc-url https://base-rpc.publicnode.com <NEW_ADDRESS> --ether
```

If that reads zero, check whether the funds went elsewhere before assuming the
transaction is merely slow:

```bash
for rpc in https://ethereum-rpc.publicnode.com https://arbitrum-one-rpc.publicnode.com \
           https://optimism-rpc.publicnode.com https://sepolia.base.org; do
  echo "$rpc $(cast balance --rpc-url $rpc <NEW_ADDRESS> --ether)"
done
```

Funds on the wrong chain are recoverable — the same key controls the address
everywhere — but they are also a liability once the key is on the server, since
a keeper EOA is supposed to hold a bounded balance only on the chain it works
on. Sweep them.

## Step 2 — Swap the mainnet key

`/opt/arbigamefi/ops/swap-keeper-key.sh` (mode 700) does the edit. It reads the
key from **stdin**, so pipe it straight from the file — the key never renders in
a terminal, a transcript, `argv`, or shell history.

```bash
awk '/Private key:/{print $3}' ~/keeper-mainnet.key \
  | ssh root@45.77.243.138 '/opt/arbigamefi/ops/swap-keeper-key.sh keeper.primary.env'
```

Expect `ok: 1 line replaced`, `lines: 36`, and a `backup:` path — that backup is
the rollback.

Why it is built this way:

- **stdin, not `argv`.** `/proc/<pid>/cmdline` is world-readable on Linux and
  this host has a non-root account; `/proc/<pid>/environ` is not. A key passed
  as an argument is readable by any local user for the life of the process.
- **Rejects anything that is not `0x` + 64 hex**, so a truncated or line-wrapped
  paste stops before it is written. Surrounding whitespace is stripped.
- **Writes only when exactly one `KEEPER_PRIVATE_KEY=` line matched.** Zero or
  two both abort with the file untouched, and the abort path removes its own
  backup rather than leaving debris.
- The anchored `(?m)^KEEPER_PRIVATE_KEY=` leaves `#KEEPER_PRIVATE_KEY=…`
  comments and `KEEPER_PRIVATE_KEY_BACKUP=` style variables alone.

Exercised before first use against: happy path, short key, empty stdin, missing
file, double match, no trailing newline, and pasted whitespace.

The script is small enough to audit in one sitting; read it before trusting it
with a key. It is version-controlled at `script/ops/swap-keeper-key.sh` — the
server copy is a deployment of that file, so reinstall it after any host rebuild:

```bash
scp script/ops/swap-keeper-key.sh root@45.77.243.138:/opt/arbigamefi/ops/ \
  && ssh root@45.77.243.138 'chmod 700 /opt/arbigamefi/ops/swap-keeper-key.sh'
```

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

Expect `status: ok`, keeper `running`, a fresh `ageMs`, and zero errors.

That proves the keepers **start, connect and run** under the new keys. It does
not prove they **settle** under them. The end-to-end check is a real
`finalized_tx_hash` signed by the new address, and it needs a bet to exist:

```sql
select count(*) from bets where chain_id=84532 and state in ('randomReady','pendingVrf','held');
```

If that is zero there is nothing pending to observe — place one bet on 84532
and watch it finalize. Do not record the swap as fully verified until a
settlement has landed under the new key.

Production web is pinned to `NEXT_PUBLIC_CHAIN_ID=8453`, so it cannot place a
testnet bet. Run the app locally against 84532 instead, without editing
`.env.local` — Next.js ranks `.env.development.local` above it, and
`frontend/.gitignore` already ignores `.env.*.local`:

```bash
echo 'NEXT_PUBLIC_CHAIN_ID=84532' > frontend/apps/web/.env.development.local
pnpm -C frontend/apps/web dev
```

Delete that file when finished. Two things that cost time on the first run:

- **Switch the wallet to Base Sepolia before betting.** The page renders
  testnet content regardless of what the wallet is connected to, so it looks
  ready while the transaction never leaves. The symptom is silence everywhere —
  no new bet row, keeper nonce unchanged, and zero GameHub events on chain.
- Local `/api/healthz` reporting `degraded` is expected. It reads a stale local
  keeper snapshot, not production. Judge the keeper from production healthz.

The decisive evidence is the **sender of the finalize transaction**, and a
fresh key makes it unambiguous — it has never sent anything, so its nonce
starts at 0:

```bash
cast nonce --rpc-url https://sepolia.base.org <NEW_KEEPER_ADDRESS>   # 0 -> 1
cast tx --rpc-url https://sepolia.base.org <FINALIZED_TX_HASH> from  # must equal it
```

Do not use `max(bet_id)` to baseline the index — `bet_id` is a text column, so
`max()` compares lexicographically and `'99'` sorts above `'184'`. Use
`count(*)` and `order by placed_at desc`.

## Execution record

Run 2026-09-20. Both gates passed; `healthz` ok, zero errors, zero 429s.

|               |                                                                                |
| ------------- | ------------------------------------------------------------------------------ |
| mainnet 8453  | `0x440558699040d28975D218caB497338B65960A92`, funded 0.001683 ETH              |
| testnet 84532 | `0xc04d22F83d7494440Dd07ab42BeD01E45E88EC59`, funded 0.05 ETH from the old EOA |
| previously    | `0xc8eC9920…24B1b684` on both — now absent from both keepers                   |

**Verified end to end on 84532** the same day. Bet 185 was placed and settled
by the new keeper:

```
finalize tx  0x654134a19001d82be3aac7d9c38322f8ab91823b1541316622b982637368c8a5
  from       0xc04d22F83d7494440Dd07ab42BeD01E45E88EC59   (new keeper EOA)
  to         0x7Bba34F0ac9476b856026273ef66dfC4Da33B102   (GameHub)
  nonce      0                                            (that key's first tx)
  status     1 (success)
  gasUsed    268,020                                      (~0.0000016 ETH)
```

268,020 gas matches the 271k–462k range measured from historical receipts, so
the mainnet funding estimate of ~0.000005 ETH per settlement holds.

Outstanding:

- **Mainnet is unexercised.** Its keeper is proven to start and connect, not to
  settle — chain 8453 has never had a bet, so there is nothing to finalize. The
  first real mainnet bet is the outstanding check.
- **The governance key's prior residency on the host is unaddressed.** The swap
  removed the key; it did not remove the fact that it lived on an
  internet-facing server from deployment until 2026-09-20. See R-03.

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
