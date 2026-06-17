# 2026-05-24 全量代码评审

**评审日期**：2026-05-24（初稿）→ 2026-05-25（逐条复查修正）
**评审范围**：前后端全量代码、Dockerfile、CI/CD、构建脚本、配置文件
**基线**：1.0.3 稳定性优化阶段，基于 `13-code-quality-evaluation.md`（2026-05-20）和 `2026-05-23-review.md` 的后续补充
**评审方法**：三个独立 Agent 并行审计（Go 后端、Vue 前端、配置与部署），主审交叉验证后去重合并；每条发现均经二次复查，逐条读取源码确认

---

## 复查修正记录

初稿共 25 条发现 + 3 条待确认。复查后修正如下：

| 编号 | 原结论 | 修正后 | 原因 |
|------|--------|--------|------|
| C-2 | Critical（SSRF + 信息泄露） | **降级为 L-6**（Low） | `disk.Usage()` 底层调用 `unix.Statfs()`，等价于 `df <path>`，仅返回文件系统聚合统计，不能读文件内容、不能列目录。公开模式需管理员主动配置 `panel_public_user_id` 才生效。 |
| H-3 | High（限流 map 无上限） | **误判，删除** | `login_rate_limit.go:29-33` 有清理逻辑，每次请求删除超过 1 分钟的条目，生命周期受控。 |
| H-5 | High（highlightBlock XSS） | **降级为 M-11**（Medium） | `lang` 经 `hljs.getLanguage()` 校验后才进入 `highlightBlock`，已注册语言名均为安全标识符，实际可利用性很低，但模板拼接仍属 unsafe by design。 |
| L-3 | Low（bash 和 curl） | **修正描述** | `curl` 仅在构建阶段安装，最终镜像无 curl。只有 `bash` 是多余的。 |
| V-1 | 待确认 | **结论：不紧急** | Login 已走 bcrypt 比对，`Md5()` 仅用于非安全场景（favicon hash 等），无密码相关调用路径。 |
| V-2 | 待确认 | **结论：无需修改** | `GetDiskMountpoints` 已在 `LoginInterceptor` 组。 |
| V-3 | 待确认 | **结论：维持** | `AdminInterceptor` 存在且检查 Role，但新增 public 路由时需留意。 |

---

## 已确认问题

### Critical（3 条）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| C-1 | **SSRF：GetSiteFavicon 可探测内网** | `service/api/api_v1/panel/itemIcon.go:195-267`，`service/lib/siteFavicon/favico.go:64-108`，`service/lib/storage/storage.go:141-213` | 接口接受用户传入 URL 由服务端发起两处 HTTP 请求（`getFaviconURL` + `DownloadRemoteFile`），均无目标地址校验。无协议限制（可尝试 `file://`、`gopher://`）、无内网 IP 过滤、跟随默认重定向（最多 10 跳）、无速率限制。需登录但无角色限制。 |
| C-3 | **Docker 容器以 root 运行** | `Dockerfile:32-49` | 最终镜像无 `USER` 指令，`su-exec` 已安装（line 42）但 `CMD` 直接执行 `./zpanel`，未使用 su-exec 降权。Go 二进制漏洞将获得容器内 root。 |
| C-4 | **build.sh 下载工具链无 checksum 校验** | `build.sh:94-101` | 从 `https://musl.nn.ci/` 下载 musl 交叉编译器 tarball，HTTPS 传输但无 sha256/gpg 签名验证，直接 `tar xf` 到 `/usr/local`。服务端被入侵则所有 release 二进制被植入后门。 |

