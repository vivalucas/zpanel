# ZPanel

Um painel de navegacao auto-hospedado, limpo e leve, para NAS, homelab, servidores pessoais e paginas iniciais do navegador.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | Português | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

ZPanel e um fork independente da versao open source licenciada sob MIT do [Sun-Panel](https://github.com/hslr-s/sun-panel). O Sun-Panel e seu autor original forneceram uma base importante para este projeto. ZPanel nao e um projeto oficial do Sun-Panel.

O objetivo do ZPanel e ser leve, agradavel de usar, facil de implantar e aberto por padrao, sem introduzir barreiras de licenca paga. Para cenarios auto-hospedados, o ZPanel continua melhorando a estrutura frontend, os dados de usuarios e navegacao, a personalizacao, os uploads, o gerenciamento Docker e o fluxo de implantacao. O projeto tambem reforca captcha de login, interceptacao de acesso, verificacoes de permissao, limite de tentativas de login, cabecalhos de seguranca, health checks de contêiner, controles de qualidade CI e arquivos de colaboracao.

## Recursos

- Gerenciamento de itens e grupos de navegacao
- Alternancia entre enderecos internos e externos
- Multi-contas, acesso publico opcional e troca rapida de conta local
- Personalizacao de fundo, layout, rodape, login, CSS e JavaScript
- Motores de busca personalizados e captcha opcional no login
- Uploads, galeria publica e backups `.zpanel.json`
- Widgets de status do sistema
- Gerenciamento Docker para administradores

## Inicio rapido

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

## Licenca

MIT License. Veja [LICENSE](../LICENSE).
