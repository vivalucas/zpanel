# 部署

## 部署环境

| 环境 | 用途 | 地址 |
|------|------|------|
| 开发 | 本地前后端调试 | 前端 Vite 默认 `1002`，后端默认 `6521` |
| 预发布 | 暂无 | 待规划 |
| 生产 | 自托管 Docker / 二进制部署 | 用户自定义 |

## 部署步骤

用户操作以 [中文安装指南](../README.zh-CN.md#ubuntu-局域网部署推荐)、[中文配置与运维参考](../docs/deployment.zh-CN.md) 和 [English operations](../docs/deployment.md) 为准，避免复制多份已失配的命令。

- 发布目标：`vivalucas/zpanel:1.1.8`、`ghcr.io/vivalucas/zpanel:1.1.8`，以及两处 `latest`；具体发布状态以工作流结果为准。
- 默认 Docker 挂载 `./conf:/app/conf`、`./data:/app/data`，使用 SQLite 与 memory 缓存/队列；不需要安装前端或 Go 工具链。
- 仓库 Compose 默认绑定 `127.0.0.1:6521:6521`，适合宿主机反代；中文指南明确绑定局域网 IP，且要求变量非空。
- Compose 与 `.env` 修改用 `up -d` 重新创建；INI 修改用 `restart`；前端环境变量是构建配置，不是容器运行时 INI 覆盖。
- Docker socket 可选，保留数据挂载，设置实际 GID 的 `group_add`；不要覆盖 `.env` 或用 `user: 0:0` 规避入口降权。
- 完整备份需停机归档 conf/data 与部署配置；恢复到干净目录并匹配旧镜像。启动会 AutoMigrate，不能宣称任意降级兼容。
- 自定义路径需要额外持久化和权限；MySQL 独立备份。backups_path 只预留目录，不代表已有自动备份任务。
- 二进制包只提供 Linux amd64，需匹配运行库、固定工作目录和可写 conf/data/lang；默认推荐容器。

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
| 2026-06-04 | 补充 Docker 管理页 socket group 配置说明 | 仅宿主机安装 Docker 不代表 ZPanel 容器有权限访问 Docker socket |
| 2026-05-20 | 补充 Docker 应用管理的部署权限说明 | Docker 管理功能需要访问宿主机 Docker |
| 2026-05-20 | 初始化部署文档 | fork 后记录当前部署形态 |

## 2026-09-12 代理与验收补充

反代部署需在 `conf/conf.ini` 的 `[base]` 设置 `trusted_proxies`，填实际受控代理的 IP/CIDR，逗号分隔；留空不信任 X-Forwarded-For。不要使用全网 CIDR。修改后重启，并从两个客户端核查登录限流不会共用代理 IP。代理自身必须正确覆盖转发头，避免让客户端控制可信链。

本轮新增 import_receipt 表由 AutoMigrate 创建；升级前仍应备份 conf/data。`.zpanel.json` 只保存配置，不替代完整目录备份。

资源写入互斥目前针对一个 ZPanel 进程，未宣称支持多副本共享数据库/上传目录的强一致性。真实 Docker、MySQL 和 Redis 部署仍需实机验收。
