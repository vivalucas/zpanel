# 开发日志

<!-- 填写说明：每轮开发追加一条记录。不要删除旧记录。详见 README 中的格式说明。 -->

---

## 2026-05-24（文件列表分页与保存失败反馈修复）

**触发原因**：在复查上一轮改动时，确认 SearchBox 保存失败仍然被静默吞掉，文件删除在物理文件与数据库记录之间仍有不一致窗口，文件列表也需要把“取消 500 条截断”推进成可控分页。

**修改内容**：
1. `src/components/deskModule/SearchBox/index.vue` — 搜索引擎配置保存失败补充错误提示，避免云端保存失败时用户无感知。
2. `service/api/api_v1/system/file.go`、`src/api/system/file.ts`、`src/components/apps/UploadFileManager/index.vue` — 文件列表改为接收 `page/limit` 并分页返回；前端补充分页控件和切换逻辑，避免一次性加载全部图片。
3. `service/api/api_v1/system/file.go`、`src/components/apps/UploadFileManager/index.vue` — 文件删除继续保留引用校验，删除失败时回传 `deletedIds` / `failedIds`，前端按部分成功 / 部分失败展示结果。
4. `src/components/apps/UploadFileManager/index.vue` — 壁纸设置、图库切换和分页查询统一收口，减少空转请求和重复刷新。

**遇到的问题**：
- 文件列表接口原本没有分页参数，但前端图库和公共图库都可能增长较快，不能再沿用全量返回。
- SearchBox 保存失败不该只靠日志暴露，否则用户会误判状态已经同步。

**解决方式**：
- 参照用户管理页的分页模式，为文件列表补齐 `page/limit` 请求与 `count` 计数，并在前端加分页组件。
- 保留删除前引用校验，删除过程继续按单个文件回写成功 / 失败结果，避免一次失败吞掉整批结果。
- 将 SearchBox 的保存失败改为显式报错，避免静默失败。

**验证方式**：
- `corepack pnpm run type-check`
- `corepack pnpm run lint`
- `corepack pnpm run build`
- `cd service && go test ./...`

**验证结果**：
- TypeScript 类型检查通过。
- ESLint 通过。
- Vite 生产构建通过；仍有既有的 `/custom/index.js` module 提示、`/custom/index.css` runtime 提示和大 chunk 提示。
- Go 全量测试通过；当前仍以 `[no test files]` 为主。

**本地产物清理**：
- 已删除本轮 `pnpm run build` 生成的 `dist/`。
- `.env` 由构建脚本更新了前端版本号，作为忽略文件保留。

---

## 2026-05-24（导入导出、文件管理与交互稳态优化）

**触发原因**：用户确认要把上一轮评审里已确认的问题一次性优化掉，重点覆盖导入导出、文件管理、搜索框、分组编辑、用户资料和外链安全边界。

**修改内容**：
1. `src/utils/request/index.ts` — GET 请求补充 `headers` 透传，保持与 POST 一致的 token / lang 行为。
2. `src/utils/cmn/index.ts`、`src/views/home/index.vue`、`src/components/deskModule/SearchBox/index.vue`、`src/components/apps/About/index.vue` — 抽出外链打开辅助函数，并为新窗口链接补充 `noopener/noreferrer`。
3. `src/components/apps/ImportExport/index.vue`、`src/components/apps/UploadFileManager/index.vue` — 修正导入导出加载态和错误态，导出结果保持原顺序，导入失败不再错误提示成功；文件管理器补充网络兜底、部分删除反馈和壁纸设置反馈。
4. `src/components/apps/ItemGroupManage/index.vue`、`src/views/home/components/AppStarter/index.vue`、`src/components/deskModule/SearchBox/index.vue` — 分组编辑改为草稿对象，拖拽 / 列表 key 改为稳定值，搜索引擎状态不再共享默认数组引用。
5. `service/api/api_v1/system/file.go` — 文件列表查询取消固定 500 条截断，改为总数 + 全量列表查询；文件删除从“事务里删文件”改为“先校验引用、后删文件和记录”，降低数据库与文件系统不一致风险。
6. `src/components/apps/UserInfo/index.vue`、`src/components/apps/Style/index.vue` — 用户资料和站点配置增加失败兜底，避免未捕获 Promise 影响交互。

