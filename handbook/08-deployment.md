# 部署与发行

部署、升级和完整恢复统一维护在 [中文部署指南](../docs/deployment.zh-CN.md) 与 [英文部署指南](../docs/deployment.md)，根 README 提供首次安装入口。两份指南按语言分别保留可执行流程；配置键/默认值以 [INI 模板](../service/assets/conf.example.ini) 为准。

默认单实例 SQLite，完整备份 conf/data；配置导出不含上传文件，旧镜像不保证兼容已迁移数据库。可信代理须显式配置；Docker socket 权限单独核对。

main push 运行 [CI](../.github/workflows/ci.yml)；容器与 Release 由 v* 标签或手动工作流触发，操作授权见 [Git 与跨设备同步](README.md#git-与跨设备同步)。普通文档提交不升级版本、不创建标签或部署。当前生产版本见 [01](01-current-status.md)，1.2.11 正式资产/M5 升级证据见 [18](18-release-deployment-evidence.md)；完整恢复、MySQL/Redis 集成仍待实机验证。

M5当前采用本地构建镜像（基线/证据见01）：本机按目标`linux/amd64`构建，核对版本和源码后以`docker save`传输、目标`docker load`，校验传输hash及镜像配置/RootFS；先用真实配置/数据的隔离副本预检。目标执行目录为`/opt/zpanel`，仅更新Compose的ZPanel镜像，使用`docker compose up -d --no-deps --no-build --pull never zpanel`；不要把本地tag改回仓库镜像或以pull代替此流程。确认健康、版本、数据与其他服务一致后，按明确清单清理已授权旧产物；无旧镜像/备份时不能承诺原地回滚。此处记录M5已确认路径，不扩大其他环境的部署授权。
