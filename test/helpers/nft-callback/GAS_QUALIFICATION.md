# Real-wrapper callback gas characterization

`NftCallbackGasQualificationFork.t.sol` deploys the current production contracts on a **local** Base Sepolia fork. Its requests pass through the deployed Chainlink wrapper and coordinator request path. Fulfillment locally impersonates the deployed coordinator and calls the real wrapper; the wrapper itself enforces its exact consumer gas budget. No transaction is broadcast.

This is sampled full-path evidence, not a worst-case gas proof or a release admission decision. A successful diagnostic retry is **not** a successful provider callback. With the current tree, lowering game rounds alone cannot establish success for every possible NFT history.

## Reproduce

Provide a Base Sepolia endpoint that serves the pinned block through `NFT_GAS_RPC_URL`. Do not include credentials in command arguments, logs or committed files. Operators use the Alchemy operator key through the redacting wrapper; the public `https://sepolia.base.org` also served the pinned block on 2026-10-11.

```sh
script/tools/with-ops-rpc.sh alchemy base-sepolia bash -c \
  'NFT_GAS_RPC_URL="$OPS_RPC_URL" python test/helpers/nft-callback/run_gas_matrix.py --output dist/nft-callback-gas-local'
```

The checked-in case list is `gas-qualification-cases.json`. Each case starts a separate Forge invocation, including a separately committed `setUp` before its measured test transaction. An example that requires one observed case to fit:

```sh
python test/helpers/nft-callback/run_gas_matrix.py \
  --filter keno10-empty-pp --require-fit \
  --output dist/nft-callback-gas-positive-sample
```

By default, runner exit status reports whether all semantic assertions ran and passed. It separately records `callbacksFit` and `callbacksDidNotFit`. Without `--require-fit`, budget failures with a safe, correct same-seed retry deliberately pass their semantic assertions. Skipped tests, missing observation fields, RPC errors and assertion failures cannot be reported as semantic passes. `--require-fit` additionally fails on every sampled budget failure; even a green run remains limited to those samples.

The runner writes one complete Forge log per case, `results.json`, `summary.json` and `SOURCE_BEFORE.sha256` / `SOURCE_AFTER.sha256`. The runner compares the same manifest before every case and after the full run, and fails on any observed drift. These manifests include production Solidity, the fixture, case list, runner, dependency lock, compiler configuration and all Solidity files in the three vendored dependency packages (a superset of compiled imports). Dependency authentication against upstream and the explicitly recorded Azuro range-query patch remain separate provenance checks. Do not edit these inputs while a run is executing; the before/after check is a drift detector, not a filesystem lock.

The initial 36-case run at `nft-callback-gas-2026-10-04/` (evidence directories cited here are archived; see the [launch candidate](../../../docs/release/launch-candidate.zh-CN.md) §14) used the preceding runner revision, saved there as `runner-used.py`, with an end-of-run `SOURCE.sha256`. The subsequent `final/` run repeats all 36 cases with dependency-inclusive start/per-case/end manifests, fixed compiler configuration and stronger event-identity assertions. Its `summary.json` and manifests are the authoritative rerun evidence. Do not retrofit a start-of-run hash claim onto the earlier evidence.

The runner clears inherited `FOUNDRY_*` and legacy `DAPP_*` overrides, fixes `FOUNDRY_PROFILE=default`, and checks the effective configuration is Solidity `0.8.37`, Cancun, via IR, optimizer enabled with 500 runs. It records only those whitelisted settings and `forge --version`, never the full configuration's RPC/key fields.

`--isolate-build` uses Forge's native `--out` and `--cache-path` directories under the selected output.
Tests run with one thread. The structural-extrema case list is `gas-structural-extrema-cases.json`;
it targets maximum cover reads, maximum query-loop shape and the two-boundary cold-slot tradeoff.
Eight such real-wrapper callbacks passed with `--require-fit --isolate-build` at
`admission-decision-2026-10-04/structural-extrema/`. These are still sampled full-path observations.
The all-state bound is the [first-callback gas certificate](../../../docs/audit/first-callback-gas-certificate-2026-10-07.md).

