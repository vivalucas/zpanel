# 当前状态

核对日期：2026-10-28。先看本页，再按[导航](README.md)定位正文。

## 源码与M5

- 前后端及M5均为 **1.3.1**，应用构建基线 `072b236b5a6bf0b5383d70a6d0fc172e4e975631`；main后续仅测试、验证命令及交接文档变化，不改变应用产物。[应用CI](https://github.com/vivalucas/zpanel/actions/runs/40672908891)前后端及322项Chromium回归通过。修复首屏闪亮、登录/设置返回提示、慢图黑字等待，图片下载/解码有期限，重验保留编辑草稿。
- 按用户授权在本机构建Linux amd64，以save/传输/load更新 `zpanel-local:1.3.1-072b236`；M5 ImageID为 `sha256:30caa82a09c0a95960f6876c56ebaa399271976b0fe3702250f2137487087b2b`。容器healthy、重启0；Compose仅镜像字段变化，环境、端口、挂载、权限与其他服务保持一致。本次为本地镜像部署，公开发行资产仍查[18](18-release-deployment-evidence.md)，更新方式见[08](08-deployment.md)。
- 部署守卫115项合成测试及真实副本预检通过。正式启动、HTTP/匿名界面检查和本轮临时清理前后，11张SQLite表的schema、类型化数据及适用rowid，conf/uploads内容与权限严格一致（sqlite_sequence只排除无业务意义的rowid，仍核name/seq）；未恢复或覆盖业务数据。237个镜像前端文件、93个公开文件hash核对，已查看实际登录页；未登录生产账号做完整业务验收。
- 已清本轮两处M5预检/传输临时目录，保留旧1.3.0镜像及本机正式产物；未创建完整业务备份，不将旧镜像等同完整恢复能力。

## 验证与本机资料

固定Node24.15.0/pnpm11.1.3/Go1.26.3，macOS arm64当前仓库119项单元、类型、零警告Lint、review/语言键、Go全测/vet/发行构建、16项容器入口及普通/PWA构建通过。Vitest固定扫描根为src，排除本机历史源码快照。已完成本机321项完整浏览器回归及新增草稿用例，19项首屏专项各重复3次、镜像前端87项通过；Ubuntu CI另跑完整322项。已查看桌面/窄屏、浅深、返回入口及等待截图；属于协作自查，不是独立验收。本轮未重跑race或PWA系统安装/升级；模拟延迟不作真实公网保证，既有加载验证口径见[17](17-loading-verification.md)。

本机未入Git的本轮证据根目录为 `.codex/m5-local-1.3.1-_1xujod7/`：正式镜像包与提取产物在 `artifact-072b236/`；最终部署、HTTP/界面、清理和远端证据在 `attempt2/`，首次保护回退及其清理证据也保留。当前源码的前端原文/Brotli与镜像一致，gzip仅平台OS头字节不同、压缩体及解码内容一致。

上轮构建资料中未提交的唯一历史原文仍在本机私有 `.codex/m5-local-1.3.0-4gmv7rrw/preserved-history/old-build-inputs.tar.gz`，SHA256为 `d5a31786840e251e4d0257909aa3d31ae618ec0553c6f0be3b085cf9c205b9e8`；它是旧构建资料，不是业务数据备份。这些本机资料不会随Git换机。

## 未解决与验证缺口

- iOS Safari纯触屏菜单仍无独立长按入口；其他既有玻璃规则的前缀/标准属性顺序未统一。产品稳定边界在02/03及前端正文维护，功能后续项见[09](09-current-plan.md)。
- 真实公网/图片/手机性能、软键盘/visualViewport、辅助技术、Safari/Firefox、Windows/Ubuntu桌面、MySQL/Redis/NAS实机，以及低内存WebP容器验证尚缺。Ubuntu CI不替代桌面实机。
- 完整恢复及PWA系统安装/升级未验收，HTTP/worker和静态离线壳不等于业务离线。配置导出只含导航/外观，不含上传/账号/模块配置；已删历史备份不能恢复。
