# ZPanel

A clean, lightweight, self-hosted navigation panel and server homepage for NAS, homelab, personal servers, internal service portals, Docker app entry points, and browser start pages.

[简体中文](README.zh-CN.md) | English | [日本語](docs/README.ja.md) | [한국어](docs/README.ko.md) | [Deutsch](docs/README.de.md) | [Français](docs/README.fr.md) | [Español](docs/README.es.md) | [Português](docs/README.pt-BR.md) | [Italiano](docs/README.it.md) | [繁體中文](docs/README.zh-TW.md) | [Русский](docs/README.ru.md)

MIT-licensed and open by default, with no paid authorization system.

<a id="why-zpanel"></a>
<a id="use-cases"></a>

## Features

**Navigation and service portal**

- Visual management for navigation items and groups
- Internal / external network address switching
- Multiple open methods, including current page, new window, and panel modal
- Icon upload, favicon fetching, image icons, text icons, and Iconify icons
- Drag sorting, context actions, and frontend navigation-item search
- Optional public access mode for sharing a read-only panel

**Personalization**

- Custom background, blur, mask, layout width, margins, and footer
- Custom site title, site icon, login title, login subtitle, and login footer
- Online custom CSS and JavaScript editing
- Custom search engines without artificial limits
- Dark / light / auto theme and multilingual UI

**Users and data**

- Multi-account user management
- Fast local account switching
- Per-user navigation data isolation
- Import / export for navigation items and style configuration
- ZPanel native `.zpanel.json` migration files; uploaded images, accounts and module settings require separate backup
- Administrator-controlled public access user

**Files and media**

- Upload manager for icons and wallpapers
- Public gallery view for uploaded images
- Set uploaded images as wallpaper

**System and Docker**

- System status widgets for CPU, memory and disk
- Docker cards and container stats snapshots
- Docker application management for administrators: container list, stats snapshot, start, stop, restart, pause, unpause, and logs

**Engineering and security**

- Optional login captcha, login rate limiting, permission interception, and security headers
- Docker / Compose health check endpoint: `GET /api/healthz`
- GitHub Actions checks for frontend and backend quality
- Issue templates, PR template, contribution guide, and security policy

---

## Screenshots

ZPanel is still refreshing its own branding, screenshots, and documentation assets. New screenshots are still pending; see [current status](handbook/01-current-status.md) for release and deployment facts.

---

## Quick Start

### Docker Compose