The joint-state list `gas-joint-state-cases.json` repeats two old baselines and adds six combinations
of matured older-source holdback, a new ineligible player, fresh source locks and tree boundary shapes.
Its fallback cases use a non-final `lastUsed` leaf, so the second boundary can also perform suffix queries.
Run it with the same fixed provider snapshot and isolated compiler:

```sh
python test/helpers/nft-callback/run_gas_matrix.py \
  --cases test/helpers/nft-callback/gas-joint-state-cases.json \
  --require-fit --isolate-build \
  --output dist/nft-callback-gas-joint-local
```

All eight invocations passed their first bounded callback at
`callback-cost-certificate-2026-10-04/joint-state/`, with a highest observed gross wrapper-call
delta of 2,206,365 gas. Six new inputs bring the accumulated distinct-input count to 55; repeated
baselines and diagnostic traces do not add to this count. The module instruction bounds, warm query
cost formula and nested-call arithmetic are component evidence; the combined all-state bound is the
first-callback gas certificate linked above.

## Fixed provider identity

Observed at `2026-10-04T03:08:59Z`, then pinned:

- Chain: Base Sepolia, `84532`.
- Block: `47,657,524`.
- Block hash: `0x5a75e3c5fbaaa54dd1e67075af773668d43757b4e5de71f788ee69837650b872`.
- Wrapper: `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`.
- Coordinator: `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE`.
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Wrapper overhead: `13,400`; coordinator callback maximum: `2,500,000`.
- Selected consumer maximum: `2,447,746`.

The wrapper expands the consumer gas to `g + floor(g / 63) + 1 + 13,400`, which is exactly `2,500,000` at this selected maximum. The fixture rechecks both provider parameters and the pinned block hash. It temporarily advances the local block number by one to read `BLOCKHASH` of the pinned block, then restores it. Updating the fork requires reviewing both its block and hash; this dated snapshot must not be called an indefinitely current provider configuration.

## What the fixture covers

- Actual `VRFHub`, `GameHub`, modules, `SettlementRouter`, `Bank`, `LiquidityVault`, pinned liquidity tree with its documented range-query and unused-suffix patches, referral engine and USDC proxy/implementation. No mocked resolve or substituted settlement book.
- All eight modules. Maximum accepted 64-byte params: two-word modules use their real two-word encoding; one-word modules carry a nonzero 32-byte ignored tail. Both stop thresholds are nonzero, including early-stop partial refund cases.
- One request placed in `setUp`, one bounded wrapper callback in the following test transaction. This preserves clean EIP-2200 originals and avoids gas discounts from same-transaction placement or repeated snapshots. `vm.cool` additionally clears access warmth for every protocol participant and USDC's delegate implementation, as well as its proxy. No preparatory external participant read occurs in the measured test before the callback.
- Three actual `XPAwarded` entries for L0/L1/L2, with three distinct payees. Each event must belong to the expected bet and source player, and the fixture asserts exactly those three permitted payees. Fresh XP state is separate from an optional previously settled, fully matured holdback case.
- `PRIOR_NEW_SOURCE_HELD=true` is off by default and mutually exclusive with the old holdback/eligible setup. An older, eligible player A settles through the real module and callback. All payees claim their immediately accrued awards before the older holdback matures. The target player B then settles as a new, ineligible source; the fixture checks the mature L1/L2 release, fresh source/payee locks, new holdback, L0 accrued and each aggregate bucket. This constructs a coexisting state that the earlier same-player holdback option did not cover. It does not change production referral eligibility or LP rules.
- Old/late NFT counts, intact/one-unit/empty old prefix, locked or immediately eligible referral rewards, direct payout or actual USDC blacklist failure, zero player balance before payout, seed, module parameters and stop thresholds are configurable.
- The old-prefix cases use ordinary deposits and matured owner withdrawals. Old leaves are created before the bet; late leaves after it. They do not jump the tree counter or overwrite tree storage. The one-unit case withdraws `ONE - 1` of the first NFT and fully burns the other old NFTs. The empty-prefix case burns every old NFT while sufficient late capital covers the outstanding risk.
- Default player cash is transferred normally to a sink after placing the bet. A successful callback payout therefore writes its token balance from zero to nonzero. Blacklisting uses the deployed USDC blacklister only on the local fork, after a funded placement; its resulting player payable is asserted exactly.
- Every successful terminal result is compared with the actual module result computed from the same seed in `setUp`. The checks cover gross/net payout, partial refund, turnover, all three XP entries, PF/XP cost, player cash or PP, zero residual P/R/K, both custodians' cash and liabilities, and the exact tree delta. A refund terminal state cannot masquerade as a gas-successful settlement.
- On a bounded failure, the original seed must persist in `Received`, Router must remain `Held`, LP deposits/withdrawals must be fenced, and cash/tree/settlement count must remain unchanged. A high-gas diagnostic retry must settle that same result. Its gas is labeled separately: it runs after `Received`, has already-populated state and is **not a fresh callback gas measurement**.