### High（4 条）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| H-1 | **无请求体大小限制** | `service/router/router.go:18` | `gin.Default()` 无 `MaxBytesReader` 或 body limit 中间件，`net/http` 也无默认上限。任意大 POST body 可耗尽内存。 |
| H-2 | **Password 字段 json tag 泄露风险** | `service/models/user_model.go:11` | `Password string ... json:"password"` — `GetList` 和 `Login` 已清理，但 `GetPublicVisitUser`（admin-only）返回完整 User 未清空 Password，bcrypt 哈希直接出现在响应中。更根本的问题是 struct tag 允许序列化，新代码路径易遗漏。 |
| H-4 | **URL 导航无协议校验** | `src/views/home/index.vue:54-72`，`src/components/deskModule/SearchBox/index.vue:143-153` | `window.location.href = url` 直接赋值，`openPage` 三种模式（当前窗口/新窗口/iframe）均无协议白名单。`javascript:alert(document.cookie)` 可执行。搜索引擎 URL 和导航项 URL 均来自用户可编辑的存储数据。 |
| H-6 | **footerHtml 显示为纯文本（功能性 Bug）** | `src/views/home/index.vue:505` | 使用 `v-text` 渲染 `footerHtml`，默认值是含 `<div>` + `<a>` 的 HTML（`panel/helper.ts:6`）。用户看到原始 HTML 标签而非渲染后的页脚。1.0.3 安全修复引入的回退。 |

### Medium（11 条）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| M-1 | **log.go 文件权限过宽** | `service/lib/cmn/log.go:106,120` | line 106 `os.OpenFile(..., 0666)`，line 120 `os.MkdirAll(..., 0777)`。`NewLog` 的 MkdirAll 已修到 0700（line 96），但 RunLog 和 OpenFile 未覆盖。 |
| M-2 | **UpdatePasssword 三重 s** | `service/api/api_v1/system/user.go:93` | 函数名 `UpdatePasssword` 拼写错误，传播到路由注册。 |
| M-3 | **PasswordEncryption panic** | `service/lib/cmn/base.go:216-222` | bcrypt 失败时 `panic()`，虽有 Gin Recovery 兜底，但生产代码不应使用 panic。 |
| M-4 | **afterRequest 回调仅失败时调用** | `src/utils/request/index.ts:39-91` | `successHandler` 从不调用 `afterRequest?.()`，仅 `failHandler:85` 调用。清理逻辑在成功路径被跳过。 |
| M-5 | **网络错误提示 50 秒** | `src/utils/request/index.ts:86-89` | `duration: 50000`，标准 toast 为 3-10 秒。 |
| M-6 | **saveSwitchAccount 无 try-catch** | `src/views/login/index.vue:81-87` | `JSON.parse(localStorage.getItem(...))` 无异常捕获，畸形数据阻断登录。 |
| M-7 | **Dockerfile Alpine 未 pin** | `Dockerfile:32` | `FROM alpine` 无版本标签，构建阶段已 pin（`node:24.15.0-alpine`、`golang:1.26.3-alpine`），但最终阶段遗漏。 |
| M-8 | **docker-compose 用 :latest** | `docker-compose.yml:3` | `vivalucas/zpanel:latest` 不可复现。 |
| M-9 | **CI 无 concurrency group** | `.github/workflows/ci.yml`，`container-ghcr.yml`，`release.yml` | 同分支多次 CI 并行浪费 runner。 |
| M-10 | **package.json private: false** | `package.json:4` | 应用项目误标为 npm 可发布。 |
| M-11 | **highlightBlock lang 模板拼接** | `src/views/home/components/Result/index.vue:53-55` | `${lang}` 直接拼入 HTML class 属性和 span 内容。当前受 `hljs.getLanguage()` 保护，实际可利用性低，但属于 unsafe by design — 若 highlight.js 未来注册含特殊字符的语言名则可 XSS。 |

### Low（6 条）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| L-1 | **vite proxy rewrite 空操作** | `vite.config.ts:47,51` | `path.replace('/api/', '/api/')` 替换自身。 |
| L-2 | **.gitignore 缺 .env.\*** | `.gitignore:31-34` | `.env.production` 等非 `.local` 后缀文件不被忽略。 |
| L-3 | **Dockerfile 多余 bash** | `Dockerfile:42` | 最终镜像安装 `bash` 但未使用（HEALTHCHECK 用 wget，CMD 用 exec 形式）。`curl` 仅在构建阶段，最终镜像无。 |
| L-4 | **npm-run-all 弃用** | `package.json:58` | v4.1.5，应替换为 `npm-run-all2`。 |
| L-5 | **docker-compose 端口绑定 0.0.0.0** | `docker-compose.yml:9` | `6521:6521` 暴露到所有网络接口。 |
| L-6 | **GetDiskStateByPath 公开接口无路径校验** | `service/api/api_v1/system/monitor.go:62-87`，路由 `rPublic.POST` | 接受任意路径传入 `disk.Usage(path)`，但底层 `unix.Statfs()` 仅返回文件系统级聚合统计（等价于 `df`），不能读文件内容或列目录。信息泄露极有限，主要风险是探测挂载点存在性。需管理员配置 `panel_public_user_id` 才对外可访问。 |