**遇到的问题**：
- 导入导出和文件删除都涉及前端 / 后端双向契约，必须先确认返回数据结构再改 UI 反馈。
- 搜索框和默认状态存在共享引用，单纯改 key 不够，必须把默认状态工厂化。

**解决方式**：
- 统一用工厂函数生成默认状态，编辑态使用草稿拷贝，保存 / 删除使用显式失败分支。
- 统一外链打开方式，减少分散的 `window.open` 调用。
- 文件删除保留引用校验，但把物理删除移出数据库事务，避免回滚后文件已经消失。

**验证方式**：
- `corepack pnpm run type-check`
- `corepack pnpm run lint`
- `corepack pnpm run build`
- `cd service && go test ./...`

**验证结果**：
- TypeScript 类型检查通过。
- ESLint 通过。
- Vite 生产构建通过；仍有既有的 `/custom/index.js` module 提示、`/custom/index.css` runtime 提示和大 chunk 提示。
- Go 全量测试通过；当前仍以 `[no test files]` 为主。

**本地产物清理**：
- 无

## 2026-05-24（安全渲染与类型收敛优化）

**触发原因**：用户要求把前面识别出的优化点尽量一次性收紧，重点是部署前的安全渲染、类型边界和明显状态问题，同时准备推进新版本发布。

**修改内容**：
1. `src/views/home/components/Result/index.vue` — 关闭 markdown-it 的原始 HTML 渲染，避免结果内容直接执行 HTML。
2. `src/utils/request/index.ts`、`src/api/system/moduleConfig.ts`、`src/store/modules/moduleConfig/index.ts` — 收紧请求和模块配置接口类型，从 `any` 迁移到 `unknown`，减少隐式宽类型扩散。
3. `src/components/apps/Users/EditUser/index.vue` — 新建 / 编辑用户时改为每次生成新表单对象，避免弹窗状态复用；提交成功时改为只在拿到有效 `id` 后回传。
4. `src/views/home/index.vue`、`src/components/apps/Users/index.vue` — 补充首页 URL / ID 运行时防御，去掉危险断言，修正右键菜单和排序保存流程中的空值边界。
5. `package.json`、`service/assets/version`、`CHANGELOG.md`、`project-log/05-current-status.md`、`project-log/08-env-config.md` — 同步推进 `1.0.3` 版本和对应说明文档。

**遇到的问题**：
- `src/components/apps/Users/index.vue` 的 `case` 分支新增局部变量后触发 ESLint `no-case-declarations`，需要加块级作用域。
- `pnpm` 在本地未作为全局命令存在，验证需要使用 `corepack pnpm`。

**解决方式**：
- 对 `case 'publicMode'` 增加块级作用域，保持语义不变并满足 lint 规则。
- 使用 `corepack pnpm` 运行前端命令，避免依赖系统 PATH。

**验证方式**：
- `corepack pnpm run type-check`
- `corepack pnpm run lint`
- `corepack pnpm run build`
- `cd service && go test ./...`

**验证结果**：
- TypeScript 类型检查通过。
- ESLint 通过。
- Vite 生产构建通过；仍保留既有的 chunk 体积提示，以及 `/custom/index.js` 非 module 的构建提醒。
- Go 全量测试通过。

**本地产物清理**：
- `dist/` 与构建生成的 `.env` 已删除。

## 2026-05-23（第三轮评审与稳定性修复）

**触发原因**：用户将 `project-log/` 推送到 GitHub，并要求以云端 `main` 为基线重新全面阅读项目与规划文档，逐项确认真实 Bug / 优化点、更新评审文档后再修复代码，并在修改后做完整自检。

