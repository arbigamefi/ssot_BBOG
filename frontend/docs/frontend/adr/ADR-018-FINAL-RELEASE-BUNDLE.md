# ADR-018: Final Release Bundle Contract (No `out/`)

## Status
Accepted

## Context
为实现“前端对接层也是 SSOT”，我们需要一个合约侧可验证、前端可直接消费的 Release Bundle。
过去方案曾允许前端从 Foundry `out/` 抽 ABI，但这会引入：体积膨胀、结构不稳定、以及“前端推导 ABI”的非 SSOT 行为。

## Decision
合约工程发布 **FINAL SHAPE Release Bundle**，前端 `ssot:sync` **只允许** 从该 bundle 同步：

- `deployments/frontend-manifest-latest.json`
- `deployments/golden-vectors-latest.json`
- `deployments/release-latest.json`
- `deployments/latest.json`（可选，仅审计用途）
- `abis/index.json` + `abis/*.abi.json`

并生成：embedded release、同步 ABI、以及 fixtures 镜像。

## Consequences
- ✅ 前端对接数据完全由合约 release bundle 决定，避免 drift。
- ✅ 可通过 golden vectors 做 bytes 级一致性证明。
- ✅ CI 可实现 digest guard。
- ❌ 若合约侧未提供 `abis/`，前端将拒绝 sync（这是刻意的 gate）。
