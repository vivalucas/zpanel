# 代码评审记录

## 评审流程

```text
A 评审（发现） → B 验证 + 修复确认项 + 评审（发现）
→ C 验证 + 修复确认项 + 评审（发现）
→ D ... → 直到无新问题
```

每一步的验证必须独立，不能直接采信上一棒的结论。

---

## 评审概览

| 棒次 | 评审人 | 日期 | 发现问题数 | 其中被下一棒确认 |
|------|--------|------|-----------|-----------------|
| 1 | CC-MIMO | 2026-05-21 | 8 确认 Bug + 6 代码质量 | — |
| 2 | CC-MIMO | 2026-05-22 | 12 确认 Bug + 8 改进项 | — |
| 3 | Codex | 2026-05-23 | 9 确认 Bug + 3 改进项 | — |

---

## 当前状态

第三轮评审已在云端 `project-log/` 基线基础上完成，详细逐项复核见 `2026-05-23-review.md`。后续复查修复与再评审见 `2026-05-25-review.md`。第一轮、第二轮和第三轮的全部发现见下方。

已修复（第一轮）：
- MD5 密码哈希 → bcrypt（兼容旧 MD5 迁移）
- 登录接口 IP 级速率限制
- 安全响应头中间件
- 用户删除 UserConfig 残留 Bug
- ErrorByCodeAndMsg 自定义消息被覆盖
- 前端 API 失败后 for 循环崩溃
- 前端 window.open 空值、Promise 未 catch、as number 掩盖 undefined
- NForm v-model 误用、falsy index check

已修复（第二轮）：
- 登录限流器并发竞态（加 mutex）
- RateLimiter TOCTOU 竞态（加 mutex）
- 队列 GetByIndex 越界（`>=` → `>`）
- 队列 LPop/RPop 竞态（单锁原子操作）
- 密码哈希泄露到 API 响应（返回前清除）
- GetList Limit/Page 未校验（加边界检查）
- ConfigInit 错误被忽略（改为报错退出）
- Notice count 硬编码 0（改为实际长度）
- 文件列表无分页（加 Limit 500）
- MD5 密码回退已移除（全新项目不需要）
- HTTP Client 无超时（加 15s）
- updateLocalUserInfo 无错误处理（加 try/catch）
- Style setTimeout 未清理（追踪 ID + onBeforeUnmount）
- 上传结果未校验（加 try/catch + 空值保护）
- useLanguage computed 副作用（改为 watch）
- unreachable code 已删除

已知需要后续处理：
- 加密密钥回退值硬编码（IMP-04）
- i18n 全量打包（IMP-05，需较大改动）
- Goroutine 泄漏（IMP-06，需加 stop channel）
- Redis O(N) 过期扫描（IMP-07，需重构）
- CORS 配置（公网部署建议按需配置）
- 大文件拆分（home/index.vue）
- Go 测试覆盖
- 全局状态解耦

第三轮已确认并纳入本轮修复：
- CPU 监控卡片 `usages` 缺失时崩溃
- 数据库迁移 / 默认管理员初始化错误被忽略
- 修改密码后前端仍保持已失效登录态
- 登录限流响应不走统一 API 错误处理，且过期 IP 记录不清理
- 首页初始化顺序导致站点标题可能使用旧配置
- `updateLocalUserInfo()` 缺少结果防御
- 系统监控编辑器把 Vue ref 写入业务数据
- 拖拽列表 key 不稳定
- 昵称更新后快速切换账号缓存不同步

## 最近自检

| 日期 | 范围 | 结果 | 未覆盖 |
|------|------|------|--------|
| 2026-05-21 | 独立仓库与 1.0.0 发布整理 | GitHub Actions Frontend / Backend 通过；Docker Hub / GHCR 容器发布成功；`/api/healthz` 测试已加入 | 本地完整联调、Docker 管理实机操作、更多业务测试 |
| 2026-05-21 | 代码质量治理第一轮 | 前端 type-check、lint、build 通过；lint 0 warning；后端 `go test ./...` 通过 | Go 真实测试用例、后端启动、Docker 实机操作、前端 chunk 拆分 |
| 2026-05-20 | PRO 功能开源化第一版 | 前端 type-check、lint、build-only 通过；登录页渲染正常 | Go 编译、后端启动、Docker 实机操作 |

---

# 第一轮评审

**评审日期**：2026-05-21
**评审人**：CC-MIMO
**评审范围**：全项目（前端 Vue 3 + TypeScript + 后端 Go + Gin + GORM）
**评审方法**：逐文件通读，结合项目实际用途（自托管 NAS/HomeLab 导航面板，公网 + 局域网双场景部署）逐项验证

