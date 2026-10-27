# 数据与迁移

当前结构以 [models](../service/models) 和 [AutoMigrate](../service/initialize/database/connect.go) 为准；本文维护源码字段表未表达的业务语义，[06](06-api-design.md)维护请求契约。

账号隔离；管理员资料响应不泄露认证字段。密码哈希更新与 session 撤销共同成功，否则回滚；角色修改/删除事务保留至少一个启用管理员，MySQL 通过管理员行锁串行检查，不能用先查后写替代。

`import_receipt` 的 `user_id` + `request_id` 联合主键和 SHA256 `payload_hash` 区分同请求重试与改动内容。收据与导入数据同事务提交，失败无部分业务数据；不储存原始配置或凭据，完整数据库备份必须保留收据。实现/回归见 [import.go](../service/api/api_v1/panel/import.go)、[import_test.go](../service/api/api_v1/panel/import_test.go)。

`file_reference` 尚非引用的唯一来源。删除/详情还扫描 `item_icon`、`user_config`、`user`、`module_config`、`system_setting` 的既有 URL/文件 ID，兼容存量 JSON，不做破坏性迁移。替换只改本人引用（管理员额外可改站点），保留原文件；无引用才允许物理删除。引用写入、删除及上传复用/创建共用单进程锁，拒绝重新保存已软删本地 URL；锁前完成上传解析/指纹，避免慢客户端阻塞写入。多实例共享写入须另引入协调。实现/回归见 [file_usage.go](../service/models/file_usage.go)、[file_usage_test.go](../service/models/file_usage_test.go)、[ResourceMutation](../service/api/api_v1/middleware/resource_mutation.go)、[上传回归](../service/api/api_v1/system/file_upload_test.go)。

导航项目和分组标题统一为 1–200 个 Unicode 字符，模型容量为 varchar(200)，经既有 AutoMigrate 扩容；不新增表或重建数据。SQLite 回归通过，真实 MySQL 扩容尚未实测。分组删除可在同一事务中先迁移应用到本人保留的分组；至少保留一个分组。

站点展示配置与验证码开关原子保存。配置读取不写数据库；只有缺失记录使用默认值，读取失败/安全配置损坏返回错误。旧外观字段损坏可临时采用默认值并返回 panelWarnings，用户调整设置触发自动保存或明确点击修复后才修复原值，打开页面本身不写回。

人工首页文字沿用 iconTextColor；空/缺键/旧默认只在显示时解析为白，不能批量改写存量颜色。自动对比度仍用既有 JSON 开关，缺键不覆盖选择。模糊/暗度的 0–10 档只是显示映射，内部分别保留 0–30/0–1；读取或保存其他字段不量化旧值。这些显示调整及上传去重不新增表、字段或迁移。

默认数据根 ./data；数据库、uploads、runtime/temp/cache/logs、backups 分区。备份目录是预留，不代表自动备份；完整迁机另含 conf 和实际持久化配置。

[14 数据演进提案](14-data-evolution.md) 保留 schema_migrations、规范化设置/搜索等未来设计，不代表当前表全部已更名或迁移。修改数据必须检查模型、AutoMigrate 和真实存量，不在文档整理中执行数据库重建。
