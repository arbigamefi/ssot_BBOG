# Gate-D Cleanliness — No Legacy / No Compat / No Drift

本 gate 用于防止 Milestone D 期间引入“垃圾代码/兼容代码/漂移源”。

## MUST NOT

- **MUST NOT** 出现旧协议/旧字段兼容：`PoolV2/VRFHubV2/wager/subgraph schema` 相关代码。
- **MUST NOT** 在 `apps/web/features/**` 或 `packages/ui/**` 直接 import：
  - `viem` / `wagmi` / `ethers`
  - `@ssot/ssot/src/**` deep import
  - `getLogs` / `readContract` / `simulateContract` / `writeContract`
- **MUST NOT** hardcode：
  - 合约地址
  - `gameId`（必须来自 release `gamesMeta`）
  - 资产列表（必须来自 release `assets`）
- **MUST NOT** 引入 “临时 TODO” 而不带 issue/rationale。

## SHOULD

- 新增系统组件必须有 Storybook story（覆盖 empty/loading/error）。
- 新增写交易必须走 tx pipeline（simulate → execute → receipt → journal）。

## Review Checklist

- 本 PR 是否新增/修改了 SDK public API？若是，是否更新了 SPEC 与相关 ADR。
- 是否新增了用户可见文案？若是，是否遵循 COPY-STYLE 与 i18n seam。
