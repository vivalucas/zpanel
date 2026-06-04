# Changelog

All notable changes to ZPanel will be documented in this file.

## Unreleased

## 1.1.1 - 2026-06-04

### UI Improvements

- Unified settings pages, add/edit item dialogs, icon editor controls, buttons, cards, inputs, tables, alerts, and modal surfaces around a cleaner glass-style visual system.
- Improved custom wallpaper rendering with a dedicated wallpaper mode for readable white foreground text, softer masking, glass-style floating controls, and clearer add placeholders.
- Improved add-item icon editor styling and normalized text/background color swatches around black, white, blue, gray, and low-saturation destructive accents.
- Improved empty-group add placeholders and floating homepage controls so icons remain clear on light and image backgrounds.

### Docker

- Improved Docker management failure handling with inline deployment guidance instead of only showing a transient error toast.
- Documented Docker socket mounting and socket group handling for container deployments.

### Localization

- Added Docker management connection-help strings across all locale files.
- Fixed locale key parity by adding the missing login-rate-limit error key to non-base locales.

## 1.1.0 - 2026-06-04

### Bug Fixes

- Fixed password change failing with database error: GORM `Updates(map)` keys must use database column names (`password_hash`), not Go struct field names (`password`).
- Fixed `GetUserInfoByUsernameAndPassword` using wrong column name in WHERE clause.
- Removed dead `gender` update code from `UpdateUserInfoByUserId` (column does not exist).
- Fixed `ReferralCode` field marked as `gorm:"-"` preventing the referral code feature from persisting data.
- Fixed `ItemIcon` update field list containing `gorm:"-"` field `"Icon"` and non-existent `"GroupId"`.
- Fixed `ItemIconGroup` update field list being copy-pasted from `ItemIcon` with incorrect fields.
- Fixed floating buttons invisible on white background (removed `text-white` class from SvgIcon elements, enhanced shadow/border).
- Fixed username minimum length validation: unified to 3 characters across frontend and backend (was inconsistent between 3 and 5).
- Fixed create account returning wrong response field (`userId` only, frontend checked `id`).
- Fixed "username already exists" error showing "account does not exist" (added error code 1009).

### UI Improvements

- Unified button color scheme across all settings pages: primary (blue) for save/confirm/add, error (red) for delete/logout/reset, default (neutral) for import/export.
- Updated username validation hint text in all 11 locale files to reflect 3-character minimum.

## 1.0.10 - 2026-06-04

- Preserved custom wallpaper mask behavior while keeping the new default light background clean.
- Removed a leftover internal `sun-main` class name from the dashboard shell.

## 1.0.9 - 2026-06-04

- Unified the main dashboard, app launcher, floating controls, app icons, and About panel around a lighter glass-style visual system.
- Removed the legacy large logo from the About panel.
- Replaced legacy favicon, logo, Apple touch icon, and PWA icon assets with ZPanel-branded assets.
- Fixed the dashboard footer so configured footer HTML renders normally instead of showing raw markup.
- Replaced the new-install default dashboard background with a cleaner light gradient.

## 1.0.8 - 2026-06-04

- Redesigned the login page with a refined glass-style light layout, blue primary action, and responsive mobile spacing.
- Fixed login footer rendering so configured footer HTML displays as a normal link instead of escaped text.
- Updated the default Docker Compose image example to use `vivalucas/zpanel:latest`.

## 1.0.7 - 2026-06-04

- Fixed Docker startup when the runtime needs to extract embedded language files into `/app/lang` while running as the non-root `zpanel` user.
- Replaced the startup banner ASCII art with ZPanel branding.
- Updated Docker deployment examples to pin `vivalucas/zpanel:1.0.7`.

## 1.0.6 - 2026-06-03

- Added a Docker entrypoint that initializes mounted `conf` and `data` directories and fixes their ownership before starting ZPanel as the non-root runtime user.
- Hardened configuration initialization so config creation or read failures return explicit startup errors instead of nil-pointer panics.

## 1.0.5 - 2026-06-03

- Added `docker-cli` to the runtime image so Docker management can use a mounted host Docker socket.
- Restricted navigation item and group updates to the authenticated owner.
- Fixed the frontend lint failure in markdown code-block language validation.
- Normalized embedded version parsing so API responses do not include trailing whitespace.
- Updated Docker deployment documentation with version pinning, pull-before-start, reverse proxy guidance, and Docker socket permission handling.

## 1.0.4 - 2026-05-25

- Restricted disk monitor requests to known mountpoints.
- Hardened markdown code-block language rendering.
- Switched the runtime Docker image to a non-root user.
- Pinned the runtime Alpine base image and removed unused runtime shell packages.

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
