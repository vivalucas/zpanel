# Changelog

All notable changes to ZPanel will be documented in this file.

## Unreleased

## 1.2.12 - 2026-10-27

### Homepage Loading and Recovery

- Show the basic homepage layout and a live local clock while authentication, page code and appearance load. Keep personal navigation behind fresh authentication. Retain the clock and offer a page refresh if homepage code cannot download.
- Load route code alongside authentication, defer editors, menus, sorting and optional languages, and display homepage sections as their data becomes ready. Isolate optional feature failures so working navigation remains available, with close/cancel and refresh recovery.
- Restore a limited same-account, same-role display snapshot after authentication and revalidate it in the background. Keep editing and settings away from unverified cached data; bound read-request waits without automatically retrying writes.
- Generate gzip/Brotli assets and cache fingerprinted static resources. Preserve PWA entry routing, original upload URLs and wallpaper behavior. Use bounded PNG/JPEG thumbnails for local icons and the gallery; serve WebP originals without server-side thumbnail decoding.

### Uploads

- Reuse identical active local images within the same account after checking file size, SHA256 and stored contents. Share the mutation guard with deletion and reference changes, clean up failed new uploads and preserve existing records and cross-account boundaries without a schema migration.

### Verification

- Passed the final full 301-check Chromium suite, 117 frontend unit tests, type checking, zero-warning lint, language/configuration review, 16 container-entrypoint checks, the Go race suite/vet/release build and standard/PWA builds. Actual Go HTTP checks covered 279 static encoding representations; Chromium activated the worker and cached all 92 precache entries.
- Inspected desktop and narrow light/dark screens, startup and local failure recovery, focus restoration and readable inline errors. This was a same-round collaborative self-check. Real devices, Safari/Firefox, production weak networks, complete restore and PWA installation/upgrades remain outside the verified scope.

## 1.2.11 - 2026-10-27

### Settings and Wallpaper Preview

- Automatically save appearance, search, monitoring and profile preferences after editing settles. Serialize writes, retain edits made during a pending request, pause for uploads and active slider drags, and wait for normal saves before internal navigation. Invalid, failed, uploading and password drafts remain protected; site code/security, passwords, entity editing and data operations keep explicit actions.
- Show wallpaper blur and darkness on matching 0–10 integer scales while preserving their internal ranges and existing values. Reading settings or saving unrelated fields does not quantize older values; no data migration is required.
- Update preview layers immediately while coalescing image analysis, reusing decoded images and reserving status space so slider dragging does not move controls or repeatedly announce loading.

### Homepage Appearance and Tools

- Use fixed white homepage text by default, with modestly heavier type, a thin dark outline and a soft shadow. Offer explicit white, black and advanced custom colors through the existing setting; wallpaper crops, theme changes and image failures do not replace the selected color. Preserve icon artwork and explicitly configured clock/monitor colors.
- Keep automatic contrast optional and limited to the wallpaper veil for the selected text color. Match analysis to the displayed crop, edge expansion, transparent background composition and blur, including mixed colors at blurred boundaries. Retain a clear fallback when canvas filters or reliable sampling are unavailable.
- Preserve inherited, system and context-dependent CSS colors, including escaped expressions, without treating them as fixed colors for automatic contrast. Analyze supported fixed colors using their actual RGBA; unattainable custom colors do not receive a veil that worsens their original worst contrast.
- Place the same horizontal tools at the bottom right on every viewport, with 44 px targets, safe-area spacing and footer clearance. Add a separated return-to-top action that expands left without shifting existing buttons, uses separate show/hide thresholds, restores keyboard focus and honors reduced motion.
- Use paired system foreground/background colors with solid surfaces under higher-contrast and forced-color preferences.

### Reliability and Verification

- Aggregate search and monitoring save feedback across both sections. A successful section cannot hide another section's error or claim every draft is saved; feedback changes to saved only after all changed sections succeed, and confirmed discard clears the persistent error.
- The cumulative implementation has final passing results for all 254 Chromium checks, plus 50 frontend unit tests, the Go suite, type checking, zero-warning lint, configuration/language review checks and standard/PWA builds. Added regressions cover actual blurred screenshot pixels, unsupported/contextual colors, concurrent save failures, slider dragging, keyboard focus and responsive tools.
- Reviewed Chinese/English, light/dark themes, desktop, narrow and short windows. This was a same-round collaborative self-check. Real mobile devices, Safari/Firefox, assistive technologies, browser zoom, mobile soft-keyboard behavior, Windows/Ubuntu desktop sessions, MySQL/Redis/NAS, complete restore and PWA installation/upgrades remain outside the verified scope. Pure-touch iOS Safari still lacks an application-menu entry.

