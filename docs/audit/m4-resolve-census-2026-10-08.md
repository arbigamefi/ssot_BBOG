# M4：已准入投注的 `resolve` 不会因 gas 以外的原因失败

日期：2026-10-08。编写方：实施接替方。本文是首次回调证书的前提之一，需经独立复核；它不是审计结论。

## 1. 断言

对 GameHub 已准入的每一笔赌场投注，在首次回调中：

1. 模块的 `resolve(params, stakeSpec, betId, randomWords)` 不会 revert；
2. 它的返回值通过 GameHub `_finalize` 的后置检查：`refund ≤ stake`，`payoutGross ≤ reserved`，`payoutGross + refund ≤ reserved`；
3. GameHub 随后对结果做的算术与类型转换也不会 revert。

这里"失败"指 gas 以外的任何原因。gas 由证书本身覆盖。

**为什么必须成立。** 如果 `resolve` 对某个已准入的投注确定性地 revert，那个结果永远无法记账：VRF 种子保留在 `Received`，Router 保持 `Held`，LP 存取栅栏一直关闭。重试也只会重复同一个 revert。这是 2026-10-04 复核中 M-5 描述的整池冻结场景。

## 2. 准入事实

GameHub `placeBet` 与 Bank `holdBet` 建立了下面这些事实。它们在首次回调时仍然成立，因为相关存储在准入后不再改变。

| | 事实 | 来源 |
| --- | --- | --- |
| A1 | 回调使用的 `params` 与准入时逐字节相同 | `GameHub.placeBet` 写入 `betParams[positionId] = params`；`_finalize` 传入 `betParams[betId]`。`stakeSpec` 四个字段同样从 `bets[betId]` 原样取回 |
| A2 | `validate(params, stakeSpec)` 和 `maxPayout(params, stakeSpec)` 在同一输入上已成功执行，且 `reserved > 0` | `placeBet` 依次调用并检查 |
| A3 | `amountPerRoll ≥ minBetAmount ≥ 1`；`1 ≤ betCount ≤ maxBetCount ≤ 25` | `placeBet` 检查；`registerGame` 限制 `maxBetCount ≤ 25` |
| A4 | `stake = amountPerRoll · betCount` 在 checked 乘法下计算成功；`reserved = maxPayout(...)` 计算成功 | `placeBet` |
| A5 | `randomWords.length == 1` | `_finalize` 构造 `new uint256[](1)` |
| A6 | `reserved ≤ 2^108 − 1`，因此 `stake ≤ reserved ≤ 2^108 − 1` | `Bank.holdBet`：`gross ≤ MAX_TREE_CAPITAL` 且 `reservedAfter ≤ gross`；`reserved ≥ stake` |
| A7 | 对每个已准入参数，模块的最大系数满足 `F ≥ P`（赔率不低于 1 倍） | P5 的穷举（`CallbackDomainP5Test`）：注额 99 时每个参数都有 `reserved > stake`，而 `reserved = ⌊stake·F/P⌋`，所以 `F > P` |

`params` 的解码是纯函数，所以 A1 与 A2 合起来给出：`resolve` 中与 `validate`、`maxPayout` 相同的解码和范围检查，结果与准入时相同。

## 3. 共同结构

八个模块的 `resolve` 结构相同：

```text
decode(params); 范围 require; require(amountPerRoll > 0); require(n > 0); require(randomWords.length > 0)
stake = amount * n
for i in 0..n-1:
    usedTurnover += amount
    r = RNG.roll(...) / RNG.roll2(...)            // keccak256(abi.encodePacked(...))
    perRound = f(params, r)                       // 模块各异，见第 4 节
    cumPayout += perRound
    if StopLogic.shouldStop(stopGain, stopLoss, usedTurnover, cumPayout): break
payoutGross = cumPayout; refundAmount = stake - usedTurnover
```

共同的 revert 位点与排除理由：

