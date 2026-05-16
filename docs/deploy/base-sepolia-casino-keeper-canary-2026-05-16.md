# Base Sepolia Casino Keeper Canary

Date: 2026-05-16

## Scope

This rehearsal validates the production casino UX target:

- player broadcasts `GameHub.placeBet`;
- Chainlink VRF fulfills the request and moves the bet to `RandomReady`;
- a protocol keeper observes `BetRandomReady` and calls permissionless `GameHub.finalize`;
- the player does not need to sign a settlement transaction.

Snapshot:

- Chain ID: `84532`
- GameHub: `0x1FC18758b64205313F920cfc7fFc7dC343a892E6`
- SettlementRouter: `0x99b0Ad5E43813760142F9821B1e5C4eBa942F4Ec`
- VRFHub: `0xb982366D72ceEd8603DF1ba6932C1d532D316a86`
- Adapter: `0x66311DF287b058140F05d9AD9270870f5a89c494`
- Casino Bank: `0xbc9A8f34A416B6Da463c634D63996C362e2C5f0A`
- Casino asset: `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (`USDC`, 6 decimals)
- Keeper/player address: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`

## Preflight

Simulation passed with a conservative VRF overpayment buffer:

```bash
CANARY_STAKE=10000 CANARY_BET_COUNT=1 CANARY_DICE_CAP=50 \
  bash script/ci/v13_gamehub_canary.sh .env
```

Readback:

- Position id: `4`
- Request id: `5297287298375542265249269726720564570533397788527180476061930583331516663802`
- Initial state: `PendingVRF`
- Quoted VRF fee: `73169614931635 wei`
- Paid VRF fee with buffer: `109754422397452 wei`

## Canary Finding

The first broadcast used the exact quoted VRF fee and failed:

- Failed tx: `0x5cebc2af14ac13f09e7e30af70390631cceeeab74da07bdb89df4c6304b2bf30`
- Receipt status: `0`
- Revert: `InsufficientVRFFee(paid, required)`
- Paid: `73169612885550 wei`
- Required at execution: `73169613788620 wei`

Root cause: the Chainlink wrapper quote can move between simulation, signing, and execution because
the Base L1 fee component changes. Paying the exact quote is unsafe. The protocol supports
overpayment and best-effort refund/credit, so callers should pay a bounded buffer above the latest
quote.

Fix applied:

- `script/ops/GameHubCanaryV13.s.sol` now defaults `CANARY_VRF_FEE_BUFFER_BPS=5000`.
- The canary validates native balance against the buffered fee.
- The keeper fallback scan now chunks `eth_getLogs` ranges with `KEEPER_SCAN_CHUNK_BLOCKS=10`, which
  is compatible with Base Sepolia free RPC limits.

Frontend note: the SDK planning path already pays a 50% VRF fee buffer and relies on VRFHub refund
semantics for any overpayment.

## Successful Keeper Canary

Keeper command shape:

```bash
KEEPER_CHAIN_ID=84532 \
KEEPER_RPC_HTTP=$RPC_URL \
KEEPER_RELEASE_PATH=/Users/kevin/arbigamefi_ssot_project_all/frontend/packages/ssot/src/release/embedded/chain-84532.json \
KEEPER_START_BLOCK=41589704 \
KEEPER_POLL_INTERVAL_SECONDS=5 \
KEEPER_SCAN_CHUNK_BLOCKS=10 \
pnpm -C frontend keeper:start
```

Place canary:

```bash
BROADCAST=1 CANARY_STAKE=10000 CANARY_BET_COUNT=1 CANARY_DICE_CAP=50 \
  bash script/ci/v13_gamehub_canary.sh .env
```

Place result:

- Place tx: `0x50f4186279026e61f886dc282648603ca0376cf7f657ff1def70d2431cbf526e`
- Place block: `41589763`
- Position id: `4`
- Request id: `5297287298375542265249269726720564570533397788527180476061930583331516663802`
- Stake: `10000`
- Reserved: `20000`
- Quoted VRF fee: `73169621900952 wei`
- Paid VRF fee with buffer: `109754432851428 wei`
- Charged VRF fee: `73169628939640 wei`
- Initial state: `PendingVRF`

Chainlink fulfillment:

- Fulfill tx: `0xa72a1ea1529fc669c9b9d7bf1ec3d21dee5e99b902681403ece796050012d455`
- Fulfill block: `41589768`
- `BetRandomReady` emitted by GameHub
- Random hash: `0xca527154ac54bebece008966f2800205a27c1a6c78a897bcf8f76adcef83e7c2`

Keeper settlement:

- Finalize tx: `0x8ce583da0ff6a197a7d6fd495fa98dce86e3bb5fa775e95ecbbb649f2bec3412`
- Finalize block: `41589775`
- Final bet state: `Settled`
- `resolvedAt`: `1778947838`
- Payout gross/net: `0` / `0`
- Refund amount: `0`
- Protocol fee accrual: `200`

Keeper logs:

```text
casino.keeper.enqueued betId=4 source=scan
casino.keeper.retry_scheduled betId=4 attempts=1 reason="finalize mined but bet remained randomReady"
casino.finalize.raced betId=4 state=settled
```

Interpretation: the keeper broadcast settlement successfully. The immediate post-receipt state read
was stale on the RPC and scheduled one retry; the retry observed the already-settled state and exited
without a duplicate finalize.

Follow-up fix: the keeper now performs a short post-receipt terminal-state polling window before
declaring a mined finalize inconclusive. This avoids misleading retry logs when the transaction
receipt is visible before the RPC read path reflects the final bet state.

## Validation

- `pnpm -C frontend keeper:test`: 12 passed
- `pnpm -C frontend keeper:build`: passed
- `CANARY_STAKE=10000 CANARY_BET_COUNT=1 CANARY_DICE_CAP=50 bash script/ci/v13_gamehub_canary.sh .env`: passed
- `BROADCAST=1 CANARY_STAKE=10000 CANARY_BET_COUNT=1 CANARY_DICE_CAP=50 bash script/ci/v13_gamehub_canary.sh .env`: passed after VRF buffer fix
- Receipts for place, fulfill, and finalize all returned `status=1`

## Conclusion

The fresh Base Sepolia deployment now validates the intended casino production path: the player only
needs to place the bet, Chainlink fulfills randomness, and the keeper settles the result without a
player settlement signature. The canary also found and fixed the exact-quote VRF underpayment hazard
in operations scripts.
