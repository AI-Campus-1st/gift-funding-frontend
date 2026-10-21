# Birthday Funding — 프론트엔드

> 이 문서는 `docs/frontend/`에 있다. 본문의 `src/...` · `npm` 명령 경로는 **`frontend/` 폴더 기준**이다.

AI 기반 생일선물 공동 펀딩 플랫폼의 프론트엔드입니다. (백엔드는 추후 구현 · 현재는 **모의(Mock) API**로 동작)

- 기획 문서: `../product/` · 디자인 문서: `../design/` · 개발 규칙: `../../rules.md`, `../../frontend/CLAUDE.md`
- 기술 스택: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · TanStack Query 5 · shadcn/ui 방식 컴포넌트(Radix) · Lucide React · FullCalendar · Pretendard · Vitest + React Testing Library
- 구조 · 규칙: `../ARCHITECTURE.md` (UI · API 분리), `../API_SPEC.md` (API 46개), `../backend/API.SPEC.md` (백엔드 API 명세), `../DATA_MODEL.md` (데이터 설계)

## 실행 방법

```bash
npm install      # 처음 한 번 (package.json 이 바뀌었을 때도 — 2026-10-16 TanStack Query 추가)
npm run dev      # http://localhost:3000
npm test         # 단위 · 컴포넌트 테스트
npm run lint     # ESLint
npm run build    # 프로덕션 빌드 확인
```

## 체험용 계정 · 데이터 (모의 데이터)

| 계정 | 비밀번호 | 설명 |
|---|---|---|
| seoyeon@example.com | password123 | 기본 체험 계정 (내 펀딩 5개 · 친구 펀딩 2개 · 이월 선물 1개) — 종료 펀딩 중 "후원 없이 끝난 펀딩"은 삭제 가능, "100% 달성한 펀딩"은 삭제 불가 |
| jihoon@example.com | password123 | 친구 (생일자 시점 확인용) |
| mina@example.com / doyoon@example.com | password123 | 기타 친구 |

- 초대 코드: `INVITE-MINA-2026`(활성) · `INVITE-OLD-0000`(비활성 → 오류 안내 확인)
- 데이터는 브라우저 localStorage 에 저장됩니다. 처음 상태로 되돌리려면 개발자도구 → Application → Local Storage 에서 `gift-funding:mock-db` 를 삭제하세요.
- 실제 결제 · 송금은 없으며 화면에 `모의 후원` / `모의 정산` 으로 표시됩니다.
- 모의 정산은 요청 3초 뒤 "처리 중", 8초 뒤 "완료"로 바뀝니다. 실패 화면은 계좌번호 끝을 `0000`(계좌 정보 오류) · `9999`(은행 오류)로 입력하면 볼 수 있습니다.
- 미달 처리 알림: 펀딩이 끝나고 7일이 지나도 이월 · 인출을 고르지 않으면 알림이 한 번 옵니다. (체험 계정의 "작년 생일 펀딩")

## 폴더 구조

```
src/
  app/
    (public)/          랜딩 · 회원가입 · 로그인 (하단 탭 없음)
    (app)/             로그인 필요 화면 (AuthGuard 로 보호)
    globals.css        디자인 토큰 (base.md → Tailwind 테마: bg-primary, shadow-window ...)
  components/
    ui/                Button · Input · Dialog · Checkbox · Badge ... (shadcn/ui 방식)
    layout/            AppShell(430px 앱 틀) · AppHeader · BottomTabBar · Screen · RetroWindow · AuthGuard
    common/            상태 화면 · FormField · ConfirmDialog · DeleteConfirmDialog(공통 삭제 모달) · BirthdayPicker · MockNotice
    providers/         QueryProvider (TanStack Query 설정)
    funding/ donation/ gift/ invite/ calendar/   도메인 컴포넌트 (데이터는 props 로만 받음)
  hooks/
    queryKeys.ts       쿼리 키 모음
    queries/           도메인별 조회 · 변경 훅 (화면은 이 훅으로만 데이터를 다룸)
  lib/
    api/               도메인 API 함수 · http.ts(HTTP 클라이언트 · 모드 전환) · dto · mappers(snake ↔ camel)
    mock/              Mock 서버: router · handlers · 모의 DB · 시드 (백엔드 연동 후 삭제)
    constants.ts · validation.ts · paths.ts · format.ts · auth.tsx(로그인 상태)
  types/               도메인 타입 (생일자용 OwnerGiftView / 후원자용 SupporterGiftView 분리)
```