## Concentrated amount profile

`NFT_GAS_AMOUNT_PROFILE=1` builds the amount shape behind the 2026-10-07 first-callback counterexample on the
dense tree (`NFT_GAS_TREE=4`):

- every old NFT holds 5 raw units, and the cutoff NFT is large;
- one large late NFT (`NFT_GAS_LATE_LARGE_USDC`, default 1,000,000 USDC) is the last used leaf;
- a real historical Coin profit (24.9% of the reserve) is settled through the wrapper in setup;
- the target reward and fee slots stay fresh.

`NFT_GAS_CUTOFF_RETAIN` keeps that many parts of `ONE` in the cutoff NFT, so the prefix capital can be set just
above or just below the position's maximum LP loss k. `NFT_GAS_EXPECT_PREDICATE` asserts that the read-only
threshold predicate walks all 40 levels and only then decides: `1` means it accepts the prefix, `2` means it
rejects it. With that assertion a pinned witness cannot silently stop being one. The pinned cases are
`gas-concentrated-amount-cases.json`.

The seed of the historical Coin profit is still searched in setup over 0..1023. The search is deterministic, but
the resulting seed is not yet recorded in the case file.

## Setup history callbacks

Setup settles earlier bets through the same wrapper and the same consumer gas:

- prior holdback;
- prior new-source hold;
- the whole-tree profit preparation;
- the concentrated profile's historical profit.

Each of those settlements happens on an admitted state, so a first callback that fails there is a
counterexample, not noise. Setup still runs a diagnostic retry so that the sample can be built, but it counts
every such miss in `setupCallbackFailures` and logs the count for every case. Under `NFT_GAS_REQUIRE_FIT` a
nonzero count fails the case. The converse does not hold: setup runs in the same transaction with warm slots, so
a setup success is not qualification evidence.

## Parameter combinations

The fixture rejects illegal combinations with `require`:

