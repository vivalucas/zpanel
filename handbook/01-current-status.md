# 当前状态

2026-09-26 对照 package.json、service/assets/version、src、工作流、CHANGELOG 与 docs 静态核对。当前版本 1.2.1，已从旧 Vue 改为 React + Ant Design。

现有导航、设置 Hash 页面、会话隔离、图库引用替换、事务幂等导入、账号/公开模式、Docker 管理与可选 PWA。1.2.1 已恢复首页布局位置、70px 默认图标、玻璃/壁纸对比，并延迟加载登录/上传/HTML 净化模块；旧“大 chunk 未解决”不是最新结论。

当前工程/视觉/验收权威资料在 docs/frontend.zh-CN.md、ui-design.zh-CN.md、frontend-audit.zh-CN.md，handbook 负责路由，不复制另一个前端规范。

仍未覆盖：真实 Docker 容器、Ubuntu 部署和恢复、MySQL/Redis、多实例一致性、真实磁盘/PWA 安装升级、全部语言母语翻译。配置 JSON 不是整站备份，不包含上传文件/账号/模块配置。

本轮仅文档迁移、静态事实和链接检查，没有重跑业务测试、浏览器或部署。历史 15 浏览器/9 单元通过记录属于 1.2.1 原验收，详见 10 引用。