| 位点 | 排除理由 |
| --- | --- |
| `abi.decode(params, …)`，含值域校验（`bool`、`uint8`、`uint40` 的高位，枚举范围） | A1、A2：与 `validate` 的解码相同 |
| 范围 `require`（目标、号码、风险等级、种类、面值、档位） | A1、A2：与 `validate`/`maxPayout` 的检查相同 |
| `require(amountPerRoll > 0)`，`require(n > 0)` | A3 |
| `require(randomWords.length > 0)`，`randomWords[0]` | A5 |
| `stake = amount * n`（checked） | A4：同一乘法已在 `placeBet` 成功 |
| `usedTurnover += amount` | 至多 `n` 次，上界 `stake`，由 A4 可表示 |
| `cumPayout += perRound` | 第 4 节逐模块证明 `cumPayout ≤ reserved`，由 A4 可表示 |
| `RNG.roll`、`RNG.roll2` | `keccak256(abi.encodePacked(...))`，无 revert 位点 |
| `StopLogic.shouldStop` | 两处减法都在同向比较之后执行，不会下溢 |
| `refundAmount = stake - usedTurnover` | `usedTurnover ≤ n·amount = stake` |
| OpenZeppelin `Math.mulDiv(a, F, P)` | 分母是常量或经校验的非零值（第 4 节）；结果不超过 `reserved`，因此不溢出 |

**后置检查。** 设已执行 `u` 轮（`1 ≤ u ≤ n`），每轮赔付 `g_i ≤ ⌊amount·F/P⌋`。

- `refund = (n − u)·amount ≤ stake`。
- `payoutGross = Σ g_i ≤ u·⌊amount·F/P⌋`。
- 由 A7 `F ≥ P` 得 `amount ≤ ⌊amount·F/P⌋`，所以 `refund ≤ (n − u)·⌊amount·F/P⌋`。
- 因此 `payoutGross + refund ≤ n·⌊amount·F/P⌋ ≤ ⌊n·amount·F/P⌋ = reserved`，最后一步用 `k·⌊x⌋ ≤ ⌊k·x⌋`。

三条后置检查由此全部成立。Slots 的 `P = 1`、`F = 64`，CoinToss 的 `F/P = 2`，形式相同。

**GameHub 后续算术。** `feeOnPayout = mulDiv(payoutGross, houseEdgeBps, 10000)` 分母为常量；`usedTurnover = stake − refund ≥ 0`；写入 `StoredBetTerminal` 的四个 `toUint128` 转换：`payoutGross ≤ reserved < 2^108`（A6），`payoutNet ≤ payoutGross`，`refund ≤ stake < 2^108`，`protocolFeeAccrual ≤ usedTurnover < 2^108`。推荐分配只做 bps 乘除，被乘数不超过 `usedTurnover`。

## 4. 逐模块

下表只列出共同结构之外的位点，并给出每轮赔付的上界 `⌊amount·F/P⌋`，其中 `F` 正是 `maxPayout` 使用的系数。

### Dice

- `denom = isOver ? 100 − target : target`，`target ∈ [1, 99]` 由 A2 保证，故 `denom ∈ [1, 99]`。
- 每轮：`mulDiv(amount, 100, denom) ≤ mulDiv(stake, 100, denom) = reserved`。`F/P = 100/denom ≥ 100/99 > 1`。
- `r % 100 + 1` 无 revert。

### CoinToss

- 每轮 `2·amount`；`reserved = 2·stake` 已在 `placeBet` 以 checked 乘法算出，所以 `cumPayout ≤ 2·stake` 可表示。

### Roulette

- `RouletteParams.decode`：`Kind(kindRaw)` 的枚举转换、各 `require`，与 `validate` 相同（A1、A2）。Column 的循环 `x += 3` 在 `x ≤ 36` 时执行，`x ≤ 39 < 256`。
- `pc = popcount(numbers)`；`require(pc > 0)` 与 `maxPayout` 相同，且 `numbers ≠ 0`。`popcount` 的乘法 `numbers·POPCNT_MULT < 2^40 · 2^222 < 2^256`。
- 每轮：`mulDiv(amount, 37, pc)`，`pc ∈ [1, 36]`；上界 `reserved`，`F/P = 37/pc > 1`。
- `(1 << rolled) & numbers`，`rolled < 37`，无 revert。

### Keno

- `played = popcount(numbers) ∈ [1, 5]`（A2）。
- `_draw`：`available` 是 `uint8[15]` 内存数组；`randomIndex = (r % remaining) + i`，`remaining = 15 − i`，故 `randomIndex ≤ 14 − i + i = 14`，索引始终在界内。`unchecked` 块内的 `--remaining`、`++i` 在 `i < 5` 时无回绕。
- `matchCount = popcount(numbers & rolled) ≤ played`。`_gain(played, m)` 对所有 `m ≤ played ≤ 5` 返回正值（表中无零项），所以 `require(factor > 0)` 恒成立。
- 每轮系数 `≤ _gain(played, played) = F`，与 `maxPayout` 相同；`F ≥ 15000 > P = 10000`。

