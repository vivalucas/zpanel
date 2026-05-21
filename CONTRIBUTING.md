# Contributing to ZPanel

Thanks for helping improve ZPanel. This project aims to stay lightweight, easy to deploy, and friendly to self-hosted environments.

## Development Setup

Requirements:

- Node.js `24.15.0`
- pnpm `11.1.3`
- Go `1.26.3`

Frontend:

```bash
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm run dev
```

Backend:

```bash
cd service
go run main.go
```

The frontend dev server listens on `http://127.0.0.1:1002` and proxies API requests to `http://127.0.0.1:3002`.

## Quality Checks

Run these before opening a pull request:

```bash
pnpm run type-check
pnpm run lint
pnpm run build
cd service && go test ./...
```

If Go is not installed locally, mention that in the pull request verification notes.

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
