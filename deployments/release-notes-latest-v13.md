# base-mainnet-v13-2026-05-24

**Architecture**: `v1.3-router-pools`

**Chain**: 8453

**Deployed at block**: 46404343

**Timestamp**: 1779598033

## Release lock (v1.3 params digest)

- **Digest**: `0x06ca8fe7253f40e0548e7dd01f2397a4dc51ba2dfae200cc8722bcb9884b5060`
- **Signer**: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- **Signature**: v=27, r=`0xe0d0cecbb4ce487bcc4cce0bbbc003da85f21a62c32a506262733d38c8b559ec`, s=`0x4000b42b220c470bd49103d246db48a21bedfb982bfcf006e36ad5a3fde4302b`

Artifacts:
- Snapshot: `deployments/latest-v13.json`
- Release lock: `deployments/release-latest-v13.json`

## Core contracts

- GOV: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- Treasury: `0x0000000000000000000000000000000000000000`
- VRF Wrapper: `0xb0407dbe851f8318bd31404A49e658143C982F23`
- Adapter: `0x4A923eACBdF8Ca3571c5dbf4B182AEC5418736A6`
- VRFHub: `0xe441dF37b6c3717A4126d201D9130ffa65eC866D`
- PoolRegistry: `0x7E92e8C162c811fa8b676B7222844fe9a1005479`
- SettlementRouter: `0xd9d1B9f9D47922D776f5A4A05eeB4D5b802E05d7`
- GameHub: `0x9CACb3250CC648D711C14F0d39cF1EEa3B1D1Ef9`
- SportsRiskEngine: `0x0000000000000000000000000000000000000000`
- SportsHub: `0x0000000000000000000000000000000000000000`
- ReferralRegistry: `0x139F850D11f0FA6fbDbFA6c7024806bB822c336f`
- ReferralEngine: `0x1c7f605d39c66f64Fe6576d54e27A87825397A20`

## Game modules

- Dice: `0x0830d84d99D9Ac933d9C99ab3B4F49352af56aB7`
- CoinToss: `0x7e9D358C94227148b5F7542DA66475277D9DA0b3`
- Roulette: `0xe6761b26d6b9b6c0cd7F240C3Fa08B65340c84F5`
- Keno: `0x84e6d3db39E1b0e0386D8f4e3222926db32A75c9`
- Plinko: `0x1B5BfeB5dD456a02470E56DA83F331502bF04635`
- SicBo: `0x868Db226d75138b8f242b02fecfa054FFa56bF17`
- Slots: `0x29e4A7B05670e5430EB0F5eF2823e6Edffa742Eb`
- Baccarat: `0xb1754c8505B1f901Ba9fdb286D631d523640B7c0`

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

- pool_0: id=1, domain=Casino, asset=`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, bank=`0x3ed89faE1708DD24df1c95B61edeDdCDe9E2D07f`, active=true

## Verification

- Verify release lock locally (offline): `make release-verify-v13`
- Generate v1.3 frontend manifest: `make release-frontend-manifest-v13`
- Generate v1.3 golden vectors: `make release-golden-vectors-v13`
- Package artifacts: `make release-package-v13`
