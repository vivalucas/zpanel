# Configuration and operations

For first installation, use the [Compose quick start](../README.md#docker-compose). This guide targets 1.1.8, one instance, SQLite and the default paths. Docker deployment does not require Node.js, Go, MySQL or Redis on the host. Ubuntu hardware deployment and recovery were not revalidated for this release.

## Configuration and persistence

| Source | Purpose | Apply changes |
|---|---|---|
| Deployment `.env` | Variables explicitly referenced by Compose, such as `DOCKER_GID`; the Chinese LAN example also uses `ZPANEL_BIND_IP` and `TZ` | `docker compose config --quiet`, then `docker compose up -d` |
| Compose YAML | Image, ports, volumes, environment and supplementary groups | Same; `restart` does not recreate container settings |
| `conf/conf.ini` | Backend port, database, cache/queue, storage and trusted proxies | `docker compose restart zpanel` |
| UI settings | Accounts, navigation, styles and site settings | Save successfully in the UI; server settings reside in the database |

The entrypoint creates `conf/conf.ini` on first start and preserves existing configuration on upgrade. Compare with the [current template](../service/assets/conf.example.ini) and merge new keys when needed. Do not run `./zpanel -config` on an existing installation: it overwrites configuration. `.env` does not automatically override backend INI settings.

| Default host path | Container path | Contents |
|---|---|---|
| `./conf` | `/app/conf` | Backend configuration |
| `./data` | `/app/data` | SQLite database at `database/zpanel.db`, uploaded images at `uploads`, file logs/cache/temp at `runtime` |

Accounts, navigation and server settings persist in SQLite. Recreating the container preserves these bind-mounted directories. Use the same deployment directory throughout. Browser-local preferences and quick account information are not in server backups. Built-in `web` and generated `lang` files are replaceable image resources; manual container-layer edits are not persistent.

The entrypoint initializes ownership as root, then runs the application as UID 1000 (`zpanel`). Both mounts must be writable. Do not use `chmod 777`. Rootless Docker, NFS and custom UID setups need separate permission planning. Changing `storage.data_path` does not rewrite explicit `uploads_path`, `temp_path`, `cache_path`, `logs_path`, `backups_path` or `sqlite.file_path`, and does not move existing data. Stop, back up and migrate files before changing paths. Every new container path must have a writable persistent mount; retaining the default container paths is simpler.

`storage.backups_path` only defines a directory; it does not enable scheduled backups. UI `.zpanel.json` exports do not include uploaded images.

## Ports and reverse proxies

Change only the host side, e.g. `127.0.0.1:8080:6521`, to change the external port. Changing `base.http_port` requires updating both the container port mapping and the Compose health check, overriding the image's default 6521 check.

For a host-installed proxy, keep `127.0.0.1:6521:6521`. In an existing TLS-enabled Nginx server with your domain, certificate and access controls, a single-proxy example is:

```nginx
location / {
    proxy_pass http://127.0.0.1:6521;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20m;
}
```

The example overwrites client-supplied IP headers. Its 20 MiB request-body limit does not raise application limits. Set `[base] trusted_proxies` in `conf/conf.ini` to the actual controlled proxy IP/CIDR seen by the Go server, using commas for multiple entries. With Docker bridging, a host proxy may appear as the Docker gateway rather than loopback. Inspect container networking and access logs; do not copy arbitrary addresses or trust `0.0.0.0/0` or `::/0`. Empty means no forwarded-header trust, so proxied clients may share an IP rate limit. Invalid values prevent startup.

A containerized proxy uses a shared controlled Docker network and upstream `zpanel:6521`, not its own `127.0.0.1`; host port publishing can usually be removed in that arrangement. Validate/reload proxy configuration, restart ZPanel, and verify client IPs from two clients. Multi-proxy chains require separate trusted-header configuration.

## Optional MySQL and Redis

Defaults are `[base] database_drive=sqlite`, `cache_drive=memory`, `queue_drive=memory`. These require no external services. The template lists all supported keys. Only switch to `mysql`/`redis` after provisioning reachable services and dedicated credentials. Container loopback is not the host. For services on the same Docker network, example endpoints are `[mysql] host=mysql`, `port=3306` and `[redis] address=redis:6379`; set real strong credentials and the database name before starting. Keep memory cache/queue when Redis is unnecessary.

Changing drivers does not migrate SQLite data into MySQL. Back up MySQL separately; `conf/data` will not contain that database. Redis persistence belongs to the Redis deployment. Enabling Redis does not make multiple ZPanel replicas safe: resource mutation coordination currently assumes one process. These advanced integrations have not been revalidated on real infrastructure for this release.

## Back up before upgrading

Use `sudo` for Docker commands if required. Commands below assume the English quick start's `docker-compose.yml` in `~/zpanel`; substitute `compose.yaml` for the Chinese guide. If you use `.env`, include it in the archive as shown. Default SQLite only:

```bash
cd ~/zpanel
backup_file="$HOME/zpanel-backup-$(date +%F-%H%M%S).tar.gz"
# Omit .env below only if your deployment has no .env file.
sudo docker compose stop zpanel && \
  sudo tar -czf "$backup_file" conf data docker-compose.yml .env && \
  sudo tar -tzf "$backup_file" >/dev/null && \
  sudo docker compose start zpanel
```

If archiving fails the service may remain stopped: correct the error and retry, or start it manually. Listing an archive checks readability, not restore correctness. Protect archives containing credentials and copy them off the host. Include external database backups and custom mounts separately.

## Upgrade and rollback

1. Record the running image and immutable ID: `sudo docker inspect zpanel --format '{{.Config.Image}} {{.Image}}'`. Record registry digests with `sudo docker image inspect "$(sudo docker inspect zpanel --format '{{.Image}}')" --format '{{json .RepoDigests}}'`. Preserve the old local image using `sudo docker image tag "$(sudo docker inspect zpanel --format '{{.Image}}')" zpanel:before-upgrade`; the next use replaces this local tag.
2. Back up as above before editing the image version. Prefer a released version such as `vivalucas/zpanel:1.1.8` or its digest.
3. Run `sudo docker compose config --quiet && sudo docker compose pull && sudo docker compose up -d`.
4. Check `sudo docker compose ps` and `sudo docker compose logs --tail=100 zpanel`. For the default host-loopback mapping, run `curl --fail --show-error --connect-timeout 5 --max-time 10 http://127.0.0.1:6521/api/healthz`; expect `{"status":"ok"}`. Use your LAN IP when bound there. Also sign in and check navigation, images and settings.
5. Retain the old image and backup until verified. Do not automatically run host-wide image pruning during upgrades.

Startup automatically migrates the database. Image-only rollback is appropriate only after confirming database compatibility. Otherwise restore the pre-upgrade data and matching old image. A full restore loses changes made after the backup. `latest` identifies the last successfully published image, not the current Git branch; pushing `main` alone does not publish it.

## Restore into a clean directory

Use a trusted archive. Stop the current deployment and preserve its directory instead of extracting over newer files:

```bash
cd ~/zpanel
sudo docker compose down && \
  cd "$HOME" && \
  mv zpanel "zpanel-before-restore-$(date +%F-%H%M%S)" && \
  mkdir zpanel && \
  sudo tar -xzf /path/to/zpanel-backup.tar.gz -C "$HOME/zpanel"
cd ~/zpanel
```

Before starting, edit the restored `.env`/Compose host IP for the destination machine and select the image version/digest matching the backup (or the preserved `zpanel:before-upgrade` image). A restored `latest` string does not pin the old image. Then run `sudo docker compose config --quiet && sudo docker compose up -d` and repeat health, login and image checks. Retain the previous directory until recovery is verified.

## Troubleshooting and recovery

| Symptom | Check |
|---|---|
| Docker daemon unavailable | `sudo systemctl status docker`, `sudo docker info`, active Docker context |
| Image pull fails | Network, DNS, system time and published version; try the same official GHCR version |
| Address unavailable | Host LAN IP; use `ip -br -4 addr show scope global` |
| Port occupied | `sudo docker ps`, `sudo ss -lntp`; change only the host port |
| Permission/chown failure | Writable mounts, UID and filesystem restrictions; avoid world-writable permissions |
| Restart loop/unhealthy | Compose logs, INI configuration, database connectivity, disk space and health-check port |
| Docker manager unavailable | Socket mount, actual socket GID and `group_add`; `sudo docker compose exec zpanel docker version` |

To reset the first administrator password, run `sudo docker compose stop zpanel && sudo docker compose run --rm zpanel ./zpanel -password-reset`, inspect the printed account/result, then `sudo docker compose up -d`. The password becomes `12345678`; change it immediately. For broken custom CSS/JS, open `/?safeMode=1` on the actual service URL and remove the broken settings.

## Binary packages

GitHub Releases provide Linux amd64 tar/zip archives and `SHA256SUMS`. Download both archives and verify with `sha256sum -c SHA256SUMS` before extracting one. The binary is built on Ubuntu and requires compatible system libraries; do not assume Alpine compatibility. Run `./zpanel` from the extracted directory containing `web/` and writable `conf/`, `data/`, `lang/`. First start generates configuration. For automatic startup use a dedicated unprivileged user and a service manager with `WorkingDirectory` pointing to that directory. Configure host firewall/listening exposure yourself. Frontend development commands are not production deployment steps.