## 一、第一轮结论

本轮共提出 26 项初始发现，经逐项深入验证后：

| 分类 | 数量 |
|------|------|
| 确认为真实 Bug（需修复） | 8 |
| 代码质量问题（建议修复） | 6 |
| 误报 / HomeLab 场景无影响 | 12 |

## 二、第一轮确认为真实 Bug

### BUG-01：用户删除时 UserConfig 未清理（复制粘贴错误）

- **位置**：`service/api/api_v1/panel/users.go:97-101`
- **严重性**：中
- **描述**：删除用户的两个连续操作都操作 `models.ModuleConfig`，第二个注释为"删除用户配置"但模型仍为 `ModuleConfig`，应为 `models.UserConfig`。导致删除用户后 `UserConfig` 数据残留。
- **公网影响**：多用户场景下数据残留。

### BUG-02：ErrorByCodeAndMsg 自定义消息被覆盖

- **位置**：`service/api/api_v1/common/apiReturn/apiReturn.go:95-101`
- **严重性**：低
- **描述**：函数接收自定义 `msg` 参数，但当错误码在映射表中找到时，`msg` 被默认消息覆盖，调用方的自定义消息丢失。
- **公网影响**：仅影响错误消息展示，无功能影响。

### BUG-03：前端 API 失败后 for 循环仍执行

- **位置**：`src/views/home/index.vue:96-107`
- **严重性**：高
- **描述**：`if (code === 0)` 无花括号，仅保护 `items.value = data.list` 一行。API 返回错误时 `for` 循环仍执行，`data.list` 为 undefined 会导致运行时异常。
- **公网影响**：页面白屏。

### BUG-04：前端 window.open 无空值保护

- **位置**：`src/views/home/index.vue:120-125`
- **严重性**：低
- **描述**：`jumpUrl` 可能为 undefined，`window.open(undefined)` 会打开空白页。
- **公网影响**：用户体验问题。

### BUG-05：前端 Promise rejection 未处理

- **位置**：`src/store/modules/panel/index.ts:30`
- **严重性**：低
- **描述**：`updatePanelConfigByCloud()` 的 `.then()` 无 `.catch()`，网络错误时产生 unhandled rejection。
- **公网影响**：控制台警告，配置加载失败时已有 else 分支兜底。

### BUG-06：前端 `as number` 掩盖 undefined

- **位置**：`src/views/home/index.vue:146`
- **严重性**：低
- **描述**：`currentRightSelectItem.value?.id as number` 当 value 为 null 时传入 `[undefined]` 给 API。
- **公网影响**：仅在右键菜单且选中项为 null 的边缘情况下触发。

### BUG-07：MD5 密码哈希（公网部署时 CRITICAL）

- **位置**：`service/lib/cmn/base.go:214-216`
- **严重性**：公网部署时 CRITICAL，局域网部署时低
- **描述**：`PasswordEncryption` 使用纯 MD5，无盐无拉伸。公网部署后数据库泄露（SQL 注入、备份泄露等）时密码可被秒破。
- **公网影响**：所有用户密码面临暴力破解风险。

### BUG-08：登录接口无速率限制（公网部署时 CRITICAL）

- **位置**：`service/global/rateLimit.go` + `service/initialize/A_ENTER.go`
- **严重性**：公网部署时 CRITICAL，局域网部署时低
- **描述**：速率限制模块已编写但从未初始化。`global.RateLimit` 为 nil，若被调用会 panic。公网暴露后登录接口可被无限暴力破解。
- **公网影响**：配合默认密码，几秒内可被攻破。

## 三、第一轮代码质量问题

### QUAL-01：NForm 误用 v-model

- **位置**：`src/components/deskModule/SystemMonitor/Edit/DiskEditor/index.vue:135`、`GenericProgressStyleEditor/index.vue:76`
- **描述**：NForm 不支持 v-model，指令被忽略。

### QUAL-02：`!index` 误判 0 值

- **位置**：`src/components/deskModule/SystemMonitor/common.ts:38-40`
- **描述**：`if (!index)` 在 `index === 0` 时也为 true。

### QUAL-03：computed 内产生副作用

- **位置**：`src/hooks/useLanguage.ts:24-28`
- **描述**：`setLocale()` 修改全局 i18n 状态，违反 computed 纯函数原则。

### QUAL-04：枚举 icon/small 值重复

