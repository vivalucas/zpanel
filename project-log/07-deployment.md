# 部署

## 部署环境

| 环境 | 用途 | 地址 |
|------|------|------|
| 开发 | 本地前后端调试 | 前端 Vite 默认 `1002`，后端默认 `6521` |
| 预发布 | 暂无 | 待规划 |
| 生产 | 自托管 Docker / 二进制部署 | 用户自定义 |

## 部署步骤

### 前置条件

- Node.js 24.15.0 与 pnpm 11.1.3，用于构建前端。
- Go 1.26.3，用于构建后端。
- SQLite 默认无需额外服务；如使用 MySQL / Redis，需要提前准备对应服务。
- Docker 部署需要 Docker / Docker Compose。
- 如果启用 Docker 应用管理，需要后端运行环境能够执行 `docker` 命令；容器部署时通常还需要挂载 `/var/run/docker.sock`。

### Docker 部署流程

当前默认镜像：

```text
vivalucas/zpanel:latest
ghcr.io/vivalucas/zpanel:latest
```

1.0.0 发布镜像：

```text
vivalucas/zpanel:1.0.0
ghcr.io/vivalucas/zpanel:1.0.0
```

```bash
docker compose up -d
```

默认挂载目录：

```text
./conf     → /app/conf
./data     → /app/data
```

如需在 ZPanel 内管理宿主机 Docker 容器，需要额外挂载 Docker socket：

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

> 该挂载权限较高，等同于允许 ZPanel 管理宿主机 Docker。只应在可信部署环境中启用，并确保管理员账号安全。

默认端口：

```text
6521:6521
```

健康检查：

```text
GET /api/healthz
```

### 二进制部署流程

```bash
pnpm install
pnpm run build

cd service
go build -o zpanel --ldflags="-X zpanel/global.RUNCODE=release" main.go
```

部署时需要保证：

- 前端构建产物放在后端运行目录的 `web/` 下。
- 配置文件在 `conf/` 下。
- 上传目录、数据库目录有写权限。

### 回滚方案

```bash
# Docker 场景：切回上一镜像 tag
docker compose down
docker compose up -d

# 二进制场景：恢复上一版 zpanel 二进制、web 目录和数据库备份
```

> 回滚前必须备份 `database/`、`uploads/` 和 `conf/`。

## CI/CD

GitHub Actions 当前包含：

- 前端 CI：安装 pnpm / Node，运行类型检查、lint、build。
- 后端 CI：按 `service/go.mod` 配置 Go，运行 gofmt 检查与 `go test ./...`。
- 容器发布：同时发布 Docker Hub 与 GitHub Container Registry。

容器发布目标：

```text
vivalucas/zpanel
ghcr.io/vivalucas/zpanel
```

`v1.0.0` tag 已用于 1.0.0 容器发布。Alpine + sqlite3 首次构建失败后，已通过 Dockerfile 中的 `CGO_CFLAGS="-D_LARGEFILE64_SOURCE"` 修复并重新发布成功。

## 常用运维命令

```bash
# Docker 启动
docker compose up -d

# Docker 停止
docker compose down

# 查看容器日志
docker logs -f zpanel

# 本地后端开发启动
cd service
go run main.go
```

## 变更记录

| 日期 | 变更内容 | 原因 |
|------|----------|------|
| 2026-05-21 | 更新 1.0.0 Docker Hub / GHCR 发布、健康检查和默认端口 6521 | 仓库已独立发布并完成容器发布 |
| 2026-05-20 | 补充 Docker 应用管理的部署权限说明 | Docker 管理功能需要访问宿主机 Docker |
| 2026-05-20 | 初始化部署文档 | fork 后记录当前部署形态 |
