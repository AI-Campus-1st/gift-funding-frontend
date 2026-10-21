# plan.md — AI 기반 생일선물 공동 펀딩 플랫폼 개발 계획

> 작성일: 2026-10-16 · 기준 문서: `docs/product/*`, `docs/design/*`, `rules.md`, `frontend/CLAUDE.md`
> 이 문서는 **진행 현황 · 확정된 결정 · 다음 작업 계획 · 디렉터리 구조**를 한곳에 정리한다.
> 기능 정책은 `docs/product/FEATURE_SPEC.md`, 화면은 `docs/design/pages/*.md` 가 우선한다.

---

## 1. 전체 진행 현황

| 단계 | 내용 | 상태 |
|---|---|---|
| Phase 1 | 프론트엔드 MVP (화면 29개 · 모의 API) | ✅ 완료 |
| 연동 준비 | 데이터 · API 설계, Mock 라우터, TanStack Query, UI/API 분리 (7장) | ✅ 완료 (2026-10-16) |
| Phase 2 | 백엔드 (FastAPI · PostgreSQL) | ⏳ 예정 |
| Phase 3 | 프론트 ↔ 백엔드 연동 · 배포 | ⏳ 예정 |

---

## 2. Phase 1 — 프론트엔드 (완료)

### 2.1 기술 스택
Next.js 16.4 (App Router, cacheComponents) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui 방식 컴포넌트(Radix · cva) · Lucide React · FullCalendar 6 · Pretendard · Vitest + React Testing Library

> shadcn 레지스트리(ui.shadcn.com)는 네트워크 정책으로 접근 불가 → 같은 방식으로 `components/ui` 에 직접 작성

### 2.2 마일스톤

| 단계 | 화면 / 작업 | 상태 |
|---|---|---|
| M0 | 프로젝트 세팅 · 디자인 토큰 · 타입 · 모의 DB/API · 공통 컴포넌트 | ✅ |
| M1 | UI-01 랜딩 · UI-02 회원가입 · UI-03 로그인 | ✅ |
| M2 | UI-07 친구 펀딩 · UI-17 초대 참여 · UI-18 친구 펀딩 상세 · UI-19 후원 · UI-20 후원 완료 · UI-21 내 후원 내역 | ✅ |
| M3 | UI-05 내 펀딩 · UI-09 펀딩 생성 · UI-10 선물 등록 · UI-11 AI 추천 · UI-12 내 펀딩 상세 · UI-13 후원자 내역 | ✅ |
| M4 | UI-06 그룹 · UI-14 그룹 생성 · UI-15 그룹 상세 · UI-16 초대 링크 관리 | ✅ |
| M5 | UI-04 홈 · UI-08 마이페이지 · UI-25 프로필 수정 · UI-26 선물 취향 · UI-27 축하 편지함 | ✅ |
| M6 | UI-22 종료 결과 · UI-23 목표 미달 처리 · UI-24 정산 관리 | ✅ |
| M7 | UI-28 생일 캘린더 · UI-29 알림 | ✅ |
| M8 | 테스트 · 빌드 · 린트 · 브라우저 흐름 검증 · README | ✅ |

### 2.3 추가 수정 이력 (사용자 요청 · 버그)

| 구분 | 내용 |
|---|---|
| 버그 | 로그인 후 404 → 홈 화면 우선 구현 |
| 버그 | "로그인 중... / 가입 처리 중..." 멈춤 → Next.js 16 Activity 화면 보관 문제, `withFreshState` 로 새 진입 시 상태 초기화 · 로그아웃은 전체 새로고침 |
| 버그 | 관심사 키워드 입력 중 Backspace 로 기존 키워드 삭제 → × 버튼으로만 삭제 |
| 버그 | AI 추천: 취향을 불러오기 전 "추천받기" 클릭 시 빈 조건 오류 → 불러오는 동안 버튼 잠금 |
| 버그 | 후원 금액 직접 입력 시 10,000원(추천 금액)에서 입력창이 비워짐 → 직접 입력 글자를 따로 관리 |
| 기능 | 선물 취향: 입력 폼은 빈 상태로 시작 · 저장 시 기존 취향에 추가 후 폼 초기화 · "저장된 내 취향" 카드 · 항목별 × 삭제 |
| 기능 | 그룹 삭제 · 펀딩 삭제 (확인 모달) — 그룹 삭제는 7장 결정에 따라 제거 예정 |
| 기능 | 축하 편지함: 펀딩 상세 → 해당 펀딩 메시지만 / 마이페이지 → 전체 |

### 2.4 검증 결과 (마지막 실행 기준)
- Vitest 57개 통과 · ESLint 오류 0 · `next build` 29개 경로 성공
- Playwright 주요 흐름 23개 통과 · 브라우저 콘솔 오류 0

---

## 3. 확정된 정책 · 결정 사항 (기획 문서 해석 · 확장)

