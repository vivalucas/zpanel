# 前端事件与交互专项检查

用途：为全面检查、直接修复及原任务独立复核提供逐项对照。状态：本地实施、自查及原任务独立验收完成，实机缺口保留。基线：`9cf3e54`，`main`，2026-10-23。维护时机：后续事件边界变化时更新。

范围包括 `src/app`、`components`、`features`、`lib`、`locales`、`utils`、入口和相关测试；保留现有视觉方向、数据及权限语义，不升级依赖。实施阶段保留改动供原任务验收；验收完成后，用户另明确授权提交并推送到 origin/main，不包含发版或部署。浏览器仅访问 `scripts/e2e-server.mjs` 创建的临时 SQLite 服务，Docker 指向不存在的测试 socket；Docker 成功响应及竞态故障使用浏览器拦截。

2026-10-24 首页菜单增量由当前 AI 实施和自查，未计入上述 2026-10-23 独立验收。配置导入入口、应用右键与复制边界以当前前端说明及 [菜单专项回归](../tests/e2e/item-menu.spec.ts) 为准，实际执行结果见 01。

## 证据与覆盖矩阵

下表事件相关实现均已逐个阅读；纯函数、配置和语言资源按静态核查及相应自动检查覆盖。E = [events.spec.ts](../tests/e2e/events.spec.ts)，B = [event-boundaries.spec.ts](../tests/e2e/event-boundaries.spec.ts)，A = [audit.spec.ts](../tests/e2e/audit.spec.ts)，W = [workspace.spec.ts](../tests/e2e/workspace.spec.ts)，P = [project-review.spec.ts](../tests/e2e/project-review.spec.ts)，H = [home-appearance.spec.ts](../tests/e2e/home-appearance.spec.ts)，L = [settings-layout.spec.ts](../tests/e2e/settings-layout.spec.ts)。表中短语可在对应文件中搜索测试名称；整套实际结果见下节。静态核查不能视为真实设备的操作验收。

