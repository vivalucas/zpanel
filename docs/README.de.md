# ZPanel

Ein schlankes, selbst gehostetes Navigationspanel fuer NAS, Homelab, private Server und Browser-Startseiten.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | Deutsch | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

Open Source, leicht zu betreiben und ohne kostenpflichtige Freischaltung.

## Funktionen

- Verwaltung von Navigationseintraegen und Gruppen
- Umschaltung zwischen internen und externen Adressen
- Mehrere Konten, oeffentlicher Zugriff und schneller lokaler Kontowechsel
- Anpassbare Hintergruende, Layouts, Footer, Login-Seite, CSS und JavaScript
- Eigene Suchmaschinen und optionales Login-Captcha
- Uploads, oeffentliche Galerie und `.zpanel.json` Exporte fuer Navigation/Stil (ohne Uploads, Konten und Modulkonfiguration)
- Systemstatus-Widgets
- Docker-Verwaltung fuer Administratoren
- Zugriffskontrolle, Login-Limits, Sicherheits-Header, Container-Healthchecks und CI

## Schnellstart

Erstelle zuerst die Compose-Datei nach dem [Installationsleitfaden (Englisch)](../README.md#docker-compose); fuehre die Befehle im gleichen Deployment-Verzeichnis aus.

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

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## Lizenz

MIT License. Siehe [LICENSE](../LICENSE).
