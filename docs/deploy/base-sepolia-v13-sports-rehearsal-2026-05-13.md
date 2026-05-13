# Base Sepolia v1.3 Sports Rehearsal - 2026-05-13

## Status

Base Sepolia v1.3 Casino+Sports deployment rehearsal, funded canary settlement, direct void
debt-out, challenge arbitration debt-out, and dedicated testnet Sports role rehearsal completed
successfully.

This is a public testnet deployment only. It is not a mainnet launch approval and does not prove
real provider data quality, managed production key custody, user-facing signer integration, or
jurisdiction controls.

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
- Initial bootstrap testnet roles:
  - odds signer: GOV
  - result reporter: GOV
  - result challenger: GOV
  - result arbitrator: GOV
- Rotated testnet canary roles:
  - odds signer: `0x871FbF5FF3FD3515636dACAafcEF1a008F1853Eb`
  - result reporter: `0x9f1F0b9BaB6Ccf386E32F72023368cF74228cb7A`
  - result challenger: `0x6ee473cE7AA56bDA640bD7560604e1699Fd9D013`
  - result arbitrator: `0x7033114a50115fdbCA684dEa0734A502bA2F7BD8`
  - role env: local ignored `.env.sports-roles.local`

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

# simulation only: rotate existing SportsHub testnet roles
ENV_FILE=.env.sports-roles.local make sports-roles-v13

# broadcast role rotation
BROADCAST=1 ENV_FILE=.env.sports-roles.local make sports-roles-v13
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

## Phase 1 Ops Rehearsal

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

# simulation only: challenge setup with paired tickets
CANARY_MODE=challenge-setup ENV_FILE=.env make sports-canary-v13

# broadcast challenge setup with paired tickets
BROADCAST=1 CANARY_MODE=challenge-setup ENV_FILE=.env make sports-canary-v13

# simulation only: challenge arbitration void + batch debt-out
CANARY_MODE=challenge-void CANARY_MARKET_ID=<market-id> CANARY_TICKET_ID=<first-ticket-id> \
  ENV_FILE=.env make sports-canary-v13

# broadcast challenge arbitration void + batch debt-out
BROADCAST=1 CANARY_MODE=challenge-void CANARY_MARKET_ID=<market-id> \
  CANARY_TICKET_ID=<first-ticket-id> ENV_FILE=.env make sports-canary-v13

# after role rotation, run the same canaries with dedicated role keys
CANARY_MODE=challenge-setup ENV_FILE=.env.sports-roles.local make sports-canary-v13
BROADCAST=1 CANARY_MODE=challenge-setup ENV_FILE=.env.sports-roles.local make sports-canary-v13
CANARY_MODE=challenge-void CANARY_MARKET_ID=<market-id> CANARY_TICKET_ID=<first-ticket-id> \
  ENV_FILE=.env.sports-roles.local make sports-canary-v13
BROADCAST=1 CANARY_MODE=challenge-void CANARY_MARKET_ID=<market-id> \
  CANARY_TICKET_ID=<first-ticket-id> ENV_FILE=.env.sports-roles.local make sports-canary-v13
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

Result challenge + arbitration void broadcast:

- Setup block: `41447653`
- Challenge/arbitration block: `41447793`
- Market ID: `3`
- Event ID: `1778663514`
- Lock/start time: `1778663634`
- Ticket IDs:
  - refunded through `refundTickets`: `6`, `8`
  - voided through `voidTickets`: `7`, `9`
- Stake per ticket: `0.1 USDC`
- Total stake routed in: `0.4 USDC`
- Expected total reserved while held: `0.6 USDC`
- Result source hash: `0xe994491f37255a73e174863b8db772e73d1d5b49d32cb913c6420809c32a4583`
- Evidence hash: `0x3a02451faab76c71d0a369770b9f3e67aa753ac901475bed8af706dde9a5db2c`
- Challenge reason hash: `0x21a0180c220c1aff0792f487593dd5f03334a5ea730ca252d34273ab555e9da6`
- Arbitration decision hash: `0xb8855bb23b93abe57065031037d736a62037c79a874fc82c8c1225c33abc6b96`
- Create market tx: `0xb66b881194e70c284608f8643ba1d4f3947c74152496ccbd6dbfc7c4d9f1349d`
- Open market tx: `0x786897fc33f6e787f6f560f8ca274667d39064c4f28a0704402d63a720a94aed`
- Approve batch stake tx: `0xe113dc5393a2ff103c483fdb673cbcd7c8a54b441c227507f7fddef1d2ee1d28`
- Place ticket txs:
  - `0x068d840bcc4871e2d192fd23cdf0c0b93ec8921241893fdaec041de9d62e18ee`
  - `0x363b9e938aa33819ce39425c567640f4189addada19fe2a5d7a6b55590812210`
  - `0xb014df356b724c113875c0b0e356a532e2728b5a03ecdc361d0a19699ad7a213`
  - `0x58b7aea7d9d200dfaf2141a465a9640d41890e9249d276e4b46ef4205bfb5fa3`
