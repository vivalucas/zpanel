# 当前状态

核对日期：2026-10-28。先看本页，再按[导航](README.md)定位正文。

## 源码与M5

- 前后端及M5均为 **1.3.0**，部署源码 `c4ae3120b51dd87e83b70b6b1e9445ff51355f3d`，包含加载/去重优化、文档整理和壁纸重分析闪白修复；[源码CI](https://github.com/vivalucas/zpanel/actions/runs/40558656924)前后端通过。main后续文档提交不改变该构建基线。
- 按用户授权在本机构建Linux amd64，save/传输/load后部署 `zpanel-local:1.3.0-c4ae312`；M5 ImageID为 `sha256:ec4aef55d461293a57eb47ce8f01daf55e7812dd96e030141cea03047aab2947`。未拉取ZPanel仓库镜像，未创建Git标签、Release或仓库镜像；1.2.11正式发行资产的历史证据仍见[18](18-release-deployment-evidence.md)。本地镜像更新约束见[08](08-deployment.md)。
- M5容器健康、重启0次；仅Compose镜像字段变化，环境、挂载、端口、权限及其他服务保持一致。真实副本隔离预检、正式启动、HTTP/页面检查和清理前后，11张SQLite表的schema/类型化数据及可验证rowid、conf/uploads内容与权限严格比对一致（sqlite_sequence不比物理rowid，仍核name/seq）；未恢复或覆盖业务数据。235个镜像前端文件、93个公开文件hash核对，实际查看登录页；未登录生产账号做完整业务验收。
- 已删M5旧ZPanel的3个标签/2个镜像、13个已证实归属的构建中间镜像、11处构建残留及本轮临时目录/传输包；两个备份目录为空。共享基础镜像、其他应用及2个无此项目归属证明的dangling镜像保留。M5不保留旧版回滚镜像或业务备份，完整恢复能力未验证。

## 验证与本机资料

macOS arm64固定Node24.15.0/pnpm11.1.3/Go1.26.3：117项单元、类型、零警告ESLint、review/语言键、Go全测/vet/发行构建、普通/PWA构建及文档检查通过；隔离Go/SQLite验证两端及导出appVersion为1.3.0，导出格式version仍为1。闪白修复相关40项浏览器用例累计通过（触屏项纠正QA隔离端口后单独通过），新增两项及原失败项各重复5次通过，已查看浅深主题截图；Ubuntu CI另外303项浏览器全过。同轮协作自查不是独立验收，本次未重跑race或PWA系统安装/升级。1.2.12历史专项及合成弱网口径见[17](17-loading-verification.md)。

本机未入Git的证据根目录为 `.codex/m5-local-1.3.0-4gmv7rrw/`，部署及失败/通过结果见其 `reports/`、`remote-evidence/`、`wallpaper-fix-qa/`；本次正式构建包保留在 `artifact-c4ae312/`。旧构建中有未提交的唯一历史原文，删除M5原件前已保留本机私有 `preserved-history/old-build-inputs.tar.gz`（相对此证据根目录），SHA256为 `d5a31786840e251e4d0257909aa3d31ae618ec0553c6f0be3b085cf9c205b9e8`；它是旧构建资料，不是业务数据备份。换机不会随Git取得这些本机资料。

## 未解决与验证缺口

- iOS Safari纯触屏菜单仍无独立长按入口；其他既有玻璃规则的前缀/标准属性顺序未统一。产品稳定边界在02/03及前端正文维护，功能后续项见[09](09-current-plan.md)。
- 真实公网/图片/手机性能、软键盘/visualViewport、辅助技术、Safari/Firefox、Windows/Ubuntu桌面、MySQL/Redis/NAS实机，以及低内存WebP容器验证尚缺。Ubuntu CI不替代桌面实机。
- 完整恢复及PWA系统安装/升级未验收，HTTP/worker和静态离线壳不等于业务离线。配置导出只含导航/外观，不含上传/账号/模块配置；已删历史备份不能恢复。
