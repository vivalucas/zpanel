# 外部服务与参考

按接入主题读取；版本/用法以清单、锁文件和实现为准，不在这里维护重复接口或变更流水账。不记录真实密钥。

| 来源 | 本项目采用部分与边界 | 官方入口 / 本地依据 |
| --- | --- | --- |
| Iconify | React 图标组件和 `mdi:home` 等图标名；无认证。图标集/名称需按当时数据核对，外部图标集及网络行为未单独专项验收 | [图标集](https://icon-sets.iconify.design/)；[ItemIcon](../src/features/home/ItemIcon.tsx)、[package.json](../package.json) 的 `@iconify/react`（旧 `@iconify/vue` 已随 Vue 移除） |
| GitHub Container Registry | 镜像发布到 `ghcr.io/vivalucas/zpanel` | [官方文档](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry)；[08 发行](08-deployment.md) |
| GitHub Releases | 正式版本、资产、关于页和 README 的仓库入口 | [官方文档](https://docs.github.com/repositories/releasing-projects-on-github)；[08](08-deployment.md)、[当前状态](01-current-status.md) |
| Docker CLI | 可选管理员功能；后端直接执行 CLI，未用 SDK。服务进程需有 `docker` 命令及宿主机/socket 权限 | [CLI 文档](https://docs.docker.com/reference/cli/docker/)；[实现](../service/api/api_v1/system/docker.go)、[06 契约](06-api-design.md) |
| Redis | 可选缓存/队列驱动，默认使用内存 | [官方文档](https://redis.io/docs/)；[环境](07-environment.md)、[队列驱动](../service/global/queue.go) |
| MySQL | 可选数据库，SQLite 仍为默认 | [官方文档](https://dev.mysql.com/doc/)；[05 数据](05-data-design.md)、[环境](07-environment.md) |

Docker 使用 `ps -a --format "{{json .}}"`、`stats --no-stream --format "{{json .}}"`、`start/stop/restart/pause/unpause`、`logs --tail N --timestamps`。参数、时限、输出上限与错误恢复以 06 和实现为准；不在参考页另建一份操作契约。
