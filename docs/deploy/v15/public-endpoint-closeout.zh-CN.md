# v1.5 公网 TLS 与监控部署验收

核验窗口：2026-09-24 07:50–07:59 UTC。修复来自 PR #66，候选提交 `88fe786079de8a9af8e4c9e158aa7033db3006d9`，全部八项 GitHub 检查通过后合并为 `337d77e7e16397c462cf6b9653ab0c6e9545a66e`。

## 已部署与核验

- Caddy 为 `arbigamefi.com`、`www.arbigamefi.com`、`dapp.arbigamefi.com` 分别取得 Let's Encrypt 正式服务器证书。先保留主域名旧证书选择完成签发，再原位更新 bind-mounted Caddyfile 并 graceful reload。
- 07:56:38 UTC 从 VPS 的 `127.0.0.1:443` 对三个实际 SNI 分别验证：系统 CA、服务器用途、域名全部通过，协商 TLS 1.3。证书到期时间为 2026-12-23，续期由 Caddy 和现有数据卷管理。
- Cloudflare 配置规则只匹配以上三个主机名，启用 `ssl=strict`，写入后读取验证一致。区域默认仍为 `full`，没有改动同区域 GoDaddy 服务的回源设置。
- 07:57:42 UTC 公网主站返回 200；两个别名返回 301。测试路径 `/casino/receipt/84532/14?from=legacy` 完整保留到主域名，先前的别名 525 未再复现。对应 Ray ID：主站 `a4003d5a2e2af8b7-LAX`，www `a4003d59e8d0c74e-LAX`，dapp `a4003d5a8f2b2b8a-LAX`。
- `GET /api/healthz?chainId=8453` 与 `?chainId=84532` 均为 HTTP 200、`status=ok`；两个 keeper 状态 running、queueDepth=0，持久化索引配置正常。
- 安装 PR #66 的诊断 helper 和 alert wrapper，保留原 timer、通知配置与间隔。07:58:21 UTC 原 timer 自然触发生成最新诊断：HTTP 200、curl 退出码 0、总耗时 0.144910 秒、Ray `a4003e572ee5cb36-SIN`；诊断文件权限 0600。没有手动触发通知。
- 五个生产容器的 ID、启动时间和镜像均与迁移前相同；应用、数据库和 keeper 没有重启。没有执行链上交易。

部署内容 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| Caddyfile | `54d2a597fc870a67e32b097d11f3a933f0faf168d8a05eba97e3d11e6ed944ec` |
| compose.production.yml | `4abce80d80e09383b79093caada31820509cb9f138776427ec0a2ed5d91ebf98` |
| healthz-probe.py | `cc334dbbf2af70ef459347c41ae81a726d260093ed3081361ffbdd83af2b2da6` |
| healthz-alert.sh | `ad1bfd29d4aa47ce7310d7391fab2fc2bfc9ef62d5cfdb7256003ffaba699d9d` |

## 清理与限制

确认运行中的 Caddy 配置不再引用旧证书后，删除专用目录中的旧证书和私钥文件，移除两个旧 `CLOUDFLARE_ORIGIN_*` 环境项及 Compose 中旧证书挂载声明，并验证 Compose 配置。没有读取或导出旧私钥内容。迁移临时文件已从服务器和 Caddy 容器清除。当前 Caddy 容器仍保留空旧目录的 bind mount，下一次正常重建时按新 Compose 自动去除；不为移除空挂载单独中断代理服务。

主域名 ACME 验证期间曾收到 Cloudflare 520，自动重试后签发成功。这次验收证明错误证书和别名 TLS 配置已修复，**不能证明此前偶发二十秒无响应或历史 522 的根因已修复**。后续故障由既有监控保存 Ray ID、分阶段耗时和本机对照，按[故障定位 runbook](../../ops/runbooks/public-healthz-timeouts.zh-CN.md)继续分析。

在本记录的 07:59 UTC 窗口，主网新增 LP 与业务验收只有[分叉模拟证据](base-mainnet-acceptance-prepared.json)。13:13 UTC 更新：用户已完成新增 4 USDC LP 和第一笔 Dice，真实 VRF、keeper 自动结算与网页凭证一致，见[实时业务验收记录](base-mainnet-live-acceptance.json)；其余游戏仍待验收。[14 个历史 Bank](legacy-bank-closeout.zh-CN.md)仍等待旧治理钱包暂停。因此这份记录不是整个项目已全部完工或所有历史链上义务清零的声明。
