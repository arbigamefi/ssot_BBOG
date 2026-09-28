# 注单索引的备份与恢复

注单索引是链上事件的读模型，合约仍是权威数据源。本文描述当前自托管 PostgreSQL 的运行步骤，
不表示仓库已经上线或已有成功备份。首次启动见 [索引运行手册](bet-index-production.md)。

## 备份配置

[bet-index-backup.sh](../../../script/ops/bet-index-backup.sh) 在目标 Docker 容器内运行
`pg_dump`，凭据留在容器环境中。配置 `BACKUP_PG_CONTAINER`、`BACKUP_DIR` 和 `BACKUP_KEEP`
（默认保留最新七份）；核对容器实际身份，不依赖示例名称。脚本读取 `ALERT_CONFIG_FILE`，默认
`/opt/arbigamefi/ops/alert.env`。

备份先写 `.partial`，用 `pg_restore --list` 确认每张源表都有表数据项后改为 `.dump`。
目录权限为 0700，文件权限为 0600。这是文件完整性检查，不能替代实际恢复和业务读验收。
成功写 journal；失败写 journal，并尝试向已配置的 Telegram 通道通知。

仓库提供 [service](../../../script/ops/systemd/arbigamefi-db-backup.service) 和
[timer](../../../script/ops/systemd/arbigamefi-db-backup.timer)。安装并核对路径后，timer 在每天
03:30 UTC 运行，最多随机延后十五分钟，并补跑停机期间错过的任务。仓库内存在单元文件不等于
主机已启用它。

```sh
systemctl start arbigamefi-db-backup.service
journalctl -t arbigamefi-db-backup --since today --no-pager
```

## 恢复验证

[bet-index-restore-drill.sh](../../../script/ops/bet-index-restore-drill.sh) 接受备份文件路径，
不传参数时选择最新一份。它使用源容器的镜像，创建无网络、内存数据盘的临时容器，完成后删除；
源库只读。

当前脚本检查源表均恢复、恢复行数不超过源库且至少一张表非空。该行数比较适用于两次观察间没有
删表、重建或 reorg 替换的场景。全新空库或发生重组时，需要结合实际数据变化判断，不能把失败
直接认定为备份损坏，也不能仅凭行数通过就认定应用恢复成功。

恢复到独立目标后，用相同应用版本核对链/Hub 身份、事件和游标，验证查询以及从备份位置继续重放。
记录备份时间、恢复目标、结果和实际恢复耗时，不预填尚未发生的演练结果。

## 事故恢复与主机丢失

替换活动数据库前，确认事故授权、目标库和备份身份，停止所有写入该库的 worker，等待在途写入结束。
先在独立目标完成恢复验证，再执行批准的切换。启动当前 keeper 后，检查游标继续推进、遗漏事件重放、
未终结投注、批次激活和历史回收权；重复事件不得形成重复债务。

本机备份无法抵御整台主机丢失。按恢复时间要求配置独立存储副本，或明确接受从已验证 release 区块
重建读模型的成本。使用当前空 schema，恢复链历史，不从任意更晚游标开始。若以后加入无法从链上
重建的数据，备份范围与恢复方案必须一并更新。
