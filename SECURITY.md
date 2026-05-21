# Security Policy

ZPanel is a self-hosted panel that may run with access to private services, uploaded files, and optionally the host Docker socket. Please report security issues privately.

## Supported Versions

Security fixes target the latest published ZPanel release. If you are running an older release, upgrade before reporting an issue unless the issue still affects the latest version.

## Reporting a Vulnerability

Please do not open a public GitHub issue for vulnerabilities.

Report privately through GitHub Security Advisories:

https://github.com/vivalucas/zpanel/security/advisories/new

Include:

- A clear description of the vulnerability
- Steps to reproduce
- Affected version or commit
- Deployment mode, such as Docker Compose or local binary
- Any relevant logs, screenshots, or proof-of-concept details

## High-Risk Configuration Notes

- Mounting `/var/run/docker.sock` gives ZPanel administrative control over the host Docker daemon.
- Custom CSS and JavaScript should only be enabled for trusted administrators.
- Public access mode should be reviewed before exposing a panel to the internet.
