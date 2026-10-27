# ZPanel

Легкая self-hosted панель навигации для NAS, homelab, персональных серверов и стартовой страницы браузера.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | Русский

---

Простая в развертывании панель с открытым кодом, без платных лицензионных ограничений.

## Возможности

- Управление элементами навигации и группами
- Переключение внутренних и внешних адресов
- Несколько аккаунтов, публичный режим и быстрое локальное переключение аккаунтов
- Настройка фона, макета, footer, страницы входа, CSS и JavaScript
- Пользовательские поисковые системы и опциональная CAPTCHA
- Загрузки, публичная галерея и экспорт навигации/стиля `.zpanel.json` (без изображений, аккаунтов и настроек модулей)
- Виджеты состояния системы
- Управление Docker для администраторов
- Контроль доступа и прав, ограничения входа, security headers, health checks и CI

## Быстрый старт

Сначала создайте Compose-файл по [руководству установки (английский)](../README.md#docker-compose); запускайте команды из того же каталога.

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

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## Лицензия

MIT License. См. [LICENSE](../LICENSE).