- Lock market tx: `0xf25cf15a323a7692d19a7ffa1ecf76f0188de3c386d80c3fac766129320ea21a`
- Propose result tx: `0xf4c8e8a467bd2f824c67701ca56e0c859ac3df3547445a518d43de368251f012`
- Challenge result tx: `0x7b4bc1821c167facff31d832eff428c632640082844002f7c0be8d3e74ae5af0`
- Resolve challenge tx: `0x97a4b435503cdda1cb53bd1f4bd01c4bd60f96ecb594dc053a443c4aa785dbee`
- Batch refund tx: `0x43edc6fe21e6e36da1a767b8445317fbf274cbd24ee491b0542ede223367457b`
- Batch void tx: `0x6c39257100fe805c68916ae12bd2d3bc3e7f7738430d1cb2044a604a6ae99f66`
- Post-arbitration debt-out state:
  - market state: `Voided`
  - result challenged: `true`
  - challenge decision: `VoidMarket`
  - ticket `6` / `8` state: `Refunded`
  - ticket `7` / `9` state: `Voided`
  - router positions `6` / `7` / `8` / `9` state: `Refunded`
  - Sports market/event/pool-event reserved: `0`
  - Sports Bank reserved: `0`
  - Sports Bank assets: `0.95 USDC`

Dedicated Sports role rotation broadcast:

- Block: `41452104`
- Odds signer: `0x871FbF5FF3FD3515636dACAafcEF1a008F1853Eb`
- Result reporter: `0x9f1F0b9BaB6Ccf386E32F72023368cF74228cb7A`
- Result challenger: `0x6ee473cE7AA56bDA640bD7560604e1699Fd9D013`
- Result arbitrator: `0x7033114a50115fdbCA684dEa0734A502bA2F7BD8`
- New odds signer set hash: `0x3716125c7970c7724f4603dad9e0c599f575c5ce9a0db3ee4fc52bc94ec18b96`
- New result reporter set hash: `0x0409bfe432d5e74ddc77b987eef0b4236d7d36f628cfb145a6282bbf707b9253`
- Reporter threshold: `1`
- Role txs:
  - set odds signer set hash: `0x5e42df98e733a7b18a66022763511d5db1d682a907ec63ea538ca902c842e1e9`
  - set result reporter set hash: `0xab3d36d2a89ce361767b7958ab0e52d37ba86b3a61b32e1f8ff95ea4d385dd5f`
  - allow odds signer: `0x8488862f2cf81d016345d836ae2bbcceca1949f669b32b837ad9c853f35e15b9`
  - allow result reporter: `0x577985f12042ce0f08ac27315d232e19949574b707e3f013c853e9ff10e0bacc`
  - allow result challenger: `0x793a840b53cb57eb186e414386e38ca1f5b315d054ff0d6af236af6ff0839bf9`
  - allow result arbitrator: `0xcb5d67c9f2bb955dde0de5c17bb4196d4e3fbd1af2826ef1abe8be316faa762f`
  - revoke GOV odds signer mapping: `0xbf180b885171f4d0ede0967bc3bdb6cf03293ca6021d1971ac09d2cdf1bdfba8`
  - revoke GOV result reporter mapping: `0x5cd76b6f8cfe977f8b29302e315766ec2ba04dd89ab52a6708cd4e9e62b20e71`
  - revoke GOV challenger mapping: `0x6f06843cb3d16a5e9b10ddce3fe47010016fcff1f24a5f2817387a170c229b76`
  - revoke GOV arbitrator mapping: `0x0c0c9358bbb770bfce4644f24155042df319075bbbe792a815e3343b7315a520`
- Gas funding txs:
  - odds signer, `0.00005 ETH`: `0x85ece7459f54f57876ea3e3e6d47382c0c45617db82d2b8f33553a9c2a71e7a0`
  - result reporter, `0.00005 ETH`: `0xc27f521bb10980e4e43e31a603e498b97d2d9eceffab1f23064c00009d62d270`
  - result challenger, `0.00005 ETH`: `0xabf21d0781ff349c122d8556ea259da9ec19169043e55c48a3103533efce8b61`
  - result arbitrator, `0.00005 ETH`: `0xe110241e880857b895ab3eada065e97cb095289001690222c853df6d78ce6ef7`