| 入口/文件 | 事件及正常行为 | 失败、取消、禁用及加载 | 证据 | 未覆盖或复核边界 |
| --- | --- | --- | --- | --- |
| `home/ItemActionMenu.tsx`（2026-10-24 增量） | 右键/更多/键盘共用菜单；地址分区、临时打开方式、复制、编辑与删除；按视口定位 | 缺失地址隐藏、非法地址禁用、访客隐藏管理项、排序/过滤关闭、Esc/Tab 恢复焦点；剪贴板失败手动复制、迟到结果丢弃；内嵌保留外开入口 | `item-menu.spec.ts`；E 编辑/跨组焦点；H 首页与设置入口 | HTTP 非安全来源与模拟拒绝分别覆盖；真实手机、Safari/Firefox 与所有外站嵌入策略仍需实机 |
| `app/App.tsx` | Hash 路由、公开/登录/管理入口，CSS 随内容更新、JS 同内容不重复执行，安全模式重新加载清除脚本副作用 | 认证读取重试、403/404、路由异常恢复入口；空 JS 后仍记住执行历史 | A unknown routes/custom JavaScript；W ordinary users；E safe mode clears script；P repair path；异常页恢复按钮静态核查 | 未人为制造所有 React 渲染异常；线上自定义脚本不在测试环境执行 |
| `app/Providers.tsx`、`store.ts`、`main.tsx` | 会话独立 QueryClient；主题/系统主题、账号增删选、语言即时变化 | 取消旧查询/清缓存；系统监听器清理；过期语言失败不覆盖最新选择；顶层错误可刷新 | W appearance/account switching；E failed old language；B confirmed switching/logout；系统 media listener 及 ErrorBoundary 静态核查 | 未覆盖多标签页存储冲突、系统级 PWA 安装升级 |
| `auth/Login.tsx` | 点击/Enter 登录、语言选择、验证码按钮/键盘刷新，公开来路返回首页 | 业务失败换验证码；忙时锁表单/验证码及同步提交锁；离页或切会话后的成功不再登录/跳转 | A HTTP LAN/captcha；W login；E login locks fields/late anonymous login；API 单元显式匿名会话检查 | 验证码图像识别不自动化；真实手机输入法待验 |
| `home/Home.tsx` 搜索/工具 | 本地搜索含标题/描述/内外网 URL；清除、IME Enter 防误跳；网页搜索按引擎及新窗口选项；WAN/LAN、设置、编辑提示 | 读取失败可重试；引擎保存失败回滚以便再次选同值；写入时禁用选择；访客选择不写服务端 | E failed default-engine/LAN addresses；A/W search；H touch/hint/partial failures/public visitors | 浏览器阻止弹窗的具体策略及真实手机组合键待验 |
| `Home.tsx` 导航/菜单/内嵌 | 原生链接普通/Meta/中键；菜单独立于链接，不冒泡误开；内外网覆盖、编辑/删除、iframe/外开 | URL 安全校验；排序中禁止跳转；删除失败留确认可重试；同源 iframe 不授予 allow-same-origin；Esc/关闭与焦点恢复 | A home honors navigation；P native links；B native modified clicks；E orphan confirmation/editor focus/moving app focus；sandbox/事件结构静态核查 | Meta 在 macOS Chrome 验证；Windows Ctrl、跨站 iframe 的服务器嵌入策略待实机 |
| `Home.tsx` 分组/应用排序 | 组内新增、切换排序、键盘拖动、保存回读；空组引导与空搜索状态 | 保存中禁用排序；搜索时不拖局部结果；完成后恢复点击 | W keyboard-sort persisted；H keyboard/touch；B group pointer sorting；Sortable 结构核查 | 真触屏拖拽、辅助技术读屏播报待验 |
| `home/ItemEditor.tsx` | 必填/URL/至少一个地址校验，图标类型/文字/上传/favicon，保存与取消 | 上传/favicon 未结束不能保存；保存锁字段；晚 favicon 不能覆盖手改图标或新地址/类型；卸载取消请求；关闭后回到触发按钮 | P LAN-only；W create/edit；E item upload/favicon/editor focus；类型/地址变化比较静态核查 | 私网 favicon 与实际外部网站服务未实测 |
| `home/MonitorCards.tsx`、`useWallpaperAppearance.ts` | CPU/内存/磁盘按配置轮询；壁纸 onload/resize 合并采样，离页清理 timer/listener | Query 错误状态；后台轮询沿用 TanStack 默认暂停；跨域/超大/透明/失败壁纸回退；卸载丢弃采样 | W monitor cards；H 全部壁纸/resize/partial failures；纯计算 Vitest；轮询与 cleanup 静态核查 | 未以真实长时后台驻留计量轮询；NAS 磁盘与跨平台监控待验 |
| `settings/Settings.tsx` | 侧栏、手机选择器、返回、品牌 Link；分类切换回顶，同一权限列表 | 未保存取消后选择器仍显示当前页；403/404；品牌返回参与 Router blocker | E brand navigation；B mobile settings；A unknown routes；W ordinary users；滚动复位静态核查 | 系统读屏及移动软键盘滚动待验 |
| `settings/Appearance.tsx` | 主题即时生效；字段/标识/壁纸草稿预览；明确保存、恢复默认确认 | 上传锁保存；保存锁上传/重置/表单；失败留草稿；离页/刷新保护；详情样式发送合法值 2 | A failed appearance saves；E appearance upload/detail card/brand；W appearance；L 全部布局/焦点；P invalid style | 未实际关闭浏览器验证原生提示；beforeunload 注册/移除已静态核查 |
| `settings/Groups.tsx` | 新增/改名、删除并迁移或连同应用删除；指针/键盘排序 | 最后分组禁删说明；忙时新增/编辑/取消视觉禁用；错误保留输入，取消不写请求 | W group creation；P moving applications；E group editor locks；B group sorting Escape/pointer drop | Ant Design 已在 confirmLoading 时阻止实际取消，显式禁用属于加固，不能记作旧数据竞态缺陷 |
| `settings/Modules.tsx` | 搜索引擎增删/默认选择/保存；监控增删/上移/类型/颜色/磁盘路径/单独保存 | 分区首次/刷新失败与重试；保留另一区域；最少一个引擎；两份草稿共同保护；写请求统一页面生命周期 | A removing engine/failed section；W search/monitor save；B mobile leave；Form.List 动作/校验静态核查 | 每种监控样式与真实磁盘挂载点组合未逐一实机验证 |
| `settings/Files.tsx` | 个人/公共图库、图片预览、上传/重试、分页、设壁纸、引用/替换/删除 | 空/读取错误；跨页替换；删除末页回退；替换中冻结目标/图库/分页并禁止关闭，避免迟到回调关闭新目标；仅本人文件有删除入口 | W upload/wallpaper/usage；A cross-page replacement/delete；P upload retry；E replacement locks；权限条件及预览组件静态核查 | 真实大图库及多用户同时删图导致替换页缩减未实机验证；当前错误可重试 |
| `settings/Backup.tsx`、`utils/jsonImportExport/index.ts` | 选择/校验/预览、选数据、追加/覆盖确认、导出下载；仅最后一次文件读取生效 | 格式/尺寸/校验失败；覆盖读取失败禁用；确认时冻结选项；重试同载荷复用 requestId；导出失败不下载；下载后释放 Blob URL；离页废弃旧解析 | E latest selected backup；B backup retries/export failures；W round trip；test:review 导入 schema/checksum/导出失败 | 浏览器下载目录权限、多设备完整恢复、二进制图片恢复不属配置导入范围 |
| `settings/Account.tsx` | 资料/头像、语言、账号增删切换、密码确认/修改、退出 | 资料失败保草稿/上传锁保存；密码也参与离页/切账号保护；确认账号转换同步放行旧 blocker；成功改密/退出撤销本地会话；旧确认随页面消失 | W account switching；A password session revoke；E password drafts/account upload；B confirmed switching/logout；密码规则纯字节校验静态核查 | 真多账号并发服务及跨设备会话撤销由既有后端测试覆盖，未做生产操作 |
| `settings/Users.tsx` | 搜索/清除/分页、新增/改名/角色/可选改密、删除、公开账号开关确认 | 不删当前用户；最后管理员由后端保护；读取/刷新失败重试；删除末页回退；忙时冻结编辑入口；公开失败留确认可重试、取消不写 | A user creation/edit；W ordinary/public；E last user page；B user editor/public retries/mobile account table；后端 Go 测试 | 未做真实用户管理；用户名/昵称超长组合仍按现有后端校验显示错误 |
| `settings/Docker.tsx` | 名称/镜像过滤、列表/资源刷新；启动/停止/重启/暂停/恢复；日志行数/刷新/重开 | 按 state 禁用；pending 数组按容器隔离；同容器只开一确认；操作失败可重试；列表/资源/日志错误分区显示；重开日志不复用未刷新快照 | A Docker action/read failures；E reopening logs；logs key/signal/pending 分支静态核查 | 成功动作使用模拟响应；不声称真实 Docker 成功验收，长任务断线/宿主机权限待实机 |
| `settings/Site.tsx`、`About.tsx` | 站点/登录/验证码/CSS/JS 保存；版本/说明读取与外链 | 保存锁字段、失败保草稿/离页保护；安全模式；版本/说明分别重试、长 Markdown 截断且净化 | A/W site customizations；E empty script safe mode；P repair path；B surfaces；About 错误与外链静态核查 | 真实管理员自定义脚本的任意副作用无法逐一覆盖 |
| `components/ImageUpload.tsx` | 格式/10 MiB 预检、单/多上传、逐文件状态、失败重试、成功回调 | 同文件同步互斥；单选忙时禁重选；卸载取消请求；回调刷新失败不重传；向表单报告上传忙碌，卸载释放忙状态 | P upload retry；W upload；E 三个上传表单；预检/多文件/刷新失败 catch 分层静态核查 | 并行多文件断网/浏览器原生文件选择取消等全部 OS 组合未实机 |
| `components/Sortable.tsx`、`shared.tsx` | Pointer/Keyboard Sensor；空格/方向键/完成/Esc，手柄独立；共享重试/加载/错误状态 | 禁用时无手柄，不排序相同/无目标；重试显示加载与恢复；不把错误当空列表 | W keyboard-sort；B pointer/Esc；A Docker/分区重试；H 键盘入口；实现静态核查 | 极快无间隔合成按键早于第三方 sensor 注册，不等同实机问题；回归采用 100ms 按键时序 |
| `components/SafeHtml.tsx`、`BrandMark.tsx` | 净化 HTML/Markdown 链接、装饰图标；无业务写事件 | 过滤危险 HTML/style；装饰图标不污染按钮名称 | W/A 页面 smoke；DOMPurify 与链接实现静态核查；test:review URL 校验 | 外部链接目标可用性不属于本地验收 |
| `lib/api.ts`、`session.ts`、`queries.ts`、`feedback.ts`、`unsaved.ts` | 请求/会话/取消、业务错误/重试、确认框与 beforeunload 生命周期 | 页面 scope 和调用方信号合并并清理监听；fetch 前/响应/JSON 后均检取消与会话；匿名请求也绑定发起会话；卸载销毁旧确认、忽略旧错误；显式放弃后同步放行导航 | `api.test.ts` 新增 3 项；E orphan/login；B switching/logout；A save/leave；信号合并不依赖 AbortSignal.any | 取消客户端等待不代表回滚服务端已完成写入；未承诺撤销已发送动作 |
| `lib/format.ts`、`iconColor.ts`、`id.ts`、`panelConfig.ts`、`password.ts`、`wallpaper.ts`、`utils/navigation.ts` | 事件调用的纯函数：格式、对比、请求 ID、配置修复、UTF-8 密码、壁纸和安全 URL | 缺省/非法/上下界回退或校验；HTTP 不依赖 randomUUID | Vitest；test:review；P invalid style；H contrast；未改函数逐文件静态核查 | 所有语言母语质量和所有 CSS 色值组合未人工逐项检查 |
| `locales/index.ts`、全部 11 个 JSON | 异步语言包仅最后选择生效；与 Ant Design/文档 lang 同步 | 旧加载失败不再触发全局英文回退；全部 locale key 对齐 | E failed old language；A login language；test:review locale parity；动态资源加载静态核查 | 2026-10-24 新增菜单文案已补齐全部语言；非中英母语质量仍待复核 |

