# ZPanel

Un panneau de navigation auto-heberge, propre et leger, pour NAS, homelab, serveurs personnels et pages d'accueil de navigateur.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | Français | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

ZPanel est un fork independant de la version open source sous licence MIT de [Sun-Panel](https://github.com/hslr-s/sun-panel). Sun-Panel et son auteur original ont fourni une base importante pour ce projet. ZPanel n'est pas un projet officiel Sun-Panel.

ZPanel vise a rester leger, agreable a utiliser, facile a deployer et ouvert par defaut, sans introduire de barriere de licence payante. Pour les usages auto-heberges, ZPanel continue d'ameliorer la structure frontend, les donnees utilisateur et de navigation, la personnalisation, les televersements, la gestion Docker et le flux de deploiement. Le projet renforce aussi le captcha de connexion, l'interception des acces, les controles de permission, la limitation des tentatives de connexion, les en-tetes de securite, les health checks de conteneur, les controles CI et les fichiers de collaboration.

## Fonctionnalites

- Gestion des elements de navigation et des groupes
- Bascule entre adresses internes et externes
- Multi-comptes, acces public optionnel et changement rapide de compte local
- Personnalisation de l'arriere-plan, de la mise en page, du pied de page, de la page de connexion, du CSS et du JavaScript
- Moteurs de recherche personnalises et captcha de connexion optionnel
- Televersements, galerie publique et sauvegardes `.zpanel.json`
- Widgets d'etat systeme
- Gestion Docker pour les administrateurs

## Demarrage rapide

```bash
docker compose up -d
```

Image par defaut : `ghcr.io/vivalucas/zpanel:latest`

Compte par defaut :

```text
Username: admin@zpanel.local
Password: 12345678
```

Changez le mot de passe apres la premiere connexion.

La gestion Docker necessite l'acces au socket Docker. Activez-la uniquement dans un environnement de confiance.

## Developpement

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

## Licence

MIT License. Voir [LICENSE](../LICENSE).
