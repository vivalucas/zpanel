# 数据演进提案

用途：实施数据重构时复核尚未采用的结构、理由和取舍；日常改数据先读 [05 数据与迁移](05-data-design.md)。本文件源于 **2026-05-21** 设计，不是当前模型/API 契约，也不授权建表、清库或删除兼容代码。

## 状态与阅读边界

- 已采用：用户/会话拆分、只存 token hash、文件对象元数据与引用、统一 `data/` 目录；2026-09-12 的导入收据/事务/引用兼容约定已归 [05](05-data-design.md) 与 [06](06-api-design.md)。后续同账号上传去重也以 06 为准。
- 未整体实施：显式 `schema_migrations`、导航/搜索/设置规范化、统一 `file_id` 业务引用、备份格式及 repository 分层。下文目标表名、字段类型、枚举和顺序均是提案，不能据此把现有表改名或写入目标字段。
- 当前实现依据：[模型](../service/models/)、[AutoMigrate](../service/initialize/database/connect.go)、[存储](../service/lib/storage/)和[配置示例](../service/assets/conf.example.ini)。SQLite 默认、MySQL 可选；`Notice` 存在但未进入 AutoMigrate，是否保留仍待确认。
- 原提案以“1.0.0 后、尚无历史用户数据”为前提。项目已有生产数据，该前提不再成立；重新实施前须盘点真实存量、兼容/迁移/回滚方案及验收，按 [09](09-current-plan.md) 确认范围，重要取舍归 [11](11-decisions.md)。不得沿用当时“开发库可清空”的建议处理现有数据。

## 当前实现概览

现行事实只维护在 05 与代码。旧 `uploads/YYYY/M/D/<hash>.<ext>`、用户明文 token 和薄文件表已经替代，不再作为待修问题；日期目录会让替换/查找跨目录，URL 同时承担身份和路径会阻碍迁移，单删文件记录也无法判断业务引用。目标设计因此以稳定对象 ID、owner/purpose、引用关系替代路径身份；现有 URL/JSON 兼容仍须保留，不能仅因已建 `file_reference` 就停止扫描存量引用。

## 设计目标

SQLite 默认、MySQL 兼容；核心实体结构化，主键、唯一约束、索引、时间戳和删除策略明确。GORM 可继续作 ORM，结构版本拟由独立 migration 管理；身份、会话、导航、资源、设置和导入导出分域，为公开面板、多用户及模块扩展留空间。

暂不做企业 RBAC/组织/团队、复杂审计或默认 PostgreSQL；不为完全范式化牺牲自托管部署简单性。

## 当前模型问题总结

以下是仍需按真实代码/存量复核的重构动机，不是已确认的新缺陷：

- `AutoMigrate` 难表达删列、重命名和数据回填，也缺独立迁移历史；显式 migration 需跨 SQLite/MySQL 验证。
- `UserConfig.PanelJson/SearchEngineJson`、`ModuleConfig.ValueJson`、`SystemSetting.ConfigValue`、`ItemIcon.IconJson` 的长期演进需版本、校验、默认升级和边界；核心权限/查询字段拟结构化，UI/插件细节可保留 JSON。
- 删除和级联主要依赖应用层；须逐表核对唯一性、外键与事务，不能泛称“所有约束都缺失”。例如当前 User 已有 username/mail 唯一索引，旧提案的“无唯一约束”判断已过期；系统 key、跨实体一致性和外键策略仍按源码复核。
- 会话、资源元数据和运行时目录已采用的部分不重复重建。保留旧模型命名、URL/JSON 兼容与尚未转为 `file_id` 的业务字段，是后续迁移的实际边界。

## 目标数据域

```text
Identity
  ├── users
  └── sessions

Navigation
  ├── nav_groups
  ├── nav_items
  └── search_engines

Preferences
  ├── user_panel_settings
  └── user_ui_settings

Resources
  ├── files
  └── file_references

System
  ├── system_settings
  ├── schema_migrations
  └── optional notices / audit logs
```

## 表设计提案

