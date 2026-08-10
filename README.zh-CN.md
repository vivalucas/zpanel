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

两条命令都能正常显示版本号时，直接跳到第 3 步。全新 Ubuntu 可按 [Docker 官方 Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/) 添加官方软件源并安装：

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
      - "${ZPANEL_BIND_IP}:6521:6521"
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
curl http://192.168.1.50:6521/api/healthz
```

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
- 端口已被其他程序占用。用 `sudo ss -lntp | grep 6521` 检查；必要时把 Compose 中左侧端口改成其他端口，例如 `"${ZPANEL_BIND_IP}:8080:6521"`，然后访问 `http://IP:8080`。

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

升级到最新稳定镜像：

```bash
cd ~/zpanel
sudo docker compose pull
sudo docker compose up -d
sudo docker image prune -f
```

`latest` 会跟随最新稳定版本。生产或重要环境建议把镜像改成明确版本，例如：

```yaml
image: vivalucas/zpanel:1.1.7
```

需要回滚时，把版本号改回升级前的版本，再执行：

```bash
sudo docker compose pull
sudo docker compose up -d
```

镜像也会发布到 `ghcr.io/vivalucas/zpanel:<version>`。GitHub Release 另有 Linux `amd64` 压缩包和 `SHA256SUMS`，但大多数 Ubuntu 用户仍推荐使用 Docker 镜像。

### 备份和恢复

ZPanel 默认使用 SQLite。为避免复制数据库时仍有写入，建议短暂停机后备份整个 `conf` 和 `data`：

```bash
cd ~/zpanel
sudo docker compose stop zpanel
sudo tar -czf "$HOME/zpanel-backup-$(date +%F-%H%M%S).tar.gz" conf data compose.yaml .env
sudo docker compose start zpanel
```

恢复前先停止容器，并先保留当前目录副本。确认备份文件可信后，在 `~/zpanel` 中解压覆盖，再启动：

```bash
cd ~/zpanel
sudo docker compose down
sudo tar -xzf /你的备份文件路径/zpanel-backup-日期.tar.gz -C ~/zpanel
sudo docker compose up -d
```

升级前、修改 `conf/conf.ini` 前都建议先备份。

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
echo "DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)" | sudo tee -a .env
```

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
