# ZPanel

Un panneau de navigation auto-heberge, propre et leger, pour NAS, homelab, serveurs personnels et pages d'accueil de navigateur.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | Français | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

Open source, facile a deployer et sans licence payante.

## Fonctionnalites

- Gestion des elements de navigation et des groupes
- Bascule entre adresses internes et externes
- Multi-comptes, acces public optionnel et changement rapide de compte local
- Personnalisation de l'arriere-plan, de la mise en page, du pied de page, de la page de connexion, du CSS et du JavaScript
- Moteurs de recherche personnalises et captcha de connexion optionnel
- Televersements, galerie publique et exports `.zpanel.json` de navigation/style (sans images, comptes ni configuration des modules)
- Widgets d'etat systeme
- Gestion Docker pour les administrateurs
- Controle d'acces, limites de connexion, en-tetes de securite, health checks et CI

## Demarrage rapide

Creez d'abord le fichier Compose selon le [guide d'installation (anglais)](../README.md#docker-compose), puis executez les commandes dans ce meme repertoire.

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

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## Licence

MIT License. Voir [LICENSE](../LICENSE).
