# 架构

浏览器 React SPA → /api Go/Gin → GORM/SQLite（或 MySQL）及文件存储；缓存/队列默认内存，可选 Redis。前端静态产物 dist，Docker 放至 /app/web；Hash 路由无需 SPA 路由回退。

前端目录和请求/会话/加载边界见 [前端开发](../docs/frontend.zh-CN.md)。src/app 为路由/主题，features 为业务页，components 为共享交互，lib 为请求/数据，locales 为 i18next。后端 service/api、router、models、initialize 与 lib 保持现有层次。

资源引用按现有 URL/文件 ID 按需扫描，单进程写入互斥；不承诺多副本共享上传目录的一致性。未来数据重构见 14，必须与当前实现区分。
