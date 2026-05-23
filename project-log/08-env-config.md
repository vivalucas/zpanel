# 环境配置

## 环境要求

| 项目 | 版本 | 说明 |
|------|------|------|
| Node.js | 24.15.0 | 前端构建，使用 fnm 读取 `.node-version` |
| pnpm | 11.1.3 | 当前 `pnpm-lock.yaml` 为 lockfile v9 |
| Go | 1.26.3 | 后端构建 |
| Docker | 未固定 | 容器部署 |
| SQLite | 随 Go sqlite driver | 默认数据库 |
| MySQL | 未固定 | 可选数据库 |
| Redis | 未固定 | 可选缓存 / 队列 |

## 前端环境变量

来自项目根目录 `.env`：

| 变量名 | 说明 | 示例值 | 必填 |
|--------|------|--------|------|
| `VITE_GLOB_API_URL` | 前端请求 API 前缀 | `/api` | 是 |
| `VITE_APP_API_BASE_URL` | Vite 开发代理目标后端 | `http://127.0.0.1:6521/` | 是 |
| `VITE_GLOB_OPEN_LONG_REPLY` | 上游遗留配置，当前用途待确认 | `false` | 否 |
| `VITE_GLOB_APP_PWA` | 是否启用 PWA | `false` | 否 |

## 后端配置文件

配置模板：`service/assets/conf.example.ini`

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `base.http_port` | 后端 HTTP 端口 | `6521` |
| `base.database_drive` | 数据库驱动，支持 `sqlite` / `mysql` | `sqlite` |
| `base.cache_drive` | 缓存驱动，支持 `memory` / `redis` | `memory` |
| `base.queue_drive` | 队列驱动，支持 `memory` / `redis` | `memory` |
| `sqlite.file_path` | SQLite 文件路径 | `./data/database/zpanel.db` |
| `mysql.host` | MySQL 主机 | `127.0.0.1` |
| `mysql.port` | MySQL 端口 | `3306` |
| `mysql.username` | MySQL 用户名 | `root` |
| `mysql.password` | MySQL 密码 | 示例值，不应用于生产 |
| `mysql.db_name` | MySQL 数据库名 | `zpanel` |
| `redis.address` | Redis 地址 | `127.0.0.1:6379` |
| `redis.password` | Redis 密码 | 空 |
| `redis.prefix` | Redis key 前缀 | `zpanel:` |
| `redis.db` | Redis DB 编号 | `0` |

说明：可变运行时数据已收敛到 `./data` 根目录。旧的 `base.source_path` 和 `base.source_temp_path` 已从新配置模板移除。

## 目标运行时目录配置

旧的 `source_path` 只表达“上传文件根目录”，不足以覆盖数据库、上传文件、临时文件、缓存、日志、备份之间的边界。新基线采用以下配置模型：

| 配置项 | 建议默认值 | 说明 |
|--------|------------|------|
| `storage.data_path` | `./data` | 所有可变数据根目录 |
| `storage.uploads_path` | `./data/uploads` | 用户上传、系统上传、公共图库 |
| `storage.temp_path` | `./data/runtime/temp` | 临时上传、导入解压、导出打包 |
| `storage.cache_path` | `./data/runtime/cache` | favicon、缩略图等可再生成缓存 |
| `storage.logs_path` | `./data/runtime/logs` | 运行日志 |
| `sqlite.file_path` | `./data/database/zpanel.db` | SQLite 数据库 |
| `backup.path` | `./data/backups` | 手动 / 定时备份 |

目录原则：

- Docker 部署优先挂载 `./data` 一个主目录，减少用户理解和备份成本。
- 上传文件不再按日期目录保存，改为 `data/uploads/users/{user_id}/{purpose}/{object_key}.{ext}`、`data/uploads/public/gallery/{object_key}.{ext}` 或 `data/uploads/system/{area}/{object_key}.{ext}`。
- 临时文件、缓存、日志和上传资源分离；缓存和临时文件可清理，上传资源和数据库必须备份。
- 配置默认值必须与 `conf.example.ini`、代码内 fallback、README、Compose volume 保持一致。

## 敏感信息规则

- project-log 中只记录变量名、用途、假示例值和配置位置。
- 不写入真实数据库密码、Redis 密码、token、cookie、私钥。
- 生产环境必须替换配置模板中的示例密码。
- 如果真实密钥曾被提交或写入文档，立即轮换密钥，并在 `06-dev-log.md` 记录处理方式。

## 第三方服务

| 服务 | 用途 | 配置方式 |
|------|------|----------|
| Iconify | 前端图标资源 | 前端依赖 / 用户输入图标名 |
| Redis | 可选缓存和队列 | `conf.ini` |
| MySQL | 可选数据库 | `conf.ini` |
| Docker CLI / Docker socket | 可选 Docker 应用管理 | 部署环境 / compose volumes |

## 版本与健康检查

| 项目 | 当前值 | 来源 |
|------|--------|------|
| 产品版本 | `1.0.2` | `service/assets/version` 与 `package.json` |
| 后端版本源 | `1|1.0.2` | `service/assets/version` |
| 健康检查 | `GET /api/healthz` | `service/router/router.go` |
| 默认 HTTP 端口 | `6521` | `service/assets/conf.example.ini` |

## 功能相关配置

| 配置 | 存储位置 | 说明 |
|------|----------|------|
| 登录验证码开关 | `system_setting.system_application` | `loginCaptcha`，由风格设置页面保存 |
| 站点标题 / 图标 / 登录页文案 | `system_setting.site_setting` | 全局站点展示配置 |
| 自定义 CSS / JS | `system_setting.site_setting` | 前端启动时动态注入 |
| 多账号快速切换 | 浏览器 localStorage | 仅本机浏览器保存，不写入服务端 |
| 自定义搜索引擎 | `module_config` | 按用户保存搜索模块配置 |

## 本地开发配置

```bash
# 1. 安装前端依赖
fnm use
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile

# 2. 启动前端开发服务
pnpm run dev

# 3. 启动后端
cd service
go run main.go
```

## 变更记录

| 日期 | 变更内容 | 原因 |
|------|----------|------|
| 2026-05-21 | 移除新配置模板中的 `base.source_path` / `base.source_temp_path` | 当前项目无历史包袱，直接采用 `storage.*` 作为运行时存储配置 |
| 2026-05-21 | 将当前运行时默认路径同步为 `./data` | 基础结构重构已开始落地 |
| 2026-05-21 | 补充目标运行时目录配置 | 后续需要替换按日期分散的上传目录，并统一数据库、上传、缓存、日志、备份路径 |
| 2026-05-21 | 更新默认端口 6521、版本源和健康检查说明 | 1.0.0 发布整理已统一端口和版本 |
| 2026-05-20 | 补充 PRO 功能相关配置位置 | 已新增站点设置、验证码、搜索和 Docker 管理 |
| 2026-05-20 | 初始化环境配置文档 | fork 后记录当前运行配置 |
