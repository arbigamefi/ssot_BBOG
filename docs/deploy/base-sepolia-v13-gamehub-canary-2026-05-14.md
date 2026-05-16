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

## Post-canary cleanup finding - 2026-05-16

Follow-up user testing of position `14` on the same Base Sepolia deployment showed that the
`finalize(14)` transaction completed successfully but Basescan rendered an internal revert warning:

- Finalize tx: `0x76426348a60c99e96fc310753321bc27276c8d59e6b317d43a2f8bcc36f2413f`
- Receipt status: `1` / success
- Successful settlement effects: `BetFinalized`, `Bank.BetSettled`, and USDC payout transfer
- Internal reverted call: `GameHub.finalize -> VRFHub.detach(requestId)`
- Revert selector: `0x25ef7ff6` = `NotOwningHub()`

Root cause: the Chainlink fulfill path had already called `GameHub.onRandomWords`, which cleared
`GameHub.requestToBetId[requestId]` and detached the VRFHub request. Later, `finalize()` called the
same best-effort cleanup again via `_clearRequest`, so `VRFHub.detach` reverted because the request
storage no longer belonged to the GameHub. The revert was caught and did not block settlement, but
it polluted explorer traces and is not acceptable for production UX.

Fix: `GameHub` now uses `_detachRequestIfOwned(requestId)`, which first reads `VRFHub.getRequest`
and calls `detach` only when the request still belongs to the current GameHub. The regression test
`GameHubE2E.test_finalizeSkipsVrfDetachWhenRequestAlreadyClearedByFulfill` asserts that a fulfilled
and already-cleared request does not trigger a second detach call during finalization.

Validation:

- `forge test --match-path test/unit/GameHubE2E.t.sol -vv`: 11 passed
- `forge test --match-path test/unit/SecurityFixes.t.sol -vv`: 9 passed
- `forge test --match-path test/unit/ChainlinkAdapter.t.sol -vv`: 2 passed
- `forge test --match-path 'test/unit/VRFFee*.t.sol' -vv`: 4 passed
- `forge build`: passed
- `forge test`: 120 passed, 0 failed, 1 skipped

This fix changes `GameHub` bytecode. The existing Base Sepolia tx remains historical evidence of the
old cleanup behavior; the next Base Sepolia canary must use a fresh v1.3 release/deployment before
validating that explorer traces no longer include the internal `detach` revert.

## Redeploy validation - 2026-05-16

A fresh Base Sepolia v1.3 deployment was broadcast after the `GameHub` cleanup fix.

- Deployment snapshot block: `41562978`
- Release digest: `0x97025bf84b1e73ceb683366d38ff8647763e0baa71d9216605d3ed030cc2216a`
- Release bundle: `dist/ssot-release-chain-84532-41562978-0x97025bf8.tar.gz`
- GameHub: `0x1FC18758b64205313F920cfc7fFc7dC343a892E6`
- SettlementRouter: `0x99b0Ad5E43813760142F9821B1e5C4eBa942F4Ec`
- VRFHub: `0xb982366D72ceEd8603DF1ba6932C1d532D316a86`
- Adapter: `0x66311DF287b058140F05d9AD9270870f5a89c494`
- Casino Bank: `0xbc9A8f34A416B6Da463c634D63996C362e2C5f0A`
- Sports Bank: `0x732d8fdCe925f73d0b8573A8E8638a748069E661`

Funding transactions:

- Casino Bank approve: `0x9bfbf4a21db9a117bba5011e7b14c3df5a37952fcb7ff4f38f10094bff6acda8`
- Casino Bank deposit: `0xa935948be7a14ca04d3d493fd7acb9985bf752f52940c750f8897af9085aad47`
- Sports Bank approve: `0x167e5cc3a411097be22f85de7fd8c9d27557a475f01766c1c46e987aabcc1250`
- Sports Bank deposit: `0x1970126c9ef08d1e736566bdd0fce3550699a945ef60f8273a5501b42e94beda`

`BROADCAST=1 ENV_FILE=.env make gamehub-canary-v13` succeeded:

- Place tx: `0x98ff3ef3c5b3626b75f0e88c0ad8088f69b25949e633d56fc868190b3eb1d1c1`
- Position id: `1`
- Request id: `88900432683796515367687110441888685110385694721876547794792857014691553370968`
- Initial state: `betState=PendingVRF`, `positionState=Held`, `bankReserved=20000`

Chainlink callback arrived and moved the position to `RandomReady`:

- Random hash: `0xc1dd6522ffc33603f07c9f43cc35e6ad9f0fd8228b7715f072787026f04f5894`
- VRFHub request readback after callback: detached / inactive

`BROADCAST=1 CANARY_MODE=finalize CANARY_POSITION_ID=1 ENV_FILE=.env make gamehub-canary-v13`
succeeded:

- Finalize tx: `0x467731ba1354ff1b1ae8036c3822ab18ca56e95814550fa48fab973ba4bc16fa`
- Finalize block: `41563334`
- Final state: `betState=Settled`, `positionState=Settled`
- `resolvedAt`: `1778894956`
- Payout gross/net: `20000` / `19600`
- Protocol fee accrual: `200`
- Final Casino Bank assets: `990200`
- Final Casino Bank reserved: `0`

Trace validation:

- `cast receipt <finalize tx>` returned `status=1`.
- `cast run <finalize tx>` showed `GameHub.finalize -> VRFHub.getRequest(requestId)` returning an
  empty request, followed by `SettlementRouter.settlePosition -> Bank.settleBet -> USDC.transfer`.
- The trace did not call `VRFHub.detach(requestId)` during `finalize`, and no internal revert was
  present.

Conclusion: the fresh Base Sepolia v1.3 deployment validates the cleanup fix. Once Chainlink has
already fulfilled and detached a request, `finalize()` no longer emits a best-effort duplicate
`detach` call that causes explorer-level internal revert warnings.