| 항목 | 결정 | 근거 / 비고 |
|---|---|---|
| 화면 경로 | 명세서 제안 경로 이름 유지 + 특정 데이터 화면만 `[id]` (예: `/friend-funding-detail/[fundingId]`) | 사용자 합의 |
| 초대 참여 화면 | 모달 대신 `/join-invite` 페이지 하나로 직접 입력 · 공유 링크(`?token=`) 모두 처리 | 06_friend_funding.md UI-17 |
| 초대 링크 관리 권한 | 그룹 관리자 + **펀딩 생일자(본인 펀딩 링크만)** | F-06 "그룹 또는 펀딩 관리 권한" |
| 달성률 표시 | 펀딩 전체가 아닌 **선물별** 달성률 | DEFINITION "목표 금액 합산하지 않음" |
| 선물 취향 저장 | 저장 후 화면 유지 (명세: 마이페이지 이동) · 기존 취향에 **추가** 방식 | 사용자 요청 |
| 펀딩 삭제 | **후원이 한 건이라도 있으면 삭제 불가** · 연결 알림 함께 삭제 | 확정 (7.1 D6 · D7) |
| 그룹 삭제 | **제공하지 않음** (참여자 제외 기능도 넣지 않음) | 확정 (7.1 D8) |
| 축하 편지함 | 펀딩 상세 → 펀딩별 · 마이페이지 → 전체 · 내 펀딩 목록의 편지함 버튼 제거 | 사용자 요청 |
| 정산 계좌 | 예금주가 계정 이름과 같아야 함 (본인 명의) | F-12 |
| 생일 일정 삭제 | 그 일정의 알림도 함께 삭제 | DATA_MODEL 6.9 D-S1-1 |
| 펀딩 열람 범위 | 초대받아 참여한 그룹의 펀딩만 | D-S1-2 |
| 목표 미달 이월 | 다음 생일에 펀딩을 다시 연다 — UI-09 "이월 선물 불러오기", 그룹 변경 가능, 이번 범위에서 화면까지 구현 (S6-2) | D-S1-3 |
| 초대 링크 만료 | 펀딩 지정 링크는 펀딩 종료 시 만료 | D-S1-4 |
| 후원 금액 단위 | 1원 단위, 최소 1원 (최대는 남은 금액) | BUSINESS_LOGIC Q5 |
| 펀딩 기간 | 시작일은 오늘 이전 불가, 최대 3주(시작일 포함 21일) | Q6 ✅ |
| 선물 추가 시점 | 종료 전까지 가능(예정 기간 포함), 종료 후 불가 | Q8 ✅ |
| 정산 상태 | 프로그램이 처리 결과에 따라 자동 변경 | Q11 ✅ |
| 재이월 | 목표 달성할 때까지 반복 이월 가능 | Q13 |
| 0원 미달 선물 | "종료됨"으로 표시하고 끝 | Q14 ✅ |
| 본인 후원 | 생일자는 자기 펀딩에 후원 불가 | Q15 |
| 펀딩 정보 수정 | 이름: 종료 전까지 변경 가능 · 기간 · 연결 그룹: 수정 불가 · 진행 중 인원 추가는 초대로 가능 | Q7 ✅ |
| 미달 처리 기한 | 종료 후 7일, 지나면 생일자에게 알림 한 번 (선택은 계속 가능) | Q12 · Q12-1 ✅ |
| 선물 추가 (예정 기간) | 시작일 전에도 추가 가능, 종료 전까지 계속 가능 | Q8-1 |
| 정산 실패 | 실패 이유(계좌 정보 오류 / 은행 오류) 안내 후 계좌 다시 입력해 재요청 | Q11-1 ✅ |
| 모의 처리 표시 | 후원 · 정산 · AI 추천 화면에 `모의 후원 / 모의 정산 / 모의 AI 추천` | base.md 정책 16 |

---

## 4. Phase 2 — 백엔드 계획 (FastAPI)

> 원칙: 프론트의 `frontend/src/lib/api/*.ts` 함수 이름 · 입력 · 반환 타입을 API 계약으로 사용한다.
> 모의 API(`frontend/src/lib/mock/*`)의 권한 검사 · 규칙 처리 로직이 서버 구현의 참고 기준이다.

### 4.1 단계

