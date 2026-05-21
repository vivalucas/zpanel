# ZPanel

Ein schlankes, selbst gehostetes Navigationspanel fuer NAS, Homelab, private Server und Browser-Startseiten.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Deutsch | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

ZPanel ist ein unabhaengiger Fork der MIT-lizenzierten Open-Source-Version von [Sun-Panel](https://github.com/hslr-s/sun-panel). Sun-Panel und der urspruengliche Autor haben eine wichtige Grundlage fuer dieses Projekt geliefert. ZPanel ist kein offizielles Sun-Panel-Projekt.

ZPanel soll leichtgewichtig, angenehm zu nutzen, einfach zu betreiben und standardmaessig offen sein, ohne bezahlte Lizenzschranken einzufuehren. Fuer Self-Hosting-Szenarien werden Frontend-Struktur, Benutzer- und Navigationsdaten, Personalisierung, Datei-Uploads, Docker-Verwaltung und Deployment-Ablauf weiter aufgeraeumt und verbessert. Dazu kommen Verbesserungen bei Login-Captcha, Zugriffskontrolle, Berechtigungspruefung, Login-Rate-Limiting, Sicherheits-Headern, Container-Healthchecks, CI-Qualitaetspruefungen und Projektdateien fuer die Zusammenarbeit.

## Funktionen

- Verwaltung von Navigationseintraegen und Gruppen
- Umschaltung zwischen internen und externen Adressen
- Mehrere Konten, oeffentlicher Zugriff und schneller lokaler Kontowechsel
- Anpassbare Hintergruende, Layouts, Footer, Login-Seite, CSS und JavaScript
- Eigene Suchmaschinen und optionales Login-Captcha
- Uploads, oeffentliche Galerie und `.zpanel.json` Backups
- Systemstatus-Widgets
- Docker-Verwaltung fuer Administratoren

## Schnellstart

```bash
docker compose up -d
```

Standard-Image: `ghcr.io/vivalucas/zpanel:latest`

Standardkonto:

```text
Username: admin@zpanel.local
Password: 12345678
```

Aendere das Standardpasswort nach dem ersten Login.

Docker-Verwaltung erfordert Zugriff auf den Docker socket. Aktiviere dies nur in einer vertrauenswuerdigen Umgebung.

## Entwicklung

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

## Lizenz

MIT License. Siehe [LICENSE](../LICENSE).
