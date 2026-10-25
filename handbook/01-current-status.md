# 当前状态

## 当前工作（2026-10-25）

用户明确授权修复全部已确认问题、提交推送本地全部累计修改、推进补丁版本与 Tag，并更新 m5。候选基于 main 的 `70f8725`，已完成 Docker 入口高 GID 修复与错误页优化，准备先提交推送，再推进 1.2.7；等待发行提交 main CI 全通过后打注释标签，正式镜像发布后再部署。只在 main 工作，不创建分支/工作树，不升级固定工具链或锁文件。

入口按真实 socket GID 与启动组列表建立服务用户成员关系，支持较大 Linux GID，避免 BusyBox 数值建组上限；可选 Docker 组准备失败时告警并继续站点启动，基础 conf/data 初始化仍失败即退出。Docker 列表、缓存刷新、资源、日志及鉴权错误采用局部紧凑提示，默认折叠详情，长诊断限高换行，手机操作与 portal 主题回退完整；权限、缓存、数据结构和接口语义不变。

主线程负责累计验证、版本/文档、GitHub 发行与生产切换，协作代理实现入口及持久回归，另两代理交叉核对 UI、权限与发行契约，属于同轮实施自查，不作为独立验收。

## 本轮验证

固定 Node.js 24.15.0/pnpm 11.1.3/Go 1.26.3：普通构建、类型检查、零警告 ESLint、36 项 Vitest、test:review、Go 全部测试与 138 项浏览器回归通过（4.2 分钟）。验收使用独立临时源码快照、端口和 SQLite，不访问开发数据库或真实 Docker。桌面/320px、浅深主题、首页与 Docker 错误/日志弹窗截图已实际查看，保留会话验收产物。

新增 16 项入口回归通过并纳入 Ubuntu CI，覆盖组授权、GID 范围、组复用/重名/幂等、可选步骤失败继续和基础初始化失败退出；恢复旧数值建组方式时两项大 GID 回归准确失败。m5 上使用正式 1.2.6 镜像只读挂候选入口，在无网络独立容器真实验证 984、300000、Docker 引擎允许的上界 2147483647、已有大 GID 组、只读组文件失败继续、未授权组及真实 Docker 读取共 7 个场景，服务 UID 均为 1000，测试容器和临时目录已清理，现有三个业务容器状态、启动时间与重启次数一致。4294967294 仅为 Linux GID 范围的模拟回归，不声称本次 Docker 引擎可传入该值。

本轮尚未验证 Safari/Firefox、真实手机/软键盘/读屏、Windows、Ubuntu 桌面、MySQL/Redis/NAS、完整恢复和 PWA 安装升级；这些不由 Chromium 或权限隔离测试替代。配置 JSON 只迁移导航和外观，不含上传文件、账号或模块配置，不能作为整站备份。

## 当前发行与生产部署

源码版本仍为 1.2.6，最近已发布标签 `v1.2.6` 指向 `eb51f9c`；[正式 Release](https://github.com/vivalucas/zpanel/releases/tag/v1.2.6) 的三项 Linux amd64 资产和双架构 GHCR/Docker Hub 镜像已发布。首页紧凑布局 `70f8725` 已推送 main，本次将随 1.2.7 首次发行：桌面身份/时钟与搜索横排，窄屏自然堆叠，同配置首图标约上移 148px；布局、壁纸和既有配置语义保留。

m5 当前运行正式 Docker Hub 1.2.6，Compose 固定 `vivalucas/zpanel:1.2.6@sha256:0c7f3da10e50b9ae999f9239dfd190b18f446c19c7cb2a223403587b2f8c571b`，实际镜像 ID `sha256:7b970cb083b200a7de86f2d95466fc4793876e39b08c4ac2d445769575ed53e7`。Docker socket 与 GID 984 已配置，旧修正脚本只读覆盖 `/app/docker-entrypoint.sh`，服务 UID 1000，容器 healthy、重启次数 0。升级到内置修复的镜像时必须移除此覆盖，保留 conf/data/socket、权限组和其他 Compose 配置，只重建 ZPanel。

部署目录保留两份重要备份（目录时间为 UTC）：`backups/upgrade-1.2.6-20261024-095641` 含升级前停机归档及前后指纹，回退镜像 `zpanel:before-1.2.6` 对应原 `zpanel:1.2.5-local-54724d1`；`backups/docker-management-20261025-121417` 含在线一致 SQLite 副本、Docker 配置切换前停机 conf/data/Compose/环境归档及校验。目录 0700、数据文件 0600，归档校验通过。此前重建前后 11 张表结构和内容、配置、上传文件一致，integrity_check 为 ok；sun-panel/frpc 的 ID、启动时间、镜像、状态和重启次数未变。Docker 管理读取及独立无网络、无挂载临时容器的全部支持动作已验，测试容器已删除；已用 Chrome 既有会话查看线上首页、设置、关于与恢复后的 Docker 表，未将生产容器用于启停测试。

## 实现与追溯入口

工程、视觉与验收入口分别为 [React 开发](../docs/frontend.zh-CN.md)、[视觉设计](../docs/ui-design.zh-CN.md)、[前端验收](../docs/frontend-audit.zh-CN.md)。计划见 [09](09-current-plan.md)，长期边界见 [11](11-decisions.md)，部署与恢复见 [08](08-deployment.md)。1.2.1–1.2.6 的代码/发行及旧验证历史由 Git 追溯；[15 全项目评审](15-project-review.md)和[16 前端事件检查](16-frontend-event-review.md)保留专题证据，后者的原任务独立验收不代表本轮。数据演进 [14](14-data-evolution.md) 仍为提案。
