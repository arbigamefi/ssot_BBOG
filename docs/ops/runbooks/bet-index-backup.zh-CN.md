# 注单索引数据库的备份与恢复

## 生产现状

注单索引运行在生产主机的 Docker PostgreSQL 16 里：容器 `arbigamefi-v15-postgres-1`，数据卷 `arbigamefi-v15_bet_index_postgres_data`。[`bet-index-production.md`](bet-index-production.md) 预设的是托管数据库，但生产环境没有使用托管服务。2026-09-27 之前，这个库没有任何备份。

库里 7 张表都由链上事件推导，包括注单、GameHub 事件、资金池存取记录、扫描游标，以及尚未启用的体育相关表。合约才是权威数据源，这个库只是读模型，没有链下数据。

## 每日备份

`arbigamefi-db-backup.timer` 每天 03:30 UTC 运行 `/opt/arbigamefi-v15/ops/bet-index-backup.sh`，最多随机延后 15 分钟。主机关机期间错过的那次，开机后会补跑。单元文件的源码在 `script/ops/systemd/`。

每次备份按以下步骤进行：

1. 在容器里用 `pg_dump` 导出 custom 格式，数据库凭据不离开容器。
2. 先写成 `/var/backups/arbigamefi/bet-index/bet-index-<UTC 时间>.dump.partial`。
3. 用 `pg_restore --list` 读回备份，确认线上每张表都有对应的表数据项之后，才去掉 `.partial` 后缀。因此凡是 `.dump` 文件都是完整的；被中断的运行留下的 `.partial` 会在下次运行时删除。
4. 目录权限 0700，文件权限 0600。只保留最新 7 份（`BACKUP_KEEP`）。

成功只写 journal。失败也写 journal，并且在 `alert.env` 配置了 Telegram 时推送 `[BACKUP FAILED] arbigamefi bet-index`，内容是失败原因。

```sh
systemctl start arbigamefi-db-backup.service        # 手动备份一次
journalctl -t arbigamefi-db-backup --since today --no-pager
ls -l /var/backups/arbigamefi/bet-index/
```

## 恢复演练

```sh
/opt/arbigamefi-v15/ops/bet-index-restore-drill.sh          # 最新一份
/opt/arbigamefi-v15/ops/bet-index-restore-drill.sh <dump>   # 指定一份
```

脚本把备份恢复到一个临时 PostgreSQL 容器里：与生产使用同一镜像，不接网络，数据放在内存里，演练结束后自动删除。它会逐表对比恢复出的行数和线上行数，对生产库只读。通过需要同时满足三个条件：

- 线上每张表都已恢复；
- 每张表恢复出的行数都不超过线上，因为从备份到演练之间，表只会增长；
- 至少有一张表有数据。

每月跑一次，改动表结构之后也跑一次，并把结果记在下面。

| 日期       | 备份                                             | 结果                                                                                                    |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 2026-09-27 | `bet-index-20260927T012524Z.dump`（32,461 字节） | 通过：7 张表全部恢复，行数与线上一致（资金池存取记录 3、注单 28、事件 84、游标 4，体育相关 3 张表为 0） |

## 事故时恢复到生产

覆盖生产库需要单独的事故批准，这一点沿用 `bet-index-production.md` 的规定。先停两个 keeper，避免恢复过程中写入：

```sh
cd /opt/arbigamefi-v15/frontend
docker compose -p arbigamefi-v15 -f compose.production.yml stop keeper-primary keeper-testnet-primary
docker exec -i arbigamefi-v15-postgres-1 sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' < /var/backups/arbigamefi/bet-index/bet-index-<UTC 时间>.dump
set -a; . ./images.env; set +a
docker compose -p arbigamefi-v15 -f compose.production.yml up -d --no-build --pull never --no-deps keeper-primary keeper-testnet-primary
```

恢复后，扫描游标停在备份时的位置。keeper 会从那里继续扫描，补上之后的区块。事件表以 `(chain_id, tx_hash, log_index)` 为主键，重复写入不会产生重复数据。

## 主机丢失

本机备份和数据库在同一台主机上，主机丢失时两者会一起丢失。这种情况下从链上重建：

1. 在新主机上部署同一版本。
2. 数据库为空时，keeper 会从发布区块（`KEEPER_START_BLOCK` 留空时使用发布区块）开始扫描，重建索引，并重新检查历史注单是否都已结算。
3. 也可以用 `pnpm -C frontend keeper:backfill` 做一次有界重放，步骤见 `bet-index-production.md`。

2026-09-27 的重建成本：

| 链           | 发布区块   | 当前区块   | 窗口（1,000 区块） |
| ------------ | ---------- | ---------- | ------------------ |
| Base 主网    | 51,692,502 | 51,841,451 | 149                |
| Base Sepolia | 47,140,467 | 47,351,981 | 212                |

每个窗口是 GameHub 和资金池各一次 `eth_getLogs`：(149 + 212) × 2 × 255 ≈ 18 万 Infura 额度，不到每日免费额度 300 万的 7%。耗时方面，每轮最多扫 50 个窗口，事件扫描每分钟一轮，几分钟就能追上；资金池每 5 分钟一轮，约 25 分钟追上。区块越往后增长，重建成本也按窗口数线性增加。

目前没有异地副本，因为所有数据都能从链上重建。库里一旦出现链下数据（例如链下的推荐归因或用户设置），就必须增加加密的异地副本。