| 단계 | 내용 | 관련 기능 |
|---|---|---|
| B1 | 프로젝트 세팅: FastAPI · SQLAlchemy · Alembic · Pydantic · Docker Compose(PostgreSQL) · pytest | — |
| B2 | DB 모델 · 마이그레이션 (아래 4.2) · 고유 제약조건 | 전체 |
| B3 | 회원가입 · 로그인(JWT) · 내 정보 · 프로필 · 취향 (Argon2 해싱) | F-01, F-02 |
| B4 | 그룹 · 초대 토큰(Python `secrets`) · 참여 | F-05, F-06 |
| B5 | 펀딩 · 선물 CRUD · 권한별 응답(생일자용 / 후원자용 분리) | F-04, F-07, F-09, F-13 |
| B6 | 후원 처리: 트랜잭션 + 행 잠금 · idempotency key 고유 제약 · 초과 시 `maxAvailable` | F-08, F-10 |
| B7 | 축하 메시지 (후원과 같은 트랜잭션) · 편지함(펀딩별 / 전체) | F-14 |
| B8 | 목표 미달(이월/인출) · 정산 요청 · 이력 (모의 정산) | F-11, F-12 |
| B9 | 생일 캘린더 · 알림 · APScheduler(하루 전 · 당일, 중복 방지) | F-15, F-16 |
| B10 | AI 선물 추천: OpenAI API(httpx) · 응답 형식 검증 · 키는 서버 환경 변수 | F-03 |
| B11 | pytest: 인증 · 권한 · 초과/중복/동시 후원 · 정산/이월 중복 방지 | TechStack 9장 |

### 4.2 DB 테이블 초안 (모의 DB `frontend/src/lib/mock/db.ts` 기준)

| 테이블 | 주요 컬럼 | 제약 |
|---|---|---|
| users | id, name, email, password_hash, birthday, profile_image | email UNIQUE |
| user_preferences | user_id, keywords[], categories[], price_range | user_id UNIQUE |
| groups | id, name, description, admin_id | — |
| group_members | group_id, user_id | (group_id, user_id) UNIQUE |
| invites | token, group_id, funding_id?, is_active | token UNIQUE |
| fundings | id, owner_id, group_id, name, start_date, end_date | — |
| gifts | id, funding_id, name, price, image_url, product_url, description, shortfall_action, settlement_id | — |
| donations | id, funding_id, gift_id, supporter_id, amount, idempotency_key, created_at | (supporter_id, idempotency_key) UNIQUE |
| messages | id, donation_id, author_id, content | donation_id UNIQUE |
| carryovers | id, owner_id, gift_id, amount | gift_id UNIQUE |
| settlements | id, owner_id, funding_id, amount, bank, account_number, account_holder, status | — |
| birthday_events | id, owner_id, friend_name, birthday, linked_funding_id? | — |
| notifications | id, user_id, type, title, body, event_id, funding_id?, dedupe_key, is_read | (user_id, dedupe_key) UNIQUE |

### 4.3 API 엔드포인트 초안 (프론트 함수 ↔ REST)

| 프론트 함수 (`lib/api`) | 메서드 · 경로 |
|---|---|
| signup / login / getMe | `POST /auth/signup` · `POST /auth/login` · `GET /me` |
| updateProfile / getPreference / updatePreference | `PATCH /me` · `GET /me/preferences` · `PUT /me/preferences` |
| listMyGroups / getGroupDetail / createGroup | `GET /groups` · `GET /groups/{id}` · `POST /groups` |
| listInvites / createInvite / deactivateInvite | `GET /groups/{id}/invites` · `POST /groups/{id}/invites` · `PATCH /invites/{token}` |
| previewInvite / joinByInvite | `GET /invites/{token}` · `POST /invites/{token}/join` |
| listMyFundings / getMyFunding / createFunding / deleteFunding | `GET /fundings/mine` · `GET /fundings/{id}/owner` · `POST /fundings` · `DELETE /fundings/{id}` |
| addGift / getGiftForEdit / updateGift / deleteGift | `POST /fundings/{id}/gifts` · `GET /gifts/{id}` · `PUT /gifts/{id}` · `DELETE /gifts/{id}` |
| listFriendFundings / getFriendFunding / getGiftForDonation | `GET /fundings/friends` · `GET /fundings/{id}` · `GET /gifts/{id}/donation-view` |
| listSupporterDonations | `GET /fundings/{id}/donations` (생일자 전용) |
| donate / getMyDonation / listMyDonations | `POST /donations` · `GET /donations/{id}` · `GET /me/donations?fundingId=` |
| listReceivedMessages | `GET /me/messages?fundingId=` |
| applyShortfall / getSettlementOverview / requestSettlement | `POST /gifts/{id}/shortfall` · `GET /fundings/{id}/settlement` · `POST /fundings/{id}/settlements` |
| listBirthdayEvents / create · update · deleteBirthdayEvent / listLinkableFundings | `GET·POST /birthday-events` · `PUT·DELETE /birthday-events/{id}` · `GET /fundings/linkable` |
| listNotifications / hasUnreadNotifications / markNotificationRead / markAllNotificationsRead | `GET /notifications` · `GET /notifications/unread` · `PATCH /notifications/{id}` · `POST /notifications/read-all` |
| recommendGifts | `POST /ai/recommendations` |

> 오류 응답 형식: `{ code, message, fieldErrors?, maxAvailable? }` — 프론트 `ApiError` 코드(`EXCEEDS_REMAINING`, `GOAL_REACHED`, `FORBIDDEN` 등)와 맞춘다.

---

## 5. Phase 3 — 연동 · 배포 계획

