# ZPanel

NAS, Homelab, 개인 서버, 브라우저 홈페이지를 위한 가볍고 깔끔한 셀프 호스팅 내비게이션 패널입니다.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | 한국어 | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

ZPanel은 MIT 라이선스로 공개된 [Sun-Panel](https://github.com/hslr-s/sun-panel)의 독립 fork입니다. Sun-Panel과 원저자는 이 프로젝트의 중요한 기반을 제공했습니다. ZPanel은 Sun-Panel의 공식 프로젝트가 아닙니다.

ZPanel은 가볍고, 사용하기 쉽고, 배포하기 쉬우며 기본적으로 열린 패널을 목표로 하고, 유료 라이선스 게이트를 도입하지 않습니다. 셀프 호스팅 환경을 위해 프론트엔드 구조, 사용자와 내비게이션 데이터, 개인화 설정, 파일 업로드, Docker 관리, 배포 흐름을 계속 정리하고 개선합니다. 또한 로그인 CAPTCHA, 접근 차단, 권한 검증, 로그인 속도 제한, 보안 응답 헤더, 컨테이너 헬스 체크, CI 품질 게이트, 프로젝트 협업 파일도 보강했습니다.

## 기능

- 내비게이션 항목과 그룹 관리
- 내부 / 외부 네트워크 주소 전환
- 다중 계정, 공개 접근 모드, 빠른 로컬 계정 전환
- 배경, 레이아웃, 푸터, 로그인 화면, CSS / JavaScript 사용자 지정
- 사용자 지정 검색 엔진과 로그인 CAPTCHA
- 이미지 업로드, 공개 갤러리, `.zpanel.json` 백업
- 시스템 상태 위젯
- 관리자용 Docker 컨테이너 관리

## 빠른 시작

```bash
docker compose up -d
```

기본 이미지: `ghcr.io/vivalucas/zpanel:latest`

기본 계정:

```text
Username: admin@zpanel.local
Password: 12345678
```

첫 로그인 후 기본 비밀번호를 변경하세요.

Docker 관리 기능을 사용하려면 Docker socket을 마운트해야 합니다. 높은 권한을 부여하므로 신뢰할 수 있는 환경에서만 사용하세요.

## 개발

```bash
fnm use
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm run dev
```

```bash
cd service
go run main.go
```

## 라이선스

MIT License. 자세한 내용은 [LICENSE](../LICENSE)를 참고하세요.
