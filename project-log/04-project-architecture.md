# 项目架构

## 系统架构

```text
Browser / WebView
      │
      ▼
Vue 3 + Vite SPA
      │  /api、/uploads
      ▼
Go + Gin HTTP Server
      │
      ├── GORM → SQLite / MySQL
      ├── Cache → Memory / Redis
      ├── Queue → Memory / Redis
      ├── Docker CLI → 容器管理（可选，管理员）
      └── Static files → ./web、data/uploads
```

构建后的部署形态是一个 Go 后端进程同时提供 API、前端静态文件和上传文件访问。Docker 镜像内的可执行文件为 `zpanel`，默认 HTTP 端口为 `6521`。

说明：运行时可变数据开始统一收敛到 `./data`，上传资源由 `data/uploads` 承载，数据库、备份、临时文件、缓存和日志也进入同一数据根目录。详见 `02-database-design.md` 和 `08-env-config.md`。

## 目录结构

```text
zpanel/
├── src/                    # Vue 前端源码
│   ├── api/                # 前端 API 调用封装
│   ├── components/         # 业务组件和通用组件
│   ├── locales/            # 多语言文案
│   ├── router/             # 前端路由与权限
│   ├── store/              # Pinia 状态
│   ├── styles/             # 全局样式
│   └── utils/              # 前端工具函数
├── service/                # Go 后端源码
│   ├── api/                # API handler
│   ├── assets/             # 后端内置资源和配置模板
│   ├── global/             # 全局对象
│   ├── initialize/         # 初始化流程
│   ├── lib/                # 后端工具库
│   ├── models/             # GORM 模型
│   ├── router/             # Gin 路由注册
│   └── structs/            # 配置结构
├── public/                 # 前端 public 资源
├── docs/                   # README 多语言文档
├── project-log/            # 本地开发知识库，整体被 Git 忽略
├── scripts/                # 构建辅助脚本
├── data/                   # 目标运行时数据根目录，默认应被 Git 忽略
├── .github/                # CI、Dependabot、Issue / PR 模板
├── Dockerfile
├── docker-compose.yml
├── build.sh
└── README.md
```

## 关键技术决策

### 决策 1：保留单体部署形态

- **选择**：继续使用 Go 后端托管前端静态文件和 API。
- **备选方案**：前后端拆成独立服务。
- **原因**：当前项目面向自托管用户，单进程 / 单容器部署更简单；初始化阶段优先降低迁移风险。
- **参考**：详见 `10-planning-log.md` ADR-001。

### 决策 2：初始化阶段只做品牌和维护基线改名

- **选择**：将项目名、Go module、构建产物、Docker 服务名和运行时文案改为 ZPanel。
- **备选方案**：先不改 module，仅改显示文案。
- **原因**：fork 已更名为 zpanel，早期统一命名可避免后续新增代码继续依赖上游名称。
- **参考**：详见 `10-planning-log.md` ADR-001。

### 决策 3：README 和产品语言集合与 DashCat 对齐

- **选择**：ZPanel README 和产品 locale 统一支持 11 种语言。
- **备选方案**：只保留原项目中英文，或只扩展 README 不扩展产品语言。
- **原因**：用户希望项目文档和产品本身都与 DashCat 的语言覆盖保持一致；先建立稳定语言框架，后续逐语言补真实翻译。
- **参考**：详见 `10-planning-log.md` ADR-004。

### 决策 4：仓库独立化与 1.0.0 发布基线

- **选择**：删除原 GitHub fork 仓库，重新创建同名独立仓库，并以精简历史发布 1.0.0。
- **备选方案**：保留 fork 关系和完整历史。
- **原因**：用户希望项目对外呈现为独立开源项目，不显示 fork 标识、Sync fork 或旧历史；同时保留 README / LICENSE 中的上游 MIT 来源说明。
- **参考**：详见 `10-planning-log.md` ADR-005。

## 依赖关系

| 依赖 | 版本 | 用途 |
|------|------|------|
| Vue | ^3.5.34 | 前端框架 |
| Vite | ^8.0.13 | 前端构建 |
| TypeScript | ~6.0.3 | 前端类型系统 |
| Naive UI | ^2.44.1 | UI 组件 |
| Pinia | ^3.0.4 | 状态管理 |
| Vue Router | ^5.0.7 | 前端路由 |
| Gin | v1.9.0 | 后端 HTTP 框架 |
| GORM | v1.25.5 | ORM |
| SQLite driver | v1.5.4 | 默认数据库 |
| MySQL driver | v1.5.0 | 可选数据库 |
| go-redis | v9.0.5 | 可选 Redis 缓存 / 队列 |

## 工程化架构

- CI：GitHub Actions 分为 Frontend 和 Backend 两条质量门禁。
- 依赖更新：Dependabot 已启用。
- 协作入口：PR 模板、Issue 模板、`CONTRIBUTING.md`、`SECURITY.md` 已补齐。
- 容器发布：Docker Hub 与 GHCR 双 registry 发布。
- 健康检查：`GET /api/healthz` 用于 Dockerfile、Compose 和后端测试。
- 后端 assets：当前使用 Go embed 的 `service/assets/assets.go`，不再依赖旧 go-bindata 生成流程。

## 可选能力

### Docker 管理

Docker 管理不是核心运行依赖，而是管理员功能。后端通过 `os/exec` 调用 Docker CLI，因此部署环境需要满足以下条件：

- `docker` 命令存在于 ZPanel 后端进程的 PATH 中。
- 后端进程用户具备 Docker 操作权限。
- 如果 ZPanel 在容器内运行，需要挂载 `/var/run/docker.sock`。

该能力不应开放给普通用户或公开模式访问。

## 本地化架构

前端文案集中在 `src/locales/`，由 Vue i18n 在运行时按用户配置切换。语言列表在 `src/locales/index.ts` 注册，默认配置和浏览器语言识别逻辑分别位于 `src/utils/defaultData/index.ts` 与 `src/store/modules/app/helper.ts`。

当前 11 个 locale 文件 key 已保持一致。需要特别注意：日语、韩语、德语、法语、西班牙语、巴西葡萄牙语、意大利语、俄语目前是英文基线文案；繁体中文目前是简体中文基线文案。它们用于保证语言切换链路可运行，不代表真实翻译版已完成。

## 变更记录

| 日期 | 变更内容 | 原因 |
|------|----------|------|
| 2026-05-21 | 补充独立仓库、1.0.0、CI、健康检查和 Docker Hub/GHCR 架构说明 | 当前仓库已重新创建并发布 1.0.0 |
| 2026-05-20 | 补充本地化架构说明 | README 多语言和产品 locale 框架已建立，真实翻译版仍需后续完成 |
| 2026-05-20 | 更新前端依赖版本并补充 Docker 管理架构说明 | 依赖已升级，PRO 功能开源化已加入 Docker 管理 |
| 2026-05-20 | 初始化架构文档 | fork 后建立维护基线 |
