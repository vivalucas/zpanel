# ZPanel

Um painel de navegacao auto-hospedado, limpo e leve, para NAS, homelab, servidores pessoais e paginas iniciais do navegador.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | Português | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

Codigo aberto, facil de implantar e sem licenca paga.

## Recursos

- Gerenciamento de itens e grupos de navegacao
- Alternancia entre enderecos internos e externos
- Multi-contas, acesso publico opcional e troca rapida de conta local
- Personalizacao de fundo, layout, rodape, login, CSS e JavaScript
- Motores de busca personalizados e captcha opcional no login
- Uploads, galeria publica e exportacoes `.zpanel.json` de navegacao/estilo (sem imagens, contas e configuracao dos modulos)
- Widgets de status do sistema
- Gerenciamento Docker para administradores
- Controle de acesso, limites de login, cabecalhos de seguranca, health checks e CI

## Inicio rapido

Primeiro crie o arquivo Compose seguindo o [guia de instalacao (ingles)](../README.md#docker-compose); execute os comandos no mesmo diretorio.

```bash
docker compose up -d
```

Imagem padrao: `ghcr.io/vivalucas/zpanel:latest`

Conta padrao:

```text
Username: admin@zpanel.local
Password: 12345678
```

Altere a senha padrao apos o primeiro login.

O gerenciamento Docker requer acesso ao Docker socket. Ative apenas em ambientes confiaveis.

## Desenvolvimento

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## Licenca

MIT License. Veja [LICENSE](../LICENSE).
