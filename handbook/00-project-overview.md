# 项目概述

ZPanel 是基于 MIT 许可 Sun-Panel 独立维护的自托管导航面板，面向个人服务器、NAS 与 Homelab。保留上游版权归属；独立 GitHub 仓库不改变代码来源。支持分组导航、多账号/公开访问、内外网切换、监控、图片图库、配置导入导出和管理员 Docker 管理。

当前 1.2.1：React + TypeScript + Vite + Ant Design，TanStack Query 管服务端数据，Zustand 管浏览器偏好/会话；Go 1.26.3 + Gin/GORM，默认 SQLite 和内存缓存，可选 MySQL/Redis。锁文件和清单是工具链依据。

不承诺兼容上游闭源/旧配置，不复制闭源授权系统。默认单实例部署；Docker 功能需要明确宿主机权限。前端 Vue/Pinia/Naive UI 已移除，不继续维护两套实现。