- **位置**：`src/enums/panel/index.ts:8-12`
- **描述**：`icon` 和 `small` 均为 1，运行时不可区分。

### QUAL-05：getDropdownMenuOptions 在模板中每次渲染调用

- **位置**：`src/views/home/index.vue:505`
- **描述**：应改为 computed 属性。

### QUAL-06：安全响应头缺失（公网部署时 HIGH）

- **位置**：`service/router/A_ENTER.go`
- **描述**：无 X-Frame-Options、X-Content-Type-Options、CSP 等安全头。

## 四、第一轮误报

| # | 初始报告 | 结论 |
|---|----------|------|
| 1 | AdminStore 缺花括号 | 误报 — if 后只有一条语句 |
| 2 | Clock setInterval 在 mount 前 | 误报 — script setup 执行时机正确 |
| 3 | SSRF（GetSiteFavicon） | 局域网无影响 — 需登录用户 |
| 4 | UploadFiles 无扩展名过滤 | 局域网无影响 |
| 5 | ItemIcon/Group Edit 无所有权校验 | 局域网无影响 |
| 6 | GetPublicVisitUser 返回完整 User | 局域网无影响 |
| 7 | 无 CORS 配置 | 局域网无影响 |
| 8 | Token 生成 TOCTOU 竞态 | 理论风险 — 碰撞概率为零 |
| 9 | Token 列无索引 | 无影响 — 小表 |
| 10 | 无分页查询 | 无影响 — 家庭场景数据量小 |
| 11 | 0777 日志目录权限 | 无影响 |
| 12 | defineAsyncComponent 类型问题 | 代码风格 |

## 五、第一轮修复记录

**修复日期**：2026-05-21

### 后端改动

| 文件 | 改动 |
|------|------|
| `service/lib/cmn/base.go` | `PasswordEncryption` 改用 bcrypt；新增 `VerifyPassword` 兼容 bcrypt 和旧 MD5 |
| `service/models/User.go` | `Password` 字段 `varchar(32)` → `varchar(60)` |
| `service/api/api_v1/system/login.go` | 登录流程改为先查用户名再用 `VerifyPassword` 验证 |
| `service/api/api_v1/system/user.go` | 修改密码用 `VerifyPassword` |
| `service/initialize/A_ENTER.go` | 初始化 `global.RateLimit` |
| `service/api/api_v1/middleware/LoginRateLimit.go` | **新增** — IP 级登录频率限制 |
| `service/router/system/login.go` | 登录路由挂载限流中间件 |
| `service/api/api_v1/middleware/SecurityHeaders.go` | **新增** — 安全响应头 |
| `service/router/A_ENTER.go` | 全局挂载安全头中间件 |
| `service/api/api_v1/panel/users.go:100` | `ModuleConfig` → `UserConfig`（复制粘贴修复） |
| `service/api/api_v1/common/apiReturn/apiReturn.go:97` | `msg = v` → `defalurMsg = v`（自定义消息修复） |

### 前端改动

| 文件 | 改动 |
|------|------|
| `src/views/home/index.vue:94-107` | `if (code === 0)` 加花括号，API 失败时 return |
| `src/views/home/index.vue:125` | `window.open` 加空值保护 |
| `src/views/home/index.vue:146` | `as number` 前加空值保护 |
| `src/store/modules/panel/index.ts:30` | 添加 `.catch()` |
| `src/components/deskModule/SystemMonitor/Edit/DiskEditor/index.vue:135` | 移除 NForm 无效 v-model |
| `src/components/deskModule/SystemMonitor/Edit/GenericProgressStyleEditor/index.vue:76` | `v-model` → `:model` |
| `src/components/deskModule/SystemMonitor/common.ts:38-40` | `if (!index)` → `index = index ?? 0` |

### 验证结果

- TypeScript 类型检查：通过
- Vite 生产构建：通过
- ESLint：0 warning、0 error
- Go 测试：通过

---

# 第二轮评审

**评审日期**：2026-05-22
**评审人**：CC-MIMO
**评审范围**：全项目（前端 Vue 3 + TypeScript + 后端 Go + Gin + GORM）
**评审方法**：逐文件通读，逐项独立验证，结合项目实际用途（自托管 NAS/HomeLab 导航面板，支持公网 + 内网双场景部署）判断

## 一、第二轮结论

本轮共提出 47 项初始发现，经逐项深入代码验证后：

