# ADR-025 — Forms, Units, and Validation

**Status**: Accepted

## Context
Web3 前端最常见且最隐蔽的 bug 来自：
- decimals 处理错误（USDC 6 vs 18）
- number 精度丢失（JS number）
- mask/bitset 解析与展示不一致

SSOT 作为机构级系统，必须把金额/单位/校验统一为可审计规范。

## Decision
- 所有金额内部表示 **MUST** 为 `bigint`
- 所有 parse/format **MUST** 经统一工具函数完成
- 所有表单输入 **MUST** 有边界校验、错误文案统一

### Units Helpers
- `parseUnitsSafe(decimalString, decimals) -> bigint`
- `formatUnitsSafe(amount, decimals) -> string`
- `formatToken(amount, assetMeta) -> string`（展示层）

### Validation Rules (MUST)
- Stake
  - amountPerRoll > 0
  - betCount ∈ [1, MAX_BET_COUNT]
  - amountPerRoll * betCount 不溢出，且 <= 用户余额（余额不足应提示）
- VRF
  - quoteVRFFee(betCount) 成功，否则 plan 失败
- Game params
  - Dice cap：范围由游戏规则定义
  - Coin toss：bool
  - Roulette/Keno mask：必须符合 bitset 范围（uint40），且不能为 0（若规则禁止）
- House edge
  - maxHouseEdgeBps >= effectiveHouseEdgeBps（若可计算）

### Copy & Error
- 校验错误 **MUST** 映射为 DomainError（或 ValidationError），不得直接 throw 原始错误
- 文案 **SHOULD** 集中在 copy 模块（i18n seam）

## Consequences
- 开发成本上升，但减少隐性资金/单位错误
- 便于 UI/UX 团队统一交互与错误呈现
