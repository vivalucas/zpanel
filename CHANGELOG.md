# Changelog

All notable changes to ZPanel will be documented in this file.

## Unreleased

## 1.0.3 - 2026-05-24

- Hardened markdown rendering by disabling raw HTML execution in result content.
- Improved navigation and sorting guards to avoid unsafe ID and URL assertions.
- Tightened module configuration and request helper types by replacing broad `any` usage with `unknown`.
- Fixed user edit form state reuse so add/edit dialogs always start from a fresh model.

## 1.0.2 - 2026-05-23

- Fixed third-round stability issues found during project review.
- Improved startup failure handling for database migration and default administrator initialization.
- Made login rate-limit errors use the standard API error-code flow.
- Hardened home-page initialization, user-info refresh, password-change logout behavior, and system-monitor configuration editing.
- Fixed inconsistent `VueDraggable` closing tags in home and system-monitor views.

## 1.0.1 - 2026-05-21

- Published a clean patch release after validating the new GitHub Release workflow.
- Added a GitHub Release workflow that publishes release notes, deployable Linux amd64 packages, and SHA256 checksums for version tags.

## 1.0.0 - 2026-05-21

- Standardized repository metadata, GitHub templates, CI, dependency updates, and security policy.
- Added a health check endpoint for deployments: `GET /api/healthz`.
- Improved Docker and Docker Compose health check configuration.
- Cleaned editor-specific files, unused development routes, and legacy configuration leftovers.
- Refined README content for users, self-hosted deployment scenarios, and project discoverability.

## Initial ZPanel Cleanup - 2026-05-21

- Initialized ZPanel as an independent fork.
- Renamed user-facing project identity, build artifacts, and container defaults to ZPanel / zpanel.
- Switched planned container publishing to GitHub Container Registry.
- Removed legacy upstream links from the active product surface.
