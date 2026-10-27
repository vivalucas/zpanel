# 全项目评审与修复

用途：定位 **2026-10-07** 全项目评审的问题与验收证据。基线 `main / 6d7fb70`，获批修复在本地完成；这是同一 AI 自查，不是独立评审。现行规则见 [11](11-decisions.md#管理员能力与安全数据边界)，当前验证/缺口见 [10](10-quality.md)、[01](01-current-status.md)。历史结果不覆盖后续变更。

## 评审范围与方法

覆盖 React、会话/请求、Go 权限/模型/缓存、导航/文件/导入/监控、部署与测试；逐项读源码和已有防护，在临时 SQLite 复现，未用生产数据或宿主机 Docker。

完整逐项证据、原始验收和外部公告保存在[固定 Git 原报告](https://github.com/vivalucas/zpanel/blob/94f2fd5b2b2142cf1d9b023d3f113ea21d22ad4a/handbook/15-project-review.md)。提交 `94f2fd5b2b2142cf1d9b023d3f113ea21d22ad4a`，原路径不变；Git blob 应为 `7023f5ef88f50f8304406d52aac35ef98f2c88b9`。仓库根可只读显示/校验，不依赖本机 tmp：

```sh
git show 94f2fd5b2b2142cf1d9b023d3f113ea21d22ad4a:handbook/15-project-review.md
git cat-file blob 7023f5ef88f50f8304406d52aac35ef98f2c88b9 | git hash-object --stdin
```

## 已确认问题

以下 7 项已修复；完整负例及修复证据按 ID 查原报告，不把旧缺陷重新列为待办。

| ID | 关键触发与影响 / 修复 |
| --- | --- |
| C1 / P1 | 分组绑定 ORM 完整对象可经嵌套 User 越权创建管理员；改专用字段、服务端归属和禁止关联写入。 |
| C2 / P2 | 配置读取故障可跳过验证码、读取损坏 JSON 覆盖原值；仅缺失用默认，故障拒绝登录且读取不写库。 |
| C3 / P2 | 公开监控忽略显示开关；服务端同时校验两开关，关闭/损坏拒绝访客。 |
| C4 / P2 | 合法校验和但 `iconTextColor=42` 可导入并使首页崩溃；前后端校验、旧值临时回落及明确修复。 |
| C5 / P2 | 站点第二次写入失败却已改标题；站点/应用配置同事务并验证回滚与回读。 |
| C6 / P2 | API 可写 60 ASCII 字符密码，登录却限 50；写入 6–72 UTF-8 字节，登录上限 72 字节。 |
| C7 / P3 | 管理员读取公开账号资料返回密码 hash/算法；缩为 id/username/name。匿名利用不成立。 |

## 待确认风险

T 编号保留原判断，已加固不等于真实集成全部通过。

| ID | 已处理部分与剩余边界 |
| --- | --- |
| T1 | 鉴权直读有效 session/当前账号，陈旧缓存不能恢复撤销或旧角色；真实 Redis 故障恢复未验。 |
| T2 | 标题统一 1–200 字符、varchar(200)，SQLite 扩容通过；真实 MySQL AutoMigrate 扩容未验。 |
| T3 | 管理员私网 favicon 精确 scheme/host/port 名单，仍禁环回/链路本地/云元数据；真实 NAS 未验。 |
| T4 | 关闭 linkify、说明限 32768 字符，升级 Markdown/净化依赖；当时生产 audit 公告为 0，普通用户利用链未证实。未使用的 DOMPurify IN_PLACE 不能算已确认 XSS。 |

公开图库与管理员自定义脚本符合既有产品边界，不当作缺陷；依赖版本和公告原件查固定报告。

## 已完成的获批体验优化

U1 错误恢复/配置修复；U2 空分组引导；U3 原生链接；U4 仅 LAN 地址；U5 逐文件上传/重试/预检；U6 导入预览及删除迁移；U7 批量导航加载。各 ID 的原始范围可回查 Git，不追加完成流水账。

## 实施验收

- 原评审：9 项 Vitest、21 项浏览器及类型/lint/test:review/Go/生产构建通过。
- 修复验收先为 1.2.3，再按当时授权至 1.2.4：14 项 Vitest、26 项隔离 SQLite 浏览器，以及 Go、类型、静态检查、构建、11 语言 key 与文档检查通过。两轮数量不合并。
- macOS Chromium 实查桌面与 320px 手机视口；自动回归另含浅深/英文及加载/失败/禁用。隔离服务恰好 10 MiB 图片上传成功；Docker 成功使用模拟 API。

该轮未验真实 MySQL/Redis/NAS、Docker 写动作、Ubuntu 恢复、PWA 安装升级、Safari/Firefox 和真实手机键盘；后续补齐情况查 01。历史提交推送另获授权，生产部署/标签/Release 不在该次范围。复跑入口：[project-review.spec.ts](../tests/e2e/project-review.spec.ts)、[Go API 测试](../service/api/api_v1/system/)、[贡献指南](../CONTRIBUTING.md)。