以下保留原目标 schema 供逐项评估；已采用部分仍以模型为准。尤其 `users.role/status` 的字符串枚举、`nav_items.title` 的 120 长度等不是当前协议（当前导航/分组标题为 1–200 Unicode 字符）。

### `schema_migrations`

记录数据库结构版本。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| version | string | primary key | 迁移版本，例如 `202605210001` |
| name | string | not null | 迁移名称 |
| applied_at | datetime | not null | 执行时间 |
| checksum | string | nullable | 迁移文件校验 |

说明：

- 目标顺序为后端启动先跑 migration，再启动服务。
- 此为拟议验收要求；现行启动仍使用 `AutoMigrate`，引入新机制前须提供迁移与回滚方案。

### `users`

用户身份表，只保存用户身份和状态，不保存会话明文。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint64 | primary key | 用户 ID |
| username | string(64) | unique, not null | 登录名 |
| email | string(255) | unique, nullable | 邮箱 |
| display_name | string(64) | not null | 显示名 |
| avatar_file_id | uint64 | nullable, index | 头像文件 |
| password_hash | string(255) | not null | bcrypt / argon2id hash |
| password_algo | string(32) | not null | `bcrypt` / `argon2id` |
| role | string(32) | not null, index | `admin` / `user` |
| status | string(32) | not null, index | `active` / `disabled` |
| last_login_at | datetime | nullable | 最近登录 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | nullable, index | 软删除 |

建议：

- 删除 `referral_code`，除非明确要做邀请系统。
- 不再把 token 放在用户表。
- 默认管理员首次创建后必须引导改密码；至少要在 UI 明确提示。

### `sessions`

登录会话表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint64 | primary key | 会话 ID |
| user_id | uint64 | index, not null | 用户 ID |
| token_hash | string(64) | unique, not null | SHA-256 token hash |
| name | string(128) | nullable | 设备 / 会话名 |
| ip_address | string(64) | nullable | 登录 IP |
| user_agent | string(512) | nullable | UA |
| created_at | datetime | not null | 创建时间 |
| last_seen_at | datetime | nullable | 最近使用 |
| expires_at | datetime | not null, index | 过期时间 |
| revoked_at | datetime | nullable, index | 撤销时间 |

设计说明：

- 前端保存明文 token，服务端只保存 hash。
- 支持多设备登录和单个会话撤销。
- 多账号快速切换可以基于多个 session 实现，而不是只有 localStorage 里堆 token。
- 会话恢复时必须同时复查关联用户状态；当前数值 `status != 1` 的账号即使 session 未过期也不能认证；若未来采用本表字符串枚举，必须同步转换该判断。

### `nav_groups`

导航分组。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint64 | primary key | 分组 ID |
| user_id | uint64 | index, not null | 所属用户 |
| title | string(80) | not null | 分组名称 |
| description | string(500) | nullable | 描述 |
| icon | string(255) | nullable | 分组图标 |
| sort_order | int | not null, index | 排序 |
| is_visible | bool | not null | 是否显示 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | nullable, index | 软删除 |

建议索引：

- `(user_id, sort_order)`
- `(user_id, title)` 可选唯一，取决于是否允许同名分组。

### `nav_items`

导航项目。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint64 | primary key | 项目 ID |
| user_id | uint64 | index, not null | 所属用户 |
| group_id | uint64 | index, not null | 所属分组 |
| title | string(120) | not null | 标题 |
| description | string(1000) | nullable | 描述 |
| url_external | string(2048) | nullable | 外网 / 默认 URL |
| url_internal | string(2048) | nullable | 内网 URL |
| open_target | string(32) | not null | `current` / `new_tab` / `iframe` |
| icon_type | string(32) | not null | `image` / `text` / `iconify` / `favicon` |
| icon_value | string(2048) | nullable | 图标值、URL 或图标名 |
| icon_text | string(16) | nullable | 文本图标内容 |
| icon_bg_color | string(32) | nullable | 背景色 |
| file_id | uint64 | nullable, index | 引用上传文件 |
| sort_order | int | not null, index | 排序 |
| is_visible | bool | not null | 是否显示 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | nullable, index | 软删除 |

