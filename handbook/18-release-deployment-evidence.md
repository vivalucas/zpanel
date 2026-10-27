# 1.2.11 发行与 M5 部署证据

用途：保留 1.2.11 发行包、镜像与 M5 核验的精确来源，以及已删除恢复资料的边界。仅在核对该发行、生产差异或恢复能力时读取；操作方法见 [08](08-deployment.md)，当前版本见 [01](01-current-status.md)。以下为既有记录，本次整理未访问生产或重做发行验证；后续仅修正/补充本对象证据，不堆叠每轮发行流水账。

## 发行来源与验证

发行提交 `cabab479b3928d19f72406fe72582b66e651969c`，注释标签 `v1.2.11` 固定于此；[正式 Release](https://github.com/vivalucas/zpanel/releases/tag/v1.2.11)、[Release 流水线](https://github.com/vivalucas/zpanel/actions/runs/40434732848)、[容器流水线](https://github.com/vivalucas/zpanel/actions/runs/40434732819)成功。

固定 Node 24.15.0 / pnpm 11.1.3 / Go 1.26.3，工具链/锁文件未升级。[发行提交 main CI](https://github.com/vivalucas/zpanel/actions/runs/40431175255)通过：254 项 Chromium、50 项 Vitest、类型、零警告 ESLint、test:review/语言键、普通构建、Go 全测/发行构建及 16 项容器入口检查。本机普通/PWA 构建与版本推进后的关键页面 36 项通过；随后用**正式包前端**在隔离 Go/SQLite 服务重跑同组 36 项，无失败/跳过/重试。Linux ELF 仅静态核验，未在 macOS 执行；M5 使用正式 Linux 容器。

资产 SHA256 与清单一致，tar/zip 的 91 个文件相同，12 份随包文档/配置与发行提交一致（含 UI 指南）。正式容器与包内前端 **77/77 逐字节相同**。本机 macOS 与正式 Ubuntu 构建有 3 个 JS 的 modulepreload 表/请求顺序不同，74 文件相同；逐调用 JS 依赖集合（含重复次数）、CSS 顺序及其余 JS 字节一致。比较器 5 项反例通过；原始字节/顺序比较失败结果保留，不能称本机构建逐字节复现成功。

Docker Hub/GHCR 的版本与发布时 latest 四索引相同，含 amd64/arm64，逐层核对压缩 digest/大小、解压 diffID 和配置。本机脱敏诊断/截图在忽略目录 `.codex/release-qa-1.2.11-j001amhq/`，精确入口如下；不是跨设备恢复来源，永久来源为以上发行/CI。

- 资产/随包文件通过：`release-asset-qa/asset-components-verification.json`；限定接受预加载差异：`release-asset-qa/build-variance-verification.json`。
- 原始失败：`release-asset-qa/verification.json`、`release-asset-qa/semantic-verification.json`，不能单独用作通过证据。
- 容器：`container-qa/verification.json`；M5：`reports/m5-final-verification.json`。

## M5 核验快照

北京时间 **2026-10-27 10:16:35** 启动，镜像 `ghcr.io/vivalucas/zpanel:1.2.11@sha256:678b3286c1830d8cfa41daa976739a5e3f8eace5d23b234a525abe69cd5cf624`，amd64 ImageID `sha256:b69a2216a6be1980cb4ac052751b54ac755eb8a90431b9e27e1d2526ae153666`。直拉失败后导入核验过的离线包，随后官方拉取成功并确认 RepoDigest，未改 Docker 全局配置。

隔离副本预检后只重建 ZPanel，compose 仅改镜像；`.env`、端口、挂载、附加组及受保护运行参数保持。启动前后 11 表逻辑内容/schema/类型/行标识、配置、上传和权限严格一致，SQLite integrity_check=ok。容器 healthy、重启 0，PID 1 UID 1000/组含 984，服务账号可读 Docker；sun-panel/frpc 的 ID、镜像、启动时间/重启次数保持。74 个实际公开路由静态文件经 HTTP 与正式镜像逐字节一致，另 3 个包内文件本未注册公开路由。

macOS Chrome 实查首页、回顶、外观、关于及 Docker 列表：前后端 1.2.11、滑块 0–10、自动保存说明/右下入口正常，未改设置。查看后严格快照仍记为**有差异**：仅 `session.last_seen_at/updated_at` 变化，5 行总数及 ID 保持，符合鉴权每 5 分钟更新活跃时间；其他列/行/schema/配置/上传/权限保持。未自动忽略会话差异或回写业务数据，未在生产试验 Docker 写操作。

临时容器、副本、镜像传输包/远端工具已清，脱敏报告取回；确认无容器引用后移除旧 1.2.10 镜像，未全局清其他镜像。清理前后数据/配置严格一致，运行容器未变，未新建业务备份。

## 历史维护与恢复限制

[1.2.10](https://github.com/vivalucas/zpanel/releases/tag/v1.2.10)、[1.2.9](https://github.com/vivalucas/zpanel/releases/tag/v1.2.9)发行/M5 升级已完成，过程查 Git 和 Release。用户要求删除的 **14 项历史备份、审计目录及旧回退镜像已清理**，`data/backups` 当时为空，不能作为现成恢复来源；隔离副本、合成脚本或升级成功不代表完整恢复演练。

M5 存量图标曾单独授权：65 张旧图中替换 63 项为官方/品牌原稿，草料二维码、量子位保留，部分来源分辨率仍低。仅改目标图标/时间及正常图库登记，未覆盖原上传或其他导航字段；同期其他外观变化单列核验，来源未归属操作者。Chrome 实查分组无破图。该次备份/审计已删除，旧 CAS 方案不能现成回退。
