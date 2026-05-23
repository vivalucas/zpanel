# 当前状态

> **最后更新**：2026-05-23
> **最后更新人**：Codex
> **最近开发日志**：`06-dev-log.md` 中的 2026-05-23（第三轮评审与稳定性修复）
> **当前可信度**：本地 `pnpm run type-check`、`pnpm run lint`、`pnpm run build`、`cd service && go test ./...` 通过；Docker 管理实机功能验证仍待补

## 当前版本

**ZPanel 1.0.0 独立仓库阶段** — 已从 GitHub fork 仓库调整为重新创建的独立仓库，当前公开历史为精简后的初始化提交和 1.0.0 发布准备提交。项目已完成品牌清理、仓库规范化、CI、Docker Hub + GHCR 镜像发布和默认端口统一。

## 当前阶段

项目已从“fork 后清理”进入“独立开源项目 1.0.0 基线”阶段。当前重点是补齐 project-log、本地联调与 Docker 管理实机验证，继续完善测试覆盖、安全边界、前端包体积和真实多语言翻译。

## 已完成

- GitHub 仓库已删除原 fork 并重新创建为同名独立仓库；当前远端不再显示 fork 标识、Sync fork 或旧历史。
- 当前 Git 历史为精简后的 `e734a49 chore: initialize zpanel project`、`90177e5 chore: prepare 1.0.0 release`、`1e80e0d fix: build docker image with sqlite on alpine`。
- 主 README 已重写为更适合用户和 SEO 的 ZPanel 项目说明，并保留上游 MIT 来源归属。
- 前端显示名、PWA 名称、页面标题、默认页脚改为 ZPanel。
- `package.json` 包名改为 `zpanel`，包管理统一到 pnpm。
- Go module 从 `sun-panel` 改为 `zpanel`，后端 import 路径同步更新。
- Dockerfile、docker-compose、build.sh 的二进制名 / 服务名 / 产物名改为 `zpanel`。
- Node.js 固定为 24.15.0，pnpm 固定为 11.1.3，Go 目标版本提升到 1.26.3。
- 产品版本统一为 `1.0.0`：`package.json` 与 `service/assets/version` 同步，版本源为 `1|1.0.0`。
- 默认端口从 `3002` 统一改为 `6521`，已同步 Dockerfile、docker-compose、配置模板、README 和 Vite 开发代理。
- Docker 默认镜像改为 `vivalucas/zpanel:latest`，容器发布同时推送 Docker Hub 与 GHCR。
- 关于页改为当前维护者、当前仓库链接和上游归属说明。
- `project-log/` 模板已复制到项目根目录并按当前项目补充第一版内容。
- 已实现 PRO 功能表中列出的开源化能力：在线 CSS / JS、无限用户、站点标题 / 图标 / 登录页文案、自定义搜索引擎、登录验证码、多账号快速切换、公共图库、备份迁移、Docker 应用管理。
- README 已补充与 DashCat 对齐的 11 种语言入口：简体中文、English、日本語、한국어、Deutsch、Français、Español、Português do Brasil、Italiano、繁體中文、Русский。
- 产品侧已注册同样的 11 种语言 locale，并完成中英文文案整理、硬编码用户可见文案收敛和 locale key 对齐。
- 已提交并 push `0082469 docs: add multilingual readmes and locale options`。
- 代码质量第一轮评估已完成，结论是前端已接近可维护基线，后端工程化、测试覆盖和安全基线仍是主要短板。
- 代码质量治理第一轮已完成：前端 lint warning 从 37 个收敛到 0；后端 `go test ./...` 已能通过；完整前端 `pnpm build` 已通过。
- 第三轮代码评审已完成并记录到 `11-code-review-log.md` 与 `2026-05-23-review.md`；本轮修复首页初始化、系统监控、登录限流、初始化错误传播和用户资料相关稳定性问题。
- 新增 GitHub Actions CI、Dependabot、PR 模板、Issue 模板、`CONTRIBUTING.md`、`SECURITY.md`、`.dockerignore`、`.gitattributes` 和 Husky 配置。
- 新增 `/api/healthz` 健康检查接口及对应 Go 测试。
- `UPDATELOG.md` 已改为标准 `CHANGELOG.md`，`add-frontend-version.js` 已移入 `scripts/`。
- Dockerfile 已优化依赖缓存并修复 Alpine + sqlite3 CGO 构建问题；v1.0.0 tag 移动后容器发布成功。
- 已从 `/Users/lucas/projects/zpanel_副本/project-log` 恢复本地 project-log，并按用户笔记与当前新仓库状态完成第一轮重建。

## 进行中

- 代码中仍需继续清理少量上游历史视觉资源和真实多语言文案。
- 自定义 CSS / JS 恢复路径、搜索框交互拆分、系统监控数据类型收敛仍在评估中。

## 待处理

