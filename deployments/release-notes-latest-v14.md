# base-sepolia-v14-2026-06-06

**Architecture**: `v1.4-bank-observability`

**Chain**: 84532

**Deployed at block**: 42478832

**Timestamp**: 1780725952

## Release lock (v1.4 params digest)

- **Digest**: `0x2a6144a4e77387a122f699daaf4ff2bdc020b466e005d0168fd69a89eaa31a1b`
- **Signer**: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- **Signature**: v=28, r=`0x880ee01bddece24411f039dd7afae66610c592c1f9f067a210f3f11bb1765946`, s=`0x050eec139244c2a78d151ccccbd8852cedddb8fcc80080262c01bb762ba51d8a`

Artifacts:
- Snapshot: `deployments/latest-v14.json`
- Release lock: `deployments/release-latest-v14.json`

## Core contracts

- GOV: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- Treasury: `0x0000000000000000000000000000000000000000`
- VRF Wrapper: `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`
- Adapter: `0x5e9b53C3BC2fEe7088308E06d24092C4B40E05d0`
- VRFHub: `0xc904f2B6ae561FB454A8743cF3AbEA550E0E65EF`
- PoolRegistry: `0x33FC265754b5eAcc1e1dE84C28A3046A0f8a43f0`
- SettlementRouter: `0x3AcA2c08F92c744e486b82E1C942A84dF4fCF965`
- GameHub: `0xbBEAb865DBc467AD46f92Cfec642d0Ba92c0e96D`
- SportsRiskEngine: `0x0000000000000000000000000000000000000000`
- SportsHub: `0x0000000000000000000000000000000000000000`
- ReferralRegistry: `0x5bEEB8893Cfbe42D8D719173a094b55fC9FB8b05`
- ReferralEngine: `0x5c1290a823cB166295F019619596cf8e0F48D213`

## Game modules

- Dice: `0x1afF50cECFE4B0c4A1DE7Db961031fc8b57217e1`
- CoinToss: `0x53e915F73b0a7BEA2C453538E272a2f16Dbf0D71`
- Roulette: `0x06b4b2cE86D7e3B20382Bbc7a35ccaEa3952ffCF`
- Keno: `0xE93D7694890c889443F6770AC9faF092a24A5A3e`
- Plinko: `0x7E085535861f18eAc18519aF8Ae171Db81Dbb786`
- SicBo: `0xf575Baf851c53803d1b6DC3fFbf668507C4c4769`
- Slots: `0xC2Fedd2FF14495fACF5c810352Fb237F43AE47A5`
- Baccarat: `0xad377784ee5CF6474F9f3479793c7D5b040F2003`

## Key parameters

- refundTimeoutSeconds: 3600
- defaultHouseEdgeBps: 200
- maxAffiliateDeltaBps: 0
- sportsEnabled: false
- defaultSportsRiskCaps(raw asset units): maxStake=0, maxPayout=0, maxMarketReserved=0, maxOutcomeReserved=0, maxEventReserved=0
- sportsOddsSignerSetHash: `0x0000000000000000000000000000000000000000000000000000000000000000`
- sportsResultReporterSetHash: `0x0000000000000000000000000000000000000000000000000000000000000000`
- sportsResultReporterThreshold: `0`
- sportsResultChallengeTimeoutSeconds: `0`
- sportsResultChallenger: `0x0000000000000000000000000000000000000000`
- sportsResultArbitrator: `0x0000000000000000000000000000000000000000`

## Pools

- pool_0: id=1, domain=Casino, asset=`0x036CbD53842c5426634e7929541eC2318f3dCF7e`, bank=`0x16f5BBc7d62Aa8d1828b807F57d3796712C7E3e9`, active=true
- pool_1: id=3, domain=Casino, asset=`0x4200000000000000000000000000000000000006`, bank=`0x71D9E131D5F92c3c18a44fAE058ED789085DD095`, active=true

## Verification

- Verify release lock locally (offline): `make release-verify-v14`
- Generate v1.4 frontend manifest: `make release-frontend-manifest-v14`
- Generate v1.4 golden vectors: `make release-golden-vectors-v14`
- Package artifacts: `make release-package-v14`
