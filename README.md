# ZPanel

A clean, lightweight, self-hosted navigation panel and server homepage for NAS, homelab, personal servers, internal service portals, Docker app entry points, and browser start pages.

[简体中文](README.zh-CN.md) | English | [日本語](docs/README.ja.md) | [한국어](docs/README.ko.md) | [Deutsch](docs/README.de.md) | [Français](docs/README.fr.md) | [Español](docs/README.es.md) | [Português](docs/README.pt-BR.md) | [Italiano](docs/README.it.md) | [繁體中文](docs/README.zh-TW.md) | [Русский](docs/README.ru.md)

---

ZPanel is an independent fork of the MIT-licensed open-source version of [Sun-Panel](https://github.com/hslr-s/sun-panel). Sun-Panel and its original author provided an important foundation for this project. ZPanel is not affiliated with or endorsed by the original project; it is maintained separately for users who want a refreshed self-hosted navigation panel.

The goal is simple: keep the panel lightweight, pleasant to use, easy to deploy, open by default, and free of a paid authorization system. ZPanel continues to refine the frontend architecture, user and navigation data flows, personalization settings, file uploads, Docker management, and deployment workflow. It also adds practical hardening and maintainability work around login captcha, access interception, permission checks, login rate limiting, security headers, container health checks, CI quality gates, and project collaboration files.

---

Keywords: self-hosted dashboard, NAS dashboard, homelab dashboard, personal server homepage, Docker management panel, internal service navigation, browser homepage.

## Why ZPanel

- **Simple deployment**: start with Docker Compose, use SQLite by default, and persist configuration, uploads, and database files in local directories.
- **Built for real self-hosting**: LAN / WAN URL switching, optional public access, multiple users, fast local account switching, uploads, and system status widgets.
- **Highly customizable**: background, blur, mask, icon style, layout width, footer, site title, login page, custom CSS, and custom JavaScript can be adjusted from the UI.
- **Maintenance friendly**: health checks, CI, dependency update configuration, PR / Issue templates, contribution guide, and security policy are included.
- **Clearer security posture**: login captcha, login rate limiting, permission interception, and security headers are built in; high-privilege features such as Docker socket access, public mode, and custom JavaScript are documented explicitly.

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
- Optional login captcha
- Dark / light / auto theme and multilingual UI

**Users and data**

- Multi-account user management
- Fast local account switching
- Per-user navigation data isolation
- Import / export for navigation items and style configuration
- ZPanel native `.zpanel.json` backup files
- Administrator-controlled public access user

**Files and media**

- Upload manager for icons and wallpapers
- Public gallery view for uploaded images
- Set uploaded images as wallpaper

**System and Docker**

- System status widgets
- CPU, memory, and disk status display
- Docker cards and container stats snapshots
- Docker application management for administrators: container list, stats snapshot, start, stop, restart, pause, unpause, and logs

**Engineering and security**

- Login captcha, login rate limiting, permission interception, and security headers
- Docker / Compose health check endpoint: `GET /api/healthz`
- GitHub Actions checks for frontend and backend quality
- Dependabot, Issue templates, PR template, contribution guide, and security policy

---

## Screenshots

ZPanel is still refreshing its own branding, screenshots, and documentation assets. New screenshots will be added after the first ZPanel release build is verified.

---

## Quick Start

### Docker Compose

For a complete, copy-and-paste Ubuntu LAN deployment walkthrough—including Docker installation, choosing the correct LAN IP, firewall caveats, verification, upgrades, backups, password recovery, and troubleshooting—see [Ubuntu 局域网部署（简体中文）](README.zh-CN.md#ubuntu-局域网部署推荐).

The example below is intentionally bound to `127.0.0.1` for reverse-proxy deployments. It is **not reachable from another device on your LAN**. For direct LAN access, bind the published port to the Ubuntu host's actual LAN IP, for example `192.168.1.50:6521:6521`; replace that address with your own.

Create a `docker-compose.yml` file:

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

Then start ZPanel:

```bash
docker compose pull
docker compose up -d
```

Default image:

```text
vivalucas/zpanel:latest
```

Default port:

```text
6521
```

Default persistent directories:

```text
./conf
./data
```

For direct LAN access, prefer a specific host mapping such as `192.168.1.50:6521:6521`. Using `6521:6521` listens on all host interfaces, which may include interfaces outside your trusted LAN. For public internet access, keep the service bound to `127.0.0.1` and put HTTPS and access controls in front of it with Nginx, Caddy, Traefik, or a similar reverse proxy.

### Releases

Version tags create GitHub Releases with release notes, Linux amd64 deployment packages, and `SHA256SUMS`. The Docker image is still the recommended deployment artifact for most users:

- `ghcr.io/vivalucas/zpanel:<version>`
- `vivalucas/zpanel:<version>`

`latest` points to the most recently published stable image. If you need repeatable rollbacks, use an explicit version tag such as `vivalucas/zpanel:1.1.4`.

Health check endpoint:

```text
GET /api/healthz
```

Default account:

```text
Username: admin@zpanel.local
Password: 12345678
```

Change the default password after the first login.

Custom CSS / JS recovery:

```text
http://your-zpanel-host/?safeMode=1
```

Safe mode skips custom CSS and custom JavaScript for the current page load, so you can sign in and remove a broken customization from settings. `?zpanelSafeMode=1` is also supported.

### Docker Management

Docker management is optional. If ZPanel runs inside a container and you want it to manage host containers, mount the Docker socket:

```yaml
services:
  zpanel:
    group_add:
      - "${DOCKER_GID}"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

On most Linux hosts, the socket is owned by the host Docker group. Set `DOCKER_GID` before starting the container:

```bash
echo "DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)" > .env
docker compose up -d
```

If your environment cannot use `group_add`, the less isolated fallback is to run the container as root:

```yaml
services:
  zpanel:
    user: "0:0"
```

The official image includes `docker-cli`, and Docker management works by running `docker` commands inside the container against the mounted host socket. This gives ZPanel high-level control over Docker on the host. Only enable it in a trusted environment and keep the administrator account secure.

---

## Use Cases

- A unified homepage for NAS, routers, mini PCs, and home servers
- Homelab service navigation for Jellyfin, qBittorrent, Home Assistant, Git, monitoring tools, and more
- Internal service directory for teams or small organizations
- Personal browser homepage and bookmark dashboard
- Read-only public navigation page for sharing selected links
- Lightweight Docker container management entry point for trusted self-hosted environments

---

## Local Development

Frontend requirements:

- Node.js `24.15.0`
- pnpm `11.1.3`

```bash
fnm use
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm run dev
```

Backend requirements:

- Go `1.26.3`

```bash
cd service
go run main.go
```

By default, the frontend dev server listens on `http://127.0.0.1:1002` and proxies API requests to the backend at `http://127.0.0.1:6521/`.

---

## Quality Checks

```bash
pnpm run type-check
pnpm run lint
pnpm run build
cd service && go test ./...
```

GitHub Actions runs the same frontend and backend checks on pull requests and pushes to the main branches.

---

## Build

```bash
pnpm run build
```

Backend binary build:

```bash
cd service
go build -o zpanel --ldflags="-X zpanel/global.RUNCODE=release" main.go
```

---

## Project Status

ZPanel has completed its initial fork cleanup and a broad engineering pass across product behavior, deployment, security posture, and repository standards. Frontend type-check, lint, production build, backend tests, and backend release build are expected to pass before release.

Still pending before a polished release:

- New ZPanel logo, screenshots, and release assets
- Security review for custom JS / CSS, Docker socket access, and public gallery behavior

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, quality checks, commit style, and pull request expectations.

Security reports should follow [SECURITY.md](./SECURITY.md).

---

## Roadmap

- Finish backend build and full local integration verification
- Refresh screenshots, logo, favicon, and documentation assets
- Add safer recovery paths for custom CSS / JS misconfiguration
- Improve Docker management UX and deployment documentation
- Explore plugin, widget, and application-center ideas for future versions

---

## Fork Notice

ZPanel is based on the MIT-licensed open-source version of [Sun-Panel](https://github.com/hslr-s/sun-panel). It is an independent project, not an official continuation, and now evolves around ZPanel's own self-hosted product direction.

---

## License

MIT License. See [LICENSE](./LICENSE).