## 确认问题、触发条件及修复

以下按根因分组，避免把多个断言计成多个问题。除注明外，均已在修复前通过延迟响应/失效响应或正常操作复现；测试用例名称见矩阵。

| ID | 触发条件与影响 | 修复位置/行为 |
| --- | --- | --- |
| E01 | 首页打开删除确认后，同账号跳转其他页面，确认仍残留，可继续执行旧操作 | `feedback.ts` 按调用页面登记并销毁确认；`session.ts` 阻止卸载后旧请求 |
| E02 | 登录请求等待时返回其他路由，迟到成功仍 signIn 并把页面拉回首页 | `session.ts` 页面 scope；`api.ts` 显式匿名请求也检发起会话，并在 JSON 读取后检取消 |
| E03 | 登录等待期间账号/密码等字段仍可操作，与已发请求内容不一致；原回调无重复提交互斥 | `Login.tsx` 锁字段/验证码，加同步提交互斥 |
| E04 | 壁纸/头像/项目图标上传中点击保存，保存旧地址，新上传结果只留草稿 | `ImageUpload.tsx` 报告忙碌并清理，三个表单阻止未完成上传时保存；保存时也禁用上传 |
| E05 | 获取 favicon 等待期间手工修改图标，旧响应覆盖新图标 | `ItemEditor.tsx` 比较发起 URL、图标地址及类型，失效时不写回；获取期间禁止提交 |
| E06 | 密码表单输入后切页，无提示丢弃密码草稿 | `Account.tsx` 密码与资料共同参与离页/账号切换保护 |
| E07 | 用户列表第二页仅一行，删除后分页显示回第一页但请求仍读第二页，列表为空 | `Users.tsx` 将实际请求页同步到最新末页 |
| E08 | 首页改默认搜索引擎失败仍显示新引擎，再选同值不触发保存重试 | `Home.tsx` 失败回滚选择，允许重新选择并保存 |
| E09 | 以导航项目内网 URL 的片段搜索，项目无法匹配 | `Home.tsx` 将 `lanUrl` 纳入本地搜索 |
| E10 | 外观选择详情图标后保存，发送 0，而前后端仅接受 1/2，配置不能保存 | `Appearance.tsx` 详情选项改为既有合法值 2，不更改协议/数据模型 |
| E11 | 连续选两个备份，先选文件读取较慢，晚完成后覆盖最新文件预览 | `Backup.tsx` 选择序号与卸载失效检查；新选择立即废弃旧预览 |
| E12 | 外观有草稿时点击设置侧栏品牌返回，原生 hash 链接绕过离页保护 | `Settings.tsx` 使用 Router Link，保留原生链接交互及 blocker |
| E13 | 从项目更多菜单进入编辑，取消后焦点落到页面 body | `Home.tsx` 按稳定项目 ID 找回当前触发按钮，编辑结束及跨分组保存后均恢复焦点；添加入口也使用相同行为 |
| E14 | 30 秒内关闭并重新打开同一 Docker 日志，仍显示旧缓存 | `Docker.tsx` 日志立即过期，重开请求新快照 |
| E15 | 自定义 JS 已执行，再保存为空，进入 hash 安全模式未刷新，旧监听/副作用仍存在 | `App.tsx` 独立保存本页曾执行脚本的事实，不以当前脚本文本是否为空判断 |
| E16 | 选择 Deutsch、立即选回简体中文，再让旧德语包失败，偏好/lang 为中文而文案变英文 | `Providers.tsx` 仅当前仍有效的 effect 可执行失败回退；父任务也独立复现该基线问题 |
| E17 | 有资料或密码草稿时确认切账号，账号已变，但旧 blocker 把页面留在账号页 | `unsaved.ts` 提供同步放行；`Account.tsx` 在明确放弃/成功改密/成功注销后放行，再切会话/导航 |

