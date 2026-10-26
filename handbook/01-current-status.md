# 当前状态

## 当前工作（2026-10-26）

1.2.9 候选已完成累计改动复核与完整隔离验证，按用户授权推进 GitHub 发布和 M5 升级。全程 main，不创建分支/工作树，不升级固定工具链或锁文件；正式标签与生产切换等待对应检查通过。

应用图片取消统一 75% 缩放，完整方图贴合底座，横竖图保持比例；底座圆角与阴影收轻，新建图标默认空背景使用磨砂，历史显式底色和原图留白保留。编辑器共用图标组件实时预览，清空背景可恢复磨砂，失败图片换源可恢复。修复纵图被 grid 隐式轨道撑高后裁切，以及生产 CSS 丢失图标标准磨砂属性的问题。无持久化字段或存量数据迁移。

## 1.2.9 验证

固定 Node.js 24.15.0/pnpm 11.1.3/Go 1.26.3：普通/PWA 构建、类型检查、零警告 ESLint、36 项 Vitest、test:review/语言键、Go 全部测试与发行构建、16 项 Docker 入口回归通过。完整 163 项 Chromium 全通过（6.0 分钟，0 跳过/失败/重试），包括新增 6 项图标回归及原有账号/会话、上传、菜单、表单、设置和首页关联功能。普通/PWA 图标标准磨砂声明均核对；PWA 产物独立保存。

完整 QA：`/tmp/zpanel-1.2.9-full-qa-20261026-s8wki28f`。隔离快照的 350 个文件在测试前后及与发布工作区的内容/模式比对一致；发布清单为 QA 中 `publish-source-files.sha256`。运行副本已清理，临时 SQLite/不可用 Docker socket 和所有测试服务均已退出；不访问开发或生产数据。

已实际查看浅深、壁纸、详情样式、320px 首页及中英文编辑预览。累计代码与关联路径交叉复核未确认新增 bug 或发布阻塞项。主线程实施/视觉查看、协作代理测试和静态交叉核对均属于同轮自查，不称独立验收。预览跟随弹窗主题，不代表首页壁纸下的最终材质。

## 当前发行与生产部署

