# Legacy Banks

The key `0xc8eC9920d573893E888db5D30b2B3B3824B1b684` deployed and governed the contracts before v1.5 and sat on the
production host until 2026-09-20; treat it as exposed. It still governs the Banks below.
None of them belongs to a release, and no application build serves them. The key can still call, on each of them,
`setRiskInPaused`, `rescueToken` (any token the Bank holds), `transferGovernance` and every parameter setter. The
launch candidate never uses it: the preflight refuses it for any role (`exposedGovernanceKeyIsNotUsed`).

## Census (2026-10-12)

Read-only, from the Base public RPCs, each chain at one block: every address the key created with `CREATE` (nonces 0
to 173 on Base, 0 to 4993 on Base Sepolia), kept when it has code, `governance()` returns the key, and
it answers `asset()`, `totalAssets()` and `riskInPaused()`. No Bank has a pending governance. Amounts are in asset
units; "paused" is `riskInPaused()`, which equals `paused()` on every Bank listed.

| Chain | Block | Contracts created | Governed by the key | Banks | Paused | Not paused | Holding anything |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base 8453 | 52,483,310 | 53 | 20 | 5 | 3 | 2 | 0 |
| Base Sepolia 84532 | 47,994,135 | 526 | 193 | 39 | 10 | 29 | 14 |

The other contracts the key governs are not Banks, and none of them holds ETH, USDC or WETH. The count of 18 Banks
recorded on 2026-09-26 covered fewer deployments; the census includes every Bank the key created.

### Base 8453

Real USDC (`0x833589fC…2913`) and WETH; every Bank is empty.

| Created at nonce | Bank | Asset | Paused | Asset held | LP shares | Protocol fees |
| ---: | --- | --- | --- | ---: | ---: | ---: |
| 58 | `0x3ed89fae1708dd24df1c95b61ededdcde9e2d07f` | USDC | yes | 0 | 0 | 0 |
| 93 | `0x9e1f54704a8820be969ed84d6ef881e5320b9dbd` | USDC | **no** | 0 | 0 | 0 |
| 100 | `0x50149eb4679383a1d7346c0873b389e420e2b412` | WETH | **no** | 0 | 0 | 0 |
| 134 | `0x597266ba243455f1a9145ba0cdc0408aae532c77` | USDC | yes | 0 | 0 | 0 |
| 140 | `0xf63c7c3304469f524ad3433dace31401e8472955` | WETH | yes | 0 | 0 | 0 |

### Base Sepolia 84532

Circle's test USDC (`0x036CbD53…CF7e`) and WETH; the balances are test tokens without value.