**修改内容**：
1. `project-log/2026-05-23-review.md`、`project-log/11-code-review-log.md` — 新增第三轮评审记录，逐项说明真实性、用户场景影响、优先级和本轮处理 / 延后范围。
2. `service/initialize/app.go` — `DatabaseConnect()` 改为返回错误，启动流程和密码重置流程检查数据库连接、迁移、默认管理员初始化错误，避免半初始化继续运行。
3. `service/api/api_v1/middleware/login_rate_limit.go`、`service/api/api_v1/common/apiReturn/error_code.go`、`src/locales/*.json`、`src/utils/request/apiMessage.ts` — 登录限流使用统一 API 错误码 `1008`，清理过期 IP 记录，并让前端展示后端错误消息。
4. `src/components/deskModule/SystemMonitor/*` — CPU 使用率访问增加空值保护；监控配置编辑时克隆数据并保存普通对象；拖拽项使用稳定 key。
5. `src/views/home/index.vue`、`src/store/modules/panel/index.ts`、`src/utils/cmn/index.ts` — 首页初始化改为等待用户信息和云端配置刷新，`updateLocalUserInfo()` 增加返回值和异常防御。
6. `src/components/apps/UserInfo/index.vue` — 修改昵称后同步快速切换账号缓存；修改密码成功后移除当前账号缓存、清理本地登录态并刷新页面。

**遇到的问题**：
- 本地分支落后 `origin/main` 3 个提交，且本地已有第三轮候选改动。
- `git stash pop` 后登录限流和 `updateLocalUserInfo()` 与远端第二轮修复发生重叠冲突。
- `pnpm run build` 会生成 `dist/`，并按项目脚本更新忽略文件 `.env` 中的前端版本号。

**解决方式**：
- 先暂存本地候选改动，删除旧的本地忽略版 `project-log/`，快进拉取云端 `main` 后重新套回候选改动。
- 冲突处保留远端第二轮修复基础，并合入第三轮新增行为：统一 API 错误码、过期记录清理、`boolean` 返回值和空值防御。
- 构建后删除 `dist/`，不删除用户本地 `.env`。

**验证方式**：
- `pnpm run type-check`
- `pnpm run lint`
- `pnpm run build`
- `cd service && go test ./...`

**验证结果**：
- TypeScript 类型检查通过。
- ESLint 通过。
- Vite 生产构建通过；仍有既有的大 chunk 提示、`/custom/index.js` 非 module 提示和 `/custom/index.css` 运行时解析提示。
- Go 全量测试通过；除 `router` 外多数包仍为 `[no test files]`，核心业务测试覆盖仍不足。

**本地产物清理**：
- 已删除本轮 `pnpm run build` 生成的 `dist/`。
- 未删除 `.env`，因为它是用户本地环境文件且已被 Git 忽略；本轮构建脚本仅更新其中的 `VITE_APP_VERSION`。

---

## 2026-05-23（1.0.2 小版本发布准备）

**触发原因**：用户要求在再次全面检查项目代码、重点确认上一轮修改点无误后，推进一个小版本号，提交 GitHub，打 tag 并触发构建。

**修改内容**：
1. `package.json` — 版本号从 `1.0.1` 推进到 `1.0.2`。
2. `service/assets/version` — 后端版本源从 `1|1.0.1` 推进到 `1|1.0.2`，确保 release workflow 的 tag 校验通过。
3. `CHANGELOG.md` — 新增 `1.0.2 - 2026-05-23` 发布记录。
4. `src/views/home/index.vue`、`src/components/deskModule/SystemMonitor/index.vue` — 修正 `VueDraggable` 小写闭合标签，避免模板解析和维护风险。
5. `project-log/05-current-status.md`、`project-log/08-env-config.md` — 同步当前版本状态。

**遇到的问题**：
- 复核上一轮改动时发现两个 `VueDraggable` 闭合标签仍使用旧的小写写法；现有构建可通过，但属于真实模板一致性问题。

**解决方式**：
- 仅做小范围模板修正和版本推进，不扩大到新的功能改造。

**验证方式**：
- `pnpm run type-check`
- `pnpm run lint`
- `cd service && go test ./...`
- `pnpm run build`

