# 规划决策记录

---

### ADR-005 [2026-05-21] 重新创建独立 GitHub 仓库与 1.0.0 发布基线

**状态**：已采用

**替代关系**：补充 ADR-001、ADR-002

**背景与需求**：用户希望 ZPanel 从“GitHub fork 后继续维护”的外观，调整为更像独立开源项目的状态。原 GitHub fork 仓库已删除，并重新创建同名仓库后重新推送。由于 `project-log/` 被 Git 忽略，另一台电脑没有这些文档，需要在当前本地工作区根据用户笔记、旧副本和当前代码重新补齐。

**采用的方案**：

- 重新创建 `vivalucas/zpanel` 同名 GitHub 仓库，使 GitHub 不再显示 fork 标识、Sync fork 或旧历史。
- 以精简历史重新推送：初始化提交 + 1.0.0 发布准备 + Docker Alpine sqlite 修复。
- README / LICENSE 继续保留上游 Sun-Panel MIT 来源和归属说明，避免误导为完全原创。
- 项目版本统一为 `1.0.0`，版本源为 `service/assets/version = 1|1.0.0`，并同步 `package.json`。
- 默认端口统一为 `6521`。
- 容器发布同时推送 Docker Hub 与 GHCR。

**备选方案**：

1. 保留 GitHub fork 关系和旧历史
   - 优点：来源链路完全透明，历史保留完整。
   - 缺点：GitHub 页面持续显示 fork / Sync fork，不符合用户希望建立独立项目外观的目标。
   - 放弃原因：ZPanel 仍在 README / LICENSE 中保留来源说明，仓库外观可独立化。

2. 继续只发布 GHCR，不接入 Docker Hub
   - 优点：发布链路较少，维护成本低。
   - 缺点：普通用户更习惯 Docker Hub，拉取体验不够友好。
   - 放弃原因：1.0.0 发布时已接入 Docker Hub。

3. 保留默认端口 3002
   - 优点：延续旧配置。
   - 缺点：不像正式产品端口，也容易和开发后端端口历史混淆。
   - 放弃原因：用户已确认统一为 `6521`。

**决策依据**：

- 独立仓库外观更符合 ZPanel 后续作为独立开源项目维护的目标。
- 保留上游归属说明即可满足 MIT 许可证要求和用户透明度。
- 精简历史降低新用户理解成本。
- Docker Hub + GHCR 同步发布可兼顾可见性和 GitHub 原生发布链路。

**改动范围**：

- GitHub 仓库形态和远端历史
- `README.md`、`README.zh-CN.md`、`docs/README.*.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/workflows/ci.yml`
- `.github/workflows/container-ghcr.yml`
- `.github/dependabot.yml`
- `.github/ISSUE_TEMPLATE/*`
- `Dockerfile`
- `docker-compose.yml`
- `service/assets/version`
- `service/assets/conf.example.ini`
- `service/router/router.go`
- `service/router/router_test.go`
- `package.json`
- `scripts/add-frontend-version.js`
- `vite.config.ts`

**验证状态**：

- GitHub Actions Frontend / Backend 已通过。
- Docker Hub / GHCR 容器发布已成功。
- Alpine + sqlite3 构建问题已通过 `CGO_CFLAGS="-D_LARGEFILE64_SOURCE"` 修复。
- 当前本地仓库已 fast-forward 到 `1e80e0d fix: build docker image with sqlite on alpine`。

**已知不足**：

- `project-log/` 是本地忽略目录，不随 GitHub 同步；跨电脑开发时需要手动迁移或重建。
- Docker 管理功能仍需在真实 Docker socket 环境中验证。
- 当前 README 仍需要后续跟随实际验证状态继续微调。

---

### ADR-004 [2026-05-20] README 与产品本地化语言集合对齐

**状态**：已采用

**替代关系**：无

**背景与需求**：用户希望 ZPanel 的 README 支持 DashCat 已覆盖的语言，并进一步要求产品本身也支持同样多的语言。与此同时，需要明确记录“语言选项和 locale 文件已经建立”不等于“所有语言的真实翻译已经完成”。

**采用的方案**：README 和产品侧统一支持 11 种语言：简体中文、English、日本語、한국어、Deutsch、Français、Español、Português do Brasil、Italiano、繁體中文、Русский。第一阶段完成语言入口、locale 文件、key 对齐、中英文文案优化和用户可见硬编码收敛；非中英语言真实翻译作为后续独立任务推进。