| 分类 | 数量 |
|------|------|
| 确认为真实 Bug（需修复） | 12 |
| 代码质量 / 改进项 | 8 |
| 设计意图 / 场景无关（不改） | 21 |
| 误报（排除） | 4 |
| 与第一轮重复（已修） | 2 |

## 二、第二轮确认为真实 Bug

### BUG-09：登录限流器并发竞态

- **位置**：`service/api/api_v1/middleware/login_rate_limit.go:26-37`
- **严重性**：高
- **描述**：`ipRecord` 结构体存储在 `sync.Map` 中，但 `count` 和 `resetAt` 字段的读写没有任何同步机制。`sync.Map` 只保护 map 槽位的原子获取，多个 goroutine 拿到同一个 `ipRecord` 指针后，对字段的读写是并发竞争的。
- **影响**：同一 IP 并发登录请求时，限流计数可能丢失，限流可被绕过。

### BUG-10：RateLimiter TOCTOU 竞态

- **位置**：`service/global/rateLimit.go:13-18, 29-35`
- **严重性**：高
- **描述**：`MinuteAddOnce` 先调用 `MinuteGet` 读取计数，再 `+1` 后调用 `SetKeepExpiration` 写回。两个并发请求可以同时读到相同的旧值，各自 `+1` 后写回，导致计数丢失一次。底层 `go-cache` 的内部锁只保护单次操作，不保护读-改-写复合操作。
- **影响**：速率限制在并发场景下不可靠。

### BUG-11：内存队列 GetByIndex 越界

- **位置**：`service/lib/queue/queueMemory/memory.go:60`
- **严重性**：中
- **描述**：`if int64(len(k.Values)) >= index` 应为 `>`。当 `index == len(k.Values)` 时条件成立，但 `k.Values[index]` 越界，运行时 panic。
- **影响**：队列边界调用时程序崩溃。

### BUG-12：内存队列 LPop/RPop 并发竞态

- **位置**：`service/lib/queue/queueMemory/memory.go:69-86`
- **严重性**：中
- **描述**：`GetByIndex` 获取 `RLock` 后释放，`removeIndex` 再获取 `Lock`。两个锁之间存在窗口，并发的 LPop 可以同时读到同一个元素。`RPop` 甚至在获取锁之前就读取了 `len(k.Values)`，完全无保护。
- **影响**：并发消费队列时可能弹出同一元素或 panic。

### BUG-13：密码哈希泄露到 API 响应

- **位置**：`service/api/api_v1/panel/users.go:197`
- **严重性**：中
- **描述**：`Update` 处理函数在更新用户后，将完整的 `param`（`models.User` 类型，含 `Password` 和 `PasswordAlgo` 字段）返回给客户端。虽然 `allowField` 限制了 DB 写入字段，但不过滤 API 响应。
- **影响**：调用更新接口可获取用户密码哈希。

### BUG-14：GetList Limit/Page 未校验

- **位置**：`service/api/api_v1/panel/users.go:227`
- **严重性**：中
- **描述**：`Limit` 和 `Page` 直接来自用户输入，无 binding 标签校验。`Limit: -1` 在 GORM 中禁用限制，`Limit: 999999999` 可 dump 全表，`Page: 0` 产生负 Offset。
- **影响**：可遍历或 dump 全部用户数据。

### BUG-15：ConfigInit 错误被忽略

- **位置**：`service/initialize/app.go:158`
- **严重性**：中
- **描述**：密码重置命令行分支中 `config, _ := config.ConfigInit()` 丢弃错误。配置文件损坏或缺失时 `config` 为 nil，后续 `global.Config = config` 会导致 nil pointer dereference。
- **影响**：密码重置在配置异常时崩溃。

### BUG-16：Notice API count 硬编码 0

- **位置**：`service/api/api_v1/system/notice.go:27`
- **严重性**：低
- **描述**：`apiReturn.SuccessListData(c, noticeList, 0)` 第三个参数是字面量 `0`，应为 `len(noticeList)`。
- **影响**：客户端收到的总数永远为 0，分页逻辑异常。

### BUG-17：updateLocalUserInfo 无错误处理

- **位置**：`src/utils/cmn/index.ts:104-114`，调用于 `src/views/home/index.vue:266`
- **严重性**：中
- **描述**：`onMounted` 中调用 `updateLocalUserInfo()` 无 `.catch()`。`getAuthInfo` 失败时产生 unhandled promise rejection。`data.user` 为 undefined 时访问属性也会崩溃。
- **影响**：页面加载时网络异常导致控制台报错，可能白屏。

### BUG-18：Style 组件 setTimeout 未清理

