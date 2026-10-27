# ZPanel

Un pannello di navigazione self-hosted, pulito e leggero, per NAS, homelab, server personali e home page del browser.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | Italiano | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

Open source, facile da distribuire e senza autorizzazioni a pagamento.

## Funzioni

- Gestione di elementi e gruppi di navigazione
- Commutazione tra indirizzi interni ed esterni
- Multi-account, accesso pubblico opzionale e cambio rapido account locale
- Personalizzazione di sfondo, layout, footer, login, CSS e JavaScript
- Motori di ricerca personalizzati e captcha opzionale
- Upload, galleria pubblica ed esportazioni `.zpanel.json` di navigazione/stile (senza immagini, account e configurazioni dei moduli)
- Widget di stato del sistema
- Gestione Docker per amministratori
- Controllo degli accessi, limiti di login, header di sicurezza, health check e CI

## Avvio rapido

Crea prima il file Compose seguendo la [guida di installazione (inglese)](../README.md#docker-compose); esegui i comandi dalla stessa directory.

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

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## Licenza

MIT License. Vedi [LICENSE](../LICENSE).
