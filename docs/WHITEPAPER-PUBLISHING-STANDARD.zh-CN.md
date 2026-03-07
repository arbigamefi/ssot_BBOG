# ArbiGameFi 白皮书发布规范

> 项目：`ArbiGameFi`
>
> 文档系列：`Whitepaper System`
>
> 文档编号：`AGF-WP-SYSTEM-2026.03`
>
> 状态：`Working Standard`
>
> 语言：`zh-CN`
>
> 日期：`2026-03-07`

## 1. 目的

本规范用于统一 ArbiGameFi 白皮书文档族的对外表达方式，避免以下问题反复出现：

- 把 `SSOT` 当成项目品牌名
- 技术事实与商业设想混写
- 长版和短版文档口径不一致
- 对外版本缺少统一编号、状态和角色说明

本规范不定义协议本身的技术规则，而是定义白皮书文档的发布规则。

## 2. 品牌与术语规则

### 2.1 品牌层

- 对外项目、平台、协议主体名称统一使用 `ArbiGameFi`
- 不再把 `SSOT` 当作项目名或产品名使用

### 2.2 架构层

- `SSOT` 仅表示 `Single Source of Truth`
- `SSOT` 仅用于描述底层账本原则、事实源模型或设计方法

### 2.3 推荐表述

推荐用法：

- `ArbiGameFi`
- `ArbiGameFi protocol`
- `ArbiGameFi platform`
- `ArbiGameFi, built on an SSOT architecture`

不推荐用法：

- `SSOT 协议` 作为项目名
- `SSOT 平台`
- `SSOT 产品`

## 3. 文档族定义

### 3.1 技术白皮书

- 文件：`docs/WHITEPAPER.zh-CN.md`
- 角色：协议技术事实源的对外正式说明
- 重点：架构、会计、状态机、随机数、治理、风控、边界
- 禁止：把未来 token、商业路线或未实现能力写成现状

### 3.2 产品与商业白皮书

- 文件：`docs/WHITEPAPER.product.zh-CN.md`
- 角色：基于当前协议能力的产品和商业叙事
- 重点：用户价值、LP 价值、渠道价值、增长飞轮、商业模式、路线图
- 禁止：篡改技术边界；把尚未实现的机制写成已上线能力

### 3.3 执行摘要

- 文件：`docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md`
- 角色：对外快速阅读版
- 重点：一句话定义、价值主张、可信点、商业模式、最现实路线
- 禁止：过多技术细节；与两份长版冲突

## 4. 文档元数据标准

每份白皮书文档顶部都应统一包含以下字段：

- 项目
- 底层架构
- 文档系列
- 文档编号
- 状态
- 语言
- 日期
- 目标读者或用途
- 关联文档

## 5. 文档编号规则

建议使用以下模式：

- 技术白皮书：`AGF-WP-TECH-YYYY.MM`
- 产品白皮书：`AGF-WP-BIZ-YYYY.MM`
- 执行摘要：`AGF-BRIEF-YYYY.MM`
- 发布规范：`AGF-WP-SYSTEM-YYYY.MM`

如果同月需要多次对外修订，可加后缀：

- `AGF-WP-TECH-2026.03-r1`
- `AGF-WP-TECH-2026.03-r2`

## 6. 状态字段规则

推荐状态：

- `Internal Draft`
- `External Draft`
- `Review Copy`
- `Release Candidate`
- `Published`

当前文档族默认处于 `External Draft` 或 `Working Standard`，意味着：

- 已可对外分享
- 但仍允许继续打磨措辞、图示和版式

## 7. 中英结构规则

### 7.1 中文为主

当前文档族的主语言为 `zh-CN`。

### 7.2 英文摘要为辅

每份对外文档建议至少提供一个英文入口：

- 长版文档：`Abstract (EN)`
- 摘要文档：`One-line Summary (EN)` 或短版英文摘要

目标不是形成完整双语全文，而是让英语读者快速理解文档角色与核心命题。

## 8. 图示规则

技术白皮书中的图示以解释事实源、状态机和系统边界为主，推荐：

- 架构图
- 生命周期状态机
- 预算或价值流说明图

产品白皮书中的图示以解释增长和产品层路径为主，推荐：

- 用户路径图
- 增长飞轮图
- 房间层级图

执行摘要中尽量少图，保持短读。

## 9. 一致性检查清单

每次发布前至少检查：

- 是否把 `ArbiGameFi` 和 `SSOT` 混用了
- 技术白皮书是否仍只陈述已实现技术事实
- 商业白皮书是否仍明确区分现状与未来
- 摘要版是否没有引入新承诺
- 三份文档中的一句话定义是否不冲突
- 文档编号、状态、日期和关联文档是否已更新

## 10. 当前文档族映射

| 文件 | 角色 | 主要读者 |
| --- | --- | --- |
| `docs/WHITEPAPER.zh-CN.md` | 技术白皮书 | 审计、LP、技术合作方 |
| `docs/WHITEPAPER.product.zh-CN.md` | 产品与商业白皮书 | 运营、BD、投资人 |
| `docs/ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md` | 对外摘要 | 合作方、顾问、首次阅读者 |
| `docs/WHITEPAPER-PUBLISHING-STANDARD.zh-CN.md` | 发布规范 | 核心贡献者 |