**验证结果**：
- TypeScript 类型检查通过。
- ESLint 通过。
- Go 全量测试通过；核心业务测试覆盖仍不足，多数包仍为 `[no test files]`。
- Vite 生产构建通过；仍有既有的大 chunk 提示、`/custom/index.js` 非 module 提示和 `/custom/index.css` 运行时解析提示。

**本地产物清理**：
- 已删除本轮 `pnpm run build` 生成的 `dist/`。
- 未删除 `.env`，因为它是用户本地环境文件且已被 Git 忽略；本轮构建脚本仅更新其中的 `VITE_APP_VERSION`。

---

## 2026-05-21（基础数据与运行时存储重构）

**触发原因**：用户明确表示当前没有历史用户包袱，希望基础结构一步做到位，优先修正上传目录、数据存储、字段设计、会话 token、安全边界等长期骨架问题。

**修改内容**：
1. 新增 `service/lib/storage`，统一 `data/`、`data/uploads`、`data/runtime/*`、`data/backups` 等运行时目录。
2. Docker Compose 挂载从 `./uploads` + `./database` 改为 `./data:/app/data`。
3. SQLite 默认路径改为 `./data/database/zpanel.db`，上传默认路径改为 `./data/uploads`。
4. 上传文件不再按日期目录保存，改为 object key + owner/purpose/visibility 目录。
5. `File` 模型重构为对象资源表，增加 `object_key`、`relative_path`、`mime_type`、`size`、`sha256`、`visibility`、`purpose`、`status` 等字段。
6. 新增 `FileReference` 模型，为资源引用关系和安全删除打基础。
7. 登录 token 不再写入用户表，新增 `Session` 模型，数据库只保存 token hash、过期时间、撤销时间、IP 和 UA。
8. `User` 模型增加唯一用户名 / 邮箱、`password_hash`、`password_algo`、`avatar_file_id` 等长期字段。
9. `SystemSetting`、`UserConfig`、`ModuleConfig`、`ItemIcon` 增补 schema version、结构化图标和文件引用相关字段。
10. 文件上传、公共图库、favicon 下载、文件删除逻辑接入新的 storage 和 file 模型。
11. 初始化顺序调整为先读取配置，再按 `storage.logs_path` 初始化日志。
12. 删除仍被引用的文件时直接拒绝，避免资源在 UI 中消失但业务仍在引用。

**验证结果**：
- `cd service && go test ./...` 通过。
- `corepack pnpm run type-check` 通过。
- `corepack pnpm run build-only` 通过；仍有既有 chunk 体积提示和 `/custom/index.js` 非 module 提示。

**后续仍需处理**：
- 前端仍有部分业务状态保存 URL 字符串，后续应逐步改为保存 `file_id`。
- JSON blob 尚未完全移除，当前先增加 schema version 和结构化字段，为下一轮 API / UI 重构铺底。
- 需要补齐文件管理 UI 中可见性、用途、引用状态展示。

---

## 2026-05-21（独立仓库与 1.0.0 发布整理）

**触发原因**：用户在另一台电脑上删除原 GitHub fork 仓库并重新创建同名仓库，希望 ZPanel 从“fork 后项目”整理为更像独立开源项目的状态。由于 `project-log/` 不随 GitHub 同步，需要根据用户笔记、当前新 clone 和旧副本重新补全文档。

