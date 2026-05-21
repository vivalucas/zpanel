# ZPanel

Un panel de navegacion autoalojado, limpio y ligero, para NAS, homelab, servidores personales y paginas de inicio del navegador.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | Español | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

ZPanel es un fork independiente de la version open source con licencia MIT de [Sun-Panel](https://github.com/hslr-s/sun-panel). Sun-Panel y su autor original proporcionaron una base importante para este proyecto. ZPanel no es un proyecto oficial de Sun-Panel.

ZPanel busca ser ligero, agradable de usar, facil de desplegar y abierto por defecto, sin introducir barreras de licencia de pago. Para escenarios autoalojados, ZPanel sigue mejorando la estructura frontend, los datos de usuarios y navegacion, la personalizacion, las subidas de archivos, la gestion Docker y el flujo de despliegue. Tambien refuerza el captcha de login, la interceptacion de acceso, las comprobaciones de permisos, la limitacion de intentos de login, los encabezados de seguridad, los health checks de contenedor, las puertas de calidad CI y los archivos de colaboracion del proyecto.

## Funciones

- Gestion visual de elementos y grupos de navegacion
- Cambio entre direcciones internas y externas
- Multiusuario, acceso publico opcional y cambio rapido de cuenta local
- Personalizacion de fondo, diseno, pie de pagina, login, CSS y JavaScript
- Motores de busqueda personalizados y captcha opcional
- Subidas, galeria publica y copias `.zpanel.json`
- Widgets de estado del sistema
- Gestion Docker para administradores

## Inicio rapido

```bash
docker compose up -d
```

Imagen por defecto: `ghcr.io/vivalucas/zpanel:latest`

Cuenta por defecto:

```text
Username: admin@zpanel.local
Password: 12345678
```

Cambia la contrasena tras el primer inicio de sesion.

La gestion Docker requiere acceso al socket de Docker. Usala solo en entornos de confianza.

## Desarrollo

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

## Licencia

MIT License. Consulta [LICENSE](../LICENSE).