### 高优先级

- 增加前后端测试覆盖，避免后续重构缺少回归保护。
- 在具备 Docker CLI / Docker socket 的环境中验证 Docker 管理页面。
- 完成日语、韩语、德语、法语、西班牙语、巴西葡萄牙语、意大利语、俄语的母语级产品文案翻译。
- 完成繁体中文产品文案的繁体化与地区用语校对。
- 梳理默认管理员账号、默认密码和初始化安全策略。
- 全量核对 API、数据库模型和前端调用，补齐 `02-database-design.md`、`03-api-design.md`。
- **代码质量改进**：按 `13-code-quality-evaluation.md` 路线图推进，第一阶段聚焦安全加固（MD5→bcrypt、硬编码密钥、XSS 防护、文件权限、Docker API 校验）。

### 中优先级

- 清理或替换上游截图、logo 等展示资源。
- 评估自定义 CSS / JS、Docker socket、公共图库的安全提示和恢复手段。
- 拆分前端大 chunk，降低首页与入口包体积。
- **代码质量改进第二阶段**：消灭前端 `any`、统一 Go 错误处理、修复已知 bug（`InStringArray` 永远返回 true）。

### 低优先级

- 更新 logo、截图和文档图片。
- 规划后续自有功能路线。
- **代码质量改进第三/四阶段**：代码清理（重复代码、依赖整理、命名修正）和架构改进（依赖注入、测试覆盖、大文件拆分）。

## 未解决的问题 / 临时决策

| 问题 | 影响 | 状态 | 备注 |
|------|------|------|------|
| Go 测试覆盖仍很低 | 后端缺少足够回归保护 | 待处理 | 当前已有 `/api/healthz` 测试，仍需补登录、权限、导入导出、Docker 参数校验 |
| 当前 shell 未找到 Docker | 无法验证 Docker 管理实机操作 | 待处理 | 功能依赖部署环境提供 Docker CLI / socket |
| 前端主 chunk 偏大 | 首屏加载与长期维护仍可优化 | 待处理 | 当前构建通过，但 Vite 提示 `index` / `home` chunk 偏大 |
| 后端未启动时前端预览 API 报错 | 预览首页会出现网络错误 | 临时方案 | 前端标题和基础渲染已验证，完整联调需启动 Go 后端 |
| 旧配置导入兼容已移除 | 旧 `.sunpanel.json` 无法导入 | 已采用 | ZPanel 按全新项目发布 |
| Docker socket 权限较高 | 配置不当可能扩大宿主机控制面 | 已识别 | 仅管理员接口可访问，部署文档需明确风险 |
| 非中英语言仍为基线文案 | 用户切换这些语言时暂不能获得真正翻译体验 | 待处理 | 当前先用英文基线保证 locale key 完整；繁体中文先用简中基线 |
| 自定义 CSS / JS 缺少安全恢复入口 | 错误脚本或样式可能阻断进入设置页 | 待评估 | 需要设计安全模式或启动参数，未在第三轮 Bug 修复中处理 |

## 下一步

1. 做一次后端启动 + 前端联调，确认登录、验证码、首页、站点设置、导入导出基础流程。
2. 在 Docker 环境中验证容器列表、操作和日志接口。
3. 增加第一批后端单元测试，优先覆盖密码校验、登录限流、导入导出格式校验和 Docker 参数校验。
4. 拆分前端入口和首页 chunk，逐步优化包体积。
5. 安排非中英语言真实翻译版。

## 任务交接

**当前任务**：第三轮评审与稳定性修复已完成；下一步进入本地联调、Docker 实机验证和后续质量治理。

**已完成**：独立仓库重建、品牌清理、依赖升级、Docker Hub + GHCR 发布配置、PRO 功能表开源化第一版、README 多语言版本、产品 11 语言 locale 注册、中英文文案优化、CI、健康检查、1.0.0 版本统一、默认端口 6521、前端类型检查 / lint / build 验证、后端 CI 验证、第三轮 Bug 修复。

**未完成**：本地完整联调、Docker 管理实机验证、更多 Go 后端测试覆盖、非中英语言真实翻译版、完整数据库/API 逆向、默认密码策略改进。

**下一步建议**：先做一次完整本地联调；随后补后端测试、Docker 管理实机验证和自定义 CSS / JS 恢复方案设计。

**风险 / 阻塞**：当前环境缺少 Docker；后端仍缺测试覆盖；Docker socket 权限高；自定义 JS / CSS 需要恢复手段和安全提示；前端大 chunk 仍需拆分。

**相关文件**：`README*.md`、`src/locales/`、`src/store/modules/app/helper.ts`、`src/utils/defaultData/index.ts`、`src/components/apps/Style/index.vue`、`src/components/apps/DockerManager/index.vue`、`src/components/deskModule/SearchBox/index.vue`、`project-log/`