**修改内容**：
1. GitHub 仓库重新创建为独立仓库，并以精简历史重新推送；当前 GitHub 不再显示 fork 标识、Sync fork 或旧历史。
2. 清理项目文件：删除 `.vscode`、旧 `config/`、旧 `doc/images/`、测试页、旧说明文件等无人引用或不适合公开项目的内容。
3. `UPDATELOG.md` 改为标准 `CHANGELOG.md`；`add-frontend-version.js` 移入 `scripts/`。
4. Go 文件命名规范化：例如 `A_ENTER.go`、大小写混乱文件名、`userCondig.go` 等已改为更标准命名；`ApiPpenness` 拼写修复为 `ApiOpenness`。
5. 新增 `/api/healthz` 健康检查接口，并增加 `service/router/router_test.go` 测试。
6. 新增 GitHub Actions CI、Dependabot、PR 模板、Issue 模板、`CONTRIBUTING.md`、`SECURITY.md`。
7. 优化 `.gitignore`、`.dockerignore`、`.gitattributes` 和 Husky 配置。
8. Dockerfile 优化依赖缓存，并为 Dockerfile / docker-compose 增加健康检查。
9. 修复没有 `.env` 时 `pnpm run build` 失败的问题；调整 build 脚本顺序，避免版本写入和构建并行竞态。
10. README 与多语言文档重写为更适合用户、SEO 和独立开源项目的表达，减少过度提原项目、PRO、付费对比等表述。
11. 版本统一为 `1.0.0`：`service/assets/version = 1|1.0.0`，`package.json` 同步为 `1.0.0`。
12. 默认端口从 `3002` 统一改为 `6521`，同步 Dockerfile、docker-compose、配置模板、README、开发代理配置等位置。
13. 容器发布接入 Docker Hub 与 GHCR，同时推送 `vivalucas/zpanel:1.0.0`、`vivalucas/zpanel:latest`、`ghcr.io/vivalucas/zpanel:1.0.0`、`ghcr.io/vivalucas/zpanel:latest`。
14. 修复 Alpine + sqlite3 CGO 构建问题：Dockerfile 增加 `CGO_CFLAGS="-D_LARGEFILE64_SOURCE"`，重新提交并移动 `v1.0.0` tag 后容器发布成功。

**当前 Git 状态**：
- `e734a49 chore: initialize zpanel project`
- `90177e5 chore: prepare 1.0.0 release`
- `1e80e0d fix: build docker image with sqlite on alpine`
- 当前 `HEAD` 为 `1e80e0d`，`origin/master` 已同步。

**验证结果**：
- GitHub Actions `ci / Frontend` 通过。
- GitHub Actions `ci / Backend` 通过。
- Docker Hub / GHCR 容器发布成功。
- 当前本地已 `git pull --ff-only origin master` 到最新版。

**后续仍需处理**：
- 当前 project-log 是从旧副本恢复并按笔记重建，后续每次重要改动仍需本地同步维护。
- 本地 Docker 管理实机验证仍待补。
- 非中英产品文案真实翻译版仍待补。
- README 中个别“本地 Go 验证待补”表述需要后续和 CI 状态继续统一。

---

## 2026-05-21（代码质量治理第一轮）

**触发原因**：用户希望 ZPanel 成为标准化的 Vue / Go / TypeScript 项目，并要求在更新相关文档后开始代码质量治理。

**当前实测状态**：
1. 前端 `npx pnpm@11.1.3 run type-check` 通过。
2. 前端 `npx pnpm@11.1.3 run lint` 通过，但仍有 37 个 warning，主要是 `console`、未使用变量和少量 Vue 命名风格。
3. 前端 `npx pnpm@11.1.3 run build-only` 通过，但存在 chunk 过大提示。
4. Go 环境已可用，当前为 `go1.26.3 darwin/arm64`。
5. 后端 `cd service && go test ./...` 初始失败，阻塞点包括错误位置生成的 `service/bindata.go` 缺少 `package` 声明，以及 `LoginRateLimit.go` 存在未使用 import。
6. 排除 `node_modules` 后，当前项目仍没有前后端测试文件。

**修改内容**：
1. 删除错误位置生成的本地忽略文件 `service/bindata.go`，避免 Go 根包编译失败；保留正确位置的 `service/assets/bindata.go`。
2. `service/api/api_v1/middleware/LoginRateLimit.go` — 删除未使用 import，并 gofmt。
3. `add-frontend-version.js` — 移除已不存在的 `moment` 依赖，改用标准 `Date` 生成 `VITE_APP_VERSION`。
4. 多个 Vue 组件 — 移除调试 `console.log`，把未使用的 `catch (error)` 改为 `catch`，删除未使用参数或改为 `_` 前缀。
5. `src/components/deskModule/SystemMonitor/Edit/index.vue`、`src/views/home/index.vue` — 修正 Vue 事件 / v-model 参数命名风格。
6. `src/components/apps/DockerManager/index.vue`、`src/typings/system.d.ts` — 为 Docker stats 补充类型，减少 `any`。
7. `src/utils/jsonImportExport/index.ts` — 删除 throw 后不可达的 `return null`。