1. ✅ 준비 완료: `frontend/.env.local` 에 `NEXT_PUBLIC_API_MODE=http`, `NEXT_PUBLIC_API_BASE_URL` 만 넣으면 `lib/api/http.ts` 가 FastAPI 를 호출한다
2. 도메인별로 하나씩 교체 → 화면 흐름 확인 (인증 → 그룹/초대 → 펀딩 → 후원 → 정산 → 캘린더/알림 → AI)
3. 인증 토큰: JWT (httpOnly 쿠키 방식 검토) · 초대 링크 로그인 후 복귀 흐름 유지
4. 이미지 업로드: data URL → 서버 업로드 API(또는 스토리지)로 교체
5. 연동 완료 후 `frontend/src/lib/mock/` 삭제 · 로그인 화면 체험 계정 안내 제거
6. 배포: 프론트 Vercel(Root Directory `frontend`) · 백엔드/DB 호스팅은 추후 결정
   - 배포 전까지 다른 사람과 **데이터 공유는 불가** (모의 데이터가 각 브라우저에 저장됨)

---

## 6. 미정 · 확인 필요 사항

- 남은 정책 질문(글자 수 · 이미지 · 계좌 형식 · 로그인 유지 기간 · 알림 시각 · 모의 정산 진행 시점 등)은 **백엔드 구현 단계에서 정한다** (BUSINESS_LOGIC 13장)

- 실제 결제 · 송금 · 본인 계좌 인증 구현 여부 (현재 모의 처리)
- 후원 취소 · 환불 정책
- 그룹 나가기(본인 탈퇴)
- 백엔드 · DB 배포 환경

---

## 7. 백엔드 연동 대비 설계 — 최종 Plan (✅ S1~S8 완료)

> 상태: **계획만 작성. 코드 · 문서는 아직 수정하지 않았다.**
> 실제 DB 구축 · 백엔드 서버 구현은 이번 범위에서 제외한다.
> 승인 후 S1부터 단계별로 진행하고, 단계마다 보고한다.

### 7.1 확정된 결정

| # | 항목 | 결정 |
|---|---|---|
| D1 | Mock 방식 | 직접 만든 Mock 라우터 사용. Mock 라이브러리(MSW 등)는 추가하지 않는다. |
| D2 | 서버 데이터 관리 | TanStack Query 도입. `useAsync` 사용 위치를 단계적으로 교체한 뒤 삭제한다. |
| D3 | 필드 표기 | 백엔드 snake_case ↔ 프론트 camelCase. **API 계층(mappers)에서만 변환**한다. |
| D4 | 삭제 방식 | Hard Delete. `deletedAt` 같은 Soft Delete 필드는 쓰지 않는다. |
| D5 | 홈 친구 펀딩 카드 | 선물별 달성률 표시 (펀딩 전체 합산 없음). |
| D6 | 펀딩 삭제 | 지금 방식 유지: 생일자만, **후원이 한 건이라도 있으면 삭제 불가**. |
| D7 | 펀딩 삭제 시 연결 데이터 | 선물 · 이 펀딩 전용 초대 링크 · **이 펀딩과 연결된 알림** 삭제, 생일 일정의 펀딩 연결은 해제(null). |
| D8 | 그룹 삭제 | **제공하지 않는다.** 현재 구현된 그룹 삭제 기능은 제거한다. |
| D9 | 삭제 확인 모달 | 공통 `DeleteConfirmDialog` 하나로 펀딩 삭제 · 선물 삭제에 적용한다. |
| D10 | 기능명세서 | `FEATURE_SPEC.md` F-07에 펀딩 삭제 규칙을 직접 추가한다. |

### 7.2 현재 구현 vs 추가 구현

| 영역 | 현재 구현됨 | 추가 · 변경 필요 |
|---|---|---|
| 사용자 관리 (F-01, F-02) | 회원가입 · 로그인 · 로그아웃 · 내 정보 · 프로필 수정 · 선물 취향 | 토큰 만료 · 재발급 처리, 비밀번호 변경(미정) |
| 그룹 (F-05, F-06) | 그룹 생성 · 상세 · 초대 링크 생성/비활성화 · 초대 참여 · 그룹 삭제 | **그룹 삭제 제거** (나머지는 그대로) |
| 펀딩 · 선물 (F-04, F-07, F-09, F-13) | 펀딩 생성 · 조회 · 삭제, 선물 추가 · 수정 · 삭제 | 펀딩 삭제 시 미달 처리 알림 삭제(생일 알림 유지), 공통 삭제 모달 적용(펀딩 · 선물) |
| 후원 · 메시지 (F-08, F-10, F-14) | 후원(멱등 키 · 초과 검증) · 후원 내역 · 편지함(펀딩별/전체) | 변경 없음 (API 형식만 정리) |
| 정산 (F-11, F-12) | 목표 미달 이월/인출 · 정산 요청 · 이력 (모의) | 변경 없음 |
| 캘린더 · 알림 (F-15, F-16) | 생일 일정 CRUD · 알림 목록 · 읽음 처리 | 알림에 `fundingId` 연결 필드 추가 |
| AI 추천 (F-03) | 모의 추천 | 변경 없음 |
| 데이터 통신 구조 | 화면이 `lib/api` 함수를 직접 호출, `useAsync` · `useEffect` 조회 | HTTP 클라이언트 · Mock 라우터 · DTO/매퍼 · TanStack Query 훅 계층 |