## 1.2.10 - 2026-10-26

### Wallpaper Appearance

- Choose the stronger available text color on uniform middle-gray wallpapers. Measure the actual fixed background area so scrollbar gutters do not make automatic contrast analyze hidden image regions or disagree with the preview.
- Make whole-image automatic contrast an explicit, saved option that defaults to off. Existing wallpaper darkness, blur and custom colors are preserved; wallpapers may look brighter because the formerly implicit contrast overlay is no longer applied by default.
- Share wallpaper layers, shade colors, crop analysis and scaled blur between Home and the live settings preview. Keep controls readable on their own glass surfaces while retaining light icon tiles and transparent group headings.
- Distinguish image loading failures from unavailable color analysis. Keep default mode free of automatic veils for cross-origin images, transparent images and large windows; preserve existing settings when importing older backups.

### Application Icons

- Give icon tiles their own translucent frosted surface in light and dark themes, with matching editor and wallpaper previews.
- Protect text, monochrome symbols and failed-image fallbacks with a thin inner surface while respecting explicitly saved background colors. Use solid surfaces without blur for reduced transparency, higher contrast and forced colors.

### Reliability

- Keep the Docker error card and its loading feedback visible during an initial retry. Failed retries remain actionable, cached rows survive refresh retries, and denied container, resource-statistics and log data stay hidden until access is restored.

### Verification

- Passed the full local 181-check Chromium suite, then 34 related checks against the final Docker retry changes, including the two new first-access denial regressions. Passed 41 frontend unit tests, the Go suite and release build, 16 Docker entrypoint checks, type checking, lint, configuration review checks and standard/PWA builds.
- Reviewed desktop, narrow and short windows, light/dark themes and Chinese, Traditional Chinese and English previews. Real mobile devices, Safari/Firefox, assistive technologies and PWA installation/upgrades remain outside the verified scope. The existing pure-touch iOS application-menu limitation remains.

## 1.2.9 - 2026-10-26

### Application Icons

- Let square images fill their rounded icon tiles while keeping wide and tall marks in proportion and fully visible. Refined corner radii and shadows without changing tile sizes or hover positions.
- Use a light frosted background for new applications by default. Preserve saved background colors and the original image contents; clearing an application's background restores the automatic glass surface.
- Added live icon previews to the application editor, including background changes and recovery after replacing a failed image URL.
- Fixed icon and preview blur declarations being lost from production CSS by keeping the standard backdrop-filter after its compatibility declaration.

### Verification

- Added browser regressions for filled tiles, uncropped horizontal/vertical marks, saved colors, empty backgrounds, failed-image recovery and responsive previews. The complete local suite passed 163 Chromium checks, 36 frontend unit tests, 16 Docker entrypoint checks, the Go suite and standard/PWA builds.
- Real mobile devices, Safari/Firefox, assistive technologies and PWA installation/upgrades remain outside the verified scope. Existing pure-touch iOS application-menu limitations remain unchanged.

## 1.2.8 - 2026-10-26

### Appearance and Navigation

- Kept application icons stationary on hover, with a deeper shadow instead of a floating animation, and removed the overlay menu button.
- Replaced oversized context menus with compact address actions, visible shortcut labels, shared light/dark glass surfaces and larger touch targets. Identical primary and LAN addresses share one action section without changing saved configuration.
- Removed URL hover bubbles from application icons. Only visually truncated application names show a full-name tooltip, with updates after resizing, font loading and renaming.
- Widened and reorganized the add/edit application dialog so its fields fit common desktop viewports, while narrow and short windows retain bounded scrolling and reachable actions.

### Reliability and Verification

- Preserved address-specific opening, clipboard fallback, native link behavior, keyboard menus, permissions, upload draft protection and unsaved-change confirmation.
- Fixed offscreen dropdowns under reduced-motion preferences by making CSS transitions immediate, preserving synchronous popup measurements and automatic viewport placement.
- Kept reduced-motion button loading cleanup finite so failed saves restore their labels and remain retryable.
- Added browser regressions for compact menus, application-name tooltips and responsive application editing; synchronized the duplicate-search-engine test with dropdown and save completion.
- Pure-touch iOS Safari still lacks an application-menu entry after removal of the overlay button; its native long press does not emit the required contextmenu event. A compatible touch entry remains pending. Real mobile devices, Safari/Firefox and assistive technologies are outside this release's verified scope.

## 1.2.7 - 2026-10-25