建议索引：

- `(user_id, group_id, sort_order)`
- `(user_id, title)`

设计说明：

- 替代当前 `IconJson`。
- `icon_type` + `icon_value` 足够表达大多数图标场景。
- 复杂图标扩展可放 `icon_meta_json`，但不要让核心字段依赖 JSON。

### `search_engines`

搜索引擎独立成表，不放在 `UserConfig.SearchEngineJson`。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint64 | primary key | 搜索引擎 ID |
| user_id | uint64 | index, not null | 所属用户 |
| scope | string(32) | not null, index | `builtin` / `user` |
| name | string(80) | not null | 名称 |
| url_template | string(2048) | not null | 搜索 URL 模板 |
| icon | string(2048) | nullable | 图标 |
| sort_order | int | not null | 排序 |
| is_enabled | bool | not null | 是否启用 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

建议：

- URL 模板使用 `{keyword}` 占位。
- 内置搜索引擎通过 `scope = builtin` 表达，用户自定义搜索引擎通过 `scope = user` 表达。

### `user_panel_settings`

用户面板配置。这里可以保留 JSON，但必须有 schema version。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| user_id | uint64 | primary key | 用户 ID |
| schema_version | int | not null | 配置 schema 版本 |
| network_mode | string(32) | not null | `lan` / `wan` |
| theme | string(32) | not null | `light` / `dark` / `auto` |
| language | string(32) | not null | locale |
| wallpaper_file_id | uint64 | nullable, index | 当前壁纸文件 |
| layout_json | text/json | not null | 布局和外观细节 |
| widget_json | text/json | nullable | 小组件配置 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

设计说明：

- 常用查询、权限、行为字段结构化。
- 纯 UI 外观可以保留 JSON。
- `layout_json` 必须带前端类型定义和默认值升级函数。

### `files`

上传资源表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint64 | primary key | 文件 ID |
| owner_id | uint64 | index, not null | 上传用户 |
| storage | string(32) | not null | `local`，未来可扩展到 `s3` / `webdav` |
| object_key | string(255) | unique, not null | 稳定对象 key，建议使用 UUIDv7 / ULID |
| relative_path | string(2048) | unique, not null | 相对上传根目录的存储路径 |
| source_url | string(2048) | nullable | 远程抓取来源，例如 favicon 原始 URL |
| original_name | string(255) | not null | 原始文件名 |
| mime_type | string(255) | not null | MIME |
| ext | string(32) | not null | 扩展名 |
| size | int64 | not null | 字节数 |
| sha256 | string(64) | index, nullable | 内容哈希 |
| visibility | string(32) | not null, index | `private` / `public` / `system` |
| purpose | string(32) | not null, index | `icon` / `wallpaper` / `avatar` / `site_icon` / `attachment` / `backup` |
| status | string(32) | not null, index | `active` / `orphaned` / `deleted` / `delete_failed` |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |
| deleted_at | datetime | nullable, index | 软删除 |

设计说明：

- 公共图库可以通过 `visibility = public` 实现。
- 未来接入 S3 / WebDAV / 对象存储时，`storage`、`object_key` 和 `relative_path` 不需要推翻表结构。
- 文件访问 URL 不建议直接永久存库。前端保存 `file_id` 或 API 返回的资源 URL，后端根据当前配置生成访问地址。
- `source_url` 只记录远程抓取来源，不作为本实例的访问地址使用。
- 原第一版不强制内容去重，以免删除引用复杂化；后续已实现的同账号有限去重及跨账号/历史文件边界见 [06](06-api-design.md)，不据此推导全局去重。
- 删除文件时先检查引用关系；仍被引用的文件不应直接物理删除。

### `file_references`

文件引用关系表，用来回答“这个文件正在被哪里使用”。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint64 | primary key | 引用 ID |
| file_id | uint64 | index, not null | 文件 ID |
| owner_id | uint64 | index, not null | 所属用户 |
| ref_type | string(64) | not null, index | `nav_item_icon` / `panel_wallpaper` / `user_avatar` / `site_icon` / `login_background` |
| ref_id | uint64 | nullable, index | 引用实体 ID；系统配置可为空 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