E03 修复前首先复现字段未锁，重复请求防护同时作为加固；不将“两个请求已实际落库”作为复现结论。

## 加固、建议与去误报

- 图片引用替换等待期间目标控件仍可修改已实测；关闭后重开被旧回调关闭属于静态关联风险，未单独回放基线，不计入上表。`Files.tsx` 冻结选择、图库/分页及关闭按钮，阻止目标改变；最终用例检查冻结与 Esc 不关闭，路由离开仍由页面请求 scope 废弃回调。

- 分组与用户 Modal 在 `confirmLoading` 时已由 Ant Design 阻止实际取消。本轮显式禁用取消、新增/编辑入口，并增加 busy guard；这是状态一致性加固，不列为已确认的“慢保存可取消”缺陷。
- 同容器重复点击只保留一个确认；Docker 原 `pending:string[]` 已按容器隔离，未发现“单一 busyId 相互清空”的问题。
- 覆盖导入确认时冻结文件和选项，保证确认与预览一致；同载荷重试继续复用收据。导出下载后释放 Blob URL，避免长会话累积。两项作为加固，不夸大为已发生数据丢失。
- 搜索与监控保存从未绑定页面的 `saveModule` 便利方法改为 `useSessionRequest`，统一已确认的页面生命周期边界。
- 分组排序测试最初无间隔发键，早于第三方 sensor 注册；改用与既有回归一致的 100ms 按键时序。取消后 `aria-pressed` 被移除，不能错误要求必须等于字符串 false。没有为测试时序更改产品排序实现。
- 语言的初次自动化脚本因虚拟下拉菜单滚动未完成选择，不计复现；修正为键盘选择并核实偏好已回到 zh-CN，再释放失败请求。账号切换模拟也补齐搜索配置响应，避免无效测试 token 误触真实鉴权错误。
- 请求合并使用 AbortController 和可清理监听器，不依赖 `AbortSignal.any` 或 `throwIfAborted`，未提高声明的浏览器要求。
- 暂无需要另行改变产品语义的体验建议；真实设备、长时并发及集成缺口在矩阵与下节保留。

