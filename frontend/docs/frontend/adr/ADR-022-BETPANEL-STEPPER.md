# ADR-022 — BetPanel Stepper (Plan → Stepper → Execute)

**Status**: Accepted

## Context
SSOT 的写交易路径天然是多步的（approve + action），并且下注还需要 VRF fee（native）与 stake（ERC20）并行处理。若每个页面自行实现交易流程，会导致：
- UX 不一致（按钮状态/错误处理/回执/重试）
- 审计难度高（交易生命周期无法统一记录）
- 容易破坏 SDK 边界（页面直接调用 wagmi/viem）

## Decision
实现一个**统一的 BetPanel Stepper 状态机**，所有下注页面必须复用。

### State Machine
`Idle → Planning → NeedsApproval | Ready → Submitting → Mined → Reconciled | Failed`

### Contract
- UI 必须调用 `sdk.hub.planPlaceBet()` 生成 `PlaceBetPlan`
- UI 必须以 `plan.steps[]` 驱动 stepper，逐步执行 `approve` / `placeBet`
- 每一步写交易都必须 **simulateContract preflight**
- journal 在 `submitted/mined/failed` 必须落库
- 对 placeBet 必须执行 `reconcile(tx→betId)`

## Alternatives Considered
1) 页面内手写 async/await 流程：拒绝（不可审计，易漂移）
2) 仅在 SDK 内部做 approve + placeBet “黑盒”：拒绝（UX 不透明，无法逐步签名）

## Consequences
- 交易 UX 一致，支持审计与可观测
- 需要编写系统组件（Stepper/Preview/Error）与状态机单测
