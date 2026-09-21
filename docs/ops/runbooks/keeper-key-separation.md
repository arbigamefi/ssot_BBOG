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

Historical state before the 2026-09-20 rotation:

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

Record each address. Set `NEW_KEEPER_ADDRESS` to the approved address for the
chain being processed. Step 3 gates on it; `FINALIZED_TX_HASH` below is an
observed transaction hash, not an instruction to create a transaction.

## Step 1 — Fund the new mainnet EOA

Send 0.01 ETH **on Base mainnet, chain id 8453** to the new mainnet address.

**Verify it landed before restarting anything.** During the 2026-09-20
execution the first transfer went to Ethereum mainnet instead of Base, and two
further "already sent" reports had not arrived at all. The address is valid on
every EVM chain, so a wrong-chain send succeeds and simply funds the wrong
place.

```bash
cast balance --rpc-url https://base-rpc.publicnode.com "$NEW_KEEPER_ADDRESS" --ether
```

If that reads zero, check whether the funds went elsewhere before assuming the
transaction is merely slow:

```bash
for rpc in https://ethereum-rpc.publicnode.com https://arbitrum-one-rpc.publicnode.com \
           https://optimism-rpc.publicnode.com https://sepolia.base.org; do
  echo "$rpc $(cast balance --rpc-url $rpc "$NEW_KEEPER_ADDRESS" --ether)"
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

Expect `ok: 1 line replaced atomically; no old-key backup created`. Keep an
approved dedicated keeper key in operator custody for rollback. Do not restore
the historical governance key or store a rollback secret on this host.

Why it is built this way:

- The entire key is read from stdin through an inherited descriptor, never argv
  or an exported environment variable. Only a valid secp256k1 scalar is accepted.
- Exactly one canonical `KEEPER_PRIVATE_KEY=` declaration is required. Compose
  aliases (`export`, whitespace, `:`), duplicate declarations, multiline quoted
  values and extra stdin records are rejected before replacement. Normalize
  unusual env syntax deliberately before retrying; never print the file.
- The filename must be a basename. Symlinks and hard-linked targets are refused.
- A same-directory `0600` temporary file is explicitly written, flushed,
  fsynced and closed before atomic replacement; owner/group are preserved.
  Cooperating invocations serialize using an empty persistent `.lock` file.
- Before replacement, an error leaves the original bytes intact. If the final
  directory fsync fails, the helper reports **replacement installed; durability
  unconfirmed**. Inspect the installed account before deciding whether to retry.
- No copy of the old environment is created. Existing historical backups are
  unaffected and require the separate retirement procedure below.

Run `python3 -m unittest discover -s test/ops -v` locally before installing.
Coverage includes real file-size-limit failures, fsync/rename failures, Compose
aliases, quoted fake declarations, key/path validation, and successful byte and
permission preservation. The helper supports Linux and macOS with Python 3.

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
If it does not, stop this rollout. Reapply the approved dedicated keeper key
from operator custody using Step 2, then restart and repeat the address check.

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
cast nonce --rpc-url https://sepolia.base.org "$NEW_KEEPER_ADDRESS"   # 0 -> 1
cast tx --rpc-url https://sepolia.base.org "$FINALIZED_TX_HASH" from  # must equal it
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
- **Governance-key residency remains unresolved.** Read-only inspection on
  2026-09-21 found 24 historical keeper env backups with the old governance
  credential; 9 mainnet copies were mode `0644` under traversable directories.
  At 08:17 UTC, an approved containment change made the env directory `0700`
  and those nine files `0600`; all 26 keeper secret files are now `0600`. The
  24 historical copies remain. The new running keeper accounts do not establish
  removal from the host. See the retirement procedure and rework plan before
  declaring closure.

## Rollback

Supply an approved **dedicated keeper** key from operator custody through
Step 2, then restart one keeper and verify its address, gas balance, fresh health
and transaction behavior. Keep non-secret configuration separately versioned.
Never revert to a governance credential. Atomic replacement protects against
partial writes; it does not replace this operational rollback procedure.

## After

- The intended end state is no governance credential on this host. Merely
  changing `KEEPER_PRIVATE_KEY` does not establish it; retire all copies below.
- Treat it as having been resident on an internet-facing server since deployment
  when deciding whether to rotate governance — that decision is independent of
  this runbook.
- Consider a low-balance alert on the new keeper EOA. Settlement is
  permissionless, so an empty keeper degrades latency rather than safety, but it
  degrades silently.
- Migrating governance to a Safe multisig (R-03) is the change that makes the
  old key's history stop mattering.

## Retire historical credential copies

This is a separate production change, after the live dedicated addresses and
operator-held recovery keys have been verified. Do not let a rotation helper
silently delete recovery material.

1. Inventory filenames, modes and secret identity **without printing values**.
   Include `.bak*`, `.throttle-*.bak`, other exports, old container environments,
   host snapshots and operator copies. A filename-only search is not proof that
   no other credential copy exists.
2. Contain unintended local access: restrict the env directory to `0700` and
   secret-bearing files to `0600`, recording original modes in a secret-free
   rollback manifest. Existing compose containers need no restart for chmod.
3. Verify both current keeper public addresses and an off-host recovery method.
   Check that the old governance credential is held by its authorized operator;
   do not create another host archive of the compromised copies.
4. Obtain the operator's explicit retirement approval for the reviewed file
   list, then unlink exactly those obsolete backups. Verify absence and live
   keeper health. Unlinking is not secure erasure of filesystem/cloud snapshots.
5. Treat prior world-readable residency as possible disclosure. Rotation or
   transfer of all live governance authority is a separate signed operation,
   with target addresses, chain IDs, Safe quorum and readbacks reviewed first.
   Removing files does not invalidate previously copied keys.

Close the residency item only with recorded containment, retirement and
credential-authority decisions. Host filesystem evidence alone cannot prove a
credential was never copied. See [the rework plan](../pr39-rework-plan.zh-CN.md).