## 验证与交接

工具链实际为 Node.js 24.15.0、pnpm 11.1.3、Go 1.26.3。固定版本通过本机已安装运行时选取，未升级依赖或改锁文件。最初默认沙箱不能启动临时监听服务，经权限流程允许后在隔离服务运行；没有使用真实数据库。

| 命令/对象 | 实际结果 |
| --- | --- |
| `pnpm build`（含 TypeScript） | 通过，最终普通 dist 已稳定保留（无 sw.js） |
| `VITE_GLOB_APP_PWA=true pnpm build`，随后恢复普通构建 | 两种构建均通过，最终已恢复普通构建 |
| `pnpm lint` | 通过，无警告 |
| `pnpm test` | 4 文件、23 项通过（原 20 + 请求边界 3） |
| `pnpm test:review` | URL 安全、导入 schema/checksum、导出错误、11 语言 key 一致通过 |
| `go test ./...`（service，Go 1.26.3） | 通过，未改后端，存在有效测试缓存 |
| `pnpm exec playwright test --config /private/tmp/zpanel-event-review.config.ts --reporter=list` | 71 项全部通过（原 39 + 新增 32）；临时配置仅覆写 channel:chrome、输出目录和绝对测试目录，沿用项目隔离服务 |
| `python3 handbook/tools/check_docs.py` | 独立验收回写后错误 0；14 与本专题有篇幅提醒，保留完整覆盖矩阵及复验证据 |
| `git diff --check`、累计改动检查 | 通过，累计业务与测试改动已自查；未改后端、依赖、版本或锁文件 |

