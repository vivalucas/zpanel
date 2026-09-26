# 数据与迁移

当前实现依据 service/models 与 service/initialize/database 的 AutoMigrate。现有用户、session、导航项/分组、moduleConfig、userConfig、system_setting、文件与引用、import_receipt 等模型以源码为准。

长期语义：账号隔离；管理员最小响应不泄露认证字段；密码写入与 session 撤销原子；保留至少一个启用管理员。文件删除/替换核对当前业务引用；import_receipt 保证请求幂等，导入失败不留下部分业务数据。

默认数据根 ./data；数据库、uploads、runtime/temp/cache/logs、backups 分区。备份目录是预留，不代表自动备份；完整迁机另含 conf 和实际持久化配置。

[14 数据演进提案](14-data-evolution.md) 保留 schema_migrations、规范化设置/搜索等未来设计，不代表当前表全部已更名或迁移。修改数据必须检查模型、AutoMigrate 和真实存量，不在文档整理中执行数据库重建。