**验证结果**：
- `npx pnpm@11.1.3 run type-check` 通过。
- `npx pnpm@11.1.3 run lint` 通过，0 warning。
- `npx pnpm@11.1.3 run build` 通过；仍有 Vite chunk 过大提示。
- `cd service && go test ./...` 通过；当前所有包仍显示 `[no test files]`。
- `git diff --check` 通过。

**后续仍需处理**：
- Go bcrypt 迁移后的登录 / 修改密码回归测试。
- 后端全局状态解耦和测试注入能力。
- 前端 bundle 拆分、动态 import 和真实多语言翻译。
- Docker 管理实机验证。

---

## 2026-05-20（多语言 README 与产品本地化框架）

**触发原因**：用户希望 ZPanel 的 README 语言数量和 DashCat 对齐，同时项目本身也支持这些语言；随后确认需要把“真正翻译版”这件事明确记录下来，避免把 locale 框架完成误认为所有语言翻译完成。

**修改内容**：
1. `README.md` 与 `README.*.md` — 增加 11 种语言入口和对应 README 版本，语言包括简体中文、English、日本語、한국어、Deutsch、Français、Español、Português do Brasil、Italiano、繁體中文、Русский。
2. `src/locales/index.ts`、`src/store/modules/app/helper.ts`、`src/utils/defaultData/index.ts` — 注册产品侧同样的 11 种语言，并接入语言选择和浏览器语言识别。
3. `src/locales/zh-CN.json`、`src/locales/en-US.json` — 整理现有中文 / 英文文案，补齐登录验证码、Docker 管理、站点设置、公共图库、搜索引擎、异常页、校验提示等新增文案 key。
4. `src/locales/de-DE.json`、`src/locales/es-ES.json`、`src/locales/fr-FR.json`、`src/locales/it-IT.json`、`src/locales/ja-JP.json`、`src/locales/ko-KR.json`、`src/locales/pt-BR.json`、`src/locales/ru-RU.json`、`src/locales/zh-TW.json` — 补齐 locale 文件，确保 key 完整。
5. 多个前端组件 — 把用户可见的硬编码中文 / 英文收敛到 locale 文件，覆盖 Docker 管理、用户信息、样式设置、搜索框、文件管理、登录页、异常页、调试导入导出等界面。
6. `project-log/` — 明确记录当前非中英产品文案只是可运行基线，还不是母语级真实翻译版。

**重要说明**：

当前已经完成的是产品本地化框架、语言选项、locale key 对齐和中英文文案优化。日语、韩语、德语、法语、西班牙语、巴西葡萄牙语、意大利语、俄语目前使用英文基线文案，繁体中文目前使用简体中文基线文案。这样做是为了保证切换语言时不会缺 key 或页面崩坏，但它不等于真正翻译完成。

真正翻译版需要后续单独完成：每种语言都需要母语级产品文案翻译、术语统一、按钮长度检查和界面实测；繁体中文还需要做繁体化、地区用语和标点习惯校对。

**遇到的问题**：
- 原项目已有中英文翻译，但新增 PRO 功能和部分旧界面仍存在硬编码文案。
- 非中英语言一次性补齐真实翻译成本较高，且需要界面长度和语境校验。
- README 翻译和产品 UI 翻译是两类工作，不能混为同一个完成状态。

**解决方式**：
- 先建立完整 locale 文件集合，并用脚本检查 11 种语言 key 完全一致。
- 中英文先做真实可用文案；其他语言先使用基线文案占位，后续按语言逐个真实翻译。
- 在 project-log 中把“真实翻译版待办”列为明确后续任务。