发行代码 `070cd20`，注释标签 `v1.2.8` 的远端对象和目标：Tag 对象 `b81ac0f8cd1958ebe28fff42375fcbac27ae94bf` 已核对，剥离后的目标精确为 `070cd2056851f5afa97054b876cf139c5704a37f`。最终 157 项 CI 结果见上节。[正式 Release](https://github.com/vivalucas/zpanel/releases/tag/v1.2.8)：正式稳定发行已发布；[Release 流水线](https://github.com/vivalucas/zpanel/actions/runs/40260114877)、[容器流水线](https://github.com/vivalucas/zpanel/actions/runs/40260114838)：均成功。三项部署资产非空、两份归档的实际 SHA256 与公开 SHA256SUMS/资产摘要核对结果：通过，gzip/tar/zip 结构也有效；公开 [SHA256SUMS](https://github.com/vivalucas/zpanel/releases/download/v1.2.8/SHA256SUMS) 可用于复核。

Docker Hub/GHCR 的 `1.2.8` 与 `latest` 索引摘要核对：四个标签与两仓库摘要一致；共同索引摘要为 `sha256:385d62d0da42929bb784d1440574bddf7714c7b73195d364b57d8eddb5ffa5c9`，包含 linux/amd64、linux/arm64。m5 的固定镜像为 `ghcr.io/vivalucas/zpanel:1.2.8@sha256:385d62d0da42929bb784d1440574bddf7714c7b73195d364b57d8eddb5ffa5c9`，实际 amd64 镜像 ID 为 `sha256:9200d46c5280d58f27040813ec8ed362ace3367c26997496809dafcfa7733376`，与 manifest 的 config 摘要核对：一致。

m5 升级结果：正式 1.2.8 已上线，仅重建 ZPanel，原挂载、端口、GID 与其他 Compose 参数保留。一致副本的无网络、无发布端口预检结果：通过，前后端 1.2.8、11 张表结构与内容、配置和上传文件一致，并以实际服务身份完成 Docker 只读检查。正式切换前只停 ZPanel，完整备份 conf/data、Compose 和环境文件；备份位于 `/opt/zpanel/backups/upgrade-1.2.8-20261026-023740`（目录名时间为 UTC），目录 0700、数据与归档 0600。归档 gzip/tar/SHA256 校验：全部通过，归档摘要 `3f8c88975c35f67ebbafd4d647a6a2e701cf61ce4fa585d7d3463a619afdebdb`；回退镜像 `zpanel:before-1.2.8-20261026-023740` 对应升级前 1.2.7，须配套恢复该次完整备份和原部署配置，不能只改镜像标签。

切换后的前后端均为 1.2.8，容器 healthy、重启次数 0；服务 UID 1000、Groups 含 984。正式切换后，11 张表结构与内容、配置及上传文件与停机快照一致，SQLite integrity_check 为 ok。实际 UI 检查后再次核对，仅会话记录的 `last_seen_at`、`updated_at` 按认证中间件的五分钟活跃触达更新；会话其他列、业务表、配置和上传文件保持一致。

首页实际引用的 6 项静态文件 HTTP 内容与容器文件 SHA256 全部匹配。内置入口脚本 SHA256 为 `45cd7a3a16a44d4f9bf17185eb3b4b1beaed384d4377e451181f26d2d1cfd8a3`，与发行源码一致；实际服务身份的 Docker version、列表、资源和日志读取通过。sun-panel/frpc 的容器 ID、启动时间、镜像、状态与重启次数均与切换前一致。

生产实际 UI 检查：Chrome 既有会话刷新后，首页无图标覆盖菜单或网址提示，YouTube 紧凑右键菜单正常；820px 图片编辑表单一屏完整，下拉定位正确，关闭编辑后回焦原应用链接；关于页前后端均为 1.2.8，Docker 三个容器的 CPU/内存/网络数据显示正常，并已返回首页。启动日志检查：已实际查看 ZPanel 真实启动日志，未见启动故障指征。本轮预检容器、数据副本清理与正式备份/回退镜像保留结果：预检容器与数据副本、远端官方镜像传输副本已清理；正式备份、回退镜像及会话 QA 结果保留。生产检查未保存站点配置，未把其他业务容器作为启停测试对象。

历史备份 `backups/upgrade-1.2.7-20261025-133854` 及回退镜像 `zpanel:before-1.2.7-20261025-133854` 仍保留；该回退镜像对应 1.2.6，须配套恢复当时 Compose、环境与可执行旧入口脚本。更早的 `upgrade-1.2.6-20261024-095641`、`docker-management-20261025-121417` 备份仍保留。旧发行和验证明细由 Git 追溯；切换成功不等于完整恢复演练通过。

## 已知限制与交接

iOS Safari 纯触屏仍缺应用菜单入口：当前依赖浏览器 contextmenu，没有触屏长按识别器，不能声称已支持 iPhone/iPad 长按。应用图片不自动裁去素材白边或透明留白；旧项目保存的白色底座保留，可在编辑器清空背景色恢复磨砂。

真实手机/软键盘/辅助技术、Safari/Firefox、Windows/Ubuntu 桌面、MySQL/Redis/NAS、完整恢复和 PWA 安装升级仍未验证。配置导出只迁移导航与外观，不含上传文件、账号或模块配置，不能作为整站备份。本轮图标优化待用户指令提交/推送及后续发行部署，生产仍为上述 1.2.8；已知限制继续保留。

工程、视觉与验收入口分别为 [React 开发](../docs/frontend.zh-CN.md)、[视觉设计](../docs/ui-design.zh-CN.md)、[前端验收](../docs/frontend-audit.zh-CN.md)。计划见 [09](09-current-plan.md)，长期边界见 [11](11-decisions.md)，部署与恢复见 [08](08-deployment.md)。[15](15-project-review.md)、[16](16-frontend-event-review.md) 保留专题证据，后者的原任务独立验收不代表本轮。数据演进 [14](14-data-evolution.md) 仍为提案。
