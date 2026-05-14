# Gate-D — Milestone D Execution Gates

本文件定义 Milestone D（Feature End-to-End）在“合约式”节奏下的 gate。

## D0 — Docs Gate (MUST)

进入任何功能实现（D1+）之前必须满足：

- SPEC 已补齐并冻结：BetPanel stepper contract / reconcile contract / allowance policy / forms & units validation
- ADR 已接受：ADR-022..ADR-025
- Page specs 更新完成：Games / Bets / Liquidity / Claims / Referral / Account
- 代码边界 lint 规则保持：feature 不得 import wagmi/viem/ABI

**Exit Criteria**

- 无未定义的 UX/状态机/校验规则 “unknowns”

## D1 — Stepper Framework Gate (MUST)

- 存在可复用的 `GameRoomBetPanel + usePlaceBetStepper + plan preview`（系统组件）
- 纯状态机单测覆盖：成功/失败/重试/不可逆
- Storybook 覆盖所有 stepper states

## D2 — Games Gate (MUST)

- 4 个游戏输入表单 + 校验 + stories
- gameId/encoding 全部来自 release `gamesMeta`

## D3 — Reconcile Gate (MUST)

- `txHash → betId` reconcile 按 ADR-023 实现
- 支持 `Mined but Unreconciled` 和手动绑定

## D4 — Liquidity Gate (MUST)

- deposit/redeem 使用标准 stepper
- allowance policy 与 ADR-024 一致

## D5 — Referral Gate (SHOULD)

- bind referrer 使用标准 stepper
- 不影响非 referral 用户下注

## D6 — Account/Bets Gate (MUST)

- `/account` 可审计：balances/allowances/refundCredit/txJournal
- `/bets` list/detail 完整闭环

---

## Cleanliness Gate (MUST)

见 `docs/frontend/GATE-D-CLEANLINESS.md`。
