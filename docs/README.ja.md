# ZPanel

NAS、Homelab、個人サーバー、ブラウザのホームページ向けの、軽量なセルフホスト型ナビゲーションパネルです。

[简体中文](../README.zh-CN.md) | [English](../README.md) | 日本語 | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

導入しやすいオープンソースのパネルで、有料ライセンス制限はありません。

## 主な機能

- ナビゲーション項目とグループの管理
- LAN / WAN アドレス切り替え
- 複数ユーザー、公開アクセスモード、ローカルアカウント切り替え
- 背景、レイアウト、フッター、ログイン画面、CSS / JavaScript のカスタマイズ
- カスタム検索エンジン、ログイン CAPTCHA
- 画像アップロード、公開ギャラリー、ナビゲーション／スタイルの `.zpanel.json` エクスポート（画像・アカウント・モジュール設定は含まれません）
- システム状態ウィジェット
- 管理者向け Docker コンテナ管理
- アクセス・権限制御、ログインレート制限、セキュリティヘッダー、コンテナヘルスチェック、CI

## クイックスタート

先に[インストール手順（英語）](../README.md#docker-compose)で Compose ファイルを作り、同じデプロイ用ディレクトリから実行してください。

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

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## ライセンス

MIT License。詳細は [LICENSE](../LICENSE) を参照してください。
