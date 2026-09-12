# ZPanel

一个干净、轻量、可自托管的导航面板和服务器首页，适合 NAS、Homelab、家庭服务器、个人服务器、内网服务入口、Docker 应用入口和浏览器主页。

简体中文 | [English](README.md) | [日本語](docs/README.ja.md) | [한국어](docs/README.ko.md) | [Deutsch](docs/README.de.md) | [Français](docs/README.fr.md) | [Español](docs/README.es.md) | [Português](docs/README.pt-BR.md) | [Italiano](docs/README.it.md) | [繁體中文](docs/README.zh-TW.md) | [Русский](docs/README.ru.md)

---

ZPanel 是 [Sun-Panel](https://github.com/hslr-s/sun-panel) MIT 开源版本的独立 fork。Sun-Panel 和原作者为本项目提供了重要基础。ZPanel 不是 Sun-Panel 官方项目，也不代表原项目继续维护。

ZPanel 的目标很简单：保持轻量、好用、易部署，并默认开放，不引入付费授权系统。围绕自托管使用场景，ZPanel 对前端工程结构、用户与导航数据、个性化配置、文件上传、Docker 管理和部署流程做了持续整理与优化；同时补强了登录验证码、访问拦截、权限校验、登录限流、安全响应头、容器健康检查、CI 质量门禁和项目协作文件，让项目更适合作为可维护、可部署、可二次开发的开源样例。

关键词：自托管导航页、NAS 导航面板、Homelab Dashboard、个人服务器首页、Docker 管理面板、内网服务导航、浏览器主页。

## 为什么选择 ZPanel

- **部署简单**：Docker Compose 一条命令启动，默认使用 SQLite，本地目录持久化配置、数据库和上传文件。
- **面向真实自托管场景**：支持内网 / 外网地址切换、公开访问模式、多账号、本地快速切换账号、文件上传和系统状态组件。
- **高度可定制**：背景、模糊、遮罩、图标样式、布局宽度、页脚、站点标题、登录页、自定义 CSS / JavaScript 都可以在线调整。
- **更适合长期维护**：补充健康检查、CI、依赖更新配置、PR / Issue 模板、贡献指南和安全策略，方便个人使用，也方便团队二次开发。
- **安全默认值更清晰**：支持登录验证码、登录限流、权限拦截、安全响应头；Docker socket、公开访问、自定义 JS 等高权限能力在文档中明确提示风险。

## 功能

**导航和服务入口**

- 可视化管理导航项目和分组
- 内网 / 外网地址切换
- 支持当前页、新窗口、弹窗等打开方式
- 支持图片图标、文字图标、favicon 获取和 Iconify 图标
- 支持拖拽排序、右键快捷操作、前端搜索导航项
- 可选公开访问模式，适合分享只读导航页

**个性化**

- 自定义背景、模糊、遮罩、布局宽度、边距和页脚
- 自定义站点标题、站点图标、登录页标题、副标题和底部内容
- 在线编辑自定义 CSS 和 JavaScript
- 自定义搜索引擎，无人为数量限制
- 可选登录图形验证码
- 暗色 / 亮色 / 自动主题和多语言界面

**用户和数据**

- 多账号管理
- 本地多账号快速切换
- 用户数据隔离
- 导航项目和样式配置导入 / 导出
- ZPanel 原生 `.zpanel.json` 备份文件
- 管理员可设置公开访问用户

**文件和媒体**

- 上传图标和壁纸
- 公共图库视图
- 上传图片可直接设为壁纸

**系统和 Docker**

- 系统状态组件
- CPU、内存、磁盘等状态展示
- Docker 卡片能力和容器资源快照
- 管理员 Docker 应用管理：容器列表、资源快照、启动、停止、重启、暂停、恢复和日志

**工程和安全**

- 登录验证码、登录限流、权限拦截和安全响应头
- Docker / Compose 健康检查接口：`GET /api/healthz`
- GitHub Actions 前后端质量检查
- Dependabot、Issue 模板、PR 模板、贡献指南和安全策略

## Ubuntu 局域网部署（推荐）

下面是一套可以直接照着操作的部署流程。目标是把 ZPanel 部署到一台局域网内的 Ubuntu 设备，并让手机、电脑等同一局域网设备通过 `http://Ubuntu设备IP:6521` 访问。

配置与持久化的完整说明见 [部署配置与运维参考](docs/deployment.zh-CN.md)。

本文使用 Docker Compose 部署，默认使用内置 SQLite，不需要另外安装数据库。Docker 镜像同时提供 Linux `amd64`（常见 PC、迷你主机）和 `arm64`（部分 ARM 开发板、NAS）版本。

> 如果 Ubuntu 设备有公网 IP 或路由器做了端口转发，请不要把 `6521` 端口直接暴露到互联网。公网访问应使用反向代理、HTTPS 和额外的访问控制；本文只讲可信局域网内的直接访问。

### 1. 确认设备和网络

在 Ubuntu 终端执行：

```bash
uname -m
ip -br -4 addr show scope global
```

- `uname -m` 显示 `x86_64` 或 `aarch64` 均可使用官方镜像。
- 在第二条命令的结果中找到 Ubuntu 的局域网 IPv4 地址，例如 `192.168.1.50`。不要选择 `docker0`、`br-*` 等 Docker 虚拟网卡地址。
- 建议在路由器中给这台 Ubuntu 设备设置 DHCP 静态租约，避免设备重启后 IP 变化。
- 下文统一用 `192.168.1.50` 举例，请务必替换成你自己的实际地址。

### 2. 安装 Docker Engine 和 Compose

先检查是否已经安装：

```bash
sudo docker --version
sudo docker compose version
```

两条命令都能正常显示版本号时，再用 `sudo docker info` 确认服务可连接，然后跳到第 3 步。若只有 Docker 而没有 Compose，先按官方文档补装 Compose 插件，不要直接混装已有发行版 Docker 软件包。最小化系统还需安装编辑器：`sudo apt install -y nano`。全新 Ubuntu 可按 [Docker 官方 Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/) 添加官方软件源并安装：

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

添加 Docker apt 软件源：

```bash
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

安装并验证：

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

本文后续命令统一使用 `sudo docker ...`，不要求把当前用户加入 `docker` 组。Docker 官方提示：`docker` 组本身拥有接近 root 的权限，不应把它当作普通的无特权用户组。

### 3. 创建部署目录

```bash
mkdir -p ~/zpanel/conf ~/zpanel/data
cd ~/zpanel
```

目录用途：

- `~/zpanel/compose.yaml`：容器部署配置。
- `~/zpanel/.env`：Ubuntu 局域网 IP 和时区。
- `~/zpanel/conf`：ZPanel 运行配置，首次启动时自动生成 `conf.ini`。
- `~/zpanel/data`：SQLite 数据库、上传文件、日志、缓存和备份数据。

删除或覆盖 `conf`、`data` 会丢失配置或业务数据；重新创建容器不会丢失这两个目录中的数据。

### 4. 写入局域网 IP

创建环境文件：

```bash
nano .env
```

写入以下内容，把示例 IP 换成第 1 步查到的实际 IP：

```dotenv
ZPANEL_BIND_IP=192.168.1.50
TZ=Asia/Shanghai
```

在 nano 中按 `Ctrl+O`、回车保存，再按 `Ctrl+X` 退出。

这里绑定的是 Ubuntu 的具体局域网 IP。不要写 `127.0.0.1`，否则只有 Ubuntu 本机能访问。也可以写 `0.0.0.0` 监听所有 IPv4 网卡，但如果设备还有公网或其他不可信网卡，暴露范围会更大。

### 5. 创建 Compose 配置

```bash
nano compose.yaml
```

完整粘贴以下内容：

```yaml
services:
  zpanel:
    image: vivalucas/zpanel:latest
    container_name: zpanel
    environment:
      TZ: "${TZ:-Asia/Shanghai}"
    volumes:
      - ./conf:/app/conf
      - ./data:/app/data
    ports:
      - "${ZPANEL_BIND_IP:?请先在.env设置局域网IP}:6521:6521"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:6521/api/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
    restart: unless-stopped
```

保存退出后先检查配置。输出中不应出现 `ZPANEL_BIND_IP` 为空的警告：

```bash
sudo docker compose config
```

### 6. 启动 ZPanel

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
```

第一次拉取镜像可能需要几分钟。`docker compose ps` 中 ZPanel 应显示为 `Up`，健康检查完成后会显示 `healthy`。查看实时日志可执行：

```bash
sudo docker compose logs -f --tail=100 zpanel
```

看到服务正常启动后按 `Ctrl+C` 退出日志，不会停止容器。

### 7. 验证局域网访问

先在 Ubuntu 本机验证健康接口，注意仍要替换 IP：

```bash
curl --fail --show-error --connect-timeout 5 --max-time 10 http://192.168.1.50:6521/api/healthz
```

应返回 `{"status":"ok"}`。这只验证 HTTP 服务；还需登录、创建导航项、上传图片，再重建容器确认数据保留。

再在同一局域网内的电脑或手机浏览器打开：

```text
http://192.168.1.50:6521
```

默认管理员账号：

```text
用户名：admin@zpanel.local
密码：12345678
```

首次登录后请立即修改默认密码。即使只在局域网使用，也不应长期保留默认密码。

### 8. 防火墙和“本机能开、其他设备打不开”

依次检查：

```bash
cd ~/zpanel
sudo docker compose ps
sudo docker compose logs --tail=200 zpanel
sudo ss -lntp | grep 6521
ip -br -4 addr show scope global
```

常见原因：

- `.env` 中写成了 `127.0.0.1`、写错了 IP，或 Ubuntu 的 DHCP 地址已经变化。修改后执行 `sudo docker compose up -d` 重新创建容器。
- 访问设备和 Ubuntu 不在同一网段，或无线路由器启用了 AP / 客户端隔离、访客网络隔离。
- 路由器、云安全组或宿主机的额外防火墙拦截了 TCP `6521`。
- 端口已被其他程序占用。用 `sudo ss -lntp | grep 6521` 检查；必要时把 Compose 中左侧端口改成其他端口，例如 `"${ZPANEL_BIND_IP:?请先在.env设置局域网IP}:8080:6521"`，然后访问 `http://IP:8080`。

特别注意：[Docker 官方防火墙文档](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw)说明，Docker 发布的容器端口可能绕过 UFW 的常规规则。因此，不要只依赖 `sudo ufw allow/deny 6521` 判断暴露范围。本文通过绑定具体局域网 IP 来缩小监听范围；有更严格隔离需求时，请在路由器、防火墙或 Docker 的 `DOCKER-USER` 链中设置来源网段规则。

### 日常管理

以下命令都在 `~/zpanel` 目录执行：

```bash
cd ~/zpanel

# 查看状态
sudo docker compose ps

# 查看最近 200 行日志
sudo docker compose logs --tail=200 zpanel

# 重启
sudo docker compose restart zpanel

# 停止
sudo docker compose down

# 再次启动
sudo docker compose up -d
```

`docker compose down` 只删除容器和 Compose 网络，不会删除 `./conf`、`./data`。不要使用 `rm -rf ~/zpanel`，也不要在不了解影响时额外添加 `--volumes`。

### 升级和固定版本

重要环境建议固定版本：

```yaml
image: vivalucas/zpanel:1.1.8
```

`latest` 跟随最近一次成功发布的镜像；推送 GitHub `main` 不会自动更新镜像。发布是否完成请查看 [Releases](https://github.com/vivalucas/zpanel/releases) 和 [容器发布任务](https://github.com/vivalucas/zpanel/actions/workflows/container-ghcr.yml)。GHCR 可作为另一个官方拉取渠道：`ghcr.io/vivalucas/zpanel:1.1.8`。

升级按以下顺序操作：

1. 在原部署目录记录当前版本、镜像 ID 和摘要，并保留旧镜像：`sudo docker inspect zpanel --format '{{.Config.Image}} {{.Image}}'`；`sudo docker image inspect "$(sudo docker inspect zpanel --format '{{.Image}}')" --format '{{json .RepoDigests}}'`。可用 `sudo docker image tag "$(sudo docker inspect zpanel --format '{{.Image}}')" zpanel:before-upgrade` 保存本次升级前的本地镜像；下一次升级会覆盖这个本地标签，应同时留存版本/摘要记录。
2. 按下一节停机备份，确认归档能列出内容，再修改 Compose 的镜像版本。
3. 执行以下命令：

```bash
cd ~/zpanel
sudo docker compose config --quiet && sudo docker compose pull && sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 zpanel
```

4. 等待 `healthy`，检查健康接口，登录确认导航、图片和配置。确认稳定前保留旧镜像及备份，不把宿主机级镜像清理加入自动升级步骤。

**回滚**：只在数据库兼容已确认时，仅切回旧镜像版本并重新启动。后端启动会自动迁移数据库，不能保证任意版本直接降级。需要完整回退时，使用升级前备份还原配置、数据库和图片，并指定记录下的旧镜像版本/摘要（或保留的 `zpanel:before-upgrade`），然后启动。完整恢复会丢失备份时间点之后的改动。

GitHub Release 还提供 Linux `amd64` 压缩包和 `SHA256SUMS`；多数 Ubuntu 用户推荐 Docker。二进制包使用说明见 [运维参考](docs/deployment.zh-CN.md#二进制包)。

### 备份和恢复

以下适用于默认 SQLite 和默认存储路径。外部 MySQL、改到挂载之外的文件不在这个归档中，需单独备份。页面导出的 `.zpanel.json` 不包含上传图片，也不等同于全量备份。

先停止服务，备份全部运行数据与部署配置；归档成功并检查后再启动：

```bash
cd ~/zpanel
backup_file="$HOME/zpanel-backup-$(date +%F-%H%M%S).tar.gz"
sudo docker compose stop zpanel && \
  sudo tar -czf "$backup_file" conf data compose.yaml .env && \
  sudo tar -tzf "$backup_file" >/dev/null && \
  sudo docker compose start zpanel
```

若归档失败，服务可能保持停止；先查看磁盘空间和报错，修复后重新备份，或手动 `sudo docker compose start zpanel` 恢复服务。列出归档只验证可读性，不能替代恢复演练。备份包含账号数据库和可能的连接密码，应限制访问并复制到另一台设备；`data/backups` 目录本身不会自动生成定时备份。

恢复时使用可信归档，先确认旧目录已停止服务，再保留整个旧目录，在干净目录还原：

```bash
cd ~/zpanel
sudo docker compose down && \
  cd "$HOME" && \
  mv zpanel "zpanel-before-restore-$(date +%F-%H%M%S)" && \
  mkdir zpanel && \
  sudo tar -xzf /你的备份文件路径/zpanel-backup-日期.tar.gz -C "$HOME/zpanel"
cd ~/zpanel
```

启动前用 `nano .env` 确认绑定 IP 在当前服务器存在，并编辑 `compose.yaml` 指定与备份匹配的旧镜像版本/摘要，尤其不要让备份中的 `latest` 自动选择新版本。然后执行：

```bash
sudo docker compose config --quiet && sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 zpanel
```

验证登录、导航和图片后再处理保留的旧目录。升级前、修改 `conf/conf.ini` 前都应备份。

### 忘记管理员密码

下面的命令会把第一个管理员账号的密码重置为 `12345678`：

```bash
cd ~/zpanel
sudo docker compose stop zpanel
sudo docker compose run --rm zpanel ./zpanel -password-reset
sudo docker compose up -d
```

登录后立即改成新密码。

### 自定义 CSS / JavaScript 导致页面打不开

使用安全模式打开：

```text
http://192.168.1.50:6521/?safeMode=1
```

安全模式只在当前页面加载时跳过自定义 CSS 和 JavaScript，方便登录后删除错误配置。也支持 `?zpanelSafeMode=1`。

### 可选：让 ZPanel 管理宿主机 Docker

普通导航面板不需要这一步。只有明确需要在 ZPanel 页面中启动、停止或查看宿主机容器时，才应挂载 Docker socket。这个 socket 基本等同于宿主机 root 权限，只应在可信环境启用。

先把 Docker socket 的组 ID 追加到现有 `.env`：

```bash
cd ~/zpanel
stat -c '%g' /var/run/docker.sock
nano .env
```

在 `.env` 中新增或更新一行 `DOCKER_GID=上面输出的数字`，保留原有 IP 和时区配置，不重复添加同名键。

然后在 `compose.yaml` 的 `zpanel` 服务中增加 `group_add`，并在原有 `volumes` 下增加 socket 挂载：

```yaml
    group_add:
      - "${DOCKER_GID}"
    volumes:
      - ./conf:/app/conf
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
```

应用并检查日志：

```bash
sudo docker compose up -d
sudo docker compose logs --tail=100 zpanel
```

## 适用场景

- NAS、软路由、迷你主机、家庭服务器的统一入口页
- Homelab 服务导航，例如 Jellyfin、qBittorrent、Home Assistant、Git、监控系统等
- 公司或团队内网工具导航
- 个人浏览器主页和常用网址收藏
- 需要公开分享的只读导航页
- 需要轻量 Docker 容器管理入口的自托管环境

## 本地开发

```bash
fnm use
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm run dev
```

后端：

```bash
cd service
go run main.go
```

默认情况下，前端开发服务器运行在 `http://127.0.0.1:1002`，并将 API 请求代理到 `http://127.0.0.1:6521`。

## 质量检查

```bash
pnpm run type-check
pnpm run lint
pnpm run build
cd service && go test ./...
```

GitHub Actions 会在 Pull Request 和主分支推送时运行前后端检查。

## 贡献与安全

贡献前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全问题请按 [SECURITY.md](./SECURITY.md) 私下报告。

## Fork 说明

ZPanel 基于 Sun-Panel 的 MIT 开源版本构建。ZPanel 是独立项目，不是官方延续；当前代码围绕 ZPanel 的产品方向持续演进，重点改进自托管部署、用户体验、权限安全、Docker 管理和工程质量。

## 许可

MIT License。详见 [LICENSE](./LICENSE)。
