# ZPanel

NAS, Homelab, 개인 서버, 브라우저 홈페이지를 위한 가볍고 깔끔한 셀프 호스팅 내비게이션 패널입니다.

[简体中文](../README.zh-CN.md) | [English](../README.md) | [日本語](README.ja.md) | 한국어 | [Deutsch](README.de.md) | [Français](README.fr.md) | [Español](README.es.md) | [Português](README.pt-BR.md) | [Italiano](README.it.md) | [繁體中文](README.zh-TW.md) | [Русский](README.ru.md)

---

쉽게 배포할 수 있는 오픈 소스 패널이며 유료 라이선스 제한이 없습니다.

## 기능

- 내비게이션 항목과 그룹 관리
- 내부 / 외부 네트워크 주소 전환
- 다중 계정, 공개 접근 모드, 빠른 로컬 계정 전환
- 배경, 레이아웃, 푸터, 로그인 화면, CSS / JavaScript 사용자 지정
- 사용자 지정 검색 엔진과 로그인 CAPTCHA
- 이미지 업로드, 공개 갤러리, 탐색·스타일 `.zpanel.json` 내보내기(이미지·계정·모듈 설정 제외)
- 시스템 상태 위젯
- 관리자용 Docker 컨테이너 관리
- 접근·권한 제어, 로그인 속도 제한, 보안 응답 헤더, 컨테이너 헬스 체크, CI

## 빠른 시작

먼저 [설치 안내(영어)](../README.md#docker-compose)에 따라 Compose 파일을 만들고 같은 배포 디렉터리에서 실행하세요.

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

[Development setup & checks (English)](../CONTRIBUTING.md#development-setup)

## 라이선스

MIT License. 자세한 내용은 [LICENSE](../LICENSE)를 참고하세요.
