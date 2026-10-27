# ZPanel

Un panel de navegacion autoalojado, limpio y ligero, para NAS, homelab, servidores personales y paginas de inicio del navegador.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | Español | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

Codigo abierto, facil de desplegar y sin autorizaciones de pago.

## Funciones

- Gestion visual de elementos y grupos de navegacion
- Cambio entre direcciones internas y externas
- Multiusuario, acceso publico opcional y cambio rapido de cuenta local
- Personalizacion de fondo, diseno, pie de pagina, login, CSS y JavaScript
- Motores de busqueda personalizados y captcha opcional
- Subidas, galeria publica y exportaciones `.zpanel.json` de navegacion/estilo (sin imagenes, cuentas ni configuracion de modulos)
- Widgets de estado del sistema
- Gestion Docker para administradores
- Control de acceso, limites de login, encabezados de seguridad, health checks y CI

## Inicio rapido

Primero crea el archivo Compose siguiendo la [guia de instalacion (ingles)](../README.md#docker-compose); ejecuta los comandos desde ese directorio.

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

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## Licencia

MIT License. Consulta [LICENSE](../LICENSE).