### Appearance

- Arranged the desktop homepage identity and clock beside search, aligned with navigation groups, with natural stacking on narrow screens and narrow configured content widths.
- Reduced homepage whitespace while preserving wallpaper contrast, configured margins, navigation behavior and 70 px icons.
- Replaced oversized Docker error states with compact theme-aware feedback, collapsed diagnostics, bounded long messages and reachable mobile retry controls, including log dialogs.

### Docker Reliability

- Preserved the mounted Docker socket's authorized group when dropping to the non-root service user.
- Supported large Linux GIDs without BusyBox's numeric group-creation limit; reused existing groups and made repeated startup safe.
- Kept the site available with a warning if optional Docker permission setup fails, while retaining fatal errors for configuration and data initialization.
- Documented removal of temporary entrypoint mounts when upgrading from 1.2.6 and verification using the actual service identity.

### Verification

- Added 16 isolated entrypoint regressions to CI, alongside 138 browser checks, 36 frontend unit tests and the Go suite.
- Verified actual BusyBox/su-exec behavior in isolated Linux containers for normal and large GIDs, existing groups, unavailable group files, unauthorized groups and Docker reads.
- Real mobile devices, Safari/Firefox, MySQL/Redis/NAS, PWA installation/upgrades and complete restore remain outside this release's verified scope.

## 1.2.6 - 2026-10-24

### Appearance and Navigation

- Unified glass menus, dialogs, dropdowns and feedback in light and dark themes, with solid-surface accessibility fallbacks and fixed actions in long dialogs.
- Refined homepage density and toolbar spacing. Added a shared application context menu with address-specific actions while preserving native browser link behavior.
- Simplified settings headings, aligned mobile switches, added live wallpaper blur/shade previews and collapsible monitor colors, and kept mobile account actions reachable.

### Reliability and Accessibility

- Prevented late image uploads and concurrent failed-upload retries from replacing newer drafts; protected unsaved application edits.
- Preserved usable cached content on temporary refresh failures while hiding it on access denial. Kept newly saved appearance, site, search and monitor values when follow-up reads fail.
- Fixed menu toggling and stale menus after embedded applications close, and distinguished search engines that share a URL.
- Improved localized keyboard sorting, input names, captcha association, login contrast and narrow multilingual layouts. Allowed avatar updates to preserve unchanged legacy nicknames without relaxing validation for renamed values.

### Verification

- Added regression coverage for upload ordering, saved-data recovery, access-denied cache handling, mobile controls and shared glass surfaces; the complete local suite contains 132 browser checks and 36 frontend unit tests.
- Real mobile devices, Safari/Firefox, Docker/MySQL/Redis integration, PWA installation and full restore remain outside the verified scope.

## 1.2.5 - 2026-10-24

### Appearance

- Unified the Z logo across the favicon, login, settings, default avatar and PWA icons.
- Refined the wallpaper desktop layout and glass settings window, with responsive controls, adaptive text contrast and readable text icons. Preserved explicit appearance overrides and conservative fallbacks for remote wallpapers.

### Reliability

- Prevented stale page and session callbacks from affecting a different account or a newly opened page. Hardened anonymous login, uploads, settings saves, password drafts and account switching.
- Fixed backup ordering, pagination, search and appearance validation, focus handling, and safe-mode/language error boundaries.
- Made native-link browser tests use the platform's new-tab modifier and wait for the intended button colors before measuring wallpaper contrast, retaining the 4.5:1 threshold.

## 1.2.4 - 2026-10-07

### Security and Reliability

- Prevented navigation-group requests from creating client-supplied users through ORM associations. Kept ownership server-controlled and minimized the public-account response.
- Fail closed when login settings cannot be read or decoded; configuration reads preserve stored data. Saved site settings and captcha changes in one transaction.
- Enforced visitor monitor switches on the server. Made session revocation, current roles and security settings authoritative in the database instead of relying on cache invalidation.
- Validated appearance fields and provided a recovery path for damaged saved settings. Unified password limits at 72 UTF-8 bytes and navigation titles at 200 characters.
- Added an administrator-only exact-origin allowlist for private-network favicon retrieval, with redirect/DNS checks and loopback, link-local and cloud-metadata blocking.
- Disabled unnecessary Markdown auto-linking, bounded description rendering, and updated Markdown parsing and HTML sanitization dependencies.

### User Experience