设计说明：

- 替换壁纸或图标时，先新增新文件引用，再移除旧引用。
- 清理孤儿文件时只处理没有引用且超过保留期的文件。
- 文件管理器可以直接显示“被 3 个导航项引用”“当前登录页背景”等信息。
- 这比扫描 URL 字符串可靠，也能支持后续一键替换资源。

## 文件目录设计

### 当前问题

日期目录的旧问题已由对象资源结构替代。继续演进的目标是目录按用途和所有者组织、文件身份由数据库和 object key 管理，而不是再次迁移已落地的目录。

### 推荐运行时目录

以下是原目标目录示意，已采用的 `data/` 根目录不代表全部子目录或自动备份均已实现。当前路径/派生缓存和 WebP 限制见 05、06 及配置；不能按示意手工重排运行数据。

```text
data/
  database/
    zpanel.db
  uploads/
    users/
      {user_id}/
        icons/
          {object_key}.{ext}
        wallpapers/
          {object_key}.{ext}
        avatars/
          {object_key}.{ext}
        attachments/
          {object_key}.{ext}
    public/
      gallery/
        {object_key}.{ext}
    system/
      site/
        {object_key}.{ext}
      login/
        {object_key}.{ext}
  thumbnails/
    {file_id}/
      small.webp
      medium.webp
  backups/
    manual/
    scheduled/
  runtime/
    temp/
    cache/
    logs/
```

目录职责：

| 目录 | 用途 | 是否应备份 |
|------|------|------------|
| `data/database/` | SQLite 数据库 | 是 |
| `data/uploads/` | 用户和系统上传资源 | 是 |
| `data/backups/` | 手动 / 定时备份包 | 是，可按策略清理 |
| `data/runtime/temp/` | 上传临时文件、导入导出临时解压 | 否 |
| `data/runtime/cache/` | favicon、缩略图等可再生成缓存 | 否 |
| `data/runtime/logs/` | 运行日志 | 可选，通常按保留期清理 |
| `data/thumbnails/` | 缩略图缓存 | 可选，可再生成 |

### 文件路径规则

第一版推荐规则：

- `object_key` 使用 UUIDv7 / ULID，避免原文件名、日期、用户输入进入真实路径。
- 原文件名只保存在 `files.original_name`，用于 UI 展示。
- 对用户上传文件，路径包含 `users/{user_id}/{purpose}/`，方便人工排查。
- 对公共图库，路径进入 `public/gallery/`，但权限仍以数据库的 `visibility` 和 API 判断为准。
- 对站点图标、登录背景等系统资源，路径进入 `system/site/` 或 `system/login/`。
- 文件扩展名从 MIME 和白名单推导，不能只信任用户上传的文件名。
- 后端返回资源时通过 `/uploads/...` 或 `/api/files/{id}/content` 统一生成，不让前端长期持有本地绝对路径。

### 替换和删除规则

替换资源时：

1. 上传新文件并创建 `files` 记录。
2. 更新业务实体，例如 `nav_items.file_id` 或 `user_panel_settings.wallpaper_file_id`。
3. 写入新的 `file_references`。
4. 移除旧引用。
5. 如果旧文件没有任何引用，标记为 `orphaned`，进入可清理列表。

删除资源时：

- 有引用：默认拒绝删除，并在 UI 展示引用位置。
- 无引用：软删除数据库记录，并删除物理文件。
- 物理文件删除失败：保留记录状态为 `deleted` 或 `delete_failed`，允许后台任务重试。

这个策略解决用户提出的“替换后想删掉旧图，还要按日期翻目录”的问题。用户应在文件管理器里按用途、名称、上传时间、引用状态筛选，而不是直接进磁盘目录找文件。

### 配置建议