### Plinko

- `risk ∈ [0, 2]`（A2）。`bucket = Σ (roll2 & 1) ≤ 8 < 9`，`require(bucket < BUCKETS)` 恒成立。
- 每轮系数取自三张表，每张表的最大值分别是 15264、82714、246153，与 `_maxFactor(risk)` 相同；均 `> P`。
- `factor == 0`（高风险中间档）时跳过加法。

### SicBo

- `_validateBet(kind, value)` 与 `validate` 相同（A1、A2）。
- 骰子值 `uint8(roll2 % 6) + 1 ≤ 6`；`total = a + b + c ≤ 18`，`uint8` 内无溢出；`_faceCount ≤ 3`。
- `_totalFactor(total)` 只在 `KIND_TOTAL` 且 `total == value` 时以 `value ∈ [4, 17]` 调用，`_totalCount` 对该范围都返回正值，不会落入 `revert("total")`。`maxPayout` 对同一 `value` 调用同一函数。
- 每轮系数：Small/Big 20571，Any Triple 360000，Specific Triple 2160000，Total `⌊216·10000/count⌋ ≥ 80000`，Specific Double 135000，Single Face `20000·count ≤ 60000`；每项上界与 `_maxFactor(kind, value)` 相同，均 `> P`。

### Slots

- `profile == 0`（A2）。符号 `≤ 7`；倍数 `∈ {0, 2, 16, 64}`；每轮 `amount · multiplier ≤ 64·amount`。
- `reserved = stake · 64` 已在 `placeBet` 以 checked 乘法算出，`cumPayout ≤ 64·stake` 可表示。

### Baccarat

- `_factor(side)` 与 `validate` 相同（A1、A2）。
- 牌值 `≤ 9`；两张牌之和 `≤ 18`，`% 10` 后再加第三张 `≤ 18`，`uint8` 内无溢出；`_bankerDraws` 只做比较。
- 每轮系数 `∈ {22414, 21813, 104793}`，与 `maxPayout` 相同，均 `> P`。

## 5. 机械对照

`test/unit/CallbackDomainM4.t.sol` 与本文的证明一一对应，不替代证明：

- **sweep**：`test/utils/CasinoParameterDomain.sol` 枚举每个模块的完整参数域（每个参数取遍其 ABI 类型；Roulette 位图按 popcount 等价类取代表），每个已准入的参数在最低注额 99、1 轮下 `resolve`，并通过第 1 节的三条后置检查。共 31,259 个参数值。
- **grid**：对 `resolve` 算术所区分的参数类（Dice 分母 1 与 99、Roulette 36 个 popcount 类加两个 typed 代表、Keno 5 个 `played` 类各两组号码、SicBo 全部 35 个参数、Plinko 3 档、Baccarat 3 边、CoinToss 2、Slots 1）× 注额 {99，官方 10,000，Bank 在 25 轮下可准入的最大值} × 轮数 {1，25} × 止盈止损 {无，首胜即停，首负即停，一轮注额} × 随机字 {0，2^256−1，哈希}。共 6,912 个格点，其中 2,226 个触发提前停止（`refund > 0`）。
- **一致性**：准入拒绝的每个参数值，`resolve` 也拒绝。
- 所有断言通过（21 项测试，含 P5）。

证书复核方此前的抽样（69,984 个组合与 20,000 次 fuzz，无 revert）与本文一致。

## 6. 范围

- 本文覆盖八个受证模块的当前 runtime（`script/release/first-callback-domain-84532.json` 中的 codehash）。新模块或新版本需要重做。
- 本文依赖 A1–A7。其中 A6 来自 Bank 的资本上界，A7 来自 P5。如果治理把最低注额降到 99 以下，A7 不再由 P5 保证：`F ≥ P` 本身仍对所有已准入参数成立（表中每个系数都大于 `P`），所以后置检查仍然成立，但 k = 0 会进入回调域，这是证书层面的另一个问题。
- 模块是 `pure` 函数，不读存储、不调用外部合约，所以没有重入或状态相关的失败面。
