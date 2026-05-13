# Base Sepolia v1.3 Sports Rehearsal - 2026-05-13

## Status

Base Sepolia v1.3 Casino+Sports deployment rehearsal completed successfully.

This is a public testnet deployment only. It is not a mainnet launch approval and does not prove
funded bankroll operations, real provider data quality, explorer verification, user-facing signer
integration, canary ticket execution, or jurisdiction controls.

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

## Commands

```bash
ENV_FILE=.env.v13-sports.local make sports-testnet-preflight-v13
forge script script/DeployV13.s.sol:DeployV13 --rpc-url "$RPC_URL" --broadcast -vvv
SNAPSHOT_PATH=deployments/latest-v13.json make release-v13
STRICT=1 make release-check-v13
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
- strict v1.3 release check passed for chain `84532`, block `41444125`.

## Remaining Phase 1 Work

- Run explorer verification for deployed contracts.
- Fund the two Banks with controlled testnet liquidity.
- Execute canary Sports tickets with realistic odds snapshots and result quorum flow.
- Rehearse result challenge, direct void, and batch debt-out playbooks on this deployment.
- Replace single-operator GOV bootstrap roles with dedicated testnet signer/reporter keys before any
  public canary.
