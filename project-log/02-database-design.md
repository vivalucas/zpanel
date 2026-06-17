# 数据库设计

> 状态：重设计提议中  
> 日期：2026-05-21  
> 适用范围：ZPanel 1.0.0 之后、正式积累用户数据之前的数据层重构设计  
> 核心判断：当前数据模型能支撑个人自用，但不适合作为长期独立开源项目的数据基线。ZPanel 当前没有历史用户包袱，应优先把数据结构、迁移体系和导入导出契约做扎实。

## 文档定位

本文件是 ZPanel 数据模型的主文档。

需要特别区分两件事：

- **当前实现**：仍继承自原项目，以 GORM `AutoMigrate`、SQLite 默认数据库、若干 JSON 字符串字段为主。
- **目标设计**：下面提出的 ZPanel v1 数据模型重设计。它还没有落库实施，后续真正改表前必须先在 `10-planning-log.md` 补充 ADR，并同步 API、前端类型和迁移脚本。

## 当前实现概览

### 数据库选型

| 项目 | 当前实现 | 说明 |
|------|----------|------|
| 默认数据库 | SQLite | 适合自托管、小规模部署、低维护成本 |
| 可选数据库 | MySQL | 由 `service/assets/conf.example.ini` 的 `database_drive` 控制 |
| ORM / 驱动 | GORM | 使用 `gorm.io/driver/sqlite`、`gorm.io/driver/mysql` |
| 迁移方式 | GORM `AutoMigrate` | 服务启动初始化时自动创建 / 更新表结构 |
| 默认端口 | 6521 | 与 Docker、Compose、README 和开发代理保持一致 |

### 当前 AutoMigrate 表

当前 `service/initialize/database/connect.go` 会自动迁移以下模型：

| 模型 | 当前用途 | 主要问题 |
|------|----------|----------|
| `User` | 用户身份、密码 hash、角色、头像文件引用 | 已从用户表移除 token 落库；后续仍需继续清理旧命名和前端表面字段 |
| `Session` | 登录会话、token hash、过期和撤销状态 | 新会话模型已落地，服务端只保存 token hash |
| `SystemSetting` | 站点级配置 | `config_name` 缺少唯一约束，`config_value` 类型和 schema 不明确 |
| `ItemIcon` | 导航项目 | 图标信息依赖 `IconJson`，分组关系缺少外键和级联策略 |
| `UserConfig` | 用户面板配置和搜索引擎 | 核心配置使用 JSON blob，缺少版本和升级策略 |
| `File` | 上传文件对象元信息 | 已包含 object key、相对路径、MIME、size、sha256、visibility、purpose、status |
| `FileReference` | 文件引用关系 | 已建立模型，业务引用写入仍需继续补齐 |
| `ItemIconGroup` | 导航分组 | 与导航项目关系主要靠业务代码维护 |
| `ModuleConfig` | 模块配置 | `ValueJson` 缺少 schema version 和明确边界 |

`Notice` 模型存在，但当前不在 `AutoMigrate` 列表中，需要在后续梳理公告功能时确认是否保留。

### 当前 ER 概览

```text
User 1──N ItemIcon
User 1──N ItemIconGroup
User 1──1 UserConfig
SystemSetting 存储站点级配置
ModuleConfig 存储模块配置
File 存储上传文件元信息
```

说明：当前关系概览基于模型命名、字段和查询逻辑整理。现有代码没有系统性使用数据库外键，删除、级联和一致性主要依赖业务代码。

### 当前文件存储

旧实现中上传路径由 `base.source_path` 控制，默认是 `./uploads`。图片上传、批量文件上传和站点 favicon 下载都会按日期创建目录：

```text
uploads/
  2026/
    5/
      21/
        <md5>.<ext>
```

这个设计的主要问题：

- 文件是按上传日期散开的，用户想替换、删除或人工排查某个图标 / 壁纸时，需要跨日期目录翻找。
- 数据库只保存 `src` 路径、原文件名和扩展名，缺少稳定对象 ID、用途、可见性、哈希、大小、MIME。
- 路径本身承担了“文件在哪里”和“前端怎么访问”两种职责；修改 `source_path` 后历史文件可能无法访问。
- 删除文件只会删除当前用户选中的 `File` 记录和磁盘文件，无法判断它是否仍被导航图标、壁纸、站点图标等引用。
- 公共图库是“查询所有文件”，不是由文件可见性和引用关系驱动的资源模型。

当前新基线已废弃日期分目录，改为以数据库记录和资源用途为中心的对象存储结构。后续重点是把前端业务状态从 URL 字符串继续迁移到 `file_id`。

## 设计目标

### 必须达成

