# Contributing to ZPanel

Thanks for helping improve ZPanel. This project aims to stay lightweight, easy to deploy, and friendly to self-hosted environments.

## Development Setup

Requirements:

- Node.js `24.15.0`
- pnpm `11.1.3`
- Go `1.26.3`

Frontend: React + TypeScript + Ant Design. See [frontend architecture and UI conventions](docs/frontend.zh-CN.md). Toolchain sources and configuration semantics are maintained in [Environment and machine handoff](handbook/07-environment.md).

Run from the repository root:

```bash
fnm use
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm run dev
```

In another terminal, from the repository root:

```bash
cd service
go run main.go
```

The frontend is available at `http://127.0.0.1:1002` and proxies API/uploads to `http://127.0.0.1:6521`. Vite binds all interfaces by default.

## Quality Checks

From the repository root, run checks appropriate to the change before opening a pull request:

```bash
pnpm run type-check
pnpm run lint
pnpm test
pnpm run test:review
pnpm run build
python3 scripts/docker-entrypoint-test.py
pnpm exec playwright install chromium
pnpm run test:e2e
cd service && go test ./...
```

Browser tests require Go and run the production build against a disposable SQLite database on port `16521`. They never target the development database. Docker success paths use mocked API responses; the test server cannot access the developer's Docker context. Add a regression test for changed data flows and error recovery, and distinguish mocked checks from real integrations in the PR.

The entrypoint checks use disposable paths and mocked operating-system commands, including large Docker socket GIDs and optional setup failures. They do not contact Docker; also verify the resulting service UID/groups in an isolated Linux container before release.

If Go is not installed locally, mention that in the pull request verification notes.

## Build

`pnpm run build` checks matching frontend/backend versions and produces `dist/`. For a backend release binary, run from the repository root:

```bash
cd service
go build -o zpanel --ldflags="-X zpanel/global.RUNCODE=release" main.go
```

The binary also needs the packaged frontend and runtime directories; deployment is covered in [the operations guide](docs/deployment.md#binary-packages).

## Pull Request Guidelines

- Keep changes focused and easy to review.
- Include screenshots or recordings for visible UI changes.
- Update README or docs when setup, deployment, or behavior changes.
- Avoid committing generated local data such as `conf`, `database`, `uploads`, `runtime`, or `dist`.

## Commit Style

This repository uses Conventional Commits through commitlint. Common prefixes include:

- `feat:` for user-facing features
- `fix:` for bug fixes
- `docs:` for documentation-only changes
- `chore:` for maintenance
- `refactor:` for behavior-preserving code changes
- `test:` for tests