**비즈니스 로직 책임 구분**
- 백엔드 책임: 후원 금액 · 남은 금액 · 달성률 계산, 초과 · 중복 후원 검증, 권한 검사, 저장 · 삭제와 연결 데이터 처리, 정산 금액 계산, 알림 생성.
- 프론트 책임: 입력 형식 검증(빠른 안내용, 서버가 다시 검증), 화면 표시 형식(금액 · 날짜), 로딩 · 오류 · 빈 상태 표시, 캐시 갱신.
- 현재 Mock(`lib/mock/*`)에 있는 계산 · 검증 로직은 "백엔드가 할 일"로 표시하고, 연동 후 Mock과 함께 삭제한다.

### 7.3 현재 코드 분석 결과 (교체 대상)

| 항목 | 수량 | 처리 |
|---|---|---|
| `useAsync` 사용 | 페이지 19개 · 24곳 | S7에서 `useQuery` 훅으로 교체 |
| `useEffect` 직접 조회 | 4개 (ai-recommend, gift-preferences, add-gift, join-invite) | S7에서 `useQuery`로 교체 |
| mutation 직접 `await` | 26곳 | `useMutation` 훅으로 교체 + 관련 쿼리 무효화 |
| API 함수 | 57개 | 이름 · 입력 · 반환 타입은 유지, 내부만 HTTP 호출로 변경 |
| 컴포넌트 → `lib/api` 직접 import (규칙 위반) | 3곳 | 상수 · 검증 함수를 `lib/constants` · `lib/validation`으로 이동 |

위반 3곳: `DonationMessageCard`(`MESSAGE_MAX_LENGTH`), `GiftForm`(`validateGiftInput`), `InviteLinkForm`(`extractInviteToken`)

### 7.4 목표 구조 (클린 아키텍처)

```text
화면(app/*/page.tsx) · 컴포넌트(components/*)
        │  useXxxQuery / useXxxMutation 만 사용
        ▼
hooks/queries/*.ts   ── TanStack Query 훅 · queryKeys · 무효화 규칙
        │
        ▼
lib/api/*.ts         ── 도메인 API 함수 (이름 · 타입 유지)
        │  http.get/post/... + mappers(snake ↔ camel)
        ▼
lib/api/http.ts      ── 공통 HTTP 클라이언트 (토큰 · 오류 → ApiError)
        │
        ├── NEXT_PUBLIC_API_MODE=mock  → lib/mock/router.ts (핸들러 · fixtures · localStorage DB)
        └── NEXT_PUBLIC_API_MODE=http  → FastAPI (NEXT_PUBLIC_API_BASE_URL)
```

- Mock 라우터는 실제 서버처럼 `(method, path, body)`를 받아 **snake_case JSON**과 HTTP 상태 코드를 돌려준다. 그래서 FastAPI로 바꿀 때 환경 변수만 바꾸면 된다.
- 오류 응답 형식: `{ "code", "message", "field_errors"?, "max_available"? }` → 매퍼에서 `ApiError`로 변환.

추가 · 변경 파일 (예정)

```text
frontend/src/
├── lib/api/
│   ├── http.ts            # 신규: 공통 HTTP 클라이언트 · 모드 전환
│   ├── dto.ts             # 신규: 백엔드 응답 타입 (snake_case)
│   ├── mappers.ts         # 신규: dto ↔ 도메인 타입 변환
│   └── *.ts               # 기존: 내부를 http 호출로 변경
├── lib/mock/
│   ├── router.ts          # 신규: 경로 → 핸들러 연결
│   ├── handlers/*.ts      # 신규: 도메인별 핸들러 (기존 Mock 로직 이동)
│   └── fixtures/*.ts      # 신규: seed.ts 분리
├── lib/constants.ts       # 신규: MESSAGE_MAX_LENGTH 등 공용 상수
├── hooks/
│   ├── queryKeys.ts       # 신규: 쿼리 키 모음
│   └── queries/*.ts       # 신규: 도메인별 useQuery · useMutation 훅
├── components/providers/QueryProvider.tsx   # 신규
└── components/common/DeleteConfirmDialog.tsx # 신규 (DeleteSection 대체)
```

### 7.5 공통 삭제 확인 모달 (`DeleteConfirmDialog`)

