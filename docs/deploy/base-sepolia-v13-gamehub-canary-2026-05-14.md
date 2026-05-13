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

## Completed follow-up

Governance configured the adapter estimator gas price:

- Value: `100000000`
- Tx: `0xc13133d499b573d3d76b4a0763fa38eb3f2284fd431e993c0d98c3bfe6b88391`
- Block: `41464040`
- Readback: `adapter.requestGasPriceWei() == 100000000`
- `GameHub.quoteVRFFee(1)`: `73169600000918 wei`, callback gas `320000`

## Successful GameHub canary

`ENV_FILE=.env BROADCAST=1 make gamehub-canary-v13` succeeded after the adapter update.

- Approve tx: `0xa257055cb13715cff0b750bc4cf2528aa4669db4d1baaa46d24ffa21dbc3a65e`
- Place tx: `0x748392fbfbba516792927536b5caa2db53cc2fb5572ff591b2db4f652aed23ab`
- Place block: `41464089`
- Position id: `10`
- Request id: `27132349123599711136123585542011620120088044542647541467732412976108291299276`
- Game: `DICE`
- Stake: `10000`
- Reserved: `20000`
- VRF fee paid/charged: `73169600000902 wei`
- Initial post-place state: `betState=PendingVRF`, `positionState=Held`, `bankReserved=20000`

Chainlink callback arrived during the rehearsal:

- Intermediate status: `betState=RandomReady`
- Random hash: `0x0b3f5451905f1963fd0f93fc143046bbd10ad9e7e290d18ab5d5d235911e4d77`
- VRFHub request readback after callback: detached / inactive

`CANARY_MODE=finalize CANARY_POSITION_ID=10 ENV_FILE=.env BROADCAST=1 make gamehub-canary-v13` succeeded:

- Finalize tx: `0x97c005c0a863dc5b649fbc6e17e969930c7c784421c18170769f253a3898595b`
- Finalize block: `41464145`
- Final state: `betState=Settled`, `positionState=Settled`
- `resolvedAt`: `1778696578`
- Final Casino Bank assets: `1009800`
- Final Casino Bank reserved: `0`

Conclusion: the Base Sepolia v1.3 deployment now has a complete Casino/GameHub chain canary covering adapter fee configuration, ERC20 approval, `GameHub.placeBet`, `VRFHub` request creation, Chainlink callback into `RandomReady`, permissionless `finalize`, and reserve release through `SettlementRouter`/`Bank`.