- Added first-application/import actions to empty groups, native card links, and support for applications with only a LAN address.
- Added per-file upload status, preflight validation and failed-upload retry. Accepted multipart headers separately from the 10 MiB file-size limit.
- Preview imported/replaced navigation counts and optionally move applications before deleting their group. Fetch complete navigation in one request.
- Added localized page recovery and protected unsaved profile changes when switching accounts.

### Verification

- Passed Go tests, 14 frontend unit tests, 26 isolated SQLite browser regressions, production build, TypeScript, ESLint and documentation checks. Verified a fresh frozen-lockfile install and a zero-advisory production dependency audit.
- Inspected desktop and 320 px mobile interfaces in macOS Chromium. Real MySQL/Redis/NAS integration, Docker operations, Ubuntu recovery, PWA installation/upgrades, Safari/Firefox and real mobile keyboards remain unverified.

## 1.2.3 - 2026-09-28

### Frontend

- Clarified settings that affect public access, shared images, reset behavior and Docker controls with concise in-page guidance.
- Unified read-error presentation across settings pages with retry actions and optional technical details. Kept previously loaded data visible when a refresh fails.
- Completed the corresponding translations across 11 languages and added a locale-key consistency check.

### Maintenance and Verification

- Kept repository development on `main` and stopped automatic dependency-update branches.
- Verified the settings and error-state changes with 21 browser regressions, 9 unit tests, production build, type checking, ESLint and documentation checks. Real Docker operations and browsers beyond macOS Chromium remain unverified.

## 1.2.2 - 2026-09-27

### Frontend

- Redesigned settings as a single floating glass window with an integrated sidebar, independent content scrolling, and responsive mobile navigation.
- Added visual theme choices and live identity/wallpaper draft previews. Theme choices fit narrow windows; long names are contained, and failed logo images fall back to initials and recover when the URL changes.
- Kept appearance and site save bars outside the scrolling content so they do not cover keyboard-focused fields. Aligned action-area styling for search, monitoring and account forms while preserving separate saves.

### Documentation and Verification

- Aligned frontend and visual conventions, current project state, and regression guidance with the settings redesign.
- Added regressions for Chinese/English narrow layouts, light/dark themes, keyboard focus with draft warnings, and logo preview edge cases. Verified the redesign with 19 browser regressions, 9 unit tests, navigation/import regression checks, production build, TypeScript, ESLint and documentation checks; Safari/Firefox, real mobile keyboards and other operating systems remain unverified.

## 1.2.1 - 2026-09-24

### Frontend

- Restored the Vue homepage layout positions and 70 px default app icons while keeping the new glass design. Aligned margin units and defaults with the previous configuration.
- Improved wallpaper and dark-theme contrast, simplified detail cards, and moved navigation actions back to their groups.
- Removed the misleading return-home action from a standalone login page; kept it when arriving from the public homepage and restored language selection before login.
- Matched search hints to the active setting, localized CPU core counts, and prevented accidental app edits while sorting.
- Lazy-loaded login, upload, and HTML sanitization code. Split the React runtime into its own chunk; the largest production script is now about 363 KB with no bundle-size warning.

### Verification

- Passed 15 production-browser regressions, 9 unit tests, navigation/import checks, TypeScript, ESLint, and standard/PWA builds. Updated the visual design and audit documentation.

## 1.2.0 - 2026-09-13

### Frontend

- Simplified interface text to functional labels and necessary instructions.
- Rebuilt the frontend with React, TypeScript and Ant Design; replaced modal-based management with hash-routed settings pages and a shared light/dark theme.
- Migrated navigation editing and sorting, search, monitor configuration, files, import/export, account switching, user administration and Docker management.
- Preserve unsaved settings on failures, confirm before leaving edited settings, and lock forms while saving. Preserve the default search engine when an earlier engine is deleted.
- Use default dependency chunking with lazy pages to avoid production circular-initialization failures; retain the shared-entry size warning as a known performance item.
- Support UUID generation on ordinary HTTP LAN origins; discard stale session responses and reject delayed actions after an account switch.
- Preserve file pagination on empty pages and allow replacement images from other pages and the public gallery.
- Avoid rerunning custom JavaScript on unrelated site updates; support safe-mode recovery from hash URLs.

### Reliability and Documentation

- Return the correct missing-record error code for first-use configuration and an unset public account.
- Serve optional PWA manifest, worker and icons through Go using explicit public paths.
- Added API/session and browser regressions, CI browser testing, frontend conventions and an audit coverage matrix. Full browser tests use temporary SQLite data; Docker success flows use mocks. Real Docker operations, Ubuntu deployment/restore, MySQL/Redis and native PWA installation remain outside the verified scope.

## 1.1.8 - 2026-09-12

