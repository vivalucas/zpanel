# 当前状态

2026-09-26 对照 package.json、service/assets/version、src、工作流、CHANGELOG 与 docs 静态核对。当前版本 1.2.1，已从旧 Vue 改为 React + Ant Design。

现有导航、设置 Hash 页面、会话隔离、图库引用替换、事务幂等导入、账号/公开模式、Docker 管理与可选 PWA。1.2.1 已恢复首页布局位置、70px 默认图标、玻璃/壁纸对比，并延迟加载登录/上传/HTML 净化模块；旧“大 chunk 未解决”不是最新结论。

当前工程/视觉/验收权威资料在 docs/frontend.zh-CN.md、ui-design.zh-CN.md、frontend-audit.zh-CN.md，handbook 负责路由，不复制另一个前端规范。

2026-09-27 以 ebc7eb2 为基线完成 Ubuntu 单实例 Docker 从 1.2.0 到 1.2.1 的源码构建升级：构建/类型检查通过，升级前停机备份，容器 healthy、局域网健康接口正常、SQLite integrity_check 为 ok，浏览器实际查看登录页。未做登录后完整交互或恢复演练。

仍未覆盖：完整恢复、MySQL/Redis、多实例一致性、真实磁盘/PWA 安装升级、全部语言母语翻译。配置 JSON 不是整站备份，不包含上传文件/账号/模块配置。

2026-09-27 清理旧项目名称、链接及产品来源文案，统一 ZPanel 产品定位；按用户明确要求移除 LICENSE 中旧作者署名，保留 MIT 正文和 ZPanel contributors 版权行，未进行代码来源或许可适用性审计。生产构建、类型检查及文档链接检查通过，隔离本地服务中实际查看关于页，确认仅展示 ZPanel 介绍、版本和项目链接。本次清理尚未部署到服务器。

2026-09-26 文档迁移仅做静态事实和链接检查。历史 15 浏览器/9 单元通过记录属于 1.2.1 原验收，详见 10 引用。
