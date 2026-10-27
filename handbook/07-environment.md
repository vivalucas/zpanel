# 环境与换机

## 环境要求

| 工具 | 固定版本与权威来源 | 用途 |
|---|---|---|
| Node.js | 24.15.0，[.node-version](../.node-version) | 前端开发与构建，`fnm use` 读取版本 |
| pnpm | 11.1.3，[package.json](../package.json) 的 `packageManager` | 沿用 [pnpm-lock.yaml](../pnpm-lock.yaml)，当前 lockfile v9 |
| Go | 1.26.3，[service/go.mod](../service/go.mod) | 后端开发、构建与浏览器测试服务 |

Docker、可选 MySQL/Redis 未固定版本；SQLite 随 Go driver。默认 Docker 部署不需要宿主机安装开发工具链。安装依赖、启动与验证命令统一见 [贡献指南](../CONTRIBUTING.md#development-setup)；前端 `http://127.0.0.1:1002` 代理到后端 `http://127.0.0.1:6521/`，需分别启动两个服务。

## 前端环境变量

根 [.env](../.env) 是 Vite 构建/开发配置，与部署目录中供 Compose 插值的 `.env` 分开。修改前者后重启开发服务或重新构建；镜像运行时不会重新编译前端。

| 变量 | 语义与回落 |
|---|---|
| `VITE_GLOB_API_URL` | 浏览器 API 前缀，缺省 `/api`；见 [api.ts](../src/lib/api.ts) |
| `VITE_APP_API_BASE_URL` | Vite 的 `/api`、`/uploads` 开发代理目标，缺省 `http://127.0.0.1:6521/` |
| `VITE_GLOB_APP_PWA` | 只有字符串 `true` 才在构建时启用 PWA；生命周期验收缺口见 [01](01-current-status.md) |
| `VITE_APP_VERSION` | Vite 回落版本；正常构建优先读取生成的 `.zpanel-build-version` |

版本权威源为 [package.json](../package.json) 与 [service/assets/version](../service/assets/version)（格式 `1|版本号`）；[构建脚本](../scripts/add-frontend-version.js)要求两者一致，再生成前端版本文件。源码、正式镜像与生产版本分开记录在 [01](01-current-status.md)，此处不维护第三份版本快照。

`VITE_GLOB_OPEN_LONG_REPLY`、`VITE_CRYPTO_SECRET` 仍在根 `.env`，当前源码未发现运行读取；不能据此声称支持长回复或前端加密。本次保留配置，删除前须重新核对消费者。

## 后端配置与运行目录

键和默认值以 [conf.example.ini](../service/assets/conf.example.ini) 为准；配置生效、目录迁移、代理和外部数据库的操作边界统一见 [部署参考](../docs/deployment.zh-CN.md)。`base.source_path/source_temp_path` 已由 `storage.*` 替代，不再用于当前模板。

可变数据默认归 `./data`，当前目录方案已落地。变更默认值时核对模板、[storage fallback](../service/lib/storage/storage.go)、README 和 Compose 挂载；子路径、迁移和备份边界查部署参考，不另维护一份操作正文。

上传路径由 storage 生成：`data/uploads/users/{user_id}/{purpose}/{object_key}.{ext}`、`data/uploads/public/gallery/{object_key}.{ext}`、`data/uploads/system/{purpose}/{object_key}.{ext}`。临时文件/缓存可再生成，数据库/原上传必须纳入备份；不可按日期目录推断当前对象路径。完整备份与恢复见 [部署参考](../docs/deployment.zh-CN.md#持久化和权限)。

### 私网 favicon

在 `conf/conf.ini` 的 `[network]` 配置 `favicon_private_origins`，修改后重启。例如 `http://192.168.1.10:8080,https://nas.example:8443` 仅为占位源，默认空即拒绝。仅管理员可用名单，普通账号仍只能访问公网；scheme、host、有效端口必须完全匹配。环回、链路本地、云元数据始终拒绝，重定向与实际 DNS 连接同样检查，不允许扩大到其他源或端口。

## 功能配置与换机

| 内容 | 保存位置 / 边界 |
|---|---|
| 验证码 `loginCaptcha` | `system_setting.system_application` |
| 站点标题、图标、登录文案及 CSS/JS | `system_setting.site_setting`，自定义代码由前端加载 |
| 用户搜索引擎 | `module_config` |
| 快捷账号与浏览器偏好 | localStorage，仅本机浏览器；不随服务器备份迁移 |
| Iconify | 前端图标资源与用户输入的图标名 |
| Docker 管理 | Docker CLI/socket、Compose 挂载与附加组 |

换机先按导航核对 main 的提交和未提交工作，拉取规则见 [Git 与跨设备同步](README.md#git-与跨设备同步)。依赖按锁文件重装；真实 INI/Compose `.env`、运行数据库和上传另行安全迁移，不入 Git。健康入口 `GET /api/healthz` 只证明服务可响应，不能代替登录、数据或代理验收。

共享文档只记变量、用途和假示例，不复制密码、token、Cookie 或私钥；生产须替换模板示例密码。若密钥曾公开，轮换并在 [11](11-decisions.md)保留脱敏处理依据。
