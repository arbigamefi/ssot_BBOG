# chain-84532-42323839-v13

**Architecture**: `v1.3-router-pools`

**Chain**: 84532

**Deployed at block**: 42323839

**Timestamp**: 1780415966

## Release lock (v1.3 params digest)

- **Digest**: `0xfeb5e4bc067b0c978d1281551638125d56822f75f4b63dbf4b4b7d51a1573721`
- **Signer**: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- **Signature**: v=27, r=`0xe6212e62520b54ea4729cc69cc81d056fb65761d439cc6c696d42cbfe7cfddba`, s=`0x2bf8d5f4aa10a6fe8a0a4f696b8bbc5593334bb6e4e5c5333e7fab714ccd6b6c`

Artifacts:
- Snapshot: `deployments/snapshots/deploy-84532-42323839-v13.json`
- Release lock: `deployments/release-latest-v13.json`

## Core contracts

- GOV: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- Treasury: `0x0000000000000000000000000000000000000000`
- VRF Wrapper: `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`
- Adapter: `0x1B4d528186E1f503fbb1a7647F679654BECbB723`
- VRFHub: `0xeD604a776Ba7104C600b6eDAF1c5940d6846C309`
- PoolRegistry: `0x47D1308C136DDBB41b138df08600674bf9B84512`
- SettlementRouter: `0x4ac82e4899C7A948D0523D8f9913E236200E497d`
- GameHub: `0x9FD191e27A411d5d37c903199E835808c66e0357`
- SportsRiskEngine: `0x117C0682E39d9a8674cd7708C3dc1146544ab100`
- SportsHub: `0x1175343A5F66d73C3c3599A0cDdB70454Ba07980`
- ReferralRegistry: `0x99645b14C0c27577bE64E938A8F693e5BF7aD86E`
- ReferralEngine: `0xF7D9552a07e5bB12131dfe9d91A1C69a000bfa17`

## Game modules

- Dice: `0x2e900F670EC608d02DCa77905DA9d60D03CbC557`
- CoinToss: `0xbb9CBAF2f98b5209Ec49BD2A497489d5831B6F4F`
- Roulette: `0x7714Ec9E6d4E213f479378605AD33b5842F905Fe`
- Keno: `0xe0883dce4038B1c070CBbA3AD6E46a859Bc6DD0E`
- Plinko: `0xf72230A2372f2e23F0EA949338E0b8C9789fD013`
- SicBo: `0xB56bD70aF4FA5D0c9A3a53ee93524Ef4e864f31d`
- Slots: `0x041D14b63FE573a0e359a0Cad0950A193c444E7B`
- Baccarat: `0x6825374EA70EbbA98Fec67f6D74bE083C7709070`

## Key parameters

- refundTimeoutSeconds: 3600
- defaultHouseEdgeBps: 200
- maxAffiliateDeltaBps: 0
- sportsEnabled: true
- defaultSportsRiskCaps(raw asset units): maxStake=10000000, maxPayout=20000000, maxMarketReserved=100000000, maxOutcomeReserved=50000000, maxEventReserved=150000000
- sportsOddsSignerSetHash: `0x785b35cf4b563a5ca8403112b1e06f601093d8e51dfd9fa24d37006b27aaa33a`
- sportsResultReporterSetHash: `0x93e4afafee686e0480ba74f64393d774306df7f0abdd8429eff149754c3cd6a0`
- sportsResultReporterThreshold: `1`
- sportsResultChallengeTimeoutSeconds: `604800`
- sportsResultChallenger: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- sportsResultArbitrator: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`

## Pools

- pool_0: id=1, domain=Casino, asset=`0x036CbD53842c5426634e7929541eC2318f3dCF7e`, bank=`0x14F3eeaacD690C8f421dE2E3353250e9682B3087`, active=true
- pool_1: id=2, domain=Sports, asset=`0x036CbD53842c5426634e7929541eC2318f3dCF7e`, bank=`0x3B1dcC35344739a58EC907958233D2E30939988b`, active=true, sportsRiskCaps(raw)=stake:10000000/payout:20000000/market:100000000/outcome:50000000/event:150000000, riskHash=`0x50695b4589bcd21d92a3a2f25f60be2f9a0566b91019b7b015934b5024f1c645`
- pool_2: id=3, domain=Casino, asset=`0x4200000000000000000000000000000000000006`, bank=`0x4735aE54b7efe4bedeCAee13420f72E05aCd0F4e`, active=true

## Verification

- Verify release lock locally (offline): `make release-verify-v13`
- Generate v1.3 frontend manifest: `make release-frontend-manifest-v13`
- Generate v1.3 golden vectors: `make release-golden-vectors-v13`
- Package artifacts: `make release-package-v13`
