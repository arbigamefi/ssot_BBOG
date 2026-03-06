# SSOT Frontend v2 SPEC (FINAL SHAPE)

本文件是“合约式”规范：以 **MUST / SHOULD / MAY** 条款描述可审计行为。

- **MUST**：必须满足，否则视为不合格。
- **SHOULD**：强烈建议满足；若不满足必须在 ADR 中明确风险与替代方案。
- **MAY**：可选能力。

> 本 SPEC 面向“最终形态”：前端只消费合约工程发布的 **Release Bundle**（lock + manifest + abis + vectors）。

---

## 1. Definitions

- **Release Bundle**：由合约工程生成的发布包（目录或 `.tar.gz`），包含前端运行所需的地址 / ABI / vectors / lock。
- **Release Lock**：`deployments/release-latest.json`（`digest` + 签名），用于锁定单一事实源。
- **Frontend Manifest**：`deployments/frontend-manifest-latest.json`（addresses + games + assets）。
- **Golden Vectors**：`deployments/golden-vectors-latest.json`（编码/调用的基准向量）。
- **ABI Index**：`abis/index.json`（本 bundle 内 ABI 的目录与哈希）。
- **Facts Store**：本地 IndexedDB（Dexie），以 *Hub events* 为事实源派生 `bets` 状态机。

---

## 2. Bundle Contract (Single Source of Truth)

前端 **MUST** 以 Release Bundle 作为唯一真相，不得通过“扫描链上状态/从其它来源推导”来生成权威地址/ABI。

### 2.1 Bundle layout (MUST)

Release Bundle **MUST** 同时包含：

```
<bundle-root>/
  deployments/
    frontend-manifest-latest.json
    golden-vectors-latest.json
    release-latest.json
    latest.json              # optional (audit)
  abis/
    index.json
    *.abi.json
  MANIFEST.sha256            # optional
```

### 2.2 Lock binding (MUST)

- 前端运行时配置 **MUST** 同时使用：`release-latest.json` 的 `digest` + `frontend-manifest-latest.json` 的地址/映射。
- 若 `chainId` 不一致、或关键字段缺失（Hub/VRFHub/BankRegistry/至少一个资产/至少一个 game），前端 **MUST** 进入 **read-only**（禁止写交易）。
- 如果 manifest 自带 `releaseDigest` 字段，则 **MUST** 与 lock digest 完全一致；不一致则 **MUST** read-only。

---

## 3. ssot:sync (MUST)

`pnpm ssot:sync` **MUST** 支持：

- `--from <bundle-root>`
- `--from <bundle>.tar.gz`（自动解压到临时目录）

并生成三类输出：

1. **Embedded release**：`packages/ssot/src/release/embedded/chain-<chainId>.json` + `embedded/index.ts`
2. **Synchronized ABIs**：`packages/ssot/src/abis/release/chain-<chainId>/*` + `abis/release/index.ts`
3. **Auditable fixtures mirror**：`packages/ssot/src/fixtures/release-bundles/chain-<chainId>/<block>-<digestShort>/...`

`ssot:sync` **MUST NOT** 读取 Foundry `out/` 等目录来“推导 ABI”（这不是最终形态）。

---

## 4. ABI Usage (MUST)

- SDK 的 Hub/Bank/VRFHub/Modules 交互 **MUST** 使用 release bundle 同步来的 ABI（`packages/ssot/src/abis/release/...`）。
- 手写 minimal ABI（除 ERC20 标准必要子集外）**MUST NOT** 出现在仓库中。

---

## 5. SDK Boundary (MUST)

- `apps/web/features/*` 与 `packages/ui` **MUST NOT** 直接依赖 `wagmi/viem/ethers`。
- 所有链 IO（read/simulate/write/getLogs）**MUST** 通过 `@ssot/ssot` 暴露的 SDK 或 Runtime API。

---

## 6. Transaction Pipeline Contract (MUST)

任何写交易（approve/placeBet/deposit/redeem/refund/claim）**MUST**：

1. **Preflight**：`simulateContract` 成功后才允许发交易。
2. **Step execution**：若需要多步（approve → action），必须显式 stepper。
3. **Receipt**：等待 receipt（可配置 confirmations）。
4. **Journal**：在 `submitted / mined / failed` 阶段记录到 TxJournal（包含 releaseDigest）。
5. **Reconcile (if applicable)**：对于 bet，必须把 tx 与 betId 关联。