| Created at nonce | Bank | Asset | Paused | Asset held | LP shares | Protocol fees |
| ---: | --- | --- | --- | ---: | ---: | ---: |
| 3063 | `0x22b8727b96dc2088768cdc8690423ecd621f2395` | USDC | **no** | 0 | 0 | 0 |
| 3086 | `0x97af57c456909bbd04bafda0d0191d593105e4d2` | USDC | **no** | 0 | 0 | 0 |
| 3109 | `0x1615922e49c89d89d875c7f556a1e95eb131b5f1` | USDC | **no** | 0 | 0 | 0 |
| 3132 | `0xbf868c51d647b292e1a23cb4b3b62f986daec0ea` | USDC | **no** | 0 | 0 | 0 |
| 3155 | `0xafea7063c8f8dc9036e5781ec5d60e1a2d252aa5` | USDC | **no** | 0 | 0 | 0 |
| 3178 | `0xe81d8f0b5b93998af91254c3d3149833cbfaf4e8` | USDC | **no** | 0 | 0 | 0 |
| 3201 | `0x21903baf62219679f64769b3579c376141a7ed91` | USDC | **no** | 0 | 0 | 0 |
| 3224 | `0x0efe639ba94e3e1cd321e54fe6f1e850c15dffb8` | USDC | **no** | 0 | 0 | 0 |
| 3247 | `0xf3870c4ab1170696ca9073c9637a8571be0a9e52` | USDC | **no** | 0 | 0 | 0 |
| 3270 | `0xedd1af25c005d64342f6a0e56fd62a18a2d59e64` | USDC | **no** | 0 | 0 | 0 |
| 3293 | `0xd4bf6af4c1feb9d45eb772043e58df986b3ac82c` | USDC | **no** | 0 | 0 | 0 |
| 3316 | `0x10b6cb9cb71375827dc786b95487fa414495d4ab` | USDC | **no** | 0 | 0 | 0 |
| 3339 | `0x1e6df5c63849c657e3dfb8a7817f902ed9f066e0` | USDC | **no** | 0 | 0 | 0 |
| 3362 | `0xc5a3058fa1cf5acd3877a9455568c8b7535a7e96` | USDC | **no** | 0 | 0 | 0 |
| 3385 | `0x49b9dc94d98c3d78224ca37abf05ec09af7c50ff` | USDC | **no** | 0 | 0 | 0 |
| 3412 | `0x7c516cd4e343664d5256e1ed04dd793790885593` | USDC | **no** | 32.0001 | 32.0001 | 0 |
| 3499 | `0xa383e1c133021c1948a644a758b3e7d5f971262e` | USDC | **no** | 1 | 1 | 0 |
| 3505 | `0x360270aa8e8fdd044af72e5cf48c2cb11093a0c6` | USDC | **no** | 0.95 | 1 | 0 |
| 3596 | `0xf744f933c2d8cd5e357ebbdc0e379d9aa9f89503` | USDC | **no** | 0 | 0 | 0 |
| 3602 | `0x6aff6500cfd35f3b4a7ee1aff2630f489a874ecd` | USDC | **no** | 0 | 0 | 0 |
| 3645 | `0xf79573e6f76a06ba7ab46985180833663606c806` | USDC | **no** | 0 | 0 | 0 |
| 3651 | `0x413e28de86a8b894cfd84d81bda797422c17c8b4` | USDC | **no** | 0 | 0 | 0 |
| 3694 | `0xa1b30a0525298546bf1d6740cb68d12457d82d5a` | USDC | **no** | 0 | 0 | 0 |
| 3700 | `0x10ae998f1c5c8e9f953d6a6af0f73eba45ccf89b` | USDC | **no** | 0 | 0 | 0 |
| 3744 | `0x3aada481f979e5dfabd2cd252a76fea2ad05e346` | USDC | yes | 1.12318 | 0.131603 | 0.0202 |
| 3750 | `0x3686664d8d92feab8c4c9ac0baaeb07c8bddbc85` | USDC | **no** | 0.93 | 0 | 0 |
| 3851 | `0xbc9a8f34a416b6da463c634d63996c362e2c5f0a` | USDC | yes | 17.911752 | 22 | 0.5204 |
| 3857 | `0x732d8fdce925f73d0b8573a8e8638a748069e661` | USDC | yes | 1 | 1 | 0 |
| 3932 | `0x552063ba55ac0a4aef3fb764957912056fb3a7f0` | USDC | yes | 1.929802 | 2.242125 | 0.3406 |
| 3938 | `0xf97c13205038c1ecf088bcc5a591e62966172af8` | USDC | **no** | 0 | 0 | 0 |
| 4007 | `0x14f3eeaacd690c8f421de2e3353250e9682b3087` | USDC | yes | 26.066266 | 4.675378 | 14.835 |
| 4013 | `0x3b1dcc35344739a58ec907958233d2e30939988b` | USDC | **no** | 24.252 | 25 | 0 |
| 4421 | `0x4735ae54b7efe4bedecaee13420f72e05acd0f4e` | WETH | **no** | 0 | 0 | 0 |
| 4504 | `0x7585145b702e8009f4eac60be4195ce8449be571` | USDC | yes | 0 | 0 | 0 |
| 4510 | `0xa4442da635a575a57d5e98f27161cf0fea8aa622` | WETH | **no** | 0 | 0 | 0 |
| 4544 | `0x16f5bbc7d62aa8d1828b807f57d3796712c7e3e9` | USDC | yes | 43.697264 | 50 | 7.6584 |
| 4550 | `0x71d9e131d5f92c3c18a44fae058ed789085dd095` | WETH | yes | 0.01 | 0.01 | 0 |
| 4681 | `0x9a6b13b7c3b54adbee57a37293978dfbff7237c9` | USDC | yes | 47.13825 | 46500.288685 | 26.323745 |
| 4687 | `0x0ec066c81eb3866b32aa59724dd49fa263d7cb17` | WETH | yes | 0.01 | 0.01 | 0 |

## Retirement (Owner)

1. With the old key, from the Owner's machine and never from a server, pause the Banks marked **no**: two on Base
   and 29 on Base Sepolia (`setRiskInPaused(true)`).
2. Optionally recover the Sepolia test balances with `rescueToken`; they have no value.
3. Use the key for nothing else, and run the census again afterwards; the implementer records the result here.

Pausing does not remove the key's authority: whoever holds it can unpause. Nothing protects a deposit made into one
of these Banks, which is why no application may ever list them.

## RPC key rotation (2026-10-11)

The four RPC keys in the repository `.env` were renamed by purpose with their values unchanged:
`INFURA_API_KEY_OPS`, `ALCHEMY_API_KEY_OPS`, `INFURA_API_KEY_PROD_KEEPER` and `ALCHEMY_API_KEY_PROD_KEEPER`. The
operator and production keys belong to different provider accounts, and the old Alchemy key was rebuilt; the Owner
confirmed all three facts. Which step uses which key is in the [deployment runbook](../deploy/v16-release.md#rpc-endpoints).
The GitHub secret `FORK_RPC_URL_BASE_SEPOLIA`, built from the former Infura key, is no longer read by any workflow;
the Owner deletes it.