| 항목 | 내용 |
|---|---|
| 동작 | 삭제 버튼 → 모달 표시 (바로 지우지 않음) |
| 기본 문구 | 제목 "정말 삭제하시겠습니까?" / 설명 "삭제한 데이터는 복구할 수 없습니다." |
| 버튼 | "취소"(보조) · "삭제"(위험). 취소 → 모달만 닫히고 데이터 유지 |
| 진행 중 | "삭제" 버튼 로딩 · 두 번 누르기 방지 · 진행 중에는 닫기 잠금 |
| 성공 | Hard Delete → 토스트 "삭제되었습니다." → 관련 목록 · 상세 쿼리 무효화 → 필요한 화면으로 이동 |
| 실패 | 모달 안에 오류 문구 표시, 데이터 유지, 다시 시도 가능 |
| 재사용 | `title` · `description` · `confirmLabel` · `successMessage`를 props로 받아 다른 삭제에도 재사용 |
| 디자인 | 기존 `Dialog`(tone) · `Button`(danger) · 토큰을 그대로 사용 |

적용 위치

| 화면 | 대상 | 성공 후 갱신 · 이동 |
|---|---|---|
| UI-12 내 펀딩 상세 | 펀딩 삭제 | `fundings.mine`, `fundings.detail`, `groups.*`, `notifications`, `schedule` 무효화 → `/my-funding` |
| UI-10 선물 수정 | 선물 삭제 | `fundings.detail(fundingId)`, `fundings.mine` 무효화 → 펀딩 상세 |

### 7.6 단계별 실행 계획

| 단계 | 내용 | 산출물 | 코드 변경 |
|---|---|---|---|
| **S1** ✅ | 데이터 설계: 기능별 추가 필드, 도메인 관계(ERD), 권한별 공개 필드, 백엔드/프론트 책임 | `docs/DATA_MODEL.md` 6장 | 없음 |
| **S2** ✅ | API 명세: 엔드포인트 약 45개, 요청 · 응답(snake_case), 오류 코드, 권한 | `docs/API_SPEC.md` 신규 | 없음 |
| **S3** ✅ | 아키텍처 · 규칙 · 명세서 반영 | `docs/ARCHITECTURE.md` 신규, `rules.md` 9장(UI·API 분리) · 10장(조회 · 삭제 규칙), `FEATURE_SPEC.md` F-07, `design/pages/03_my_funding.md` UI-09(이월 선물 불러오기) · UI-12, `08_settlement.md` UI-23(이월 안내), `04_gift.md` UI-10, `05_group.md` UI-15(그룹 삭제 버튼 제거), `base.md` 6.2 `delete-confirm-dialog`, `screen.md` 1.3 | 없음 |
| **S4** ✅ | 통신 계층: `http.ts`, Mock 라우터 · 핸들러 · fixtures, dto · mappers | 기존 57개 함수가 Mock 라우터를 거쳐 동작 | 있음 |
| **S5** ✅ | TanStack Query 기반: Provider · queryClient · queryKeys · AsyncBoundary 대응 | 조회 1~2개 화면 시범 교체 | 있음 |
| **S6** ✅ | 삭제: `DeleteConfirmDialog`, 펀딩 삭제(알림 포함) · 선물 삭제 mutation, **그룹 삭제 UI · API · 테스트 제거** | 2개 화면 적용 | 있음 |
| **S6-2** ✅ | (사용자 요청으로 먼저 구현 · 2026-10-16) 이월 펀딩 다시 열기: UI-09에 "이월 선물 불러오기"(그룹 변경 가능), 이월 금액을 시작 모금액으로 반영, API · Mock · 쿼리 훅 · 테스트 | UI-09 · UI-23 · 내 펀딩 상세 반영 | 있음 |
| **S7** ✅ | 나머지 화면 단계적 교체 (Q3 홈 · 펀딩 → Q4 그룹 · 초대 · 후원 → Q5 마이페이지 · 정산 → Q6 캘린더 · 알림 · AI) 후 `useAsync` 삭제 | 화면 29개 전환 | 있음 |
| **S8** ✅ | 지금 필요한 추가 필드 반영 (알림 `fundingId` 등), ESLint `no-restricted-imports`로 컴포넌트 → `lib/api` 직접 import 차단, 최종 검증 | 테스트 · 빌드 · E2E 통과 | 있음 |

진행 방식
- S1~S3은 문서만 수정하고 단계마다 승인을 받는다.
- S4부터는 단계마다 Vitest · ESLint · `next build` · Playwright 주요 흐름을 확인하고 폴더에 반영한 뒤 보고한다.
- 기존 화면 디자인 · 경로 · 함수 이름은 유지한다.

### 7.7 API 변경 요약 (S2에서 상세화)

| 구분 | 엔드포인트 | 비고 |
|---|---|---|
| 삭제 | ~~`DELETE /groups/{group_id}`~~ | 그룹 삭제 제거 (D8) |
| 변경 | `DELETE /fundings/{funding_id}` | 연결 알림 함께 삭제 · 후원 있으면 409 (D6, D7) |
| 유지 | `DELETE /gifts/{gift_id}` | 후원 있거나 마지막 선물이면 409 |

---

## 8. 디렉터리 구조

