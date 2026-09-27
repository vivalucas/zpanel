# 项目概述

ZPanel 是独立维护的自托管导航面板，采用 MIT 许可证，面向个人服务器、NAS 与 Homelab。支持分组导航、多账号/公开访问、内外网切换、监控、图片图库、配置导入导出和管理员 Docker 管理。

当前 1.2.1：React + TypeScript + Vite + Ant Design，TanStack Query 管服务端数据，Zustand 管浏览器偏好/会话；Go 1.26.3 + Gin/GORM，默认 SQLite 和内存缓存，可选 MySQL/Redis。锁文件和清单是工具链依据。

只维护 ZPanel 自身的配置格式和公开功能，不引入闭源授权系统。默认单实例部署；Docker 功能需要明确宿主机权限。前端 Vue/Pinia/Naive UI 已移除，不继续维护两套实现。