## 화면 경로 (UI-01 ~ UI-29)

| ID | 화면 | 경로 |
|---|---|---|
| UI-01 / 02 / 03 | 랜딩 · 회원가입 · 로그인 | `/` · `/signup` · `/login?redirect=` |
| UI-04 | 홈 | `/home` |
| UI-05 / 09 | 내 펀딩 · 펀딩 생성 | `/my-funding` · `/create-funding` |
| UI-10 / 11 | 선물 등록·수정 · AI 추천 | `/add-gift` · `/ai-recommend` |
| UI-12 / 13 | 내 펀딩 상세 · 후원자 내역 | `/my-funding-detail/[fundingId]` · `…/supporter-list` |
| UI-22 / 23 / 24 | 종료 결과 · 목표 미달 · 정산 | `…/funding-result` · `…/unmet-goal` · `…/settlement` |
| UI-06 / 14 / 15 / 16 | 그룹 · 생성 · 상세 · 초대 관리 | `/group` · `/create-group` · `/group-detail/[groupId]` · `…/invite-management` |
| UI-07 / 17 / 18 | 친구 펀딩 · 초대 참여 · 상세 | `/friend-funding` · `/join-invite?token=` · `/friend-funding-detail/[fundingId]` |
| UI-19 / 20 / 21 | 후원 · 완료 · 내 후원 내역 | `/donation/[giftId]` · `/donation-complete/[donationId]` · `/my-donations` |
| UI-08 / 25 / 26 / 27 | 마이페이지 · 프로필 · 취향 · 편지함 | `/mypage` · `/edit-profile` · `/gift-preferences` · `/message-inbox` |
| UI-28 / 29 | 생일 캘린더 · 알림 | `/birthday-calendar` · `/notifications` |

## 백엔드(FastAPI) 연동 시

1. FastAPI 를 `../backend/API.SPEC.md` 대로 만들고, `frontend/.env.local` 에 아래 두 줄을 넣습니다. 화면 · API 코드는 고칠 필요가 없습니다.
   ```
   NEXT_PUBLIC_API_MODE=http
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   ```
   (값이 없으면 `mock` 모드: `src/lib/mock/router.ts` 가 서버 역할을 합니다.)
2. 서버 오류는 `{ code, message, field_errors, max_available }` 형식이면 `http.ts` 가 `ApiError` 로 바꿔 줍니다.
3. 인증 토큰(JWT)은 로그인 응답 `access_token` 을 `src/lib/api/client.ts` 의 `saveToken` 이 보관하고, 요청마다 `Authorization: Bearer` 로 보냅니다.
4. 연동이 끝나면 `src/lib/mock/` 폴더와 `http.ts` 의 mock 분기, 로그인 화면의 체험용 계정 안내를 삭제합니다.

## 알아두면 좋은 점 (Next.js 16)

- `cacheComponents` 가 켜져 있어 이전 화면을 React `<Activity>` 로 숨겨 보관합니다. 링크로 새로 들어올 때 화면이 초기화되도록 모든 page 에 `withFreshState` 를 적용했습니다. (`src/lib/withFreshState.tsx`)
- 경로 파라미터 · 쿼리를 읽는 화면을 위해 라우트 그룹 레이아웃에 `<Suspense>` 경계가 있습니다.
