# ZPanel

一個乾淨、輕量的自架導覽面板，適合 NAS、Homelab、個人伺服器和瀏覽器首頁。

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | 繁體中文 | [Русский](README.ru.md)

---

保持輕量、易部署，開源且不設付費授權限制。

## 功能

- 導覽項目和分組管理
- 內網 / 外網地址切換
- 多帳號、公開訪問模式、本地快速切換帳號
- 自訂背景、版面、頁腳、登入頁、CSS 和 JavaScript
- 自訂搜尋引擎和登入圖形驗證碼
- 圖片上傳、公共圖庫、導覽／外觀 `.zpanel.json` 匯出（不含上傳、帳號或模組設定）
- 系統狀態元件
- 管理員 Docker 容器管理
- 存取與權限控制、登入限流、安全回應標頭、容器健康檢查與 CI

## 快速開始

先依[安裝指南（簡體中文）](../README.zh-CN.md#ubuntu-局域网部署推荐)建立 Compose 檔案，再從同一部署目錄執行命令。

```bash
docker compose up -d
```

預設映像：`ghcr.io/vivalucas/zpanel:latest`

預設帳號：

```text
Username: admin@zpanel.local
Password: 12345678
```

首次登入後請立即修改預設密碼。

Docker 管理需要掛載 Docker socket。這會授予較高權限，只建議在可信環境中啟用。

## 本地開發

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## 授權

MIT License。詳見 [LICENSE](../LICENSE)。
