# Production host rebuild

The production host is rebuilt together with a fresh contract deployment, never migrated (Owner decision,
2026-10-12): the system stays (OS, users, SSH, firewall, Docker engine); every ArbiGameFi application, container,
schedule, secret file and data set is deleted; the stack is deployed again from the new signed release with an empty
database and the keys of the RPC key allocation. Nothing on the old host is kept, including the bet index, its
backups and the health state.

The implementer prepares each step and deploys; the Owner deletes (step 2) and writes every secret (step 4). The
implementer never reads an env file, a key or a token on the host.

## 1. Before anything is deleted

- The new release exists: contracts deployed, wiring executed, release signed and packaged
  ([deployment runbook](../../deploy/v16-release.md)), and a **Frontend Docker Images** run on the release has produced
  the web and keeper image digests and the `arbigamefi-docker-deploy-bundle` artifact
  ([Docker runbook](../../../frontend/deploy/docker/README.md) §2).
- Owner: each private key in the old env files (keeper signers) is held elsewhere, or its account holds nothing worth
  keeping; deleting the files destroys the host's copy. Issue a new Telegram bot token in @BotFather for the new alert
  configuration; the old token appeared in a chat on 2026-09-26.
- Inventory, read only, as root. It prints names, states and sizes, never file contents:

  ```bash
  docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Label "com.docker.compose.project"}}'
  docker volume ls --format '{{.Name}}\t{{.Label "com.docker.compose.project"}}'
  docker network ls --format '{{.Name}}\t{{.Label "com.docker.compose.project"}}'
  docker images --format '{{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.Size}}'
  systemctl list-unit-files 'arbigamefi*' --no-pager
  systemctl list-timers --all --no-pager | grep -i arbigamefi
  crontab -l; ls /etc/cron.d
  ls -ld /opt/* /var/lib/* /var/backups/* | grep -i arbigamefi
  du -sh /opt/arbigamefi* /var/lib/arbigamefi* /var/backups/arbigamefi*
  ss -ltnp
  ```

  The implementer writes step 2 with the exact names from this inventory, and the Owner checks it against the
  inventory before running it. Anything not ArbiGameFi's stays.

## 2. Delete the old applications and data (Owner)

Schedules first, so nothing restarts or alerts while the rest goes; then containers with their volumes and networks;
then images; then files. Replace each `<...>` with the names from the inventory.

```bash
systemctl disable --now <arbigamefi timers>
systemctl stop <arbigamefi services>
rm -f /etc/systemd/system/<arbigamefi unit files>
systemctl daemon-reload
for project in <arbigamefi Compose projects>; do
  docker ps -aq --filter "label=com.docker.compose.project=$project" | xargs -r docker rm -f
  docker volume ls -q --filter "label=com.docker.compose.project=$project" | xargs -r docker volume rm
  docker network ls -q --filter "label=com.docker.compose.project=$project" | xargs -r docker network rm
done
docker images --format '{{.Repository}} {{.ID}}' | awk '$1 ~ /^ghcr\.io\/arbigamefi\// {print $2}' | sort -u |
  xargs -r docker rmi -f
rm -rf <arbigamefi directories under /opt, /var/lib and /var/backups>
```

Remove any ArbiGameFi cron entry the inventory showed. Then repeat the inventory: it must list nothing of
ArbiGameFi's, and `ss -ltnp` nothing on ports 80, 443 or 3400. The Caddy volume goes too; Caddy obtains new
certificates on first start through the ACME path, which the Cloudflare geo rule exempts.

## 3. Deploy the stack (implementer)

Follow the [Docker runbook](../../../frontend/deploy/docker/README.md) §3 and §4 with the new release: unpack the
deploy bundle into `/opt/arbigamefi/frontend`, create the four env files from their examples with mode 0600, and fill
in the public values (chain, release path, domain, ACME address, WalletConnect project id). The database password is
generated on the host and written into the three files that use it, without being shown:

```bash
cd /opt/arbigamefi/frontend/deploy/docker/env
python3 -c '
import secrets, sys
names = ("postgres.env", "web.production.env", "keeper.primary.env")
texts = {name: open(name).read() for name in names}
if any(text.count("REPLACE_WITH_LONG_RANDOM_PASSWORD") != 1 for text in texts.values()):
    sys.exit("each file must hold the password placeholder exactly once; nothing was written")
password = secrets.token_hex(32)
for name, text in texts.items():
    open(name, "w").write(text.replace("REPLACE_WITH_LONG_RANDOM_PASSWORD", password))
'
```

Install the ops scripts into `/opt/arbigamefi/ops/` (owner root, mode 0700): `swap-keeper-key.sh`, `healthz-alert.sh`,
`healthz-probe.py`, `alert-notify.py`, `bet-index-backup.sh` and `bet-index-restore-drill.sh` from `script/ops/` of the
release commit. Install `script/ops/systemd/arbigamefi-healthz.{service,timer}` and
`arbigamefi-db-backup.{service,timer}` into `/etc/systemd/system/` and run `systemctl daemon-reload`; they are enabled
in step 5. The Owner chose this host for the K0-4 monitor (2026-10-15): install it as the
[K0-4 runbook](config-drift-alerts.md) says under "On a Linux host", on Base Sepolia with the public RPC
(`RPC_URL=https://sepolia.base.org`), never the keeper's keys.

## 4. Secrets (Owner)

- **Keeper RPC endpoints**, from the repository on the Owner's machine. The script reads only
  `INFURA_API_KEY_PROD_KEEPER` and `ALCHEMY_API_KEY_PROD_KEEPER` from the repository `.env`, prints neither, and sends
  both URLs over ssh on standard input to `swap-keeper-key.sh --rpc`, which replaces `KEEPER_RPC_HTTP` and
  `KEEPER_RPC_WS` in one atomic write:

  ```bash
  script/ops/send-keeper-rpc.sh root@<host> base-sepolia
  ```

- **Keeper signer**: a new dedicated, funded keeper key through `swap-keeper-key.sh` on standard input
  ([keeper signer custody](keeper-key-separation.md)). It holds no governance, guardian or NFT operator role.
- **Alert channel**: in an interactive root SSH session (the token never enters a command line or shell history):

  ```bash
  python3 -c '
  import getpass, os
  token = getpass.getpass("Telegram bot token: ")
  chat = input("Telegram chat id: ")
  fd = os.open("/opt/arbigamefi/ops/alert.env", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
  os.write(fd, f"TELEGRAM_BOT_TOKEN={token}\nTELEGRAM_CHAT_ID={chat}\n".encode())
  os.close(fd)
  '
  ```

  Health and backup settings (`HEALTHZ_URL` for the chain, `BACKUP_PG_CONTAINER`) go into the same file afterwards,
  by name ([alerts](../alerts.md), [backups](bet-index-backup.zh-CN.md)).

## 5. Start and verify (implementer, with the Owner for the alert test)

1. `bash deploy/docker/check-production-env.sh`, then `bash deploy/docker/deploy-images.sh` (Docker runbook §3–4).
   `release.status`, `keeper.status` and `betIndex.status` are `ok` with `betIndex.source=postgres`; the keeper log
   shows its WebSocket subscription and HTTP scans, and the provider dashboards show traffic on the PROD_KEEPER keys,
   none on the OPS keys.
2. Send one test message (never by running `healthz-alert.sh`, which changes monitoring state); the Owner confirms
   it arrived:

   ```bash
   (set -a; . /opt/arbigamefi/ops/alert.env; set +a
    echo "rebuild test" | python3 /opt/arbigamefi/ops/alert-notify.py --subject "ArbiGameFi production rebuild")
   ```

   Then `systemctl enable --now arbigamefi-healthz.timer
   arbigamefi-db-backup.timer`, run `systemctl start arbigamefi-db-backup.service` once and check
   `journalctl -t arbigamefi-db-backup`.
3. Through Cloudflare: the public health endpoints answer, the origin certificate is valid for the three hostnames
   (Full (strict)), and the geo rule still blocks and exempts as configured.
4. Settlement on the new contracts as in the Docker runbook §4: a real bet, its VRF callback, the keeper's indexing,
   the database record, and HTTP recovery after a WebSocket loss.
