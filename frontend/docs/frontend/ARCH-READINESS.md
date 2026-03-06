# Architecture Readiness — Multi-chain / Multi-asset / Multi-language

本文件用于在进入 Milestone D/C 之后，持续评估架构是否对“多链/多资产/多语言”足够健壮。

## Multi-chain

### MUST
- 链支持范围由 **embedded releases** 决定（来自 release bundle）。
- 运行时必须使用钱包当前 `chainId` 选择对应 embedded release。
- Facts store 与 cursor 必须按 `(chainId, hubAddress)` 隔离。

### SHOULD
- Indexer 支持多实例（每条链一个 worker），但 UI 只激活当前链。
- Ops 展示 `confirmations/safeHead/lag` 等与链参数相关的指标。

## Multi-asset

### MUST
- 资产列表来自 embedded release `assets[]`。
- spender 永远是 per-asset Bank；approve policy 统一在 SDK。
- 所有金额运算使用 `bigint`，禁止 JS number。

### SHOULD
- 支持 token metadata 缓存（symbol/decimals/logo）并以 release manifest 为优先。
- 资产排序/展示属于产品层，可本地维护但不得影响协议语义。

## Multi-language (i18n seam)

### MUST
- 文案必须集中管理（copy module），禁止散落字符串。
- 错误必须映射 DomainError；用户可见文案不直接暴露 raw revert。

### SHOULD
- Phase-2 引入 `next-intl` 或等价方案时，copy module 作为适配层。
- Storybook 需要支持在不同 locale 下渲染关键组件（后置）。