---

## 7. BetPanel Stepper Contract (MUST)

BetPanel 交互 **MUST** 标准化为状态机（见 ADR-022）：

- `Idle` → `Planning` → `NeedsApproval | Ready` → `Submitting` → `Mined` → `Reconciled | Failed`

并满足：

- `planPlaceBet()` 输出 **MUST** 包含：`steps[]`、`preview`、`warnings[]`、`txMeta{chainId,releaseDigest}`。
- UI **MUST** 在同一布局中展示 preview（stake / vrfFee / spender / maxHouseEdgeBps）。
- UI **MUST** 支持 “Mined but Unreconciled” 状态，并允许用户触发 `reconcile()`。
- UI **MUST** 仅展示 `DomainError`，不得展示 raw selector / revert data。

---

## 8. Reconcile tx → betId (MUST)

对 `placeBet` 的结果，系统 **MUST** 尝试获得 betId，并把关联写入 TxJournal。

优先级（见 ADR-023）：

1. **Receipt logs**：从 receipt.logs 解析 Hub `BetPlaced`（按 address + topic）。
2. **Facts Store**：从 `hubEvents` 按 `txHash` 搜索 `BetPlaced`。
3. **Window search (fallback)**：按 `{blockNumber ± window}` + `placedBy == account` 筛选。
4. 若仍无法关联，**MUST** 进入 `Mined but Unreconciled`，并允许用户手动输入 betId 绑定。

---

## 8.1 TxJournal / Params Persistence (MUST)

- 对 `placeBet`，TxJournal **MUST** 持久化 `metaJson`，以保证 params 可解码与可审计（参见 ADR-023 与 Milestone D3）。
- `metaJson` **MUST** 至少包含：
  - `gameId`
  - `assetId`
  - `paramsHex`（用于 params 解码；不可仅保存 paramsHash）
  - `stakeSpec`（可为对象或编码字符串）
  - `placedBy`（account/address）
  - `releaseDigest`
- `metaJson` **MUST** 为 JSON-safe（不得包含 `bigint`、函数、循环引用）。
- Bet detail 页展示 params 时 **SHOULD** 优先从 `metaJson.paramsHex` 解码；若缺失，则 **MUST** fallback 展示 `paramsHash` 并提示无法解码。
- Reconcile 成功后，系统 **MUST** 更新 TxJournal：写入 `betId` 与 `betIdSource`（`receipt|facts|window|manual`）。

## 9. Allowance Policy (MUST/SHOULD)

- 默认策略 **MUST** 为 *Exact approval*：当 `allowance < required` 时，调用 `approve(spender, required)`（approve 是 SET，不是 ADD）。
- 对 “require reset” 的 token（USDT 风格）**SHOULD**：`approve(spender, 0)` → `approve(spender, required)`。
- Unlimited approval **MAY** 提供，但 UI **MUST** 明确风险提示并默认关闭。

---

## 10. Units & Validation (MUST)

- 所有金额运算 **MUST** 使用 `bigint`。
- parse/format **MUST** 通过统一工具（例如 `parseUnitsSafe/formatUnitsSafe`），禁止在组件内自行实现。
- 表单校验 **MUST** 覆盖：decimals、最小 stake、betCount 上限、mask 合法性、houseEdge 容忍度边界。

---

## 11. Indexer Execution Model (SHOULD)

- Indexer **SHOULD** 运行在 Web Worker 中。
- Runtime **SHOULD** 暴露 `confirmations / safeHeadBlock / lagBlocks / lastError` 用于 ops 可视化。

---

## 12. Multi-chain / Multi-asset (MUST)

### 12.1 Multi-chain
- 运行时 **MUST** 以钱包连接的 `chainId` 选择 embedded release。
- wallet connector **MUST** 只启用 embedded releases 中出现的链（`embeddedChainIds`）。
- 连接到未支持链时，应用 **MUST** read-only。

### 12.2 Multi-asset
- 资产列表 **MUST** 来自 embedded release（`release.assets[]`）。
- approve 的 spender **MUST** 是 `Hub.bankFor(asset)` 返回的 Bank（或 manifest 里显式 bank 地址）。

---

## 13. i18n seam (SHOULD)

- Phase-1 不要求完整多语言迁移，但结构 **SHOULD** 为 i18n 留 seam（见 ADR-020）。
- user-facing 文案 **SHOULD** 集中在 copy 模块中，避免散落在组件内部。