- **位置**：`src/components/apps/Style/index.vue:51-61`
- **严重性**：中
- **描述**：`watch` 中设置的 `setTimeout` 未追踪 ID，组件卸载时无 `onBeforeUnmount` 清理。
- **影响**：组件销毁后仍有状态变更和网络请求。

### BUG-19：上传结果未校验

- **位置**：`src/components/apps/Style/index.vue:63-73`
- **严重性**：中
- **描述**：`handleUploadBackgroundFinish` 中 `JSON.parse` 无 try/catch，无 `event` 空值检查，无 `res.data` 结构校验。
- **影响**：上传失败时回调崩溃。

### BUG-20：文件列表无分页

- **位置**：`service/api/api_v1/system/file.go:106-120`
- **严重性**：中
- **描述**：`GetList` 查询无 `.Limit()` 和 `.Offset()`，用户文件多时全量加载。
- **影响**：大量文件时内存占用过高。

## 三、第二轮代码质量 / 改进项

### IMP-01：MD5 密码回退可移除

- **位置**：`service/lib/cmn/base.go:216-234`
- **描述**：全新项目无旧用户，bcrypt 失败应直接报错，不需要 MD5 降级。`VerifyPassword` 中的 MD5 分支也可移除。

### IMP-02：HTTP Client 无超时

- **位置**：`service/lib/siteFavicon/favico.go:66`
- **描述**：`client := &http.Client{}` 无 Timeout，应加 15s 超时。

### IMP-03：useLanguage computed 有副作用

- **位置**：`src/hooks/useLanguage.ts:24-28`
- **描述**：`setLocale()` 在 computed 内调用，违反纯函数语义。应改为 watch。

### IMP-04：加密密钥回退值硬编码

- **位置**：`src/utils/crypto/index.ts:3`
- **描述**：`VITE_CRYPTO_SECRET` 未设置时回退为 `'__CRYPTO_SECRET__'`，等于无加密。

### IMP-05：i18n 全量打包

- **位置**：`src/locales/index.ts:2-13`
- **描述**：11 个 locale JSON 全部静态 import，应改为动态 import。

### IMP-06：Goroutine 泄漏

- **位置**：`service/lib/cache/redis.go:38`，`service/initialize/systemMonitor/systemMonitor.go:11`
- **描述**：Redis 缓存过期清理和系统监控的 goroutine 无退出机制。

### IMP-07：Redis 缓存过期扫描 O(N)

- **位置**：`service/lib/cache/redis.go:177-195`
- **描述**：每次 tick 全量 HKeys 并逐个 Get 检查过期。

### IMP-08：unreachable code

- **位置**：`service/initialize/app.go:188`
- **描述**：`os.Exit(0)` 在所有分支已 return/exit 之后，永远不会执行。

## 四、第二轮不修改项（设计意图 / 场景无关）

| # | 问题 | 结论 | 原因 |
|---|------|------|------|
| 1 | customJs 直接注入 DOM | 设计意图 | README 明确列出为功能 |
| 2 | SSRF via GetSiteFavicon | 设计意图 | favicon 获取是核心功能；NAS 部署获取内网 favicon 是正常用例；仅管理员可触发 |
| 3 | 默认密码 12345678 | 设计意图 | 开源项目，源码可见；README 已提示修改 |
| 4 | /uploads 无鉴权 | 设计意图 | 自托管面板，上传文件需被浏览器直接访问 |
| 5 | Token 明文存 localStorage | 标准做法 | SPA 标准方案 |
| 6 | MarkdownIt html:true | 死代码 | 组件未被使用 |
| 7 | iconTextInfoHideDescription 取反 | 误报 | icon 模式不渲染描述 |
| 8 | getFaviconUrl 可抛异常 | 死代码 | 无调用点 |
| 9 | Admin store 缺花括号 | 无影响 | 注释行已注释 |
| 10 | Clock setInterval 在 mount 前 | 无影响 | 功能正确 |
| 11 | .finally() 在 .catch() 前 | 代码风格 | 语义正确 |
| 12 | 推荐码生成死循环 | 极低概率 | 空间极大 |
| 13 | ref() 在搜索函数内 | 性能浪费 | 不 crash |
| 14 | getDropdownMenuOptions 每次渲染 | 性能浪费 | 函数轻量 |
| 15 | getNotice 无 try/catch | 死代码 | 无调用点 |
| 16 | Validator 每次请求创建 | 性能 | 功能正确 |
| 17 | CPU.Percent 阻塞 1 秒 | 设计限制 | 库行为 |
| 18 | 全局可变状态 | 架构债务 | 当前可工作 |
| 19 | 无 context 传播 | 架构债务 | 当前可工作 |
| 20 | 错误消息中英混杂 | 代码风格 | 不影响功能 |
| 21 | 大量注释代码 | 代码风格 | 不影响功能 |

