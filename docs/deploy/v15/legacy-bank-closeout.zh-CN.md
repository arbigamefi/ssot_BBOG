# 历史 Bank 退役收尾

本清单只覆盖清理前 Git 制品中发现的 18 个 Bank，不代表链上所有曾部署地址。刷新时间：2026-09-24T07:24:41.214Z。逐项余额见 [当前义务快照](legacy-bank-obligations.json)。旧部署脚本及归档已从工作区移除，清理不改变链上资产所有权。

## 待签署暂停

旧治理钱包为 `0xc8eC9920d573893E888db5D30b2B3B3824B1b684`。以下 14 个调用均已通过只读模拟，尚未签署或广播；每笔调用 `setRiskInPaused(true)`，value 为 0。新 Safe 无权代签。机器可读参数见 [暂停调用](legacy-pause-calls.json)。

| 网络         | Bank                                         | 操作入口                                                                                                        |
| ------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Base 主网    | `0x3ed89faE1708DD24df1c95B61edeDdCDe9E2D07f` | [Write Contract](https://basescan.org/address/0x3ed89faE1708DD24df1c95B61edeDdCDe9E2D07f#writeContract)         |
| Base Sepolia | `0x3aADa481F979E5DFabd2Cd252A76feA2aD05e346` | [Write Contract](https://sepolia.basescan.org/address/0x3aADa481F979E5DFabd2Cd252A76feA2aD05e346#writeContract) |
| Base Sepolia | `0x3686664d8D92FEAb8C4c9Ac0baaEb07c8BDDbc85` | [Write Contract](https://sepolia.basescan.org/address/0x3686664d8D92FEAb8C4c9Ac0baaEb07c8BDDbc85#writeContract) |
| Base Sepolia | `0x14F3eeaacD690C8f421dE2E3353250e9682B3087` | [Write Contract](https://sepolia.basescan.org/address/0x14F3eeaacD690C8f421dE2E3353250e9682B3087#writeContract) |
| Base Sepolia | `0x3B1dcC35344739a58EC907958233D2E30939988b` | [Write Contract](https://sepolia.basescan.org/address/0x3B1dcC35344739a58EC907958233D2E30939988b#writeContract) |
| Base Sepolia | `0x4735aE54b7efe4bedeCAee13420f72E05aCd0F4e` | [Write Contract](https://sepolia.basescan.org/address/0x4735aE54b7efe4bedeCAee13420f72E05aCd0F4e#writeContract) |
| Base Sepolia | `0x7585145B702e8009F4eac60Be4195cE8449Be571` | [Write Contract](https://sepolia.basescan.org/address/0x7585145B702e8009F4eac60Be4195cE8449Be571#writeContract) |
| Base Sepolia | `0xa4442DA635a575a57d5E98f27161cF0Fea8AA622` | [Write Contract](https://sepolia.basescan.org/address/0xa4442DA635a575a57d5E98f27161cF0Fea8AA622#writeContract) |
| Base Sepolia | `0x16f5BBc7d62Aa8d1828b807F57d3796712C7E3e9` | [Write Contract](https://sepolia.basescan.org/address/0x16f5BBc7d62Aa8d1828b807F57d3796712C7E3e9#writeContract) |
| Base Sepolia | `0x71D9E131D5F92c3c18a44fAE058ED789085DD095` | [Write Contract](https://sepolia.basescan.org/address/0x71D9E131D5F92c3c18a44fAE058ED789085DD095#writeContract) |
| Base Sepolia | `0xbc9A8f34A416B6Da463c634D63996C362e2C5f0A` | [Write Contract](https://sepolia.basescan.org/address/0xbc9A8f34A416B6Da463c634D63996C362e2C5f0A#writeContract) |
| Base Sepolia | `0x732d8fdCe925f73d0b8573A8E8638a748069E661` | [Write Contract](https://sepolia.basescan.org/address/0x732d8fdCe925f73d0b8573A8E8638a748069E661#writeContract) |
| Base Sepolia | `0x552063BA55ac0A4AEf3fb764957912056FB3A7f0` | [Write Contract](https://sepolia.basescan.org/address/0x552063BA55ac0A4AEf3fb764957912056FB3A7f0#writeContract) |
| Base Sepolia | `0xf97C13205038C1Ecf088bcc5A591E62966172Af8` | [Write Contract](https://sepolia.basescan.org/address/0xf97C13205038C1Ecf088bcc5A591E62966172Af8#writeContract) |

暂停签署后需核对链 ID、正式回执、Bank 事件与最终状态。已确认暂停的最新两个主网及两个测试网 Bank 不包含在上述清单，不要重发。

## 资产处置

本次刷新：主网三个历史 Bank 的资产、份额、协议费、reserved、XP 均为零；测试网仍有 LP 或协议费留存，所有历史 Bank 的 reserved 与 XP 均为零。LP 份额对应资产需要由持有人处置，协议费按合约治理权限处理；无法把余额统一转给部署者。先完成暂停，再逐项决定测试资产保留或依法合约权限退出。

## 旧治理钱包（2026-09-26 复核）

链上只读复核结果与 09-24 刷新一致：18 个 Bank 的治理仍全部是旧治理钱包，没有待接受的治理转移；14 个未暂停（主网 1 个、测试网 13 个）；主网 3 个 Bank 的资产、份额、协议费、reserved、XP 仍为零。主网那笔暂停调用当天重新模拟，仍可执行，约 49,000 gas。

旧治理钱包在主网还剩约 0.0031 ETH 和 0.53 USDC，测试网上仍被用来下测试注。09-20 之后它在主网的交易都能对应到已知运维操作：给 keeper 和 Safe 签名人补 gas、暂停两个主网 Bank、一次 MetaMask DelegationManager `redeemDelegations`，以及两笔转给部署者的 USDC。v1.5 Safe（2/3）的签名人中没有它。

处置顺序：

1. 签署上表 14 笔暂停。主网那笔的 gas 从这 0.0031 ETH 里出，所以先暂停、后转余额。
2. 核对暂停结果后，把主网剩余的 USDC 和 ETH 转到运维指定的安全地址。
3. 此后旧钱包只用于本次收尾；测试网下注改用单独的测试钱包。

### 地址投毒

旧钱包每次给部署者转 USDC 后，紧接着都会出现以旧钱包为转出方的记录：名称仿冒 USDC 的假代币转账，以及任何人都能发起的 0 金额 USDC 转账。收款方是首尾字符与部署者相同的仿冒地址。目前没有资金损失。

| 用途           | 地址                                         |
| -------------- | -------------------------------------------- |
| 部署者（真实） | `0x93ac87413E17d01CBa37B6317f64890bF7f99aC3` |
| 仿冒，勿用     | `0x93acF534A52126C79206aD324895cAc1E16b9AC3` |
| 仿冒，勿用     | `0x93acAc1e61818379AA40C8250Fb9873F55B89aC3` |

转账时不要从钱包或区块浏览器的交易记录里复制收款地址，也不要只核对开头和结尾几位。从仓库的部署记录（例如 [主网部署记录](base-mainnet-deployment.json) 的 `deployer`）或已核对的地址簿复制，并逐位核对完整地址。
