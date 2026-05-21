# Changelog

All notable changes to ZPanel will be documented in this file.

## Unreleased

- Added a GitHub Release workflow that publishes release notes, deployable Linux amd64 packages, and SHA256 checksums for version tags.
- Standardized repository metadata, GitHub templates, CI, dependency updates, and security policy.
- Added a health check endpoint for deployments: `GET /api/healthz`.
- Improved Docker and Docker Compose health check configuration.
- Cleaned editor-specific files, unused development routes, and legacy configuration leftovers.
- Refined README content for users, self-hosted deployment scenarios, and project discoverability.

## Initial ZPanel Cleanup

- Initialized ZPanel as an independent fork.
- Renamed user-facing project identity, build artifacts, and container defaults to ZPanel / zpanel.
- Switched planned container publishing to GitHub Container Registry.
- Removed legacy upstream links from the active product surface.
