# Base Sepolia v1.3 GameHub Canary

Date: 2026-05-14

## Scope

This rehearsal adds the missing Casino/GameHub validation path for the final v1.3 Base Sepolia deployment.

Snapshot: `deployments/latest-v13.json`

- Chain ID: `84532`
- GameHub: `0x99c8c8B55803A566561b58188027fb9E46ACa215`
- Casino Bank: `0x3aADa481F979E5DFabd2Cd252A76feA2aD05e346`
- Casino pool id: `1`
- VRFHub: `0x70F4b14e0Aba0034685c0C269445C6D4c6AeB314`
- Adapter: `0x7648feE565DC42dfdB843e5166518060048E8d73`
- Chainlink wrapper: `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`

## Local validation

Focused local tests passed:

- `forge test --match-path 'test/unit/GameHub*.t.sol' -vv`: 14 passed
- `forge test --match-path 'test/unit/ChainlinkAdapter.t.sol' -vv`: 2 passed
- `forge test --match-path 'test/unit/VRFFee*.t.sol' -vv`: 4 passed
- `forge build`: passed

## Testnet canary finding

`ENV_FILE=.env make gamehub-canary-v13` was run in simulation mode. The first run reached `GameHub.placeBet` and reverted inside the Chainlink wrapper with `fee too low`.

Readback:

- `adapter.requestGasPriceWei()`: `0`
- `GameHub.quoteVRFFee(1)`: `2848 wei`
- `wrapper.estimateRequestPriceNative(320000, 1, 6000000)`: `4390176002798 wei`
- `wrapper.estimateRequestPriceNative(320000, 1, 100000000)`: `73169600002798 wei`
- Current deployer/governance address: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`

Conclusion: GameHub is correctly wired far enough to reach the VRF provider request path, but the final deployment is not yet GameHub-canary-ready because the adapter fee estimator gas price is unset. This is a configuration gap, not a GameHub settlement-code failure.

## Guardrails added

- `script/ops/GameHubCanaryV13.s.sol` now fails before risk-in if the adapter gas price is unset.
- `script/ci/v13_gamehub_canary.sh` and `make gamehub-canary-v13` provide the GameHub canary entrypoint.
- `script/DeployV13.s.sol` rejects `REQUEST_GAS_PRICE_WEI=0` outside local chain deployments.
- `script/ci/v13_sports_testnet_preflight.sh` requires a positive `REQUEST_GAS_PRICE_WEI`.
- v1.3 public-testnet env examples now document a non-zero conservative estimator value.

## Required next action

Before broadcasting a GameHub canary, governance must configure the adapter estimator gas price. Suggested Base Sepolia test value:

```bash
cast send $ADAPTER "setRequestGasPriceWei(uint256)" 100000000 --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

Then run:

```bash
ENV_FILE=.env BROADCAST=1 make gamehub-canary-v13
CANARY_MODE=status CANARY_POSITION_ID=<positionId> ENV_FILE=.env make gamehub-canary-v13
```

If Chainlink fulfills the request, close with:

```bash
CANARY_MODE=finalize CANARY_POSITION_ID=<positionId> ENV_FILE=.env BROADCAST=1 make gamehub-canary-v13
```

If the request remains pending past `refundTimeoutSeconds`, close with:

```bash
CANARY_MODE=refund CANARY_POSITION_ID=<positionId> ENV_FILE=.env BROADCAST=1 make gamehub-canary-v13
```