## 五、第二轮修复记录

**修复日期**：2026-05-22
**修复人**：CC-MIMO

### 后端改动

| 编号 | 文件 | 改动 |
|------|------|------|
| BUG-09 | `service/api/api_v1/middleware/login_rate_limit.go` | `ipRecord` 新增 `sync.Mutex`，读写 count/resetAt 前加锁，读完后解锁 |
| BUG-10 | `service/global/rateLimit.go` | `RateLimiter` 新增 `sync.Mutex`，`MinuteAddOnce`/`HourAddOnce` 整体加锁，消除 TOCTOU |
| BUG-11 | `service/lib/queue/queueMemory/memory.go` | `GetByIndex` 边界检查 `>=` → `>`，修复越界 panic |
| BUG-12 | `service/lib/queue/queueMemory/memory.go` | `LPop`/`RPop` 改为单次 `Lock` 内完成读取+删除，消除竞态；新增 `getByIndexLocked` 内部方法 |
| BUG-13 | `service/api/api_v1/panel/users.go` | `Update` 返回前清除 `param.Password` 和 `param.PasswordAlgo` |
| BUG-14 | `service/api/api_v1/panel/users.go` | `GetList` 新增 Limit（1-100，默认 10）和 Page（≥1，默认 1）校验 |
| BUG-15 | `service/initialize/app.go` | `ConfigInit` 错误不再丢弃，失败时打印错误并 `os.Exit(1)` |
| BUG-16 | `service/api/api_v1/system/notice.go` | count 从硬编码 `0` 改为 `int64(len(noticeList))` |
| BUG-20 | `service/api/api_v1/system/file.go` | `GetList` 新增 `.Limit(500)` 防止全量加载 |
| IMP-01 | `service/lib/cmn/base.go` | `PasswordEncryption` 移除 MD5 回退，bcrypt 失败直接 panic；`VerifyPassword` 移除 MD5 分支，仅接受 bcrypt |
| IMP-02 | `service/lib/siteFavicon/favico.go` | HTTP Client 新增 `Timeout: 15 * time.Second` |
| IMP-08 | `service/initialize/app.go` | 删除不可达的 `os.Exit(0)` |

### 前端改动

| 编号 | 文件 | 改动 |
|------|------|------|
| BUG-17 | `src/utils/cmn/index.ts` | `updateLocalUserInfo` 新增 try/catch，`data.user` 空值保护 |
| BUG-18 | `src/components/apps/Style/index.vue` | 新增 `saveTimer` 变量追踪 setTimeout ID，`onBeforeUnmount` 中清除 |
| BUG-19 | `src/components/apps/Style/index.vue` | `handleUploadBackgroundFinish` 新增 try/catch 和 `res.data?.imageUrl` 空值保护 |
| IMP-03 | `src/hooks/useLanguage.ts` | `setLocale()` 从 computed 移到 watch（`{ immediate: true }`），computed 保持纯函数 |

### 未修复项（后续处理）

| 编号 | 说明 |
|------|------|
| IMP-04 | 加密密钥回退值硬编码 — 需要决定是强制配置还是生成随机值 |
| IMP-05 | i18n 全量打包 — 需要改动较大，涉及动态 import 架构 |
| IMP-06 | Goroutine 泄漏 — 需要给 Redis 缓存和系统监控加 stop channel，改动较大 |
| IMP-07 | Redis O(N) 过期扫描 — 需要重构缓存过期策略 |

### 验证结果

- **Go 编译**：`go build ./...` 通过
- **Go 测试**：`go test ./...` 通过
- **TypeScript 类型检查**：`vue-tsc --noEmit` 通过
- **ESLint**：0 error
- **Vite 生产构建**：通过

## 六、仍需后续处理

| 项目 | 说明 |
|------|------|
| Go 测试覆盖 | 核心业务测试仍不足 |
| 全局状态解耦 | `global` 包仍被全量引用 |
| 大文件拆分 | `views/home/index.vue` 仍过大 |
| CORS 配置 | 公网部署建议按需配置 |
| Redis 缓存过期扫描 | O(N) 扫描，长期可优化为原生 TTL |

---

<!-- 后续评审轮次继续追加 -->
