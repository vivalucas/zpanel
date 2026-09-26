# 部署与发行

部署、升级和完整恢复统一维护在 [中文部署指南](../docs/deployment.zh-CN.md) 与 [英文部署指南](../docs/deployment.md)，根 README 提供使用入口。

默认单实例 SQLite，完整备份 conf/data；配置导出不含上传文件，旧镜像不保证兼容已迁移数据库。可信代理须显式配置；Docker socket 权限单独核对。

main push 运行 ci.yml；容器与 Release 由 v* 标签或手动工作流触发。普通文档提交不升级版本、不创建标签或部署。实际 Docker、Ubuntu 恢复、MySQL/Redis 集成仍待实机验证。
