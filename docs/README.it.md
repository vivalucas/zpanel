# ZPanel

Un pannello di navigazione self-hosted, pulito e leggero, per NAS, homelab, server personali e home page del browser.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | Italiano | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

ZPanel e un fork indipendente della versione open source con licenza MIT di [Sun-Panel](https://github.com/hslr-s/sun-panel). Sun-Panel e il suo autore originale hanno fornito una base importante per questo progetto. ZPanel non e un progetto ufficiale Sun-Panel.

ZPanel punta a essere leggero, piacevole da usare, facile da distribuire e aperto per impostazione predefinita, senza introdurre barriere di licenza a pagamento. Per scenari self-hosted, ZPanel continua a migliorare struttura frontend, dati utente e di navigazione, personalizzazione, upload, gestione Docker e flusso di deployment. Il progetto rafforza anche captcha di login, intercettazione degli accessi, controlli dei permessi, rate limiting del login, header di sicurezza, health check dei container, controlli di qualita CI e file di collaborazione.

## Funzioni

- Gestione di elementi e gruppi di navigazione
- Commutazione tra indirizzi interni ed esterni
- Multi-account, accesso pubblico opzionale e cambio rapido account locale
- Personalizzazione di sfondo, layout, footer, login, CSS e JavaScript
- Motori di ricerca personalizzati e captcha opzionale
- Upload, galleria pubblica e backup `.zpanel.json`
- Widget di stato del sistema
- Gestione Docker per amministratori

## Avvio rapido

```bash
docker compose up -d
```

Immagine predefinita: `ghcr.io/vivalucas/zpanel:latest`

Account predefinito:

```text
Username: admin@zpanel.local
Password: 12345678
```

Cambia la password predefinita dopo il primo accesso.

La gestione Docker richiede accesso al socket Docker. Abilitala solo in ambienti attendibili.

## Sviluppo

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

## Licenza

MIT License. Vedi [LICENSE](../LICENSE).