- Post-rotation role state:
  - dedicated odds signer / reporter / challenger / arbitrator mappings: `true`
  - GOV odds signer mapping: `false`
  - GOV result reporter mapping: `false`
  - GOV challenger/arbitrator mappings: `false`
  - GOV still retains governance fallback for challenge/arbitration in contract code.

Role-separated challenge + arbitration void broadcast:

- Setup block: `41452253`
- Challenge/arbitration blocks:
  - propose result: `41452357`
  - challenge and resolve: `41452358`
  - refund batch: `41452359`
  - void batch: `41452361`
- Market ID: `4`
- Event ID: `1778672712`
- Lock/start time: `1778672832`
- Odds signer: `0x871FbF5FF3FD3515636dACAafcEF1a008F1853Eb`
- Result proposer/reporter: `0x9f1F0b9BaB6Ccf386E32F72023368cF74228cb7A`
- Result challenger: `0x6ee473cE7AA56bDA640bD7560604e1699Fd9D013`
- Result arbitrator: `0x7033114a50115fdbCA684dEa0734A502bA2F7BD8`
- Ticket IDs:
  - refunded through `refundTickets`: `10`, `12`
  - voided through `voidTickets`: `11`, `13`
- Stake per ticket: `0.1 USDC`
- Total stake routed in: `0.4 USDC`
- Expected total reserved while held: `0.6 USDC`
- Result source hash: `0xe994491f37255a73e174863b8db772e73d1d5b49d32cb913c6420809c32a4583`
- Evidence hash: `0x3a02451faab76c71d0a369770b9f3e67aa753ac901475bed8af706dde9a5db2c`
- Challenge reason hash: `0x21a0180c220c1aff0792f487593dd5f03334a5ea730ca252d34273ab555e9da6`
- Arbitration decision hash: `0xb8855bb23b93abe57065031037d736a62037c79a874fc82c8c1225c33abc6b96`
- Create market tx: `0x9c26f94b1f88ba895a781dbe34aa430ca4b9d7acc2a56b03910a8f0334d5e66f`
- Open market tx: `0xd88b21597363dcf8fbcd153ac181f3a36c7b48d1b0c02fcf2b821401ce144dff`
- Approve batch stake tx: `0x09aeea657c3749b22e95fcb72a444c307bffc178680ff30fc9a35ba301c0696c`
- Place ticket txs:
  - `0xecaf642cbfc2f0a23cce80ba339217fb22d90e89a66285083369469d0ac38130`
  - `0x1c91485ce2597b4c231e4e40e36357d9d62bb02831dc550338eff8a10cec313f`
  - `0xb4d07d9b8b8f9502bb65446bc7af70ed3999a548603cf3f7d7dd2ed43802758b`
  - `0x51d2710554cc2ac1faa21e720230fac91e041873455067920d70efff0e2aee56`
- Lock market tx: `0x6345b0009d22c827583b64fba5d3d8abc160f547be3da6d5a18af2b1ba105729`
- Propose result tx: `0x93f5c330c7b7ae0ca46d6d20ffe6423f3cdf6588a74f05525379924d7c694827`
- Challenge result tx: `0xa412629b98dcd0d8b074abdac5708e83fbdd800b707033bdd9c30751c92c7006`
- Resolve challenge tx: `0x114613b302c54e6870c010e472c1b488216ad0711726568d13f335fe132c838a`
- Batch refund tx: `0xb3e3b88cc7af98bed1a00d5c33e5095e12b08d4a6ca2c7115d0f765f43066077`
- Batch void tx: `0x7d7a97a6f8ebcfd853cab3bd9c43282850a7c54db468242335aac8fb0712777e`
- Post-arbitration debt-out state:
  - market state: `Voided`
  - result challenged: `true`
  - result reporter set hash: `0x0409bfe432d5e74ddc77b987eef0b4236d7d36f628cfb145a6282bbf707b9253`
  - reporter count / threshold: `1 / 1`
  - challenge decision: `VoidMarket`
  - ticket `10` / `12` state: `Refunded`
  - ticket `11` / `13` state: `Voided`
  - router positions `10` / `11` / `12` / `13` state: `Refunded`
  - Sports market/event/pool-event reserved: `0`
  - Sports Bank reserved: `0`
  - Sports Bank assets: `0.95 USDC`

Remaining Phase 1 gaps before any public canary:

- replace generated testnet keys with managed custody or an approved signer service;
- connect a real odds/result data-provider policy and evidence store;
- define jurisdiction, geofencing, and KYC policy for any public frontend.