`source_path` / `source_temp_path` 已由统一存储路径替代；当前 `storage.*` 与 `sqlite.file_path` 的名称、默认值和迁机方法分别以[配置示例](../service/assets/conf.example.ini)、[07 环境](07-environment.md)、[部署文档](../docs/deployment.zh-CN.md)为准。可变运行数据统一根目录便于挂载和备份，资源访问地址由后端生成，避免上传根目录变更破坏永久 URL。

其余待演进项：业务保存 `file_id` 而非路径；基于引用和保留期管理孤儿文件；备份可包含元数据、引用和可选文件内容；favicon 保留来源 URL。已落地部分不重复建实体。

### `system_settings`

系统设置表，保留 key-value 形式，但必须约束 key 唯一，并引入类型和 schema。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| key | string(128) | primary key | 配置 key |
| value | text/json | not null | 配置值 |
| value_type | string(32) | not null | `string` / `bool` / `number` / `json` |
| schema_version | int | not null | 配置 schema 版本 |
| is_public | bool | not null | 是否允许前端匿名读取 |
| updated_at | datetime | not null | 更新时间 |

适合存放：

- 站点标题、站点图标、登录页文案。
- 登录验证码开关。
- 全局自定义 CSS / JS。
- Docker 管理开关和安全策略。

不适合存放：

- 导航项。
- 搜索引擎列表。
- 用户会话。
- 文件资源。

### `notices`

公告功能如继续保留，建议明确为系统消息表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | uint64 | primary key | 公告 ID |
| title | string(120) | not null | 标题 |
| content | text | not null | 内容 |
| display_type | string(32) | not null, index | 展示位置 |
| is_enabled | bool | not null | 是否启用 |
| starts_at | datetime | nullable | 开始时间 |
| ends_at | datetime | nullable | 结束时间 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

当前 `Notice` 未纳入 `AutoMigrate`，后续要么补齐并真正使用，要么从模型和 API 中清理。

## JSON 使用规则

允许使用 JSON 的场景：

- UI 布局细节。
- 插件 / 模块的扩展配置。
- 不需要跨用户查询、不需要排序过滤、不参与权限判断的数据。

不建议使用 JSON 的场景：

- 用户身份。
- 会话。
- 导航项目主体字段。
- 搜索引擎。
- 文件资源元数据。
- 系统配置 key 本身。

所有保留 JSON 的字段必须满足：

- 有 `schema_version`。
- 有 TypeScript 类型定义。
- 有后端 DTO 校验。
- 有默认值升级函数。
- 导入导出时携带版本号。

## 导入导出格式

建议把备份迁移设计成独立稳定契约，而不是直接导出数据库表。

```json
{
  "format": "zpanel.backup",
  "version": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-05-21T00:00:00Z",
  "users": [],
  "navGroups": [],
  "navItems": [],
  "searchEngines": [],
  "panelSettings": [],
  "files": [],
  "fileReferences": [],
  "systemSettings": {}
}
```

原则：

- 导出格式版本独立于数据库 migration 版本。
- 导入时做 schema 校验和版本升级。
- 密码 hash、session token、私密密钥默认不导出，除非明确选择完整迁移模式。
- 文件可选择嵌入压缩包，或只导出元数据和 object key。
- 不建议导出本机绝对路径；导入时由目标实例重新生成 `relative_path`。

## 配置边界

配置职责分层：

| 层级 | 存储位置 | 例子 |
|------|----------|------|
| 构建配置 | `.env` / Vite env | 前端 API base URL |
| 服务配置 | `conf.ini` | 端口、数据库、运行模式 |
| 系统配置 | `system_settings` | 站点标题、登录页文案、验证码开关 |
| 用户偏好 | `user_panel_settings` | 主题、语言、布局 |
| 文件资源 | `files` + `file_references` + `data/uploads` | 上传文件、公共图库、壁纸、图标 |

不要把运行时用户偏好写进 `.env` 或 `conf.ini`，也不要把服务启动必需配置藏进数据库。

## 迁移方案