- 支持 SQLite 默认部署，同时兼容 MySQL。
- 核心业务数据结构化，避免把长期核心数据藏在无 schema 的 JSON 字符串里。
- 所有核心表具备明确主键、唯一约束、索引、时间戳和删除策略。
- 用显式 migration 管理表结构演进，不再只依赖 GORM `AutoMigrate`。
- 用户、会话、导航、文件、系统配置、用户偏好、导入导出之间边界清晰。
- 为未来多用户、公开面板、插件 / 组件、应用中心、备份迁移留扩展空间。
- 在正式用户数据积累前完成，避免未来迁移真实用户数据。

### 暂不追求

- 不做企业级 RBAC / 组织 / 团队模型。
- 不做复杂审计日志系统，但保留未来扩展位置。
- 不引入 PostgreSQL 作为默认依赖；SQLite 仍是默认体验。
- 不为了“完全范式化”牺牲自托管小项目的简单部署体验。

## 当前模型问题总结

### 数据库迁移

当前通过 GORM `AutoMigrate` 创建 / 更新表。这个方式适合早期开发，不适合作为长期发布版本的唯一迁移机制。

主要风险：

- 无法清楚表达字段删除、字段重命名、数据回填。
- 迁移历史不可追溯。
- 多环境行为难以验证。
- 一旦有用户数据，结构演进风险会迅速变高。

建议：引入显式 migration 表和迁移文件。GORM 可继续作为 ORM，但 schema 版本必须独立管理。

### JSON blob 过多

当前存在多处核心数据用 JSON 字符串保存：

- `UserConfig.PanelJson`
- `UserConfig.SearchEngineJson`
- `ModuleConfig.ValueJson`
- `SystemSetting.ConfigValue`
- `ItemIcon.IconJson`

JSON 不是不能用，但当前缺少：

- schema version
- 字段校验
- 默认值升级策略
- 局部更新能力
- 可查询索引

建议：核心业务实体结构化；个性化、插件扩展、样式细节可以用 JSON，但必须有版本和边界。

### 约束不足

当前多表缺少明确唯一约束、外键和级联策略：

- 用户名 / 邮箱没有数据库唯一约束。
- `user_id`、`group_id` 多为普通字段，缺少外键或明确应用层约束说明。
- 删除用户、删除分组、删除文件时依赖业务代码手动处理。
- `system_setting.config_name` 没有唯一约束，理论上可出现重复 key。

建议：数据库层能表达的约束尽量表达；确实为了 SQLite / MySQL 兼容而不启用外键时，也要在模型和 service 层显式保证。

### 认证和会话模型不现代

旧实现中用户表保存 `Token`，更像单设备登录 token。当前新基线已改为 `sessions` 表，数据库只保存 token hash。

问题：

- 不支持多设备会话管理。
- 不方便 token 轮换、撤销和过期。
- token 明文落库风险较高。
- 多账号快速切换依赖前端本地 token 保存，缺少服务端会话模型配合。

已采用：用户和会话拆表。服务端只保存 token hash，不保存明文 token。

### 文件存储模型过薄

旧 `File` 表只记录 `src`、`fileName`、`ext`、`userId` 等基础信息。当前新基线已改为对象资源表。

不足：

- 缺少 size、mime、sha256。
- 缺少 visibility / purpose。
- 缺少存储后端抽象。
- 无法可靠判断文件是否被导航项、壁纸、图标引用。
- 公共图库只是“全局列表视图”，不是明确的资源可见性模型。

已采用：文件资源表设计为对象元数据表，并把可见性、用途、哈希、大小纳入一等字段。

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

### `schema_migrations`

记录数据库结构版本。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| version | string | primary key | 迁移版本，例如 `202605210001` |
| name | string | not null | 迁移名称 |
| applied_at | datetime | not null | 执行时间 |
| checksum | string | nullable | 迁移文件校验 |

说明：

- 后端启动时先跑 migration，再启动服务。
- 禁止发布版本只靠 `AutoMigrate` 修改生产库。

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
- 同一个物理文件可以通过 `sha256` 做重复检测，但第一版不强制做内容去重，避免删除引用时复杂化。
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

不推荐继续使用 `uploads/YYYY/M/D/<hash>.<ext>`。日期目录适合日志归档，不适合用户可管理的媒体资源。

更好的目标是：**目录按用途和所有者组织，文件身份由数据库和 object key 管理**。

### 推荐运行时目录

建议把所有可变运行时数据收敛到一个数据根目录，默认可以是 `./data`。这样 Docker 挂载、备份、迁移都更清楚。

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

旧配置有 `source_path` 和 `source_temp_path`。当前新基线已移除这些配置名，改为：

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `storage.data_path` | `./data` | 所有可变数据根目录 |
| `storage.uploads_path` | `./data/uploads` | 上传资源目录 |
| `storage.temp_path` | `./data/runtime/temp` | 临时文件目录 |
| `storage.cache_path` | `./data/runtime/cache` | 可再生成缓存 |
| `storage.logs_path` | `./data/runtime/logs` | 日志目录 |
| `sqlite.file_path` | `./data/database/zpanel.db` | SQLite 数据库路径 |

