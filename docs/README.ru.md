# ZPanel

Легкая self-hosted панель навигации для NAS, homelab, персональных серверов и стартовой страницы браузера.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | Русский

---

ZPanel — независимый fork MIT-лицензированной open-source версии [Sun-Panel](https://github.com/hslr-s/sun-panel). Sun-Panel и его автор дали этому проекту важную основу. ZPanel не является официальным проектом Sun-Panel.

Цель ZPanel — оставаться легкой, удобной, простой в развертывании и открытой по умолчанию, без платных лицензионных ограничений. Для self-hosted сценариев ZPanel продолжает улучшать структуру фронтенда, данные пользователей и навигации, персонализацию, загрузку файлов, управление Docker и процесс развертывания. Также усилены CAPTCHA при входе, перехват доступа, проверки прав, ограничение частоты попыток входа, security headers, health checks контейнера, CI-контроль качества и файлы для совместной работы над проектом.

## Возможности

- Управление элементами навигации и группами
- Переключение внутренних и внешних адресов
- Несколько аккаунтов, публичный режим и быстрое локальное переключение аккаунтов
- Настройка фона, макета, footer, страницы входа, CSS и JavaScript
- Пользовательские поисковые системы и опциональная CAPTCHA
- Загрузки, публичная галерея и резервные копии `.zpanel.json`
- Виджеты состояния системы
- Управление Docker для администраторов

## Быстрый старт

```bash
docker compose up -d
```

Образ по умолчанию: `ghcr.io/vivalucas/zpanel:latest`

Аккаунт по умолчанию:

```text
Username: admin@zpanel.local
Password: 12345678
```

Смените пароль после первого входа.

Управление Docker требует доступа к Docker socket. Включайте это только в доверенной среде.

## Разработка

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

## Лицензия

MIT License. См. [LICENSE](../LICENSE).
