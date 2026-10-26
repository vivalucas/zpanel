# 当前状态

## 当前工作（2026-10-26）

1.2.9 图标优化、完整复核、正式发行与 M5 升级已完成。发行代码 `95f66b5ebd0c86d5613ca90ffb62ffd459a9d1eb` 已推送 main；状态回写随本次收尾同步，不改变发行代码。全程 main，未创建分支/工作树，未升级固定工具链或锁文件。

应用图片取消统一 75% 缩放，完整方图贴合底座，横竖图保持比例；底座圆角与阴影收轻，新建图标默认空背景使用磨砂，历史显式底色和原图留白保留。编辑器共用组件实时预览，清空背景可恢复磨砂，失败图片换源可恢复。修复纵图被 grid 隐式轨道撑高后裁切，以及生产 CSS 丢失图标标准磨砂属性的问题。无持久化字段或存量业务数据迁移。

## 1.2.9 验证

固定 Node.js 24.15.0/pnpm 11.1.3/Go 1.26.3：普通/PWA 构建、类型检查、零警告 ESLint、36 项 Vitest、test:review/语言键、Go 全部测试与发行构建、16 项 Docker 入口回归通过。完整本地 163 项 Chromium 全通过（6.0 分钟，0 跳过/失败/重试）；发行提交的 [Ubuntu CI](https://github.com/vivalucas/zpanel/actions/runs/40273606845) 也全部通过，163 项浏览器用例耗时 6.5 分钟。

新增 6 项图标回归覆盖满版方图、横竖图实际像素、旧色保存/清空、换源恢复、中英文实时预览及浅深/壁纸/320px/详情样式；既有账号/会话、上传、菜单、表单和设置回归继续通过。普通/PWA 图标标准磨砂声明均核对，PWA 产物独立保存。

完整 QA：`/tmp/zpanel-1.2.9-full-qa-20261026-s8wki28f`。隔离快照 350 个文件在测试前后不变；发布提交的业务源码、测试、清单、版本及锁文件与验证清单一致。临时 SQLite、不可用 Docker socket 和执行副本均隔离，测试服务及副本已清理。正式发布包的整个 web 目录与本地已验证 normal-dist 逐文件相同。

已实际查看浅深、壁纸、详情样式、320px 首页及中英文编辑预览；累计代码和关联路径交叉复核未确认新增 bug 或发布阻塞项。主线程实施/视觉查看、协作代理测试与交叉核对均为同轮自查，不称独立验收。

## 当前发行

注释标签 `v1.2.9`：远端 Tag 对象 `b59d225f8538ea6e66e9195f9d49a8621154a50a`，剥离目标精确为 `95f66b5ebd0c86d5613ca90ffb62ffd459a9d1eb`。[正式 Release](https://github.com/vivalucas/zpanel/releases/tag/v1.2.9)、[Release 流水线](https://github.com/vivalucas/zpanel/actions/runs/40275305081)、[容器流水线](https://github.com/vivalucas/zpanel/actions/runs/40275305027)：均成功。

三项公开资产非空，真实 SHA256、GitHub asset digest 和公开 SHA256SUMS 核对通过；gzip/tar/zip 完整，两包 88 个文件逐字节相同，配置/部署/文档齐全。前端 About chunk 与 Linux amd64 ELF 内嵌版本均为 1.2.9，Go 1.26.3 发行标志正确。二进制未嵌入 vcs.revision，提交对应通过标签与成功流水线核对，不混称为二进制自报 revision。

- tar.gz：`0618fd91e78bcce9d5b8b8dfdbb4f0f0218618ea7393389bcb707e1d1d8a1ee6`
- zip：`12ceee8d657c54fb367fd18c61b0038370c2e8a518fcc14529ae029d5876118b`
- SHA256SUMS：`04320c5069551dc414bb28353c5e2ee4a48374ef1dd3441e96b7719605b6516f`

资产证据：`/tmp/zpanel-1.2.9-release-asset-qa-20261026-51w4_pvt/verification.json`。

Docker Hub/GHCR 的 `1.2.9` 与 `latest` 四个标签索引相同，含 linux/amd64、linux/arm64；共同索引摘要 `sha256:9abe44343b069bb0538add57a4d2e55cc68e46e61eb337ffc44040b4d485c856`。amd64 config/image ID 为 `sha256:18d2d0da06ea6b7dcf81eb4b98d3c53c47f9c2b6f13ef2fcdd95f013467d3b82`，与 M5 实际镜像核对一致。

## M5 部署与回退

M5 固定镜像为 `ghcr.io/vivalucas/zpanel:1.2.9@sha256:9abe44343b069bb0538add57a4d2e55cc68e46e61eb337ffc44040b4d485c856`。直接拉取超时后，从官方仓库下载 amd64 的 6 个层，逐项核对压缩 digest 和解压 diffID，经传输归档 SHA256 校验导入，再按官方索引摘要完成本地 RepoDigest 关联；未重启 Docker 或改其全局配置。

一致数据副本在无网络、无发布端口的临时容器中预检通过：1.2.9 启动、11 表逻辑内容与 schema、配置/上传、UID 1000 和组 984、实际服务身份 Docker 读取均正常。严格校验曾发现 sqlite_sequence 的隐含 rowid 重排；1.2.8 在同条件副本中精确复现，name/seq 和全部业务行未变。校验 v2 只排除该内部表的无业务语义 rowid，仍严格核对 name/seq、所有业务表及其 rowid；18 项合成自验证通过，重新生成清单后预检通过。

正式切换前仅停 ZPanel，完整备份 conf/data、Compose 和环境文件。备份：`/opt/zpanel/backups/upgrade-1.2.9-20261026-142141`（Asia/Shanghai），目录 0700、归档及审计文件 0600；gzip/tar/SHA256 校验通过。归档 SHA256：`5d56cab08b0ad9bef6a0d2bac8a1c8b1cbf28fbd22ec8fa1adc34986569bb6b0`。回退镜像 `zpanel:before-1.2.9-20261026-142141` 对应升级前 1.2.8；完整回退须配套恢复该次备份和原部署配置，不能只改镜像标签。

正式升级只重建 ZPanel，保留原端口、挂载、GID、环境与其他 Compose 参数。容器 healthy、重启次数 0，服务 UID 1000、组含 984；SQLite integrity_check 为 ok，11 表逻辑内容/schema、配置和上传文件及其权限与停机快照一致。实际 UI 查看后，仅 session 的 last_seen_at、updated_at 正常更新，其余列和全部业务数据不变。首页 HTML 与引用的 6 项静态资源 HTTP/容器 SHA256 共 7 项一致；入口脚本 SHA256 为 `45cd7a3a16a44d4f9bf17185eb3b4b1beaed384d4377e451181f26d2d1cfd8a3`，与发行源码一致。

生产实际 UI 已查看：首页图片更贴合，右键菜单与取消编辑回焦正常，实时预览可见；关于页前后端均 1.2.9，Docker 三个容器 CPU/内存/网络数据正常，已返回首页。启动日志已实际查看，未见启动故障指征。sun-panel/frpc 的 ID、启动时间、镜像、状态与重启次数均与切换前一致，未保存生产站点或项目配置。

本轮预检/旧版对照容器、数据副本、远端临时工具目录及本地/远端镜像传输副本已清理；正式 QA、备份及回退镜像保留。审计结果/清单/脚本位于上述备份的 audit 目录。升级成功与回退脚本自查不代表完整恢复演练通过。

历史备份与回退镜像继续保留：`upgrade-1.2.8-20261026-023740` / `zpanel:before-1.2.8-20261026-023740` 对应旧版 1.2.7（目录时间 UTC）；`upgrade-1.2.7-20261025-133854` / `zpanel:before-1.2.7-20261025-133854` 对应旧版 1.2.6，须恢复当时 Compose、环境与可执行旧入口脚本。更早的 `upgrade-1.2.6-20261024-095641`、`docker-management-20261025-121417` 仍保留，均位于 `/opt/zpanel/backups`。

## M5 存量图标素材

用户另行授权检查并替换 M5 上的上传素材。65 张旧图均为 192×192 不透明 PNG，均含白色画布，项目底色也统一为白色；仅调整组件不能消除原图白边。已替换 63 项为官网或品牌图库的原稿，矢量统一转为 PNG，其他原稿保留原始分辨率；透明标志使用磨砂，满版图使用品牌底色。草料二维码、量子位未找到更合适的方形原稿，保留旧图。少数官网仅提供低分辨率素材，仍有清晰度限制。未改程序、版本、工具链或锁文件，M5 仍为上述 1.2.9 镜像且未重启。

私有备份：`/opt/zpanel/backups/icon-assets-20261026-150137`，含配置/上传/部署文件归档、一致 SQLite 备份、原图标 JSON、素材来源和维护脚本；目录 0700、备份/审计 0600。先事务更新 62 项，再在 `feishu` 子备份对应事务补飞书矢量 1 项；两批各自的提交前后核验通过。63 个新路径登记为正常 public/attachment 文件，不覆盖或删除旧图，仅改目标 `icon_json/updated_at`；名称、链接、分组、顺序及其他项目字段保持。

累计核验 `cumulative-verification.json` 于北京时间 16:11 通过：63 张图片 HTTP/MIME/SHA256 正常，全部表结构、受保护行/列、原上传及其权限核对，归档中的 72 个原文件保持。期间另有多次外观保存及一张 JPEG 壁纸上传；原始严格对照因此出现 file、sqlite_sequence、user_config 差异。已单独记录并保留账号 2 的背景图、遮罩、模糊度三键和新增文件 132，来源未归属到具体操作者；其余保护项无差异，未豁免整表。审计保留首轮通过结果及 `concurrent-observation-final.json`，后续新增操作可能使这份时间点核验不再适用。

维护脚本通过 6 项合成事务/保护/回退检查；实际查看 macOS Chrome 的全部分组与最终飞书图标，无破图。ZPanel healthy、重启 0，sun-panel/frpc 的容器 ID 与重启次数保持。未重新验证真实手机或其他浏览器。

图标回退应合并两批清单，按旧/新 JSON 和时间做一次 CAS 恢复，保留新增图库登记及后续外观/壁纸；不能直接覆盖整库。两份原脚本逆序回退时，首批事后检查会把第二批保留资产报为额外差异，不能据此宣称两批均可直接全绿。完整生产恢复未演练。

## 已知限制与交接

iOS Safari 纯触屏仍缺应用菜单入口，当前依赖 contextmenu，不能声称已支持 iPhone/iPad 长按。图片不自动裁去素材白边或透明留白；旧显式白底保留，可在编辑器清空背景色恢复磨砂。编辑预览随弹窗主题，不代表首页壁纸下的最终材质。其他既有玻璃规则的前缀/标准属性顺序未在图标范围内统一调整。

真实手机/软键盘/辅助技术、Safari/Firefox、Windows/Ubuntu 桌面实机、MySQL/Redis/NAS、完整恢复和 PWA 安装升级未验证。配置导出只迁移导航与外观，不含上传文件、账号或模块配置，不能作为整站备份。无本轮待实现或待部署事项，已知限制继续保留。

工程、视觉和验收入口：[React 开发](../docs/frontend.zh-CN.md)、[视觉设计](../docs/ui-design.zh-CN.md)、[前端验收](../docs/frontend-audit.zh-CN.md)。计划见 [09](09-current-plan.md)，长期边界见 [11](11-decisions.md)，部署/恢复见 [08](08-deployment.md)。[15](15-project-review.md)、[16](16-frontend-event-review.md) 保留历史专题证据，原任务独立验收不代表本轮；[14](14-data-evolution.md) 仍为提案。