原方案面向全新项目，顺序为 migration/`schema_migrations` → 目标表 → model/repository → service/API DTO → 前端类型/接口 → 备份契约 → 移除旧模型与兼容。该顺序仅作依赖参考；当前已有生产数据，必须先明确存量映射、回填/重命名、失败回滚与 SQLite/MySQL 验收，再批准实施。只有迁移与兼容验证完成后才可移除旧代码，不把“清空开发库”当作生产迁移方法。

只维护 ZPanel 自身配置格式，不因此新增其他项目配置兼容承诺；现有 ZPanel 数据和 URL/JSON 兼容不能被该边界豁免。

## 后端分层建议

当前部分模型方法直接操作全局 `models.Db`，长期会让测试和事务变困难。

建议逐步调整为：

```text
api handler
  -> service
    -> repository
      -> gorm.DB
```

原则：

- handler 只处理请求、响应、权限上下文。
- service 承载业务规则。
- repository 只做数据库读写。
- 事务由 service 层开启并传递。
- model 尽量只保留结构定义，不承载大量业务查询。

## 索引与约束原则

最低要求：

- `users.username` unique。
- `users.email` unique nullable。
- `sessions.token_hash` unique。
- `system_settings.key` primary key 或 unique。
- 导航表按 `(user_id, sort_order)`、`(user_id, group_id, sort_order)` 建索引。
- 文件表按 `owner_id`、`visibility`、`purpose`、`status`、`sha256` 建索引。
- 文件引用表按 `file_id`、`owner_id`、`ref_type`、`ref_id` 建索引。

外键策略：

- SQLite / MySQL 都支持外键，但需要注意 SQLite 的 `PRAGMA foreign_keys = ON`。
- 如果为了兼容性暂不使用数据库外键，必须在 repository / service 层定义删除和一致性规则。
- 不能处于“数据库没有外键，代码也没有明确约束”的中间状态。

## 安全与隐私

必须调整：

- 不保存明文 token，只保存 token hash。
- 密码字段统一命名为 `password_hash`。
- 记录密码算法，方便未来升级。
- 登录 session 支持过期和撤销。
- 自定义 JS / Docker 管理等高风险功能要有管理员权限边界。

建议后续增加：

- `audit_logs` 轻量审计表，用于记录登录、配置变更、Docker 操作等高风险行为。
- API key / open API token 独立表，不与用户 session 混用。

## 开放问题

| 问题 | 倾向 | 备注 |
|------|------|------|
| 是否启用数据库外键 | 倾向启用或至少在 service 层严格模拟 | 需要评估 SQLite 和 MySQL 兼容行为 |
| 主键使用 uint 还是 uint64 | 倾向 uint64 | 长期更稳，代价很低 |
| 搜索引擎内置数据放库还是代码 | 倾向代码定义 + 用户覆盖 | 避免内置数据污染用户备份 |
| 公共图库是文件可见性还是单独表 | 倾向文件可见性字段 | 简单、直接、可扩展 |
| 上传目录是否继续按日期分层 | 不继续 | 改为 owner + purpose + object key |
| 是否把可变数据统一到 `data/` | 倾向统一 | Docker、备份、迁移都会更清楚 |
| 是否保留 Notice | 待确认 | 当前模型存在但未 AutoMigrate |
| 是否马上做 audit logs | 暂缓 | 先把认证、导航、文件模型打稳 |

## 建议落地顺序

原顺序为确认正式数据基线 → migration → 认证 → 导航/搜索 → 运行时目录 → 文件/引用 → 系统设置/偏好 → 备份与测试。认证、对象资源和目录已有实现，不重新按历史顺序重做；先用本文件状态表核对，再针对未实施项立计划。

## 来源与维护

源自 2026-05-20 数据维护记录及 2026-05-21 ZPanel v1 重设计；同日开始采用 `data/`、files/file_references、sessions。2026-09-12 修复新增的现行事务、导入幂等及资源引用边界归 [05](05-data-design.md)、[06](06-api-design.md)，本页只维护剩余提案与取舍。后续确认采用、否决或改变前提时更新对应段落，不追加开发流水账。
