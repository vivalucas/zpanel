# API 设计

## 契约来源与认证

Gin 接口统一挂载 `/api`。完整方法、路径和中间件以 [router](../service/router) 为准，前端调用/类型见 [api.ts](../src/lib/api.ts)；本文只维护特殊语义，避免再手抄一份不完整接口清单。开发代理和后端默认地址见 [07](07-environment.md)。

- `LoginInterceptor`：需要登录的接口；请求头 `token` 传会话。
- `PublicModeInterceptor`：公开模式下可读的面板数据；未公开时仍需登录。
- `AdminInterceptor`：管理员接口；前端隐藏入口不能替代服务端权限。
- 会话撤销、账号状态/角色及安全配置直接读数据库，避免 Redis 失效删除失败留下旧权限。用户列表及公开账号选择仅返回必要资料，不含密码 hash、算法或 session token。

常规响应为 `{code,msg,data}`，`code=0` 成功；前端不能只按 HTTP 状态判断。常用业务码如下，完整文案以 [locales](../src/locales) 为准。

| code | 语义 |
| --- | --- |
| 1000 | 未登录 |
| 1003 | 用户名或密码错误 |
| 1004 | 账号停用或未激活 |
| 1005 | 无权限 |
| 1006 | 账号不存在 |
| 1200 | 数据库错误 |
| 1201 | 至少保留一个启用管理员或一个分组等业务保护 |
| 1300 | 上传失败 |
| 1400 | 参数格式错误 |
| 2001 | 需要验证码或验证码错误 |

## 登录、验证码与站点设置

