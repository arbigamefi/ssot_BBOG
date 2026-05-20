# Base Sepolia Casino Terminal Receipt Canary (2026-05-17)

Status: Passed

## Scope

This canary validates the release that adds the `GameHub.getBetTerminal(uint256)` view. The goal is to prove that the casino UI can read the final result directly from contract state after settlement, without relying on slow event-log backfill for the normal path.

## Release

- Chain: Base Sepolia (`84532`)
- Release block: `41615646`
- Release digest: `0xb0cdf93f442228151a6ffa2dcab1b65d3854678b39ab4c5eedc5c892c5000311`
- GameHub: `0xcBa18427b101D86A6A24BD5059f7FbdC50c1c20A`
- Casino Bank: `0x552063BA55ac0A4AEf3fb764957912056FB3A7f0`
- Asset: Base Sepolia USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## Funding

The new casino bank started with `totalAssets() = 0`, so the first canary place attempt correctly reverted with `SolvencyViolation()`. The deployer then seeded the bank with `1_000_000` USDC units (`1 USDC`) before rerunning the canary.

- USDC approve tx: `0x9d4dcbf6f38cb9b4036c21b3c320326c2a5620985ffc395b001194b89bdc0bc9`
- Bank deposit tx: `0x108db9739d93b281dad0648109c9f3453853c2738fec1909a3086bec983fc808`
- Bank `totalAssets()` after deposit: `1000000`

## Place

Command:

```bash
BROADCAST=1 CANARY_STAKE=10000 CANARY_BET_COUNT=1 CANARY_DICE_CAP=50 \
  ENV_FILE=.env.v13-sports.local make gamehub-canary-v13
```

Result:

- Position ID: `1`
- Request ID: `41323913453368454353426738143923465899887087765654106388141218798545956009096`
- Initial `betState`: `2` (`PendingVRF`)
- USDC approve tx: `0x9a0e66e9c17c4a346601845559a6659e2ad887cd9ccff2150d47e750c849242d`
- `placeBet` tx: `0x4ce5d937f823a9cb765e5bde6606fe8b39ce646e17623a5500bd417b37a9eb5b`

## VRF

The request fulfilled successfully:

- `betState`: `3` (`RandomReady`)
- `positionState`: `1` (`Held`)
- `vrfRequestActive`: `false`

## Finalize

Command:

```bash
BROADCAST=1 CANARY_MODE=finalize CANARY_POSITION_ID=1 \
  ENV_FILE=.env.v13-sports.local make gamehub-canary-v13
```

Result:

- Finalize tx: `0x8d45ebd49713ed08bfdf8b9661607a7cc0863f0eb37bd10718038837aaf2c06d`
- `resolvedAt`: `1779000330`
- Final `betState`: `4` (`Settled`)
- Final `positionState`: `2` (`Settled`)
- Bank `totalReserved()`: `0`
- Bank `totalAssets()`: `1009800`

## Terminal Receipt Readback

Direct contract read:

```bash
cast call --rpc-url "$RPC_URL" "$GAMEHUB" \
  'getBetTerminal(uint256)((uint8,uint256,uint256,uint256,uint256,uint256))' 1
```

Readback:

```text
(4, 0, 0, 0, 200, 0)
```

Interpretation:

- `state = 4` (`Settled`)
- `payoutGross = 0`
- `payoutNet = 0`
- `feeOnPayout = 0`
- `protocolFeeAccrual = 200`
- `refundAmount = 0`

This is the expected terminal receipt for a losing `0.01 USDC` Dice canary with a `200` unit protocol fee accrual.

## Verification Commands

Passed after the release sync:

```bash
pnpm -C frontend check:release
pnpm -C frontend typecheck
pnpm -C frontend test
pnpm -C frontend/apps/web build
forge build
```