Install Docker Engine and Compose first; the [Ubuntu LAN walkthrough (Chinese)](README.zh-CN.md#ubuntu-局域网部署推荐) covers installation, IP selection and firewall checks.

This example binds `127.0.0.1` for a host reverse proxy and is **unreachable from other LAN devices**. For direct LAN access, replace the host address with your actual LAN IP, e.g. `192.168.1.50:6521:6521`. A bare `6521:6521` listens on all interfaces, which may include untrusted networks. For internet access, keep loopback binding and use HTTPS plus access controls through Nginx, Caddy, Traefik or another reverse proxy.

Create and enter an empty deployment directory. Save this as `docker-compose.yml`; run all following Compose commands there:

SQLite is the default and needs no external database. Keep both mounts below to persist configuration, the database and uploads across container recreation.

```yaml
services:
  zpanel:
    image: vivalucas/zpanel:latest
    container_name: zpanel
    volumes:
      - ./conf:/app/conf
      - ./data:/app/data
    ports:
      - "127.0.0.1:6521:6521"
    restart: always
```

```bash
docker compose pull
docker compose up -d
```

Check `GET /api/healthz` for `{"status":"ok"}`, then sign in with `admin@zpanel.local` / `12345678` and change the password. The health response alone does not verify login or data persistence.

For broken custom CSS/JS, open `http://your-zpanel-host/?safeMode=1` (also `?zpanelSafeMode=1`). This skips custom code for the current page load so you can sign in and remove it from settings. See [configuration, persistence, upgrades and recovery](docs/deployment.md) before changing paths or upgrading.

### Releases

Version tags produce GitHub Releases with notes, Linux amd64 packages and `SHA256SUMS`. Docker is recommended; both registries publish `vivalucas/zpanel:<version>` and `ghcr.io/vivalucas/zpanel:<version>`. Pin a version such as `1.2.11` for repeatable rollback; `latest` follows the last stable image. A `main` push does not publish images: verify the [container workflow](https://github.com/vivalucas/zpanel/actions/workflows/container-ghcr.yml).

### Docker Management

Docker management is optional. If ZPanel runs inside a container and you want it to manage host containers, edit the existing service as follows. Keep both persistent directory mounts:

```yaml
services:
  zpanel:
    group_add:
      - "${DOCKER_GID}"
    volumes:
      - ./conf:/app/conf
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
```

On most Linux hosts, the socket is owned by the host Docker group. Set `DOCKER_GID` before starting the container:

```bash
stat -c '%g' /var/run/docker.sock
nano .env
```

Add or update `DOCKER_GID=<the number printed above>` in `.env`, preserving other settings. Then run `docker compose up -d`. Use `sudo` for Docker commands if required on your host. Do not use `user: "0:0"` as a workaround: the image entrypoint always drops privileges to the `zpanel` user.

The entrypoint preserves the mounted socket's group for `zpanel` when that GID is already in the container's startup group list; use `group_add` above to pass the host GID. Other startup groups are not copied. Large Linux GIDs are supported. If this optional setup fails, the site still starts and logs a warning; Docker management remains unavailable until its permissions are corrected.

Version 1.2.7 includes this fix. When upgrading from 1.2.6, remove any temporary entrypoint bind mount so the new image can use its built-in script. If continuing to run 1.2.6 with an updated script mounted read-only at `/app/docker-entrypoint.sh`, run `chmod +x docker-entrypoint.sh` before mounting it.

Verify access as the actual service user with `docker compose exec zpanel su-exec zpanel docker version`.

The official image includes `docker-cli`, and Docker management works by running `docker` commands inside the container against the mounted host socket. This gives ZPanel high-level control over Docker on the host. Only enable it in a trusted environment and keep the administrator account secure.

---

## Local Development

Use the fixed Node.js/pnpm/Go toolchain, setup commands and production build instructions in [CONTRIBUTING.md](CONTRIBUTING.md#development-setup). The frontend uses React + TypeScript + Vite + Ant Design; see [the frontend guide](docs/frontend.zh-CN.md) for architecture and UI conventions.

## Quality Checks

Run the [quality checks](CONTRIBUTING.md#quality-checks) for the affected paths. Browser regression uses a production build and an isolated Go/SQLite service. CI runs on pull requests and pushes to `main`; test results and coverage limits are recorded in [current status](handbook/01-current-status.md).

## Build

See [build commands and packaging requirements](CONTRIBUTING.md#build).

## Project Status

[Current status](handbook/01-current-status.md) separates source changes, published artifacts, production deployment and verification gaps. New branding/screenshots remain incomplete; external platform and integration coverage must be checked there before relying on a result.

Further security review for custom CSS/JS, Docker socket access and public gallery behavior remains pending. Existing permission and hardening boundaries are recorded in [design decisions](handbook/11-decisions.md#管理员能力与安全数据边界).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, quality checks, commit style, and pull request expectations.

Security reports should follow [SECURITY.md](./SECURITY.md).

---

## Roadmap

Active and deferred work is maintained in [the current plan](handbook/09-current-plan.md). Plugin, widget and application-center ideas remain exploratory and are not implementation commitments.

---

## License

MIT License. See [LICENSE](./LICENSE).

## 开发文档

项目规则见 [AGENTS.md](AGENTS.md)，开发导航见 [handbook/README.md](handbook/README.md)。