**备选方案**：

1. 只保留中英文
   - 优点：维护成本最低。
   - 缺点：不符合用户希望与 DashCat 对齐的目标。
   - 放弃原因：ZPanel 后续面向更广泛用户，语言框架应尽早稳定。

2. 一次性完成所有语言的真实翻译
   - 优点：最终用户体验最好。
   - 缺点：成本较高，且需要逐语言界面长度、术语和上下文校对。
   - 放弃原因：当前更适合先建立完整技术框架，再逐语言打磨。

3. 只翻译 README，不扩展产品 UI
   - 优点：文档层面见效快。
   - 缺点：用户进入产品后语言体验断裂。
   - 放弃原因：用户明确要求项目本身也支持这些语言。

**决策依据**：

- README 与产品语言集合一致，可降低长期维护混乱。
- locale key 先对齐，能让后续真实翻译只聚焦文案质量。
- 中英文是当前最可靠的基础版本，其他语言需要后续母语级校对。

**改动范围**：

- `README.md`
- `README.zh-CN.md`
- `README.ja.md`
- `README.ko.md`
- `README.de.md`
- `README.fr.md`
- `README.es.md`
- `README.pt-BR.md`
- `README.it.md`
- `README.zh-TW.md`
- `README.ru.md`
- `src/locales/`
- `src/locales/index.ts`
- `src/store/modules/app/helper.ts`
- `src/utils/defaultData/index.ts`
- 多个前端组件中的用户可见文案

**验证状态**：

- 前端类型检查通过。
- ESLint 通过，保留 3 个既有 Vue 命名风格 warning。
- 11 个 locale JSON 文件 key 完全一致。

**已知不足**：

- 日语、韩语、德语、法语、西班牙语、巴西葡萄牙语、意大利语、俄语目前使用英文基线文案，不是真正翻译版。
- 繁体中文目前使用简体中文基线文案，尚未做繁体化和地区用语校对。
- 后续真实翻译完成后，需要结合界面实测检查按钮、标题、表格和提示文案是否溢出。

---

### ADR-003 [2026-05-20] PRO 功能表开源化实现

**状态**：已采用

**替代关系**：无

**背景与需求**：用户提供上游标准版 / PRO 版功能对比表，并确认希望在 ZPanel 中实现这些功能。该表描述的是功能差异，不要求复制上游闭源代码、商业授权系统或付费运营平台。

**采用的方案**：基于公开功能描述，在 ZPanel 当前代码基础上重新实现对应能力，并全部纳入开源版：在线 CSS / JS、无限用户、站点标题 / 图标 / 登录页文案、Docker 应用管理、自定义搜索引擎、登录验证码、多账号快速切换、公共图库、备份迁移。

**备选方案**：

1. 继续保留标准版 / PRO 版差异
   - 优点：更接近上游商业设计。
   - 缺点：ZPanel 当前没有商业授权系统，也不需要制造功能限制。
   - 放弃原因：用户目标是全新开源项目发布，功能应直接可用。

2. 等待插件系统或 V2 架构后再实现
   - 优点：长期架构可能更优雅。
   - 缺点：短期无法满足用户明确需求，也会让可实现的配置类能力被无谓推迟。
   - 放弃原因：当前多数功能可基于现有模块低风险落地。

3. 复制上游 PRO / 商店平台设计
   - 优点：可能覆盖更多商业流程。
   - 缺点：涉及闭源功能、授权边界和非当前产品目标。
   - 放弃原因：ZPanel 只按公开功能描述重新实现面板能力，不复制商业后台。

**决策依据**：

- MIT fork 允许修改开源代码，但闭源实现不能直接复制。
- 用户明确要求 ZPanel 中实现这些功能，且不做付费限制。
- 当前实现优先复用已有表和模块，降低数据库迁移风险。
- Docker 管理功能安全边界较高，因此仅开放给管理员。

**改动范围**：

- `service/api/api_v1/system/login.go`
- `service/api/api_v1/system/about.go`
- `service/api/api_v1/system/docker.go`
- `service/api/api_v1/system/file.go`
- `service/lib/cmn/systemSetting/systemSetting.go`
- `src/App.vue`
- `src/views/login/index.vue`
- `src/components/apps/Style/index.vue`
- `src/components/apps/UserInfo/index.vue`
- `src/components/apps/UploadFileManager/index.vue`
- `src/components/apps/ImportExport/index.vue`
- `src/components/apps/DockerManager/index.vue`
- `src/components/deskModule/SearchBox/index.vue`
- `src/utils/jsonImportExport/index.ts`

