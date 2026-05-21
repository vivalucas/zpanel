# ZPanel

一个干净、轻量、可自托管的导航面板和服务器首页，适合 NAS、Homelab、家庭服务器、个人服务器、内网服务入口、Docker 应用入口和浏览器主页。

简体中文 | [English](README.md) | [日本語](docs/README.ja.md) | [한국어](docs/README.ko.md) | [Deutsch](docs/README.de.md) | [Français](docs/README.fr.md) | [Español](docs/README.es.md) | [Português](docs/README.pt-BR.md) | [Italiano](docs/README.it.md) | [繁體中文](docs/README.zh-TW.md) | [Русский](docs/README.ru.md)

---

ZPanel 是 [Sun-Panel](https://github.com/hslr-s/sun-panel) MIT 开源版本的独立 fork。Sun-Panel 和原作者为本项目提供了重要基础。ZPanel 不是 Sun-Panel 官方项目，也不代表原项目继续维护。

ZPanel 的目标很简单：保持轻量、好用、易部署，并默认开放，不引入付费授权系统。围绕自托管使用场景，ZPanel 对前端工程结构、用户与导航数据、个性化配置、文件上传、Docker 管理和部署流程做了持续整理与优化；同时补强了登录验证码、访问拦截、权限校验、登录限流、安全响应头、容器健康检查、CI 质量门禁和项目协作文件，让项目更适合作为可维护、可部署、可二次开发的开源样例。

关键词：自托管导航页、NAS 导航面板、Homelab Dashboard、个人服务器首页、Docker 管理面板、内网服务导航、浏览器主页。

## 为什么选择 ZPanel

- **部署简单**：Docker Compose 一条命令启动，默认使用 SQLite，本地目录持久化配置、数据库和上传文件。
- **面向真实自托管场景**：支持内网 / 外网地址切换、公开访问模式、多账号、本地快速切换账号、文件上传和系统状态组件。
- **高度可定制**：背景、模糊、遮罩、图标样式、布局宽度、页脚、站点标题、登录页、自定义 CSS / JavaScript 都可以在线调整。
- **更适合长期维护**：补充健康检查、CI、依赖更新配置、PR / Issue 模板、贡献指南和安全策略，方便个人使用，也方便团队二次开发。
- **安全默认值更清晰**：支持登录验证码、登录限流、权限拦截、安全响应头；Docker socket、公开访问、自定义 JS 等高权限能力在文档中明确提示风险。

## 功能

**导航和服务入口**

- 可视化管理导航项目和分组
- 内网 / 外网地址切换
- 支持当前页、新窗口、弹窗等打开方式
- 支持图片图标、文字图标、favicon 获取和 Iconify 图标
- 支持拖拽排序、右键快捷操作、前端搜索导航项
- 可选公开访问模式，适合分享只读导航页

**个性化**

- 自定义背景、模糊、遮罩、布局宽度、边距和页脚
- 自定义站点标题、站点图标、登录页标题、副标题和底部内容
- 在线编辑自定义 CSS 和 JavaScript
- 自定义搜索引擎，无人为数量限制
- 可选登录图形验证码
- 暗色 / 亮色 / 自动主题和多语言界面

**用户和数据**

- 多账号管理
- 本地多账号快速切换
- 用户数据隔离
- 导航项目和样式配置导入 / 导出
- ZPanel 原生 `.zpanel.json` 备份文件
- 管理员可设置公开访问用户

**文件和媒体**

- 上传图标和壁纸
- 公共图库视图
- 上传图片可直接设为壁纸

**系统和 Docker**

- 系统状态组件
- CPU、内存、磁盘等状态展示
- Docker 卡片能力和容器资源快照
- 管理员 Docker 应用管理：容器列表、资源快照、启动、停止、重启、暂停、恢复和日志

**工程和安全**

- 登录验证码、登录限流、权限拦截和安全响应头
- Docker / Compose 健康检查接口：`GET /api/healthz`
- GitHub Actions 前后端质量检查
- Dependabot、Issue 模板、PR 模板、贡献指南和安全策略

## 快速开始

```bash
docker compose up -d
```

默认镜像：

```text
vivalucas/zpanel:latest
```

默认端口：`6521`

### Release

版本 tag 会创建 GitHub Release，包含发布说明、Linux amd64 部署包和 `SHA256SUMS` 校验文件。多数用户仍然建议优先使用 Docker 镜像部署：

- `ghcr.io/vivalucas/zpanel:<version>`
- `vivalucas/zpanel:<version>`

健康检查接口：

```text
GET /api/healthz
```

默认账号：

```text
Username: admin@zpanel.local
Password: 12345678
```

首次登录后请立即修改默认密码。

如果要在 ZPanel 中管理宿主机 Docker 容器，需要挂载 Docker socket：

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

这个权限较高，只建议在可信环境启用。

## 适用场景

- NAS、软路由、迷你主机、家庭服务器的统一入口页
- Homelab 服务导航，例如 Jellyfin、qBittorrent、Home Assistant、Git、监控系统等
- 公司或团队内网工具导航
- 个人浏览器主页和常用网址收藏
- 需要公开分享的只读导航页
- 需要轻量 Docker 容器管理入口的自托管环境

## 本地开发

```bash
fnm use
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm run dev
```

后端：

```bash
cd service
go run main.go
```

默认情况下，前端开发服务器运行在 `http://127.0.0.1:1002`，并将 API 请求代理到 `http://127.0.0.1:6521`。

## 质量检查

```bash
pnpm run type-check
pnpm run lint
pnpm run build
cd service && go test ./...
```

GitHub Actions 会在 Pull Request 和主分支推送时运行前后端检查。

## 贡献与安全

贡献前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全问题请按 [SECURITY.md](./SECURITY.md) 私下报告。

## Fork 说明

ZPanel 基于 Sun-Panel 的 MIT 开源版本构建。ZPanel 是独立项目，不是官方延续；当前代码围绕 ZPanel 的产品方向持续演进，重点改进自托管部署、用户体验、权限安全、Docker 管理和工程质量。

## 许可

MIT License。详见 [LICENSE](./LICENSE)。