生产浏览器自动化覆盖正常路径、失败/重试、取消/禁用/加载、原生链接及 Meta/中键、IME、防重复、页面/会话切换、键盘焦点和指针排序。纯浏览器故障注入与真实临时 API 混用，未把模拟 Docker 成功当作真实 Docker 验收。

截图由 B 的 `desktop and mobile page surfaces` 保存在 `test-results/event-visuals/`，按 `1440-页面.png` 和 `390-页面.png` 命名，包含 home、login 及十个设置页。现有 H/L/W 继续保留壁纸、320px、主题和布局截图。实际已逐张查看全部 24 张页面首屏和外观/搜索监控/账号/站点的 8 张底部截图，共 32 张；另查看混合壁纸桌面、深壁纸 390px、细纹理 320px 及深色设置截图，未发现本轮布局和风格回退。手机账号表格横向滚动后的编辑/保存/删除/取消另有 B 的实际点击回归。截图为本机临时验收证据，不是通用运行配置。

未验证 Safari/Firefox、Windows/Ubuntu 浏览器、真实手机软键盘/触控/辅助技术、真实 Docker/NAS/MySQL/Redis、长时后台轮询与多标签页竞争、PWA 系统安装升级或线上部署。调用方取消只停止客户端等待，不能承诺回滚已经发送并在服务端完成的写入。

本专题属于实施者自查，原任务负责独立复核。交接时应重点对照共享请求/确认生命周期、匿名登录、草稿账号转换、三个上传表单、备份乱序、样式合法值、语言失败、安全模式及实际截图；不以单一 AST 事件数量声称所有运行状态已经穷尽。


