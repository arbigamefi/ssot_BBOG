# 公网 healthz 超时排查

生产现有的 `arbigamefi-healthz.timer` 每两分钟运行一次健康检查。v1.5 脚本源码为 `script/ops/healthz-alert.sh` 和同目录的 `healthz-probe.py`，部署位置是 `/opt/arbigamefi-v15/ops/`；保留现有 `alert.env`、通知渠道、状态文件和 timer。

## 新增的故障证据

检查必须同时满足 curl 成功、HTTP 2xx、JSON `status=ok` 才算成功。部分响应后的传输超时或带有 `status=ok` 的 HTTP 错误均不能报健康。

每次探测原子更新 `${ALERT_STATE_FILE}.probe.json`（默认 `/var/lib/arbigamefi/healthz-alert.state.probe.json`，权限 0600）。仅保存时间、HTTP 状态、curl 退出码、远端 IP、DNS/TCP/TLS/首字节/总耗时，以及响应存在时的 Cloudflare Ray ID；不保存响应正文、Cookie、认证头或带参数 URL。临时响应随探测结束删除。

公网失败时额外探测本机 `http://127.0.0.1:3400/api/healthz`，超时上限五秒。这是应用层对照，不经过 Caddy 或 Cloudflare；它成功也不能解除公网告警。公网探测仍使用正常 TLS 校验，连接上限五秒、总时限二十秒，不自动重试或跟随跳转。

故障详情每次写入 journal 的 `[DIAGNOSTIC]`，受现有 journal 的 256 MB/14 天保留策略约束。既有通知只在状态变化、恢复或达到六小时提醒间隔时发送，健康期间不增加通知。不要手工运行告警脚本来测试通知渠道。

## 如何分层定位

```sh
journalctl -t arbigamefi-healthz --since '30 minutes ago' --no-pager
cat /var/lib/arbigamefi/healthz-alert.state.probe.json
```

- 公网失败、本机成功：应用当时可响应；继续核对 Caddy、源站网络和 Cloudflare 请求。不能单凭此结果指定其中某一层为根因。
- curl 退出码 6：优先检查服务器 DNS 解析；退出码 7：连接失败；退出码 28：结合四阶段耗时检查发生超时的位置。
- HTTP 522：保存 Ray ID 和精确 UTC 时间，核对 Cloudflare 到源站的 TCP 连通性、防火墙和源站负载。[Cloudflare 官方说明](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/)列出该错误的连接超时情形；本机 curl 的二十秒超时不是 HTTP 522 的等价证据。
- 公网和本机均失败：结合容器健康、应用/数据库日志与资源状态继续排查；仍不直接认定是应用故障。
- 公网恢复：保留上一故障的 journal 记录，不用当前成功覆盖“根因未定位”的结论。

## 更新方式

先通过 ops 测试与 CI，再将两个经校验的文件安装到 `/opt/arbigamefi-v15/ops/`，两者权限为 0755。先安装 helper，再原子替换 alert wrapper。保留 `/opt/arbigamefi-v15/ops/alert.env` 和 systemd unit，不重启 Web、keeper 或数据库，也不新增 timer。

可单独运行以下只读探测器检验安装；它不会读取通知配置、发送通知或改写监控状态：

```sh
python3 /opt/arbigamefi-v15/ops/healthz-probe.py https://arbigamefi.com/api/healthz
```

用于对照的 `HEALTHZ_LOCAL_URL` 只允许 HTTP loopback 地址。`ALERT_CONFIG_FILE` 可用于隔离测试；生产使用默认配置位置。

## 别名 525 与源站证书（另一个已复现问题）

2026-09-24 公网 apex 为 200，www/dapp 为 525；VPS loopback 同样只有 apex 可握手，两个别名因缺少配置返回 TLS alert。旧配置引用的证书只有 clientAuth 用途，没有 DNS SAN，不能作为有效的服务器域名证书。诊断时查看的是公开证书，未读取或导出私钥。

修复配置为 Caddy ACME HTTP-01 管理 apex/www/dapp 三个服务器证书，别名统一重定向至 apex 并保留路径和查询；关闭 TLS-ALPN challenge，以免 Cloudflare 边缘终止 TLS 阻断验证。既有 Caddy 数据卷保存证书与自动续期状态，不新增证书脚本或外部定时任务。

迁移分两步：先在保留 apex 旧证书选择的临时 Caddy 配置中启用三个域名的自动签发，确认真实证书均已生成后再切换最终配置；只使用 graceful reload。最后从 VPS loopback 用系统 CA 和实际 SNI 做严格验证，并核对公开 alias 重定向及双链 health。不能用本机可能经过网络代理的“直连源站”替代 VPS loopback 核验。

这修复可复现的 alias 525 和错误证书配置，不足以证明偶发二十秒无响应的根因也已消失；后者继续使用有界诊断记录定位。