- `GET /api/healthz` 无需认证，直接返回 `{"status":"ok"}`，供容器与 CI 使用。
- `POST /api/login` 无需认证，接收 `{username,password,vcode?,email?}`，成功 `data={token}`。验证码开启时，`vcode` 为答案，历史字段 `email` 实际传 `captchaId`，不能擅自重命名。登录密码上限 72 UTF-8 字节，新密码为 6–72 字节（bcrypt 边界）。安全配置读取失败返回 1200，不回落为关闭验证码；密码更新/登出须在 session 撤销成功后才报告成功。
- `GET /api/openness/loginConfig` 无参数，公开返回登录/注册、验证码及站点展示配置。
- `GET /api/captcha/getImageByCaptchaId/:id/:width/:height` 生成 PNG，答案按前端生成的 id 缓存。width 为 80–320、height 为 30–120，越界分别回落 120/40；独立每 IP 每分钟限 30 次。可信代理配置见 [部署指南](../docs/deployment.zh-CN.md#反向代理)。
- `POST /api/system/siteSetting/get` 需登录，返回 `siteSetting` 与 `loginCaptcha`；`set` 仅管理员。字段为 `siteTitle/siteIcon/loginTitle/loginSubtitle/loginFooter/customCss/customJs/loginCaptcha`；站点配置与验证码开关同事务保存，失败无部分写入，保留其他应用配置。
- `POST /api/panel/users/getPublicVisitUser` 仍仅管理员，返回 `id/username/name`；角色编辑/删除不能移除最后一个启用管理员（1201）。原子性与数据锁见 [05](05-data-design.md)。

## 导航、配置与导入

下列相对路径均在 `/api/panel/` 下，使用 POST；导航读取走公开模式拦截，写入需登录。

| 路径 | 特殊契约 |
| --- | --- |
| `itemIcon/getListByGroupId` | 请求 `{itemIconGroupId}`，保留既有按组读取入口 |
| `itemIconGroup/getNavigation` | 请求 `{}`，`data` 为含 `items` 的分组数组；归属/顺序与旧接口相同，旧接口保留；正常已有数据用两次业务查询，不随分组增加请求 |
| `itemIconGroup/edit` | 只绑定 `id/icon/title/description/sort`，归属由服务端确定，不绑定 ORM 关联 |
| `itemIconGroup/deletes` | `{ids,moveToGroupId?}`；迁移目标须为本人且不在删除范围。无目标时删除组内应用，有目标时同事务迁移；删除最后一组返回 1201 |
| `userConfig/set` | 只接收 `panel` 和可选 `searchEngine`，按当前账号写入；校验已知样式字段类型/范围，保留扩展字段 |
| `userConfig/get` | 旧配置损坏可返回 `panelWarnings`，读取不修复数据库；恢复行为见 [05](05-data-design.md) |

项目/分组标题为 1–200 个 Unicode 字符；项目 `url/lanUrl` 至少一个有效，`openMethod` 为 1/2/3。编辑/批量新增拒绝脚本、data、file 等非 HTTP(S) 协议。

`POST /api/panel/userConfig/import` 需登录：`requestId` 为 16–64 字符，重试复用；`mode=append/replace`，可选 `icons`（分组的 `title/sort/children`）和 `panel`，至少选一项。请求最多 5 MiB、500 分组、10000 图标，覆盖图标至少一组。忽略输入的实体 ID、归属和 ORM 关联，全部归当前账号；同 ID 不同内容拒绝。收据与导入同事务，失败无部分写入，见 [05](05-data-design.md)。

访客监控要求公开账号的 `systemMonitorShow` 和 `systemMonitorPublicVisitModeShow` 均为 true；未开或配置损坏返回 1005，数据库失败为 1200，已登录用户沿用原监控权限。

## 文件与派生展示

所有 `/api/file/*` 需登录，[路由](../service/router/system/file.go)、[响应字段](../service/api/api_v1/system/file.go)为实现来源。列表保留 `src/fileName/userId/path` 等旧字段及对象化元数据，`src` 始终为原图 URL。公共图库可显示他人公开活动文件，不增加删除权限。

### 图片上传与内容去重

- `POST /api/file/uploadImg`：multipart `imgfile`，返回 `{fileId,imageUrl}`。
- `POST /api/file/uploadFiles`：multipart `files[]`，返回 `{succMap,errFiles}`，仍按本次上传文件名索引结果。

两入口完整接收后共用查重，不提供上传前秒传。实际大小/SHA256 相同，且属于当前账号、local 存储、public 可见、attachment 用途的活动文件，经磁盘常规文件/大小/内容校验后复用原 ID/URL、首次名称与时间，不新增图库记录或上传对象。改名不影响判断；跨账号、其他可见性/用途/存储/状态、软删、缺失、损坏及空指纹历史记录不复用，历史重复不自动合并清理。

指纹校验后才创建新文件；查询失败不落盘，记录创建失败清理本次文件。上传解析/指纹在锁前完成，复用/创建与删除/引用写入共用单进程锁，多实例共享上传目录无一致性保证。实现见 [file_upload.go](../service/api/api_v1/system/file_upload.go)。

### 缩略图

列表可选 `thumbnailSrc` 为原 `/uploads/...` URL 加 `?thumbnail=1`，沿用原有公开上传可读范围。惰性派生最长边 320px：只处理 10 MiB、16MP、最长边 16384 内且缩小有收益的 PNG/JPEG，透明输出 PNG，其余 JPEG。GIF/SVG/ICO/APNG、需 EXIF 旋转的 JPEG、无收益或失败均回原图。

WebP 不提供 `thumbnailSrc`，带缩略图参数也回原字节，禁止服务端派生解码；上传、原 URL 和浏览器展示保留。像素限制不能约束 WebP Huffman 元数据分配，伪装扩展名和旧派生缓存也不得绕过此边界。源文件变化使缓存失效，删除时清派生；缓存可重建，无数据库变更。实现与安全回归见 [thumbnail.go](../service/lib/storage/thumbnail.go)、[thumbnail_test.go](../service/lib/storage/thumbnail_test.go)、[uploads_test.go](../service/router/uploads_test.go)。

### 引用查询、替换与删除

- `POST /api/file/usage`：`{id}`，仅本人或公共活动文件。返回 `{kind,id,title}[]`，kind 为 `icon/wallpaper/avatar/module/site/reference`；他人引用的 id/title 隐去，管理员可看站点引用。
- `POST /api/file/replace`：`{id,replacementId}`，不同 ID，源须为本人活动文件，目标为本人或公共活动文件。同事务只改本人引用，管理员额外改站点；他人引用不变，原文件保留。
- `POST /api/file/deletes`：只删本人活动文件，先核对当前业务引用；返回 `{deletedIds,failedIds}`，不能以 HTTP 成功视为全部删除成功。引用扫描与软删除兼容见 [05](05-data-design.md)。

## Docker 操作

`/api/system/docker/{containers,stats,action,logs}` 均为 POST、仅管理员，通过宿主机 Docker CLI 执行。`action` 请求 `{id,action}`，动作限 `start/stop/restart/pause/unpause`。请求最长 30 秒、输出最多 2 MiB；超时须刷新核实状态，不自动重试变更。部署需 Docker 权限，见 [指南](../docs/deployment.zh-CN.md#排障)。
