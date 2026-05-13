# Base Sepolia v1.3 Sports Rehearsal - 2026-05-13

## Status

Base Sepolia v1.3 Casino+Sports deployment rehearsal completed successfully.

This is a public testnet deployment only. It is not a mainnet launch approval and does not prove
funded bankroll operations, real provider data quality, user-facing signer integration, canary ticket
execution, or jurisdiction controls.

## Inputs

- Source commit: `8498182ad`
- Network: Base Sepolia
- Chain ID: `84532`
- GOV/deployer: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- VRF wrapper: `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`
- Asset: Base Sepolia USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Asset decimals: `6`
- Pools:
  - pool `1`: Casino, independent Bank
  - pool `2`: Sports, independent Bank
- Sports reporter threshold: `1`
- Bootstrap testnet roles:
  - odds signer: GOV
  - result reporter: GOV
  - result challenger: GOV
  - result arbitrator: GOV

## Deployment

- Deployment block: `41444125`
- Transaction count: `40`
- Release digest: `0x057acee982c07471c6dd0fb441f14bbe10b4674d200539ceba8ef021194bbb44`
- Release signer: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`

Key addresses:

- `adapter`: `0x1d324A8dD2DB78907EA815A46737aca32E9ff6d7`
- `vrfHub`: `0x5db5F917185B66698d85C935003B6357F59dEa35`
- `poolRegistry`: `0x0808A8862C7F3e55d4f009f4912F367012cfB4fE`
- `settlementRouter`: `0x5F0930f2c0B0c20a009d0A0c2E4452b07506cE17`
- `refRegistry`: `0xF5A4EA665AEf217790d2C63e41E2b541a1806dA8`
- `refEngine`: `0xB72FE105061C714577c211cA5064203Aecf56d0f`
- `gameHub`: `0xEB387Ab52bA3E242f76EDe5c747F8210c9dB31Aa`
- `sportsRiskEngine`: `0xbD066fe5E72bE2A230f2Add60A2Dd7935A680ffD`
- `sportsHub`: `0x5f8D28d8D27376fa223Fe425048680fDE78bD275`
- Casino pool Bank: `0xa383E1C133021c1948a644a758B3E7D5F971262E`
- Sports pool Bank: `0x360270Aa8E8fdD044Af72E5CF48c2CB11093a0C6`

Explorer verification:

- `adapter`: https://sepolia.basescan.org/address/0x1d324a8dd2db78907ea815a46737aca32e9ff6d7
- `vrfHub`: https://sepolia.basescan.org/address/0x5db5f917185b66698d85c935003b6357f59dea35
- `poolRegistry`: https://sepolia.basescan.org/address/0x0808a8862c7f3e55d4f009f4912f367012cfb4fe
- `settlementRouter`: https://sepolia.basescan.org/address/0x5f0930f2c0b0c20a009d0a0c2e4452b07506ce17
- `refRegistry`: https://sepolia.basescan.org/address/0xf5a4ea665aef217790d2c63e41e2b541a1806da8
- `refEngine`: https://sepolia.basescan.org/address/0xb72fe105061c714577c211ca5064203aecf56d0f
- `gameHub`: https://sepolia.basescan.org/address/0xeb387ab52ba3e242f76ede5c747f8210c9db31aa
- `sportsRiskEngine`: https://sepolia.basescan.org/address/0xbd066fe5e72be2a230f2add60a2dd7935a680ffd
- `sportsHub`: https://sepolia.basescan.org/address/0x5f8d28d8d27376fa223fe425048680fde78bd275
- Casino pool Bank: https://sepolia.basescan.org/address/0xa383e1c133021c1948a644a758b3e7d5f971262e
- Sports pool Bank: https://sepolia.basescan.org/address/0x360270aa8e8fdd044af72e5cf48c2cb11093a0c6
- Dice module: https://sepolia.basescan.org/address/0x2b09d94a88bb41f28bf85a1347156880422bf3aa
- CoinToss module: https://sepolia.basescan.org/address/0xfe76e4728d7749c42337118734f1da2db7a4f425
- Roulette module: https://sepolia.basescan.org/address/0xddd377b53d06c7fcec7cfc53c30145ef48148b4a
- Keno module: https://sepolia.basescan.org/address/0xbe030518bffebecb6700c3cbb66bb0cfcaea3705

## Commands

```bash
ENV_FILE=.env.v13-sports.local make sports-testnet-preflight-v13
forge script script/DeployV13.s.sol:DeployV13 --rpc-url "$RPC_URL" --broadcast -vvv
SNAPSHOT_PATH=deployments/latest-v13.json make release-v13
STRICT=1 make release-check-v13
bash deployments/verify-latest-v13.sh
```

## Post-Deploy Checks

The following checks passed against Base Sepolia:

- key deployed addresses all have bytecode;
- `PoolRegistry.poolCount() == 2`;
- `PoolRegistry.domainFor(1) == Casino`;
- `PoolRegistry.domainFor(2) == Sports`;
- `GameHub` is allowed for pool `1` and not pool `2`;
- `SportsHub` is allowed for pool `2` and not pool `1`;
- both Banks point to `SettlementRouter`;
- `SportsHub.riskEngine()` points to `SportsRiskEngine`;
- `SportsRiskEngine.hasPoolLimits(2) == true`;
- GOV is allowlisted as the testnet odds signer and result reporter;
- strict v1.3 release check passed for chain `84532`, block `41444125`;
- all deployment contracts and modules passed Basescan source verification.

## Funding Preflight

As of the first post-verification funding preflight:

- GOV USDC balance: `3.066502 USDC`
- Casino Bank USDC assets: `0`
- Sports Bank USDC assets: `0`
- GOV allowance to Casino Bank: `0`
- GOV allowance to Sports Bank: `0`

Recommended first canary funding is `1 USDC` into each Bank, leaving about `1.066502 USDC` for
small ticket placement tests.

Funding transactions:

- Casino Bank approve: `0x981d82047baddf5486e7af7fc5a648ad6b9be5eb36537ebec0aab98a1807c5d8`
- Casino Bank deposit: `0xa44af58d9ea388bb94410c73bbfba4e2b7e0fa7a997866c1cfa1880beda3ed83`
- Sports Bank approve: `0xde41c78dd22977d77f0cd75da2d8d03b83f6d66e417ff847f036c3677f41552c`
- Sports Bank deposit: `0xc788260527ff96cd3efe63f607336ada6806deffb60f51e7eb5ac9add5754f9f`

Post-funding state:

- GOV USDC balance: `1.066502 USDC`
- Casino Bank USDC assets: `1 USDC`
- Sports Bank USDC assets: `1 USDC`
- GOV Casino LP balance: `1`
- GOV Sports LP balance: `1`
- GOV allowance to both Banks: `0`

## Remaining Phase 1 Work

Canary helper:

```bash
# simulation only
ENV_FILE=.env.v13-sports.local make sports-canary-v13

