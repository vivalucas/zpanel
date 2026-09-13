# 部署配置与运维参考

首次安装见 [Ubuntu 局域网指南](../README.zh-CN.md#ubuntu-局域网部署推荐)。本文对应 1.2.0，推荐单实例 Docker、SQLite、默认存储路径。默认部署不需要 Node.js、Go、MySQL 或 Redis。本轮完成源码与文档检查，未做 Ubuntu 实机部署/恢复验收。

## 配置来源与生效

| 位置 | 控制内容 | 修改后操作 |
|---|---|---|
| 部署目录 `.env` | Compose 插值：`ZPANEL_BIND_IP`、`TZ`、可选 `DOCKER_GID` | `sudo docker compose config --quiet`，再 `sudo docker compose up -d` |
| `compose.yaml` | 镜像、宿主机端口、挂载、时区、附加组 | 同上；单纯 restart 不会应用这些改动 |
| `conf/conf.ini` | 服务端口、数据库、缓存/队列、存储路径、可信代理 | `sudo docker compose restart zpanel` |
| 页面设置 | 账号、导航、壁纸、站点设置等 | 页面保存成功后生效，服务器数据写入数据库 |

`.env` 不会自动成为后端配置；只有 Compose 明确引用的值生效。镜像首次启动自动生成 `conf/conf.ini`，已存在的配置会保留，升级不会自动补齐新的配置项。以当前版本 [配置模板](../service/assets/conf.example.ini) 为准，手动合并需要的键，不要覆盖现有密码和路径。不要对已有部署运行 `./zpanel -config`，该命令会重写配置文件。

### 后端配置索引

| 节与键 | 默认值 / 用途 |
|---|---|
| `base.http_port` | `6521`，容器内服务端口 |
| `base.trusted_proxies` | 空，不信任转发头；多个受控代理 IP/CIDR 逗号分隔 |
| `base.database_drive` | `sqlite`，可选 `mysql` |
| `base.cache_drive` / `base.queue_drive` | `memory`，可选 `redis` |
| `sqlite.file_path` | `./data/database/zpanel.db` |
| `storage.data_path` | `./data` |
| `storage.uploads_path` | `./data/uploads` |
| `storage.temp_path` / `storage.cache_path` | `./data/runtime/temp` / `./data/runtime/cache` |
| `storage.logs_path` / `storage.backups_path` | `./data/runtime/logs` / `./data/backups` |
| `mysql.host/port/username/password/db_name/wait_timeout` | 外部数据库连接；模板密码只是示例，不能直接用于生产 |
| `redis.address/password/prefix/db` | Redis 连接及命名空间；默认缓存/队列不使用 Redis |

只改对外端口时，把映射改成 `"${ZPANEL_BIND_IP:?请设置IP}:8080:6521"`，访问 `http://IP:8080`，不用改 `http_port`。如果修改容器内端口，必须同时修改端口映射右侧和 Compose 健康检查地址，覆盖镜像内默认的 6521 健康检查。

## 持久化和权限

| 宿主机目录 | 容器路径 | 内容 |
|---|---|---|
| `./conf` | `/app/conf` | `conf.ini` 等配置 |
| `./data` | `/app/data` | SQLite 账号/导航/设置/会话数据、上传图片、文件日志、缓存和临时文件 |

相对挂载路径按 Compose 项目位置解析。一直使用同一部署目录，避免在其他目录创建一套空数据。默认入口以 root 初始化目录并调整所有权，然后以 UID 1000 的 `zpanel` 用户运行服务。不要给 `conf/data` 配只读挂载，也不要用 `chmod 777` 解决权限问题。NFS、rootless Docker、自定义 UID 或受限 NAS 权限需单独适配，不属于默认流程的已验证范围。

容器内 `web` 为镜像自带静态资源；`lang` 为内置语言文件的可再生成副本，默认不挂载。手工定制容器内文件不会随重建保留。浏览器本地偏好及快捷账号信息不包含在服务器备份内。

**自定义路径**：模板显式填写了各子目录，修改 `storage.data_path` 不会改写其他已配置路径，更不会迁移现有文件；`sqlite.file_path` 也独立设置。迁移时停机备份、复制原数据，逐项更新配置，确保新目录有挂载和服务用户写权限；否则可能出现空数据库、图片缺失或数据只留在容器层。默认用户优先保留路径，只调整宿主机挂载源。

`storage.backups_path` 只是目录配置，当前没有自动定时备份任务。页面 `.zpanel.json` 导出不包含上传图片。完整备份/恢复按 [README](../README.zh-CN.md#备份和恢复) 执行；外部数据库、额外挂载、自定义路径要另行纳入备份。

## 反向代理

局域网直连保持 `trusted_proxies` 为空。宿主机 Nginx 代理时可将发布端口绑定 `127.0.0.1:6521:6521`，由 Nginx 提供 TLS。以下片段放入已配置证书、域名和访问控制的 HTTPS `server` 块中：

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

这是单层代理示例，主动覆盖客户端传入的 IP 头。20 MiB 是代理请求体示例上限，不提升应用自己的导入/上传限制。多层代理应在入口规范可信链，不能无条件信任客户端转发头。

在 `conf/conf.ini` 的 `[base]` 中设置 `trusted_proxies=实际受控代理地址`。它指 **Go 服务观察到的直接连接来源**：宿主机反代进入桥接容器时可能是 Docker 网关，不一定是 `127.0.0.1`；容器代理则通常是代理容器 IP。依据访问日志和 `sudo docker inspect zpanel` 核对实际网络，使用最窄受控 IP/CIDR，不照抄网关或使用 `0.0.0.0/0`、`::/0`。

容器内的 Nginx/Caddy 不能通过自身 `127.0.0.1` 访问 ZPanel；应加入同一受控 Docker 网络，使用 `zpanel:6521` 作为上游，并通常移除 ZPanel 的宿主机端口发布。不要把宿主机代理和容器代理示例混用。

修改后检查并重载代理配置、重启 ZPanel，从两个客户端核对记录的 IP 和正常登录。健康接口返回成功不能证明代理可信链正确。无效 `trusted_proxies` 会导致服务启动失败，应查看日志修正。

## 可选 MySQL / Redis

新部署才考虑切换；已有 SQLite 数据不会自动导入 MySQL。先创建数据库与专用账号，限制网络来源，并独立建立数据库备份策略。下面仅展示连接配置，不是自动创建外部服务的脚本；`mysql`、`redis` 必须是在同一 Docker 网络中实际可解析的服务名，也可以改成可达的服务器地址。

```ini
[base]
database_drive=mysql
cache_drive=redis
queue_drive=redis

[mysql]
host=mysql
port=3306
username=zpanel
password=replace-with-a-strong-password
db_name=zpanel
wait_timeout=100

[redis]
address=redis:6379
password=replace-with-a-strong-password
prefix=zpanel:
db=0
```

按需修改现有节和键，不重复粘贴 `[base]`。如果只使用 MySQL，缓存和队列仍可保留 `memory`。Docker 容器内 `127.0.0.1` 指自身，不是宿主机；外部数据库端口不必公开到互联网。MySQL 备份不在 `conf/data` 中，Redis 持久化由 Redis 部署负责。启用 Redis 不意味着支持 ZPanel 多副本；资源变更保护目前针对单进程。

## 排障

| 现象 | 核查与处理 |
|---|---|
| `Cannot connect to the Docker daemon` | `sudo systemctl status docker`、`sudo docker info`，确认服务和当前 Docker context |
| 拉取超时/拒绝访问 | 核对网络、DNS、系统时间、镜像名和版本；可换同版本 GHCR，不使用不明镜像源 |
| `cannot assign requested address` | `ip -br -4 addr show scope global`，修正 `.env` 为本机现有 IP |
| `port is already allocated` | 核对 `sudo docker compose ps`、`sudo docker ps` 和 `sudo ss -lntp`，换左侧端口 |
| `permission denied` / `chown` 失败 | 核对 conf/data 挂载、磁盘权限和文件系统；不要改成全员可写 |
| 容器反复重启或 `unhealthy` | `sudo docker compose logs --tail=200 zpanel`，检查配置、数据库、端口和磁盘空间 |
| HTTP 正常但页面/API 报错 | 核对代理上游、`/api` 路径、浏览器请求；健康接口只证明服务可响应 |
| Docker 管理页无法连接 | 核对 socket 挂载、实际 GID 和 `group_add`，再在容器中执行 `sudo docker compose exec zpanel docker version` |

Docker socket 管理权限非常高；只在需要时启用，配置见 README。默认入口会降权，`user: "0:0"` 不能作为组权限故障的解决办法。

## 二进制包

仅提供 Linux amd64 包；需要匹配 CPU 和系统运行库（由 Ubuntu 构建，不能假设适用于 Alpine）。从同一 Release 下载 `.tar.gz`、`.zip` 和 `SHA256SUMS`，执行 `sha256sum -c SHA256SUMS` 验证两份归档，再解压需要的格式。镜像对大多数用户更省事。

在解压目录运行 `./zpanel`，首次自动生成配置；当前工作目录必须包含 `web/` 和可写的 `conf/`、`data/`、`lang/`。服务监听与系统防火墙需自行配置。需要自启动时使用服务管理器，并固定 `WorkingDirectory` 为解压目录、使用专用非 root 用户。源码构建和前端 `pnpm run dev` 属于开发流程，不是生产部署步骤。