**验证方式**：
- `pnpm run type-check`
- `pnpm run lint`
- locale key parity 脚本
- `git diff --check`

**验证结果**：
- TypeScript 类型检查通过。
- ESLint 通过，保留 3 个既有 Vue 命名风格 warning。
- 11 个 locale JSON 文件 key 完全一致，缺失 0、额外 0。
- `git diff --check` 通过。

---

## 2026-05-20（PRO 功能开源化第一版）

**触发原因**：用户提供上游 PRO / 标准版功能对比表，并要求在 ZPanel 当前版本中实现这些原本属于 PRO 的功能。

**修改内容**：
1. `service/api/api_v1/system/about.go`、`service/lib/cmn/systemSetting/systemSetting.go`、`src/components/apps/Style/index.vue` — 新增站点标题、站点图标、登录页文字、自定义 CSS / JS 和登录验证码开关。
2. `service/api/api_v1/system/login.go`、`service/router/system/login.go`、`src/views/login/index.vue` — 接通登录验证码图片生成和登录校验。
3. `src/components/deskModule/SearchBox/index.vue` — 支持无限自定义搜索引擎、删除和持久化。
4. `src/components/apps/UserInfo/index.vue`、`src/views/login/index.vue` — 增加多账号快速切换，本地保存已登录账号 token。
5. `service/api/api_v1/system/file.go`、`src/components/apps/UploadFileManager/index.vue` — 增加公共图库列表视图。
6. `src/components/apps/ImportExport/index.vue`、`src/utils/jsonImportExport/index.ts` — 导入导出扩展到图标配置和样式配置。
7. `service/api/api_v1/system/docker.go`、`src/components/apps/DockerManager/index.vue` — 新增管理员 Docker 容器管理页面，支持列表、资源快照、启动 / 停止 / 重启和日志。
8. `src/App.vue` — 启动时应用站点标题、favicon、自定义 CSS / JS。

**遇到的问题**：
- 当前环境没有 `go` / `gofmt`，无法进行 Go 编译和格式化验证。
- 当前环境没有 Docker CLI，无法验证 Docker 管理接口对真实容器的操作。
- 前端预览没有后端 API，因此登录页会出现公开配置请求失败的网络提示。

**解决方式**：
- 使用现有 GORM `system_setting` 表承载站点设置和登录验证码开关，避免第一版引入数据库迁移。
- Docker 管理接口限定为管理员访问，并将部署权限要求记录到 project-log。
- 对前端做类型检查、lint、生产构建和浏览器登录页渲染验证。

**验证方式**：
- `pnpm run type-check`
- `pnpm run lint`
- `pnpm run build-only`
- 本地 Vite 预览 + 浏览器打开登录页，确认页面标题和登录按钮正常渲染。
- `git diff --check`

**验证结果**：
- TypeScript 类型检查通过。
- ESLint 通过，保留 3 个既有 Vue 命名风格 warning。
- Vite 生产构建通过。
- 登录页可正常渲染。
- 后端 Go 编译未运行，原因是当前 shell 未找到 Go。
- Docker 实机验证未运行，原因是当前 shell 未找到 Docker。

**本地产物清理**：
- 已停止本地 Vite 预览进程。
- `dist/` 是本轮构建产物，已清理。

---

## 2026-05-20（fork 初始化与 project-log 建立）

**触发原因**：项目 fork 自 Sun-Panel，用户希望基于 MIT 协议建立独立维护分支。上游开源版本长期缺少持续维护，后续 PRO / 付费相关规划也没有按用户预期持续公开更新，因此需要先完成 ZPanel 的维护基线。