# broadcast the place-ticket canary
BROADCAST=1 ENV_FILE=.env.v13-sports.local make sports-canary-v13

# simulation only: direct void + batch debt-out
CANARY_MODE=void-batch ENV_FILE=.env make sports-canary-v13

# broadcast direct void + batch debt-out
BROADCAST=1 CANARY_MODE=void-batch ENV_FILE=.env make sports-canary-v13
```

The default canary creates a short-lived Sports market, opens it, approves `0.1 USDC` to the Sports
Bank, and places one winning-outcome ticket at `1.5x` fixed odds. The current simulation passed with
an estimated `1,512,954` gas and estimated `0.000016642494 ETH` cost.

Canary place-ticket broadcast:

- Market ID: `1`
- Ticket ID: `1`
- Event ID: `1778659542`
- Outcome ID: `1`
- Stake: `0.1 USDC`
- Expected payout/reserved: `0.15 USDC`
- Odds snapshot hash: `0x2bbda2caaf956de269dc3fb4bb9c3a09419310851c5780f79dd0a416b2690502`
- Create market tx: `0xfc0ae0c2e5f2cc95d2fdd7a9e649cefe5e28d09f721f0ba6749bad9fe48ad9f5`
- Open market tx: `0x6bc2c4b5a75edd1830b069d700800a0957a9b7e5a7839e79274ca02e0bb9b9b6`
- Approve stake tx: `0x20bc8bdf6288b55edefbe21bf7604b3656d76429b9c86404e46054d8aaa980c1`
- Place ticket tx: `0xfd282385be6323b530d0ade16cc4787ee8a8ac5046d983dc6d79b8deff2b6b26`
- Post-place state:
  - `SportsHub.nextMarketId() == 2`
  - `SportsHub.nextTicketId() == 2`
  - market state: `Open`
  - ticket state: `Held`
  - Sports market/event/pool-event reserved: `0.15 USDC`
  - Sports Bank assets: `1.1 USDC`
  - Sports Bank reserved: `0.15 USDC`

Canary result/finality/settlement broadcast:

- Lock market tx: `0x95e60677c51b31842dc3bc10d60afebcef1e53c55b58e70770382c896238167d`
- Propose result tx: `0x8d514db4b07812bde98fabd8bb3ac109f02b670f10aeee93362663e88b71b110`
- Finalize result tx: `0xa849eb2d86f760f17dc4c4b9fecbf71545db039539174b5dbc8d5d86331e3691`
- Settle ticket tx: `0x54f71582949664fd3cc14969347c4817d472451e16bc7ad3e4101b575d0a5aa4`
- Result source hash: `0xe8f744c255d9d398f2423370fbd8e899bb6ef08f6abdd751755071af4db26e8b`
- Evidence hash: `0xccdb0caf20f1a2185d42040a6f6ab658571f490f55f2ec9985fe1a8ab4020230`
- Observed at: `1778660008`
- Proposed at: `1778660016`
- Finalized after: `1778660616`
- Post-settlement state:
  - market state: `Resolved`
  - ticket state: `Settled`
  - router position state: `Settled`
  - Sports market/event/pool-event reserved: `0`
  - Sports Bank reserved: `0`
  - Sports Bank assets: `0.95 USDC`

Direct void + batch debt-out broadcast:

- Block: `41447214`
- Market ID: `2`
- Event ID: `1778662632`
- Ticket IDs:
  - refunded through `refundTickets`: `2`, `4`
  - voided through `voidTickets`: `3`, `5`
- Stake per ticket: `0.1 USDC`
- Total stake routed in: `0.4 USDC`
- Expected total reserved while held: `0.6 USDC`
- Direct void reason hash: `0x4dba5c6e334b0c2a7d22a8d9ab4907ce4cad27d9b1c6145f05a1a4db2cec802d`
- Create market tx: `0xac1043d4d81f9f69010f2a25fcaf1da730ffb35aa17e4b8a3ee36dcc4d863e0a`
- Open market tx: `0xb7be981d2e37045f52e2dbff899c4624e8fd62a67a3af4a040d1c139de50cc84`
- Approve batch stake tx: `0x897089975dbdb15682262112b1560b906e87ef617c574d1afdc31b6d29283d7e`
- Place ticket txs:
  - `0x780229643fc0e84b84fe66de8c480a90561efd102066ef070a8e663561b9ad1c`
  - `0x24e8ced903ca909719ded9fd8aef47e1182607377fad8b836deb9c2f1961ddf7`
  - `0xbc5909d9936c1eade85e230fc6b4a0530745e0facadc9c0d542a327d3c048482`
  - `0xf9f6f2a480e8049c5921bf38dbeec829cf5fb88f8efe3a206d6232c54b9bd956`
- Direct void tx: `0x12ff1ac16293e686966d90b2918da2c8be337374ec6b25b01eca643aa2575bc8`
- Batch refund tx: `0xe588c6b09f29677b8c32e65f25a7d318dd5b2d327fe85110cb11e0be37464bc9`
- Batch void tx: `0xba00e4d8056c3eb7e3fbbb9ff51520ae49aeb4a32d184a83e52ba8baae0f81a1`
- Post-debt-out state:
  - market state: `Voided`
  - ticket `2` / `4` state: `Refunded`
  - ticket `3` / `5` state: `Voided`
  - router positions `2` / `3` / `4` / `5` state: `Refunded`
  - Sports market/event/pool-event reserved: `0`
  - Sports Bank reserved: `0`
  - Sports Bank assets: `0.95 USDC`

- Rehearse result challenge playbook on this deployment.
- Replace single-operator GOV bootstrap roles with dedicated testnet signer/reporter keys before any
  public canary.
