# 公网 healthz 超时排查

生产现有的 `arbigamefi-healthz.timer` 每两分钟运行一次健康检查。v1.5 脚本源码为 `script/ops/healthz-alert.sh` 和同目录的 `healthz-probe.py`、`alert-notify.py`，部署位置是 `/opt/arbigamefi-v15/ops/`；保留现有 `alert.env`、通知渠道、状态文件和 timer。

2026-09-26 之前 `alert.env` 没有配置任何通知渠道：2026-09-25 至 26 日 RPC 额度耗尽期间，healthz 连续报 degraded 并记录了告警，但只写进了 journal，没有人收到。通知渠道见下文“Telegram 通知”。

## 新增的故障证据

检查必须同时满足 curl 成功、HTTP 2xx、JSON `status=ok` 才算成功。部分响应后的传输超时或带有 `status=ok` 的 HTTP 错误均不能报健康。

每次探测原子更新 `${ALERT_STATE_FILE}.probe.json`（默认 `/var/lib/arbigamefi/healthz-alert.state.probe.json`，权限 0600）。仅保存时间、HTTP 状态、curl 退出码、远端 IP、DNS/TCP/TLS/首字节/总耗时，以及响应存在时的 Cloudflare Ray ID；不保存响应正文、Cookie、认证头或带参数 URL。临时响应随探测结束删除。

公网失败时额外探测本机 `http://127.0.0.1:3400/api/healthz`，超时上限五秒；`compose.production.yml` 把 web 只发布在 loopback 的 3400 端口，外网不可达。这是应用层对照，不经过 Caddy 或 Cloudflare；它成功也不能解除公网告警。公网探测仍使用正常 TLS 校验，连接上限五秒、总时限二十秒，不自动重试或跟随跳转。

故障详情每次写入 journal 的 `[DIAGNOSTIC]`，受现有 journal 的 256 MB/14 天保留策略约束。通知（journal 的 `[ALERT]`、`[RECOVERED]` 以及 Telegram 或 webhook 推送）只针对持续的故障：

- 连续 `ALERT_AFTER_FAILURES` 次探测失败（默认 3 次，timer 两分钟一次，约 6 分钟）才发第一条告警，标题注明故障开始时间。
- 同一次故障中状态变成另一种（例如从 `degraded` 变为 `unreachable`），新状态同样连续 3 次才再发。
- 仍未恢复时，每六小时就已推送的状态提醒一次。
- 恢复时发一条，注明持续时长；从未推送过的故障恢复时不发。

失败一两次就自愈的偶发超时只留 `[DIAGNOSTIC]`。按 2026-09-21 至 26 日的 journal 回放，旧规则会推送 44 次故障，新规则只推送 3 次：09-23 两次约 6 分钟的中断，以及 09-25 起持续 19 小时的 RPC 额度故障。健康期间不增加通知。不要手工运行告警脚本来测试通知渠道。

告警正文会列出 healthz 各检查项的状态（例如 `keeper=degraded`）。探测器只保留检查项名称和固定的状态词，不保留检查项里的其他字段。

## Telegram 通知

`healthz-alert.sh` 在 `alert.env` 同时配置 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID` 时，通过 `alert-notify.py` 发送 Telegram 消息。token 只经环境变量传给 helper，不进入命令行参数（`/proc/<pid>/cmdline` 对所有用户可读），也不写入 journal；发送失败只记录 HTTP 状态码或错误类型。`alert.env` 保持 root 所有、权限 0600。

配置步骤：

1. 在 BotFather 创建 bot 或重新签发 token。token 一旦出现在聊天记录、工单或截图中，就吊销并重新签发。
2. 用接收告警的账号给 bot 发一条消息；群组则先把 bot 拉进群再在群里发言。bot 只能向发过消息的对象推送。
3. 以 root 登录服务器（`ssh root@<服务器>`），在这个交互式会话里运行下面的命令并按提示输入 token。输入不回显，token 不经过命令行参数、shell 变量或历史。命令需要终端来隐藏输入，所以不能从本机或非交互的远程命令里执行；它不依赖 bash 或 zsh 的 `read` 语法。

   ```sh
   python3 -c 'import getpass,pathlib,re; t=getpass.getpass("Telegram bot token: ").strip(); assert re.fullmatch(r"\d{5,}:[A-Za-z0-9_-]{30,}", t), "unexpected token format"; p=pathlib.Path("/opt/arbigamefi-v15/ops/alert.env"); lines=[l for l in p.read_text().splitlines() if not l.startswith("TELEGRAM_BOT_TOKEN=")]; p.write_text("\n".join(lines + ["TELEGRAM_BOT_TOKEN=" + repr(t)]) + "\n"); print("token written")'
   ```

4. 查出 chat id 并写入 `TELEGRAM_CHAT_ID=<id>`（chat id 不是机密）：

   ```sh
   (set -a; . /opt/arbigamefi-v15/ops/alert.env; set +a; python3 /opt/arbigamefi-v15/ops/alert-notify.py --list-chats)
   ```

5. 用 helper 直接发一条测试消息，不要运行告警脚本：

   ```sh
   (set -a; . /opt/arbigamefi-v15/ops/alert.env; set +a; echo "channel check" | python3 /opt/arbigamefi-v15/ops/alert-notify.py --subject "[TEST] arbigamefi alerts")
   ```

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

先通过 ops 测试与 CI，再将三个经校验的文件安装到 `/opt/arbigamefi-v15/ops/`，权限均为 0755。先安装两个 helper（`healthz-probe.py`、`alert-notify.py`），再原子替换 alert wrapper。保留 `/opt/arbigamefi-v15/ops/alert.env` 和 systemd unit，不重启 keeper 或数据库，也不新增 timer。状态文件由“状态 时间戳”两个字段扩展为六个字段，新脚本兼容旧格式：替换时如有未恢复的告警，会按已推送处理，恢复时照常发送 `[RECOVERED]`。web 的 loopback 端口随下一次 web 容器重建生效。

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
