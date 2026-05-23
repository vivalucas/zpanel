# API 设计

## API 概览

后端基于 Gin，统一挂载在 `/api` 下。前端开发代理将 `/api` 转发到 `VITE_APP_API_BASE_URL`，默认后端地址为 `http://127.0.0.1:6521/`。

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/login` | 登录 | 否 |
| POST | `/api/logout` | 登出 | 是 |
| GET | `/api/captcha/getImageByCaptchaId/:id/:width/:height` | 获取登录验证码图片 | 否 |
| GET | `/api/openness/loginConfig` | 公开读取登录配置 | 否 |
| GET | `/api/openness/getDisclaimer` | 公开读取免责声明 | 否 |
| GET | `/api/openness/getAboutDescription` | 公开读取关于说明 | 否 |
| GET | `/api/healthz` | 健康检查 | 否 |
| POST | `/api/system/siteSetting/get` | 获取站点设置 | 是 |
| POST | `/api/system/siteSetting/set` | 保存站点设置和登录验证码开关 | 管理员 |
| POST | `/api/file/getList` | 获取当前用户上传文件 | 是 |
| POST | `/api/file/getPublicList` | 获取公共图库文件列表 | 是 |
| POST | `/api/file/deletes` | 删除当前用户上传文件 | 是 |
| POST | `/api/panel/itemIcon/getListByGroupId` | 按分组读取导航项目 | 公开模式拦截 |
| POST | `/api/panel/itemIcon/edit` | 新增 / 编辑导航项目 | 是 |
| POST | `/api/panel/itemIcon/deletes` | 删除导航项目 | 是 |
| POST | `/api/panel/itemIcon/saveSort` | 保存导航项目排序 | 是 |
| POST | `/api/panel/itemIcon/addMultiple` | 批量新增导航项目 | 是 |
| POST | `/api/panel/itemIcon/getSiteFavicon` | 获取站点 favicon | 是 |
| POST | `/api/panel/itemIconGroup/edit` | 新增 / 编辑分组 | 是 |
| POST | `/api/panel/itemIconGroup/deletes` | 删除分组 | 是 |
| POST | `/api/panel/itemIconGroup/saveSort` | 保存分组排序 | 是 |
| POST | `/api/system/docker/containers` | Docker 容器列表 | 管理员 |
| POST | `/api/system/docker/stats` | Docker 资源快照 | 管理员 |
| POST | `/api/system/docker/action` | Docker 容器操作 | 管理员 |
| POST | `/api/system/docker/logs` | Docker 容器日志 | 管理员 |

> 说明：本表先记录当前已确认的核心接口。完整接口需继续从 `service/router/**/*.go` 和 `src/api/**/*.ts` 双向核对后补齐。

## 认证方式

现有代码使用登录 token 和后端中间件控制访问：

- `LoginInterceptor`：需要登录的管理接口。
- `PublicModeInterceptor`：公开模式允许访问的面板数据接口。
- `AdminInterceptor`：管理员权限接口。

前端在 `src/utils/request/index.ts` 中通过请求头 `token` 传递当前登录 token；后端中间件从 `c.GetHeader("token")` 读取。

## 统一响应格式

前端按 `code` 判断请求结果。常见响应形态如下：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {}
}
```

错误码文案目前在前端 locale 中维护，例如：

| code | 说明 |
|------|------|
| 1000 | 未登录 |
| 1003 | 用户名或密码错误 |
| 1004 | 账号已停用或未激活 |
| 1005 | 当前无权限操作 |
| 1006 | 账号不存在 |
| 1200 | 数据库出错 |
| 1300 | 上传失败 |
| 1400 | 参数格式错误 |
| 2001 | 需要验证码或验证码错误 |

## 接口详情

### `GET /api/healthz` — 健康检查

用于 Dockerfile、docker-compose 和 CI 基础验证。

**响应示例**：

```json
{
  "status": "ok"
}
```

### `POST /api/login` — 登录

**请求参数**：

```json
{
  "username": "admin@zpanel.local",
  "password": "example-password",
  "vcode": "abcd",
  "email": "captcha-id"
}
```

`vcode` 和 `email` 仅在登录验证码开启时需要。当前实现复用 `email` 字段传 `captchaId`，后续可单独重命名为 `captchaId`。

**响应示例**：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "token": "example-token"
  }
}
```

### `GET /api/openness/loginConfig` — 登录配置

**请求参数**：无。

**说明**：公开接口，用于登录页读取注册配置、验证码开关和站点展示配置。

### `GET /api/captcha/getImageByCaptchaId/:id/:width/:height` — 验证码图片

**请求参数**：URL 参数。

| 参数 | 说明 |
|------|------|
| `id` | 前端生成的验证码 ID |
| `width` | 图片宽度 |
| `height` | 图片高度 |

**说明**：后端生成 PNG 图片，并把答案按 `id` 缓存在验证码 Store 中。

### `POST /api/system/siteSetting/get` — 获取站点设置

**响应说明**：返回 `siteSetting` 和 `loginCaptcha`。

### `POST /api/system/siteSetting/set` — 保存站点设置

**认证**：管理员。

**请求字段**：

```json
{
  "siteTitle": "ZPanel",
  "siteIcon": "/favicon.svg",
  "loginTitle": "ZPanel",
  "loginSubtitle": "",
  "loginFooter": "Powered By ZPanel",
  "customCss": "",
  "customJs": "",
  "loginCaptcha": true
}
```

### `POST /api/panel/itemIcon/getListByGroupId` — 获取分组导航项目

**请求示例**：

```json
{
  "itemIconGroupId": 1
}
```

**说明**：通过 `PublicModeInterceptor` 控制公开模式访问。

### `POST /api/system/docker/action` — Docker 容器操作

**认证**：管理员。

**请求示例**：

```json
{
  "id": "container-id",
  "action": "restart"
}
```

**允许的 action**：`start`、`stop`、`restart`、`pause`、`unpause`。

**说明**：后端通过 Docker CLI 执行操作，部署环境必须具备 Docker 权限。

---

## 变更记录

| 日期 | 变更内容 | 原因 |
|------|----------|------|
| 2026-05-21 | 文件 API 响应补充 `objectKey`、`relativePath`、`mimeType`、`size`、`sha256`、`visibility`、`purpose`、`status` 等字段 | 文件存储模型已切换为对象化资源表 |
| 2026-05-21 | 更新默认后端地址 6521 并补充 `/api/healthz` | 1.0.0 发布整理已统一端口并加入健康检查 |
| 2026-05-20 | 补充站点设置、验证码、公共图库和 Docker 管理 API | PRO 功能开源化第一版已实现 |
| 2026-05-20 | 初始化 API 设计文档 | fork 后建立接口维护基线 |