这样比单独暴露 `source_path` 更清楚，也能避免“改了上传根目录后历史文件全部失效”的问题。

## 其他基础结构清理项

除了上传目录和数据库字段，还需要同步优化以下基础结构：

| 类别 | 当前问题 | 建议 |
|------|----------|------|
| 运行时目录 | 数据库、上传、缓存、日志分散在不同默认路径 | 收敛到 `data/` 根目录，Docker 只需挂载一个主数据目录 |
| 配置默认值 | `conf.example.ini` 与代码内 `getDefaultConfig()` 默认值不完全一致 | 统一默认端口、上传目录、数据库路径和临时目录 |
| 静态资源 URL | 代码中大量使用路径字符串，例如 `src` / `imageUrl` | API 返回 `file_id` + 临时展示 URL，业务数据保存 `file_id` |
| 文件清理 | 删除只处理当前选中文件 | 增加孤儿文件状态、引用表和清理任务 |
| favicon 下载 | 与普通上传一样落到日期目录 | 改为 `purpose = icon`，进入用户 icons 目录，并记录来源 URL |
| 导入导出 | 文件可只导出路径 | 备份格式应包含文件元数据、引用关系，并可选择嵌入文件内容 |
| 日志与缓存 | 旧代码里存在不同日志路径习惯 | 统一到 `data/runtime/logs` 和 `data/runtime/cache` |

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

建议把配置分成四层：

| 层级 | 存储位置 | 例子 |
|------|----------|------|
| 构建配置 | `.env` / Vite env | 前端 API base URL |
| 服务配置 | `conf.ini` | 端口、数据库、运行模式 |
| 系统配置 | `system_settings` | 站点标题、登录页文案、验证码开关 |
| 用户偏好 | `user_panel_settings` | 主题、语言、布局 |
| 文件资源 | `files` + `file_references` + `data/uploads` | 上传文件、公共图库、壁纸、图标 |

不要把运行时用户偏好写进 `.env` 或 `conf.ini`，也不要把服务启动必需配置藏进数据库。

## 迁移方案

因为 ZPanel 当前按全新项目发布，且不考虑旧 Sun-Panel 配置导入，第一阶段可以直接建立新模型，不需要提供复杂历史迁移。

建议路径：

1. 引入 migration 工具和 `schema_migrations`。
2. 新建目标表。
3. 更新 GORM model 和 repository。
4. 更新 service 层和 API DTO。
5. 更新前端类型与接口。
6. 更新备份导入导出格式。
7. 删除旧表模型和兼容代码。

可选策略：

- 如果本地开发库已有旧表，可提供一次性开发迁移或直接提示清空数据库。
- 发布前明确说明 1.0 数据模型为正式基线。

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

1. 写 ADR：确认 ZPanel 1.0 数据模型作为正式基线，不兼容旧 Sun-Panel 数据结构。
2. 引入 migration 框架和 `schema_migrations`。
3. 先改认证：`users` + `sessions`。
4. 再改导航：`nav_groups` + `nav_items` + `search_engines`。
5. 统一运行时目录：`data/database`、`data/uploads`、`data/runtime`、`data/backups`。
6. 再改文件：`files` + `file_references` + object key 存储。
7. 最后整理系统设置和用户偏好。
8. 补齐导入导出契约和测试。

## 结论

当前最值得优先做的是数据层重构。原因不是现在已经坏了，而是现在还没有用户数据，正是成本最低的窗口。

推荐把 ZPanel 1.0 之后的正式基线定为：

- SQLite 默认，MySQL 兼容。
- 显式 migration 管理结构。
- 用户和 session 拆表。
- 导航、搜索、文件资源结构化。
- 上传文件不再按日期散落，改为 `data/uploads/{scope}/{owner}/{purpose}/{object_key}.{ext}`。
- 业务数据保存 `file_id` 和引用关系，不保存不可迁移的本地路径。
- JSON 只用于 UI / 插件扩展，并带 schema version。
- 导入导出使用稳定备份格式，不直接绑定数据库表。

## 变更记录

| 日期 | 变更内容 | 原因 |
|------|----------|------|
| 2026-05-21 | 同步记录 `data/`、`files`、`file_references`、`sessions` 已开始落地 | 基础结构重构已从设计进入代码实现 |
| 2026-05-21 | 补充文件对象存储、运行时目录和引用关系设计 | 当前日期目录不利于替换、删除、排查和未来迁移 |
| 2026-05-21 | 重写为 ZPanel v1 数据模型重设计主文档 | 当前无历史用户，是调整数据结构的最佳窗口 |
| 2026-05-20 | 补充 PRO 功能实现对数据库的影响 | 当前实现复用既有表，没有引入新迁移 |
| 2026-05-20 | 初始化数据库设计文档 | fork 后建立数据库维护基线 |