实施交接时，`main` 与当时最新 fetch 的 `origin/main` 均为 `9cf3e54`，变更留待独立验收，未提交或推送，无版本/标签/Release/部署。普通 `dist` 保留于项目目录，临时 SQLite 服务已退出，16521 无监听。原任务可读取当前源码及 dist 进行独立对照，不需使用任何真实数据库。

可复用的本机证据：`/private/tmp/zpanel-event-review.config.ts`；完整最终 E2E 输出 `/private/tmp/zpanel-event-final-e2e.log`（71 passed）；普通/PWA 构建输出 `/private/tmp/zpanel-event-final-build.log`、`/private/tmp/zpanel-event-pwa-build.log`；Go 输出 `/private/tmp/zpanel-event-go.log`。最终截图目录 `/Users/lucas/projects/zpanel/test-results/event-visuals/`；附加壁纸截图在 `/private/tmp/zpanel-event-review-results/`，深色设置在 `test-results/settings-dark.png`。这些路径属于本轮机器的验收产物，不是共享部署配置；清理前需保留原任务仍在使用的证据。

## 原任务独立验收

2026-10-23，原任务与实施任务分别执行检查。原任务在实现期间只读代码，另写 Chrome 验收脚本；先从 `git archive 9cf3e54` 的源码构建基线，再对最终普通 dist 的独立副本执行相同操作。预览使用另一临时端口 16522，所有 API 均为受控模拟，不接触实际数据库。最终副本的全部 73 个文件与交接 dist 的 SHA-256 一致。

| 独立操作 | 精确基线结果 | 最终结果 |
| --- | --- | --- |
| 默认搜索引擎 Alpha 切 Beta，保存返回 HTTP 500 | 仍显示 Beta，复现 E08 | 回到 Alpha，通过 |
| 公开首页进入登录，延迟成功响应，先返回首页 | 旧响应仍写入登录 token，复现 E02 | token 保持空，不再登录或拉回页面，通过 |
| 壁纸上传响应保持未完成，检查保存入口 | 保存仍可用，复现 E04 | 保存禁用，通过 |
| 先选 Deutsch、立即选中文，再使旧德语包加载失败 | 偏好及 lang 为中文，文案却变英文，复现 E16 | 文案及 lang 保持中文，通过 |
| 分组延迟保存，Esc/关闭/取消，再完成请求 | 原控件已阻止关闭 | 仍保持当前弹窗，保存完成后关闭，通过；作为加固验收 |

五项最终操作均无页面运行异常或未配置 API 请求。延迟登录和语言故障由原任务独立复现后交实施任务修复，未把修复者自己的回归称为独立发现。

原任务还复核了累计代码与文档改动、共享请求/确认框/导航的生命周期，以及覆盖矩阵：基线 39 个非测试 TS/TSX 文件的 AST 盘点中，20 个文件包含 149 个显式事件或生命周期条目，均能对应矩阵；上传钩子、第三方控件行为及相关纯函数另行阅读。这仅用于找遗漏，不代表穷尽所有运行状态。已逐张查看全部 24 张桌面/手机页面和 8 张表单底部截图；未发现本轮布局、入口和风格回退。核对最终完整 E2E 输出为 71 passed，复查 diff 与文档检查。

本机独立脚本、基线/最终 JSON 结果及 AST 清单另保存在当前任务可视化附件目录的 `zpanel-event-acceptance/`，未加入产品源码。隔离静态服务及原任务临时构建均在验收后清理，项目 dist、正式测试及实施任务证据保留。验收结论仅限上述范围；跨浏览器、真实手机和真实集成缺口沿用前节。原任务核实用户后续的明确授权后，按导航 Git 流程提交并推送本轮必要改动；实际同步结果以最新 Git 为准。验收后再次核对累计改动与覆盖矩阵，未发现本轮范围内未解决的确认问题。
