# ZPanel

NAS、Homelab、個人サーバー、ブラウザのホームページ向けの、軽量なセルフホスト型ナビゲーションパネルです。

[简体中文](../README.zh-CN.md) | [English](../README.md) | 日本語 | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

ZPanel は、MIT ライセンスで公開されている [Sun-Panel](https://github.com/hslr-s/sun-panel) の独立した fork です。Sun-Panel と原作者は、このプロジェクトの重要な基盤を提供しました。ZPanel は Sun-Panel の公式プロジェクトではありません。

ZPanel は、軽量で使いやすく、デプロイしやすく、デフォルトで開かれたパネルを目指し、有料ライセンスゲートを導入しません。セルフホスト用途に向けて、フロントエンド構成、ユーザーとナビゲーションデータ、個人設定、ファイルアップロード、Docker 管理、デプロイ手順を継続的に整理しています。さらに、ログイン CAPTCHA、アクセス制御、権限チェック、ログインレート制限、セキュリティヘッダー、コンテナヘルスチェック、CI 品質ゲート、プロジェクト協作用ファイルも強化しています。

## 主な機能

- ナビゲーション項目とグループの管理
- LAN / WAN アドレス切り替え
- 複数ユーザー、公開アクセスモード、ローカルアカウント切り替え
- 背景、レイアウト、フッター、ログイン画面、CSS / JavaScript のカスタマイズ
- カスタム検索エンジン、ログイン CAPTCHA
- 画像アップロード、公開ギャラリー、`.zpanel.json` バックアップ
- システム状態ウィジェット
- 管理者向け Docker コンテナ管理

## クイックスタート

```bash
docker compose up -d
```

既定のイメージ: `ghcr.io/vivalucas/zpanel:latest`

既定のアカウント:

```text
Username: admin@zpanel.local
Password: 12345678
```

初回ログイン後、必ず既定のパスワードを変更してください。

Docker 管理を有効にする場合は Docker socket のマウントが必要です。これは強い権限を与えるため、信頼できる環境でのみ有効にしてください。

## 開発

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

## ライセンス

MIT License。詳細は [LICENSE](../LICENSE) を参照してください。