### Security and Reliability

- Bound captcha dimensions and request rates; added explicit trusted reverse-proxy configuration.
- Preserve an active administrator and make password updates and session revocation atomic.
- Protect referenced uploads from deletion, reject deleted local image references, and allow private usage inspection and replacement of the current user's references.
- Import configuration in one transaction with request idempotency and validation; abort incomplete exports.
- Reject unsafe navigation URLs, bound Docker command time/output, and improve favicon resolution after redirects.

### User Experience

- Added import previews, conflict notices and safe retry behavior; preserved unsaved wallpaper and search settings after failures.
- Added Docker operation confirmations and per-container pending states.

### Deployment

- Clarified configuration sources, persistent data, proxy setup, upgrades and complete backup/restore procedures in Chinese and English.
- Removed misleading Docker root fallback and destructive environment-file replacement instructions.
- Default deployment remains one instance with SQLite. Ubuntu hardware deployment and recovery, real Docker operations, and MySQL/Redis integration were not revalidated for this release.
- Back up configuration and data before upgrading; configuration JSON exports do not include uploaded files.

## 1.1.7 - 2026-06-18

### Bug Fixes

- Fixed Docker-built frontend assets defaulting to an empty API base URL when `.env` is not present in the build context, which caused deployed pages to call non-API paths such as `/openness/loginConfig` and show repeated network errors.
- Fixed Docker build context exclusions so runtime database directories are ignored only at the repository root, without excluding backend source packages such as `service/initialize/database`.

## 1.1.6 - 2026-06-17

### Security

- Disabled Gin's default all-proxy trust so login rate limiting cannot be bypassed by spoofed `X-Forwarded-For` headers on direct public deployments.
- Rechecked user account status when restoring sessions from token cache or database sessions, preventing disabled or inactive accounts from continuing to use existing tokens.
- Reduced user-list responses to explicit profile fields so password hashes and password algorithm metadata are not serialized from the database model.

### Bug Fixes

- Fixed favicon fetching so unsupported first-choice SVG icons no longer prevent fallback to later PNG, JPG, WebP, GIF, or ICO candidates.
- Aligned the account-management page-size selector with the backend maximum of 100 users per page.
- Hid delete actions for files owned by other users in the public gallery to avoid misleading successful no-op deletes.

## 1.1.5 - 2026-06-13

### Bug Fixes

- Fixed a Denial of Service (DoS) vulnerability in the login rate limiter where an O(N) map traversal during IP record cleanup could block all login attempts under high concurrency or malicious probing. The cleanup logic has been moved to an asynchronous background task.

### Maintenance

- Completed the sixth round of code review, verifying session consistency, cache stampede mitigations, and network error handling behaviors as acceptable trade-offs for HomeLab environments.
## 1.1.4 - 2026-06-05

### Bug Fixes

- Fixed navigation item create, edit, and batch import validation so items can only target groups owned by the current user.
- Fixed batch navigation item creation returning success when the database insert failed.
- Fixed item group deletion protection so invalid IDs cannot bypass the "keep at least one group" rule.
- Fixed login configuration request failures producing unhandled promise rejections when the backend is unavailable during local preview or startup.

### Improvements

- Added a safe-mode recovery URL for broken custom CSS / JavaScript: `?safeMode=1` or `?zpanelSafeMode=1`.
- Made request `afterRequest` hooks run after success, handled API errors, and network errors.
- Added regression tests for panel group ownership checks and group deletion protection.
- Restored `project-log/` as a local-only development knowledge base by removing it from Git tracking and ignoring it.

## 1.1.3 - 2026-06-04

### Bug Fixes

- Fixed dark mode coverage across every system application page by moving page-level dark selectors into the global settings modal stylesheet.
- Fixed dark mode backgrounds for the settings sidebar, page container, Naive layout wrappers, item group list, icon editor, upload grid, Docker error blocks, and About panel.

## 1.1.2 - 2026-06-04

### UI Improvements

- Fixed the system applications modal so light, dark, and automatic themes render consistently across the modal shell, sidebar, content panels, cards, tables, alerts, buttons, inputs, and form controls.
- Improved the settings modal light theme by reducing muddy glass effects and using clearer white surfaces, slate borders, and more stable table contrast.
- Improved the style settings "maximum width" control by separating the value input from the unit selector, removing noisy stepper buttons, and aligning the field with the surrounding settings layout.

### Maintenance

- Restored the theme selector flow after the UI cleanup and kept API error messages aligned with the active theme.
- Updated project logs for the theme consistency fix and release preparation.

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
