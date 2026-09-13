# React 前端开发

ZPanel 前端使用 React、TypeScript、Vite 和 Ant Design。后端仍为 Go / Gin，前端编译产物仍输出到 `dist`，Docker 将其复制到 `/app/web`。页面采用 Hash 路由，不需要额外配置 SPA 路由回退。

## 开发与验证

```bash
pnpm install --frozen-lockfile
pnpm dev
```

另开终端启动 API：

```bash
cd service
go run main.go
```

前端默认端口为 `1002`，代理 `/api` 和 `/uploads` 到 `6521`。可通过 `VITE_APP_API_BASE_URL` 调整开发代理目标。

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm test:review
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

浏览器测试需要 Go。测试脚本自动编译后端，在系统临时目录创建数据库与配置，使用 `16521` 端口提供真实 API 和 `dist` 静态页面，退出时清理。运行前先执行 `pnpm build`。测试不会使用 `service/data`；Docker 连接指向一个不存在的 socket，避免测试操作宿主机容器。

## 目录结构

- `src/app`：入口、路由、会话边界、全局主题和布局样式。
- `src/features/auth`：登录和验证码。
- `src/features/home`：导航首页、卡片编辑和监控显示。
- `src/features/settings`：外观、分组、搜索与监控、文件、备份、账号、账号管理、Docker、站点和关于页面。按页面延迟加载。
- `src/components`：共享布局、上传、错误状态和支持键盘操作的拖拽容器。
- `src/lib`：HTTP 协议、数据查询、反馈和纯格式化逻辑。
- `src/locales`：i18next 语言资源；新增界面文案提供中英文，其他语言缺失项回退到英文。
- `src/utils`：导航 URL 校验和备份协议。
- `tests/e2e`：使用临时 Go API 的浏览器回归；Docker 成功路径、故障注入与多页文件数据使用模拟响应。

## 组件与主题约定

基础控件使用 Ant Design。颜色、圆角、控件高度与字体在 `Providers.tsx` 的 `ConfigProvider` 中统一定义，页面通过 `--surface`、`--canvas`、`--text`、`--muted`、`--border`、`--primary` 等变量使用同一套主题。

导航卡片、时钟和监控布局为业务组件。它们的背景与文字默认跟随主题，用户可显式设置个性化颜色。避免覆盖 Ant Design 内部 DOM 层级；需要定制控件时，优先使用组件 token 和公开属性。装饰图标从无障碍名称中隐藏，功能按钮提供可读标签。

设置页通过统一的 `Section` 组织，表单采用一致的间距和保存按钮。手机使用顶部分类选择器；桌面采用侧边导航。`prefers-reduced-motion` 下禁用额外动效。

## 版本号

`package.json` 与 `service/assets/version` 使用相同的发布版本。前端构建脚本校验两者一致，并将发布版本用于关于页面和配置导出，不再使用构建日期作为前端版本。发布 tag 使用 `v` 前缀。

## 页面文案

使用准确的功能名称、操作动词和结果提示。删除口号、装饰性英文和重复说明，不添加未经确认的产品定位。仅保留影响操作的说明（如保存范围、删除后果、备份范围和恢复方式）。管理员配置的站点标题、副标题和页脚按配置显示。

## 数据与会话

- TanStack Query 管理后端数据、加载状态、刷新、错误及监控轮询。
- Zustand 只持久化主题、语言、内外网模式和账号会话。
- 每次切换账号创建独立的 QueryClient，取消旧查询并清除旧缓存。
- 请求使用后端要求的 `token` / `lang` 请求头，并传递查询取消信号。
- HTTP 成功但业务 `code` 非零时抛出 `ApiError`。仅 `1202` 表示缺少配置并使用默认值；数据库错误保持可见。
- 写操作不自动重试。备份导入使用稳定的 `requestId` 重试同一请求，避免重复追加。
- 权限入口根据服务端 `getAuthInfo` 返回的角色与访问模式展示，服务端继续负责最终鉴权。

## 功能与边界

导航支持增删改、分组、图片/文字/Iconify 图标、内外网地址、三种打开方式、搜索、菜单与拖拽排序。排序也支持聚焦手柄后使用空格和方向键。

文件支持个人与公共图库、上传、设置壁纸、引用查询、引用替换与删除。导入导出覆盖导航与面板外观配置，不包含图片文件、账号密码或搜索/监控模块配置。

监控在页面可见时每 5 秒轮询。Docker 管理支持资源快照、启动、停止、重启、暂停、恢复和日志；实际容器操作需要后端可连接 Docker。

站点设置保留自定义 CSS / JavaScript。HTML 页脚先经过 DOMPurify；自定义 JavaScript 作为管理员明确配置的功能执行。地址添加 `?safeMode=1` 可跳过自定义 CSS / JavaScript。

## 重构范围

原 Vue、Pinia、Naive UI 组件与构建依赖已移除。没有并行维护旧前端，也不提供旧浏览器本地状态迁移。Go 业务接口与部署产物结构保留；修正了缺少数据时的错误码，以支持新账号首次进入。

## 页面入口与编辑约定

首页「设置」进入 `/#/settings/appearance`，桌面使用侧栏，手机使用页首选择器。导航项目在首页添加、编辑、排序；分组在「导航分组」管理。搜索引擎与监控卡片位于「搜索与监控」。管理员额外看到用户、Docker、站点设置，普通用户直接访问这些 URL 返回 403；不存在的设置页面返回 404。匿名公开访问只显示导航及登录入口。

外观、搜索与监控、站点设置均需点「保存」。失败时保留当前输入；保存期间禁用表单；切换页面时提示放弃未保存修改，刷新或关闭页面使用浏览器原生提示。主题、语言、内外网模式是浏览器偏好，即时生效。登录用户从首页选择搜索引擎会保存为默认引擎；访客选择仅在当前页面生效。

文件引用替换可独立选择「我的文件」或「公共图库」并翻页。替换会修改自己有权管理的引用，不会自动删除原图。文件图库与外观配置保存不同：图片上传只生成文件，外观页面上传壁纸后仍需保存。

## HTTP 与自定义代码

普通局域网 HTTP 可用于登录、编辑和导入。请求 ID 使用 `crypto.getRandomValues` 生成，不能依赖仅安全上下文提供的 `crypto.randomUUID`。新页面内的请求应使用 `useSessionRequest`，避免确认弹窗的旧回调在切换账户后用新 token 发出请求；请求层也会丢弃会话切换后才完成的响应。

自定义 CSS 随内容变化更新；相同 JavaScript 不会因为修改标题、主题或重新取站点数据而重复执行。修改 JavaScript 会执行新的内容，但无法撤销旧脚本已经添加的计时器和事件监听，彻底替换后应刷新页面。`/?safeMode=1#/settings/site` 或 `/#/settings/site?safeMode=1` 可恢复设置；已经执行脚本时，进入安全模式会重新加载以清除旧副作用。仅支持管理页面中的数据库自定义配置，不再默认引用不存在的 `/custom/index.css` 和 `/custom/index.js`。

## 可选 PWA

构建环境设置 `VITE_GLOB_APP_PWA=true` 可生成清单与 service worker，默认关闭。Go 显式提供清单、注册脚本、worker 和图标路径；worker 内联运行库。生产浏览器安装需要 HTTPS（localhost 除外），普通 HTTP 局域网仍可直接访问应用。PWA 缓存静态界面，不提供离线业务数据或离线写入。本轮验证了 PWA 构建和资源路由，未验证操作系统安装和升级生命周期。

完整功能对照、回归范围及尚未验证的集成见 [React 重构自查](frontend-audit.zh-CN.md)。