| Parameter | Allowed values | Must be combined with |
| --- | --- | --- |
| `NFT_GAS_GAME` | 0..7: Keno, Plinko, Baccarat, Coin, Dice, Roulette, SicBo, Slots | — |
| `NFT_GAS_VARIANT` / `NFT_GAS_SEED` | module parameter / random word seed | the game's own parameter validation |
| `NFT_GAS_ROUNDS` | 1..25, dividing `UNIT` | — |
| `NFT_GAS_STOP_GAIN` / `NFT_GAS_STOP_LOSS` | any (default: no stop) | — |
| `NFT_GAS_TREE` | 0..4; 3 and 4 are compressed structural histories | `TREE=3` requires `OLD_LEAVES=1` and `LATE_LEAVES=1`; `TREE=1` or `2` requires `LATE_LEAVES>0` (late capital must cover pending risk) |
| `NFT_GAS_OLD_LEAVES` / `NFT_GAS_LATE_LEAVES` | 1..1023 / 0..1024 | — |
| `NFT_GAS_CUTOFF` / `NFT_GAS_LAST_USED` | dense leaf ids | `TREE=4`; `FIRST_LEAF <= CUTOFF < LAST_USED < 2*FIRST_LEAF` |
| `NFT_GAS_ELIGIBLE` / `NFT_GAS_PRIOR_HOLDBACK` / `NFT_GAS_ZERO_PLAYER_BALANCE` | bool | see the next rows |
| `NFT_GAS_CALLBACK` / `NFT_GAS_BLOCK` | consumer gas (default 2,447,746) / pinned block only | changing the block also requires reviewing its hash |
| `NFT_GAS_THIN_PREFIX` | bool | `TREE=4` |
| `NFT_GAS_THIN_PREFIX_PROFIT` | bool | `THIN_PREFIX` |
| `NFT_GAS_PRIOR_NEW_SOURCE_HELD` | bool | not `PRIOR_HOLDBACK`, not `ELIGIBLE` |
| `NFT_GAS_AMOUNT_PROFILE` | 0 or 1 | 1 requires `TREE=4`, no thin prefix, no prior holdback or new-source hold, and a target game other than Coin (3) |
| `NFT_GAS_CUTOFF_RETAIN` | below `ONE` | nonzero only with `AMOUNT_PROFILE=1` |
| `NFT_GAS_EXPECT_PREDICATE` | 0, 1 or 2 | nonzero only with a nonzero `CUTOFF_RETAIN` |
| `NFT_GAS_BLACKLIST` | bool | the result must owe the player something |
| `NFT_GAS_VARIANT2` | Dice: 0 or 1 (direction) | — |

The concentrated profile clears the reward slots, so it cannot be combined with a prior holdback release or a
new-source lock. A certificate's maximizing combination that needs both cannot be instantiated as one witness
here. It has to be argued component by component, or the fixture has to be extended first.

## Certificate witness cases

`gas-certificate-witness-cases.json` pins the six worst-shape cases that the independent certificate review of
2026-10-07 built from the tree DP's maximizing cutoff pattern (loss, prefix covers k, the predicate walking all 40
levels). Its case `witness-dp-argmax-covers-loss-keno25-pp` combines that tree shape with Keno 25 rounds, fresh
L0/L1/L2 slots and a refused payment (PP), and it set the highest observed wrapper gas so far: 2,005,280. The strict
matrix runs these cases together with every other pinned case file.

## Interpretation boundaries

`wrapper callback gas` is the gross `gasleft()` delta around the wrapper call, including the harness's call overhead. It excludes VRF proof verification, coordinator fulfillment billing and transaction intrinsic gas. Gas refunds are not subtracted. A failing callback may use less than the provider maximum because EIP-150 forwarding and the two retained completion reserves prevent the inner settlement from receiving the entire outer budget. Therefore subtracting this measurement from `2,500,000` is not a reliable usable-margin calculation; the actual bounded success/failure assertion is decisive.

Local token balances are injected only for fixture funding. Maturation uses local timestamp warps; this is state construction, not evidence about real oracle latency. The fork validates neither oracle availability, proof delivery nor live billing. Sampled seeds and finite tree shapes do not exhaust the input/state space; deep historical tree observations must be bound to their source version; the current range-query patch is separately tested against the formerly failing lifecycle cases.

Observed corrections during fixture construction: an initial attempt treated `vm.rpc`'s decoded return as JSON, causing `vm.parseJsonBytes32` to fail before setup. This was a harness format error, not a provider or gas failure. The final fixture authenticates the block using `BLOCKHASH` instead. Two initial explicit `uint256` to `uint40` percent conversions were also fixed before executing the matrix. A later identity-assertion strengthening also initially caused a via-IR stack-too-deep build failure. It was fixed with a test-only external assertion boundary after the measured callback. The incomplete attempt is retained separately and did not execute callbacks. These pre-execution failures are not counted as gas observations.