```text
gift-funding/
├── plan.md                         # 이 문서 — 진행 현황 · 계획 · 구조
├── rules.md                        # 공통 개발 규칙
├── docs/
│   ├── DATA_MODEL.md               # 데이터 형식 · DB 설계 · 권한별 공개 범위
│   ├── API_SPEC.md                 # API 45개 요청 · 응답 · 오류 계약
│   ├── ARCHITECTURE.md             # 프론트 계층 구조 · TanStack Query 기준
│   ├── BUSINESS_LOGIC.md           # 이동 안내 → business-logic/
│   ├── business-logic/             # 기능별 비즈니스 규칙 · 검증 · 예외 · 백엔드 구현 항목 (설계만, 기능별 md)
│   ├── backend/API.SPEC.md         # 백엔드(FastAPI) REST API 명세 (Mock 기준 + 비즈니스 로직)
│   ├── frontend/README.md          # 프론트 실행 방법 · 체험 계정 · 연동 방법
│   ├── product/                    # 기획 문서
│   │   ├── DEFINITION.md           #   제품 정의서
│   │   ├── FEATURE_SPEC.md         #   기능명세서 (F-01 ~ F-16)
│   │   ├── TechStack.md            #   기술 스택 · 아키텍처
│   │   ├── UserScenario.md         #   사용자 시나리오
│   │   ├── PERSONA.md              #   페르소나
│   │   └── PTS.md                  #   보조 문서
│   └── design/                     # 디자인 문서
│       ├── components/
│       │   ├── base.md             #   디자인 시스템 (토큰 · 컴포넌트 · 레이아웃)
│       │   └── screen.md           #   공통 화면 설계 기준 · UI ID 목록
│       └── pages/                  #   화면별 명세 (UI-01 ~ UI-29)
│           ├── 01_auth.md          #     랜딩 · 회원가입 · 로그인
│           ├── 02_home.md          #     홈
│           ├── 03_my_funding.md    #     내 펀딩 · 펀딩 생성 · 상세 · 후원자 내역
│           ├── 04_gift.md          #     선물 등록 · AI 추천
│           ├── 05_group.md         #     그룹 · 생성 · 상세 · 초대 관리
│           ├── 06_friend_funding.md#     친구 펀딩 · 초대 참여 · 상세
│           ├── 07_donation.md      #     후원 · 완료 · 내 후원 내역
│           ├── 08_settlement.md    #     종료 결과 · 목표 미달 · 정산
│           ├── 09_mypage.md        #     마이페이지 · 프로필 · 취향 · 편지함
│           └── 10_others.md        #     생일 캘린더 · 알림
├── frontend/                       # Phase 1 — Next.js 프론트엔드
│   ├── CLAUDE.md                   #   AI 협업 지침
│   ├── AGENTS.md                   #   Next.js 16 안내 (자동 생성)
│   ├── package.json / package-lock.json
│   ├── next.config.ts              #   cacheComponents · partialPrefetching
│   ├── vitest.config.mts           #   테스트 설정
│   ├── tsconfig.json / eslint.config.mjs / next-env.d.ts / .gitignore
│   └── src/
│       ├── app/                    # 화면(라우트)
│       │   ├── layout.tsx          #   루트: 폰트 · AuthProvider · AppShell · Toaster
│       │   ├── globals.css         #   디자인 토큰 (base.md → Tailwind 테마)
│       │   ├── (public)/           #   비로그인 화면 (하단 탭 없음)
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx        #     UI-01 랜딩  /
│       │   │   ├── signup/         #     UI-02 회원가입
│       │   │   └── login/          #     UI-03 로그인
│       │   └── (app)/              #   로그인 필요 화면 (AuthGuard)
│       │       ├── layout.tsx
│       │       ├── home/                         # UI-04 홈
│       │       ├── my-funding/                   # UI-05 내 펀딩
│       │       ├── create-funding/               # UI-09 펀딩 생성
│       │       ├── add-gift/                     # UI-10 선물 등록 · 수정
│       │       ├── ai-recommend/                 # UI-11 AI 선물 추천
│       │       ├── my-funding-detail/[fundingId]/
│       │       │   ├── page.tsx                  # UI-12 내 펀딩 상세 · 관리 (펀딩 삭제)
│       │       │   ├── supporter-list/           # UI-13 후원자 내역
│       │       │   ├── funding-result/           # UI-22 종료 결과
│       │       │   ├── unmet-goal/               # UI-23 목표 미달 처리
│       │       │   └── settlement/               # UI-24 정산 관리
│       │       ├── group/                        # UI-06 그룹
│       │       ├── create-group/                 # UI-14 그룹 생성
│       │       ├── group-detail/[groupId]/
│       │       │   ├── page.tsx                  # UI-15 그룹 상세
│       │       │   └── invite-management/        # UI-16 초대 링크 관리
│       │       ├── friend-funding/               # UI-07 친구 펀딩
│       │       ├── join-invite/                  # UI-17 초대 확인 · 참여
│       │       ├── friend-funding-detail/[fundingId]/  # UI-18 친구 펀딩 상세
│       │       ├── donation/[giftId]/            # UI-19 후원 · 축하 메시지
│       │       ├── donation-complete/[donationId]/     # UI-20 후원 완료
│       │       ├── my-donations/                 # UI-21 내 후원 내역
│       │       ├── mypage/                       # UI-08 마이페이지
│       │       ├── edit-profile/                 # UI-25 프로필 수정
│       │       ├── gift-preferences/             # UI-26 선물 취향 설정
│       │       ├── message-inbox/                # UI-27 축하 편지함 (?fundingId)
│       │       ├── birthday-calendar/            # UI-28 생일 캘린더
│       │       └── notifications/                # UI-29 알림
│       ├── components/
│       │   ├── ui/                 # 기본 UI (shadcn 방식): button · input · dialog · checkbox · badge · skeleton · sonner
│       │   ├── layout/             # AppShell · AppHeader · BottomTabBar · Screen · RetroWindow · AuthGuard
│       │   ├── common/             # StateViews · FormField · ConfirmDialog · DeleteConfirmDialog · DeleteSection · BirthdayPicker · MockNotice · ProfileAvatar
│       │   ├── providers/          # QueryProvider (TanStack Query 설정)
│       │   ├── funding/            # GiftCard · FundingCards · FundingProgress · FundingInfo · FundingStatusBadge · ShortfallBadge
│       │   ├── donation/           # DonationAmountForm · DonationMessageCard
│       │   ├── gift/               # GiftForm · GiftImageUploader · KeywordInput(+ToggleChips)
│       │   ├── invite/             # InviteLinkForm
│       │   └── calendar/           # BirthdayCalendar (FullCalendar)
│       ├── hooks/
│       │   ├── queryKeys.ts        # 쿼리 키 모음
│       │   └── queries/            # 도메인별 useQuery · useMutation 훅 (화면은 이것만 사용)
│       ├── lib/
│       │   ├── api/                # 도메인 API 함수 (http + mappers) — docs/API_SPEC.md 계약
│       │   │   ├── http.ts         #   HTTP 클라이언트 · mock/http 모드 전환 · 오류 → ApiError
│       │   │   ├── case.ts · dto.ts · mappers.ts  # snake ↔ camel 변환 · 서버 JSON 타입 · 변환 함수
│       │   │   ├── client.ts       #   ApiError · 토큰 보관
│       │   │   ├── auth.ts         #   회원 · 프로필 · 취향
│       │   │   ├── groups.ts       #   그룹 · 초대 링크
│       │   │   ├── fundings.ts     #   펀딩 · 선물
│       │   │   ├── donations.ts    #   후원 · 축하 메시지
│       │   │   ├── settlements.ts  #   목표 미달 · 정산
│       │   │   ├── schedule.ts     #   생일 캘린더 · 알림
│       │   │   └── ai.ts           #   AI 선물 추천 (모의)
│       │   ├── mock/               # Mock 서버 (연동 후 삭제)
│       │   │   ├── router.ts · token.ts          # 경로 → 핸들러 · 토큰
│       │   │   ├── handlers/       #   도메인별 서버 로직
│       │   │   ├── db.ts · seed.ts · access.ts   # 모의 DB · 시드 · 권한 검사
│       │   ├── constants.ts · paths.ts  # 고정 값 · 화면 경로 만들기
│       │   ├── auth.tsx            # 로그인 상태 Context
│       │   ├── withFreshState.tsx  # 새 진입 시 화면 상태 초기화 (Next.js 16 Activity 대응)
│       │   ├── format.ts           # 금액 · 날짜 · 달성률 계산
│       │   ├── validation.ts       # 입력값 검증
│       │   ├── fundingDraft.ts     # 펀딩 생성 임시 저장
│       │   ├── image.ts            # 이미지 축소 · 형식 검사
│       │   └── utils.ts            # cn()
│       ├── types/index.ts          # 도메인 타입 (생일자용 / 후원자용 분리)
│       └── test/setup.ts           # 테스트 공통 설정
│       # 테스트 파일: *.test.ts(x) — 각 대상 파일 옆에 위치
└── backend/                        # Phase 2 — FastAPI (예정, 아직 없음)
    ├── app/
    │   ├── main.py                 #   FastAPI 앱 · 라우터 등록
    │   ├── core/                   #   설정 · 보안(JWT · Argon2) · DB 세션
    │   ├── models/                 #   SQLAlchemy 모델
    │   ├── schemas/                #   Pydantic 요청 · 응답
    │   ├── api/                    #   라우터 (auth · groups · fundings · donations · settlements · schedule · ai)
    │   ├── services/               #   비즈니스 로직 (후원 트랜잭션 · 정산 · 알림 생성)
    │   └── scheduler.py            #   APScheduler 작업
    ├── alembic/                    #   마이그레이션
    ├── tests/                      #   pytest
    ├── docker-compose.yml          #   PostgreSQL
    └── requirements.txt (또는 pyproject.toml)
```
