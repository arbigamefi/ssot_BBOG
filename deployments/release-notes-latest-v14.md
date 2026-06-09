# chain-84532-42600719-v14

**Architecture**: `v1.4-bank-observability`

**Chain**: 84532

**Deployed at block**: 42600719

**Timestamp**: 1780969726

## Release lock (v1.4 params digest)

- **Digest**: `0xeb08b585b0037df455d84cdb97b4bbd5138e168dbc6957e717e595423a0ba09b`
- **Signer**: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- **Signature**: v=27, r=`0x0f229e1c8a4cb7fc34fc620aa0c4fb20fe67f87b77a6dc8f432be6e43c73e74b`, s=`0x437f67635a24ff288865604d7b2d8e28857af98954007995dbb057692405d140`

Artifacts:
- Snapshot: `deployments/latest-v14.json`
- Release lock: `deployments/release-latest-v14.json`

## Core contracts

- GOV: `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`
- Treasury: `0x0000000000000000000000000000000000000000`
- VRF Wrapper: `0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed`
- Adapter: `0xE0d106dB20363D9aB39FE1DC547A7d5052020120`
- VRFHub: `0x3e80e96B8f6F9C5b1d48037Ba1c020642E22A5A9`
- PoolRegistry: `0x7658219104a3b7d1966Fe1bACc305aa869387146`
- SettlementRouter: `0x1C8560a4f2584d9A6Bbbe6647a91F0221092C179`
- GameHub: `0x7Bba34F0ac9476b856026273ef66dfC4Da33B102`
- SportsRiskEngine: `0x0000000000000000000000000000000000000000`
- SportsHub: `0x0000000000000000000000000000000000000000`
- ReferralRegistry: `0x072078aB8b73Ff1dcb10Fe37775be733FC2af499`
- ReferralEngine: `0x19c0C646c6ca01075657c35382BF20185FCcE568`

## Game modules

- Dice: `0xCE46a976eEA806982Ea8b70D7706DEFbDc69a07E`
- CoinToss: `0xaac9d2478E178bC5d936b69624482d91BA07B463`
- Roulette: `0x858Acea7229298b48286f2b3B17C9F5589375D70`
- Keno: `0xebE5A01890b36869B8137e50Fc5a68f88e176Bd6`
- Plinko: `0xC8AC93105085228cf933Eb9136A0ef4AD3325c1E`
- SicBo: `0xfC7Ab37Af06eDE7d0a4F56d2d75acCb534739e2D`
- Slots: `0xC153Cab8A0899497524449e22bD85CD368884284`
- Baccarat: `0xC5B33221016a12c6b61D9d8BBdB07c2E70c1b4Dd`

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

- pool_0: id=1, domain=Casino, asset=`0x036CbD53842c5426634e7929541eC2318f3dCF7e`, bank=`0x9a6B13b7C3b54aDbEE57A37293978dFBFF7237c9`, active=true
- pool_1: id=3, domain=Casino, asset=`0x4200000000000000000000000000000000000006`, bank=`0x0ec066C81Eb3866b32Aa59724dd49fa263d7CB17`, active=true

## Verification

- Verify release lock locally (offline): `make release-verify-v14`
- Generate v1.4 frontend manifest: `make release-frontend-manifest-v14`
- Generate v1.4 golden vectors: `make release-golden-vectors-v14`
- Package artifacts: `make release-package-v14`
