# ZPanel

一個乾淨、輕量的自架導覽面板，適合 NAS、Homelab、個人伺服器和瀏覽器首頁。

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | 繁體中文 | [Русский](README.ru.md)

---

ZPanel 是 [Sun-Panel](https://github.com/hslr-s/sun-panel) MIT 開源版本的獨立 fork。Sun-Panel 和原作者為本專案提供了重要基礎。ZPanel 不是 Sun-Panel 官方專案，也不代表原專案繼續維護。

ZPanel 的目標很簡單：保持輕量、好用、易部署，並預設開放，不引入付費授權系統。圍繞自架使用情境，ZPanel 持續整理與優化前端工程結構、使用者與導覽資料、個人化設定、檔案上傳、Docker 管理和部署流程；同時補強登入驗證碼、存取攔截、權限校驗、登入限流、安全回應標頭、容器健康檢查、CI 品質門檻和專案協作檔案。

## 功能

- 導覽項目和分組管理
- 內網 / 外網地址切換
- 多帳號、公開訪問模式、本地快速切換帳號
- 自訂背景、版面、頁腳、登入頁、CSS 和 JavaScript
- 自訂搜尋引擎和登入圖形驗證碼
- 圖片上傳、公共圖庫、`.zpanel.json` 備份
- 系統狀態元件
- 管理員 Docker 容器管理

## 快速開始

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

```bash
fnm use
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm run dev
```

```bash
cd service
go run main.go
```

## 授權

MIT License。詳見 [LICENSE](../LICENSE)。
