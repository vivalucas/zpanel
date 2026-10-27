# 首页加载与图片处理验证依据

用途：核对 1.2.12 加载、缓存、图片处理的验收边界及早期弱网对照。按需读取；现行实现/回归入口分别见 [前端开发](../docs/frontend.zh-CN.md)、[前端验收](../docs/frontend-audit.zh-CN.md)、[06 API](06-api-design.md)。只在证据被复核、替代或补齐时维护，不追加日常测试流水账。以下为原开发任务记录，本次文档整理未重跑业务验收。

## 最终 1.2.12 本机验收

2026-10-27，main `560c86c9848ba84b209b3ec86be3ebb8fbb565ca` 加累计修复，提交为 `848879e9472a2994f87440f33bd13d326affada7`。固定 Node 24.15.0 / pnpm 11.1.3 / Go 1.26.3、macOS arm64 / Chromium153；同轮协作自查，不是独立验收。

- 最终完整 **301 项 Chromium** 通过（9.0 分钟），无失败/跳过/重试；117 项 Vitest、类型、零警告 ESLint、test:review/语言键、16 项容器入口检查、后端全量 race/vet 和发行构建通过，普通/PWA 构建通过。
- 专项 27 项及最终对比度修正后 7 项通过：真实 404/网络失败、慢鉴权/代码/外观、私有快照隔离、取消/关闭/Esc 回焦、实际刷新、WebP 原图、桌面/320px 浅深/高对比。实际查看首页、设置、关于及失败状态截图，前后端关于页均为 1.2.12。
- 菜单回焦与浅色行内失败对比度问题已修复；初次失败和样式修正中断的旧全测分开保留，不计为最终通过。
- 最终 PWA 92 条预缓存及 worker 的 **279 种编码表示**经实际 Go HTTP 字节、解压、缓存、HEAD/304/Range、sidecar 禁访核验通过。Chromium worker 已控制页面、缓存 92 条，在线无页面错误/失败请求；离线仅验证静态鉴权失败占位，未验证业务离线或系统安装/升级。
- 同命令对 40B、400×400 畸形 WebP 的分配从 **175,669,824B → 16B**，缩略图回原字节，伪装 PNG/JPEG 及旧派生缓存受回归保护；不能替代真实低内存容器验证。

原始指纹、日志、构建、HTTP/PWA、截图见本机忽略目录 `.codex/release-qa-1.2.12-731q3kvj/`，入口 `verification.json`、`source-manifest.json`、`pwa-http-final-verification.json`；395 项快照 SHA256 为 `a06444cdf61305f53bb4b3e6f433dbdb2553a326d5aabbaebb72fef02c04a215`。指纹后仅 CHANGELOG/01 更新，业务无意外差异。此目录不是跨设备恢复来源；永久回归为仓库测试。隔离服务/运行数据已清理，原共享构建/预览保留，未操作生产。

## Ubuntu CI 与测试竞态

首次 [Ubuntu CI](https://github.com/vivalucas/zpanel/actions/runs/40527849374) 对象为 `848879e`：后端成功，浏览器 300 通过/1 失败。2026-10-28 确定性实验确认，超时用例用 Home 代码等待文案推断外观读取已开始，虚拟时钟早于目标请求推进；请求发出后再推进 15 秒即可正常超时。测试修正提交 `e0fabeb17cc44c9c1e26fe446509a70510ad15a1` 仅增加实际请求等待，保留期限、错误/恢复断言，业务代码/构建产物保持；两种读取各重复 20 次，共 40 项本机通过。原实验见 `.codex/ci-timeout-race-8en04l_s/events.json`，修正回归见 `.codex/release-qa-1.2.12-731q3kvj/browser-timeout-race-fixed.log`。修正提交的 [Ubuntu CI](https://github.com/vivalucas/zpanel/actions/runs/40548099729)已成功（2026-10-28核实），只覆盖该1.2.12提交；当前源码CI状态见01，不以本机重复通过替代Ubuntu全量。

## 合成弱网对照：公共壳加入前

此数据来自 main `560c86c` 加当时加载/去重改动，不是最终 1.2.12 测速。相同 60 个文字图标、简中、无壁纸/页脚/监控；本地模拟 API 实际等待约 200ms，CDP 延迟 150ms、下载 1.6Mbps、上传 750kbps，无 CPU 限速。三个模式串行轮换，每模式冷启与同浏览器新标签复访各 3 次，共 18 次，均无页面异常、失败或外部请求。

| 模式 | 导航首次可点击中位数（冷启/复访） | 冷启 JS 数 | 冷启 JS HTTP 正文 |
| --- | --- | --- | --- |
| 正式 1.2.11 原文/no-store | 7,782 / 7,773ms | 32 | 1,265,479 B |
| 当时新实现原文/no-store | 6,388 / 6,155ms | 23 | 1,041,253 B |
| 当时新实现 Brotli/缓存组合 | 2,653 / 506ms | 23 | 308,424 B |

前两组同传输/缓存规则，冷启正文减少 **17.72%**；第三组复访 3 次均 23/23 缓存命中，HTTP 脚本请求与正文均为 0。组合收益含压缩、HTTP 缓存和新鉴权后的展示快照，不能归因于单一机制，也不能外推真实图片、反代、公网或手机 CPU。导航可点击用 rAF 检查真实链接在视口、未禁用、中心命中，并以 trial click 核对；HTTP 服务端计字节，浏览器 PerformanceResourceTiming/CDP 核对缓存。

本机入口 `.codex/home-loading-qa-jwbbs123/verification.json`、`performance-bench.mjs`、`performance-bench-README.md`；原始 18 份记录、三次中位数、输入 SHA256 和截图在同目录，重跑须先读脚本说明并隔离端口/产物，不能与浏览器全测争用。初轮端口映射错误、缓存控件失败、旧 PWA 外置产物残留与修正结果分别保留。

## 证据替代关系与缺口

- 初期加载/去重的 277 项 Chromium 与公共壳后的 292 项已由上方最终 301 项累计回归替代；原运行仍可在 `.codex/home-loading-qa-jwbbs123/verification.json` 和 `.codex/home-startup-qa-rvsshne1/verification.json` 复核。292 项阶段未重跑后端 race/vet 或 PWA HTTP/worker，只核对后端源码一致及普通/PWA 构建，不能混为该轮新测试。
- 292 项后的只读复核在 `.codex/recheck-qa-zsx3p209/verification.json`，证实 WebP 元数据内存分配及代码块失败导致全页退出；修复后以上方最终证据为准，失败复现原件保留。
- 当前源码/CI、生产及未覆盖平台统一见 [01](01-current-status.md)，线上速度、真实手机/辅助技术、Safari/Firefox、Windows/Linux 桌面、MySQL/多实例、PWA 安装升级仍需对应环境。