---

## 优化建议

### 安全类

| # | 建议 | 消除 |
|---|------|------|
| S-1 | **GetSiteFavicon SSRF 防护**：校验协议仅允许 http/https，禁止内网 IP 段（127/8、10/8、172.16/12、192.168/16、169.254/16），限制重定向目标，增加速率限制。 | C-1 |
| S-2 | **Dockerfile 非 root 用户**：`RUN adduser -D -u 1000 zpanel && chown -R zpanel:zpanel /app`，`USER zpanel`。 | C-3 |
| S-3 | **build.sh checksum 校验**：pin 每个架构的 SHA-256，下载后 `sha256sum -c` 验证。 | C-4 |
| S-4 | **Gin 请求体大小限制**：`router.MaxBytesReader()` 或自定义中间件限制 JSON body（如 10MB）。 | H-1 |
| S-5 | **User.Password json tag 改 `json:"-"`**：防止任何代码路径意外序列化密码哈希。 | H-2 |
| S-6 | **前端 URL 协议白名单**：`openPage` 和 `handleSearchClick` 前校验 `url.startsWith('http://') \|\| url.startsWith('https://')`。 | H-4 |
| S-7 | **footerHtml 消毒 + 恢复渲染**：引入 DOMPurify，改为 `v-html="DOMPurify.sanitize(panelState.panelConfig.footerHtml)"`。 | H-6 |
| S-8 | **highlightBlock lang 转义**：对 lang 做 HTML entity 转义后再拼接，防御性编程。 | M-11 |

### 体验 / 效率类

| # | 建议 | 消除 |
|---|------|------|
| O-1 | **首次登录强制修改密码**：检测默认密码登录后跳转修改密码页。 | — |
| O-2 | **网络错误提示缩短到 5-8 秒** | M-5 |
| O-3 | **saveSwitchAccount 增加 try-catch** | M-6 |
| O-4 | **i18n 动态 import**：11 个 locale 按需加载。 | — |
| O-5 | **home/index.vue 拆分 composable** | — |

---

## 与前轮评审的差异

| 前轮已修复 | 本轮仍存在 | 说明 |
|------------|-----------|------|
| XSS via `v-html` on footerHtml / loginFooter | H-6 footerHtml 显示为纯文本 | 1.0.3 改 `v-text` 修了 XSS 但破坏功能，需引入消毒库后恢复 |
| InStringArray return true | 已修复 | 生效 |
| 文件权限 0777/0666 (cmn/base.go, file.go) | M-1 log.go 仍有 | 部分修复，log.go 未覆盖 |
| MD5 三重哈希 | 已迁移 bcrypt | 登录兼容 bcrypt + 旧 MD5 |
| 1.0.3 类型收敛 | 仍有 any 残留 | 数量已减少 |

---

## 建议修复优先级

**第一批（安全，建议立即处理）**：
- C-1 SSRF 防护（GetSiteFavicon）
- H-1 请求体大小限制
- H-2 Password json tag 改 `json:"-"` + 清理 GetPublicVisitUser
- H-4 URL 协议白名单
- H-6 footerHtml DOMPurify 消毒 + 恢复渲染

**第二批（部署安全，建议尽快处理）**：
- C-3 Dockerfile 非 root 用户
- C-4 build.sh checksum 校验
- M-7 Alpine 版本 pin
- M-8 docker-compose 版本 pin
- M-9 CI concurrency group

**第三批（代码质量与体验）**：
- M-1 log.go 权限修复
- M-4 afterRequest 回调
- M-5 网络错误提示时长
- M-6 saveSwitchAccount try-catch
- M-11 highlightBlock lang 转义（防御性修复）
- O-1 首次登录强制改密
- L-1 ~ L-6 低优先级清理