**修改内容**：
1. `README.md` — 重写为 ZPanel 项目说明，明确当前 fork、上游来源和 MIT 归属。
2. `package.json`、`pnpm-lock.yaml` — 包名、描述、关键词改为 `zpanel` / `ZPanel`，并统一使用 pnpm。
3. `service/go.mod`、`service/**/*.go` — Go module 和内部 import 路径改为 `zpanel`。
4. `Dockerfile`、`docker-compose.yml`、`build.sh` — 构建产物、容器服务名、二进制名改为 `zpanel`，并修复 `build.sh` 版本号读取命令。
5. `index.html`、`vite.config.ts`、`src/locales/*.json`、`src/store/modules/panel/helper.ts`、`src/views/login/index.vue` — 前端显示名和默认页脚改为 ZPanel。
6. `src/components/apps/About/index.vue` — 关于页改为当前维护者、当前仓库和上游项目说明，移除不适合当前 fork 的上游社区 / 捐赠入口。
7. `sun-panel.code-workspace` → `zpanel.code-workspace` — VS Code workspace 文件按项目名重命名。
8. `project-log/` — 从模板复制项目知识库，并补齐当前项目第一版文档。
9. `.node-version`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` — 固定 Node.js 24.15.0、pnpm 11.1.3，并升级前端核心依赖。
10. `.github/workflows/container-ghcr.yml`、`docker-compose.yml` — 将容器发布目标改为 GitHub Container Registry。
11. `src/components/apps/ImportExport/index.vue`、`src/utils/jsonImportExport/index.ts` — 移除旧 `.sunpanel.json` 导入兼容，导出文件名改为 `ZPanel-Data...`。
12. `service/initialize/database/connect.go` — 默认管理员账号改为 `admin@zpanel.local`。

**遇到的问题**：
- 当前 shell 中找不到 `pnpm` 和 `go`。
- 使用 `npx pnpm` 默认拉取 pnpm 11，导致 `pnpm-lock.yaml` 被升级为 lockfile v9，并额外生成 `pnpm-workspace.yaml`。
- 初期全量 `pnpm run lint` 曾失败，后续已迁移到新的 ESLint 配置，当前全量 lint 无 error。
- 前端预览时后端未启动，`/api` 请求连接 `127.0.0.1:3002` 失败。
- TypeScript 6 / Vue 3.5 / Naive UI 新版本暴露出旧 Vue 宏 import、定时器类型、输入组件类型和 slot 名拼写问题。

**解决方式**：
- 初始验证曾使用 `npx pnpm@8 install --frozen-lockfile` 保持原锁文件，随后按新项目策略升级到 pnpm 11.1.3 并刷新 lockfile v9。
- 删除 npm lockfile，避免 npm / pnpm 双锁文件长期并存。
- 对本次触碰的 `docker-compose.yml` 和 About 页单独运行 ESLint，确认没有新增 lint 错误。
- 预览验证时只确认标题和页面基础渲染，不把后端 API 失败视为前端构建失败。
- 修复升级后暴露的类型兼容问题，并把 Vite / Vue / pnpm 的配置更新到当前工具链要求。

**验证方式**：
- `npx pnpm@11.1.3 install`
- `npx pnpm@11.1.3 run type-check`
- `npx pnpm@11.1.3 run build-only`
- `npx eslint docker-compose.yml src/components/apps/About/index.vue`
- `git diff --check`
- 本地 `vite preview` + 浏览器读取页面标题和首页文本。

**验证结果**：
- 前端依赖安装通过。
- TypeScript 类型检查通过。
- Vite 生产构建通过。
- pnpm 11 / TypeScript 6 / Vite 8 下类型检查和生产构建通过。
- 本次触碰文件的 ESLint 检查通过。
- `git diff --check` 通过。
- 本地预览页面标题显示为 `ZPanel`，首页文本包含 `Powered By ZPanel`。
- 后端构建未运行，原因是当前 shell 未找到 Go。
- 全量 lint 后续已通过；当前仅剩 3 个 Vue 命名风格 warning。

**本地产物清理**：
- `dist/` 为本轮构建产物，已在收尾阶段清理。
- 上游捐赠和 QQ 群相关资源已删除。
- `node_modules/` 是为本地验证安装的依赖目录，按项目常规保留且已被 `.gitignore` 忽略。

---

<!-- 新记录追加在上方分隔线之后、旧记录之前 -->
<!-- 格式模板：复制上面的 ## YYYY-MM-DD（主题描述）块，填写具体内容 -->
