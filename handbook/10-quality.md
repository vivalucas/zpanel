# 质量与验证

本页维护跨层验证入口和证据约束。命令见 [贡献指南](../CONTRIBUTING.md)，浏览器场景与判据集中在 [前端验收](../docs/frontend-audit.zh-CN.md)；当前执行基线、平台/集成缺口见 [01](01-current-status.md)，待复核长期项见 [09](09-current-plan.md)。历史通过数字不在这里重复维护。

## 服务端与发行回归

| 主题 | 入口与必要边界 |
| --- | --- |
| 权限与安全 | `service/api/api_v1/{middleware,system,panel}/*test.go`、`service/lib/{cmn,navigation,safehttp,siteFavicon}/*test.go`：验证码尺寸/IP 限流/可信代理、账号状态/最后管理员/会话撤销、SSRF/上传/危险导航协议、图库引用权限、导入事务/持久幂等/导出错误、Docker 取消/超时/输出上限、favicon 相对重定向。 |
| 上传去重 | [API 回归](../service/api/api_v1/system/file_upload_test.go)与[存储回归](../service/lib/storage/upload_test.go)：同图改名、单图/批量互通、12 请求并发、权限/状态、损坏/缺失候选、故障清理、引用保护与删除交错、实际大小边界和源文件变化。默认单进程锁不代表多副本协调或真实 MySQL 验收。 |
| 缩略图 | [storage](../service/lib/storage/thumbnail_test.go)、[router](../service/router/uploads_test.go)、[API](../service/api/api_v1/system/file_thumbnail_test.go)：方向、格式、资源上限与回退。WebP 不解码、不返回 `thumbnailSrc`；带缩略图参数仍返回原字节、不生成缓存，旧派生也不能复用。只看浏览器显示不足以验证服务端内存边界。 |
| 静态资源/PWA | [构建压缩](../src/lib/staticCompression.test.ts)、[Go HTTP](../service/router/static_test.go)；最终构建按实际 Go HTTP 逐字节/解压检查原文和编码表示、缓存、HEAD/304/Range、sidecar 禁访，并检查 PWA 固定路径清单、worker 激活/控制/缓存。静态离线壳不能证明业务离线或系统安装升级。 |
| Docker 入口 | 根目录运行 `python3 scripts/docker-entrypoint-test.py`，临时路径/OS 模拟覆盖大 GID、组复用/重名/幂等、未授权组、可选失败继续和基础失败退出，纳入 Ubuntu CI。发布前另用无网络独立 Linux 容器核对正式 BusyBox/su-exec、实际 UID/Groups、大 GID 及 socket 读取；不拿其他生产容器做动作试验。 |

## 隔离与证据

并行任务不得共用可变 `dist`、测试输出或同一浏览器服务端口；需要时使用临时源码快照、独立端口和 SQLite。共享构建期间白屏不能直接归因于业务实现。测试截图与日志须绑定代码指纹、构建和运行条件；本地忽略目录不是跨设备恢复来源。

前端加载预算、真实脚本失败、同值重验、响应体期限、草稿 A→B→A、对比度取样、浮层动画/命中等判据只在[前端验收](../docs/frontend-audit.zh-CN.md)维护，避免各文档同义追加。执行记录须区分合成与真实、静态与运行、自查与独立评审。

## 专题证据索引

- [15 全项目评审](15-project-review.md)：2026-10-07 的确认问题、待确认风险、获批修复与本地验收；不将已修复问题继续当当前待办。
- [16 前端事件检查](16-frontend-event-review.md)：2026-10-23 页面/共享组件覆盖、精确基线复现、修复及原任务独立验收，运行回归/静态检查/实机缺口分别标识。
- [17 加载验证](17-loading-verification.md)：1.2.12 本机验收、公共壳加入前的合成弱网口径、PWA/WebP 及原件入口；当前 CI 状态见 01。
- [18 发行/M5 证据](18-release-deployment-evidence.md)：1.2.11 包/镜像与生产核验、恢复资料的保留边界。CI、升级成功和备份存在都不能替代完整恢复演练。