**验证状态**：

- 前端类型检查、lint、生产构建和登录页渲染已通过。
- Go 编译和 Docker 实机操作未验证，原因是当前环境缺少 Go 和 Docker。

---

### ADR-001 [2026-05-20] fork 初始化命名和维护基线

**状态**：已采用

**替代关系**：无

**背景与需求**：项目 fork 自 MIT 协议的 Sun-Panel。用户长期使用原项目，但上游开源版本维护放缓，后续 PRO / 付费相关规划没有按用户预期持续公开更新。当前需要把 fork 后的仓库从“刚 clone 下来的上游副本”整理为可独立维护的 ZPanel 项目，同时保留上游归属和许可证要求。

**采用的方案**：进行安全范围内的项目身份初始化：项目显示名、包名、Go module、构建产物、Docker 服务名、README、关于页和默认页脚统一改为 `zpanel` / `ZPanel`；README 和关于页明确标注上游 Sun-Panel 和原作者归属；暂不修改业务逻辑和数据库结构。

**备选方案**：

1. 只改 README，不改代码中的 `sun-panel`
   - 优点：改动小，后端编译风险低。
   - 缺点：后续新增代码仍会混用旧命名，Docker / 二进制 / Go module 与仓库名不一致。
   - 放弃原因：fork 初期统一命名成本最低，越晚改影响越大。

2. 大规模重构并同时升级依赖
   - 优点：可一次性解决更多技术债。
   - 缺点：风险高，难以区分 fork 改名、依赖升级和业务重构导致的问题。
   - 放弃原因：当前目标是建立维护基线，不是立即重写产品。

3. 完全保留上游品牌名
   - 优点：兼容用户认知。
   - 缺点：当前仓库已改名为 ZPanel，继续使用上游品牌容易造成归属混淆。
   - 放弃原因：需要建立清晰的独立维护身份。

**决策依据**：

- MIT 允许 fork 和修改，但必须保留版权声明和许可证。
- 早期统一命名能减少长期维护混乱。
- 不改业务逻辑可降低首次初始化的回归风险。
- 上游归属应明确保留，避免误导用户以为这是原官方继续维护版本。

**改动范围**：

- `README.md`
- `package.json`、`pnpm-lock.yaml`
- `service/go.mod`、`service/**/*.go`
- `Dockerfile`、`docker-compose.yml`、`build.sh`
- `index.html`、`vite.config.ts`
- `src/locales/*.json`
- `src/components/apps/About/index.vue`
- `src/store/modules/panel/helper.ts`
- `src/views/login/index.vue`
- `project-log/`

---

### ADR-002 [2026-05-20] 全新项目发布与 GHCR 容器发布

**状态**：已采用

**替代关系**：无

**背景与需求**：用户确认 ZPanel 不需要兼容原 Sun-Panel 旧配置导入，项目按全新项目发布；容器镜像先发布到 GitHub Container Registry，DockerHub 等以后申请账号后再补充。

**采用的方案**：移除旧 `.sunpanel.json` 导入兼容和上游转换工具链接；导出文件名统一为 ZPanel；容器镜像默认使用 `ghcr.io/vivalucas/zpanel:latest`；GitHub Actions 改为 GHCR 发布。

**备选方案**：

1. 保留旧导入兼容
   - 优点：方便上游老用户迁移。
   - 缺点：增加测试和维护负担，也会让全新项目边界变模糊。
   - 放弃原因：当前项目定位为全新发布，不做旧配置兼容。

2. 同时配置 DockerHub 和 GHCR
   - 优点：用户拉取渠道更多。
   - 缺点：需要额外账号、凭据和发布维护。
   - 放弃原因：初期先减少发布面，DockerHub 后续再补。

**决策依据**：先建立清晰的 ZPanel 项目边界和可复现发布链路。

**改动范围**：导入导出、Docker Compose、GitHub Actions、project-log。

---

<!-- 新决策记录追加在此处 -->
<!-- 格式模板：复制上面的 ### ADR-XXX [YYYY-MM-DD] 块，填写具体内容 -->
