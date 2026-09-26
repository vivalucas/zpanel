# 质量与验证

当前前端验收矩阵见 [React 自查](../docs/frontend-audit.zh-CN.md)，验证命令见 [贡献指南](../CONTRIBUTING.md)。本轮仅静态核对、文档结构/链接和 diff 检查，未重跑业务测试。

历史原验收记录为 15 项 Playwright、9 项 Vitest、test:review、type-check、lint、Go 测试与普通/PWA 构建通过；不作为本次新增验证。

回归必须覆盖：验证码尺寸/IP 限流/可信代理、账号状态/最后管理员/会话撤销、SSRF 和上传边界、危险导航协议、图库引用与权限、导入事务/幂等和导出错误、Docker 取消/超时/输出上限、favicon 重定向相对路径。

前端重点：切换账户的旧请求与旧回调不得污染新会话；HTTP 局域网不依赖 crypto.randomUUID；生产构建实际浏览器验证依赖拆分；未保存保护、图库跨页与安全模式恢复。

旧评审已修复项压缩为以上规则，误报不继续当待办；尚未证实的后端长期项见 09。真实 Docker/MySQL/Redis/Ubuntu/PWA 及 Safari/Firefox 未在本轮验证。
