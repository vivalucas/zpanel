# 外部服务 / API 参考

这里记录运行时或开发时依赖的外部服务和参考文档。不记录真实密钥。

---

## 外部服务清单

| 服务 | 用途 | 官方文档 | 备注 |
|------|------|----------|------|
| Iconify | 图标库 | https://icon-sets.iconify.design/ | 用户可组合图标 |
| GitHub Container Registry | 镜像发布 | https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry | 当前使用 `ghcr.io/vivalucas/zpanel` |
| GitHub Releases | 版本发布 | https://docs.github.com/repositories/releasing-projects-on-github | 关于页和 README 指向当前仓库 |
| Docker CLI | 容器管理 | https://docs.docker.com/reference/cli/docker/ | 可选管理员功能 |
| Redis | 可选缓存 / 队列 | https://redis.io/docs/ | 非默认依赖 |
| MySQL | 可选数据库 | https://dev.mysql.com/doc/ | 非默认依赖 |

---

## Iconify

### 基本信息

| 项目 | 内容 |
|------|------|
| 文档地址 | https://icon-sets.iconify.design/ |
| API 地址 | 以前端依赖和图标名使用为主 |
| 认证方式 | 无 |
| SDK / 包名 | `@iconify/vue` |
| 关键限制 | 具体图标集和名称需以 Iconify 当前数据为准 |

### 常用接口 / 模型

| 名称 | 说明 | 备注 |
|------|------|------|
| Iconify icon name | 图标名 | 例如 `mdi:home` |

### 已知问题 / 踩坑记录

| 日期 | 问题 | 解决方案 |
|------|------|------|
| 2026-05-20 | 暂未专项验证 Iconify 行为 | 后续做图标功能测试时补充 |

---

## Docker CLI

### 基本信息

| 项目 | 内容 |
|------|------|
| 文档地址 | https://docs.docker.com/reference/cli/docker/ |
| 认证方式 | 本机 Docker 权限 / Docker socket |
| SDK / 包名 | 当前未使用 SDK，后端通过 CLI 调用 |
| 关键限制 | ZPanel 进程必须能执行 `docker` 命令并具备容器管理权限 |

### 当前使用的命令

| 命令 | 用途 |
|------|------|
| `docker ps -a --format "{{json .}}"` | 获取容器列表 |
| `docker stats --no-stream --format "{{json .}}"` | 获取资源占用快照 |
| `docker start/stop/restart/pause/unpause` | 容器操作 |
| `docker logs --tail N --timestamps` | 获取容器日志 |

---

## 变更记录

| 日期 | 变更内容 | 原因 |
|------|----------|------|
| 2026-05-20 | 补充 Docker CLI 外部依赖说明 | Docker 应用管理功能依赖 Docker CLI |
| 2026-05-20 | 初始化外部服务参考 | fork 后建立维护文档 |
