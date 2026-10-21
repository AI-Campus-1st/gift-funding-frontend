# docs/backend/API.SPEC.md — 백엔드(FastAPI) REST API 명세서

> 작성일: 2026-10-19 · 상태: **설계 문서 (서버 코드 없음)**
> 근거
> - 엔드포인트 · 요청 · 응답 · 오류: 프론트 Mock 서버 `frontend/src/lib/mock/handlers/*.ts` (46개, 화면에서 실제로 쓰는 계약)
> - 비즈니스 로직: `docs/product/FEATURE_SPEC.md` (F-01 ~ F-16), 확정 정책은 `docs/business-logic/99-open-questions.md` 13.0
> - 함께 보는 문서: `docs/API_SPEC.md`(프론트 기준 계약, 같은 번호 사용), `docs/business-logic/00-data-relations.md`(테이블 관계)
>
> 작성 원칙
> - 데이터 처리는 **CRUD**로 구성한다. 단순 조회 · 생성 · 수정 · 삭제는 표로 간단히 적는다.
> - CRUD만으로 끝나지 않는 API(검증 · 권한 · 계산 · 트랜잭션이 필요한 것)는 **비즈니스 로직 API**로 따로 적고 처리 순서와 오류를 자세히 적는다.
> - 경로 · 필드 이름은 Mock과 **똑같이** 맞춘다. 그래야 프론트가 설정(`NEXT_PUBLIC_API_MODE=http`)만 바꿔 연결할 수 있다.
> - 명세서에 없는 정책은 정하지 않는다. 미정 값은 ❓로 표시한다.
>
> 변경 이력
> - 2026-10-19 미정 정책 확정 반영 (Q2 · Q3 · Q10 · Q11-1 ① · Q16 · Q17 · Q18 · Q19 · Q20)
> - 2026-10-19 글자 수 확정(Q1 · Q4) 반영
> - 2026-10-20 AI 추천 GPT(`gpt-4o-mini`) 연결 확정 (Q21~Q24) — Gemini는 접근 거부(403)로 변경
- 2026-10-19 정산 계좌번호 암호화 방식 확정 (Fernet + `ACCOUNT_ENCRYPTION_KEY`)
- 2026-10-19 선물 가격 최대 5,000만 원 · 후원 중복 방지 키 형식 검사 확정
- 2026-10-19 그룹을 만든 사람의 권한 확정: G9 그룹 이름 · 설명 수정 추가(관리자만, Q9) · F3 펀딩은 내가 만든 그룹에만
- 2026-10-19 검토 반영: F4 삭제 시 알림 종류별 처리 · G7/G8 이동 펀딩 규칙과 커밋 시점 · F3 시작일(오늘 포함) 문구 · S1 0원 선물 판단 · S3 중복 정산 상태 · D1 재전송 우선 규칙

---

## 0. 공통 규칙

### 0.1 기본

| 항목 | 내용 |
|---|---|
| Base URL | `{NEXT_PUBLIC_API_BASE_URL}/api/v1` (예: 로컬 `http://localhost:8000/api/v1`) — 아래 경로는 이 뒤에 붙는다. 예) `POST /auth/login` → `http://localhost:8000/api/v1/auth/login`. 서버 상태 확인 `GET /health`만 `/api/v1` 없이 둔다 |
| 형식 | `Content-Type: application/json; charset=utf-8` |
| 필드 이름 | **snake_case** (프론트가 camelCase로 바꿔 쓴다) |
| 글자 수 (📌 Q1 · Q4) | 사용자 이름 50 · 이메일 255 · 그룹 이름 30 · 그룹 설명 100 · 펀딩 이름 40 · 선물 이름 100 · 선물 설명 100 · 친구 이름 20 · 축하 메시지 200 (화면 = 서버 = DB, `docs/backend/ERD.md` 0장). 넘으면 `400 VALIDATION` "OO은 N자 이내로 입력해 주세요." |
| 날짜 | 날짜만: `YYYY-MM-DD` · 시각: ISO 8601 (`2026-10-19T09:00:00+09:00`) |
| 금액 | 원 단위 **정수** |
| ID | 문자열 (DB는 UUID) |
| 기준 시간대 | Asia/Seoul — 펀딩 상태 · 생일 · 알림 날짜 계산 |

### 0.2 인증

- 로그인(A2) 응답의 `access_token`(JWT)을 `Authorization: Bearer {token}` 헤더로 보낸다.
- 표의 **권한** 칸이 `공개`가 아니면 모두 로그인이 필요하다. 토큰이 없거나 만료되면 `401 UNAUTHORIZED`.
- 비밀번호는 Argon2로 해시해 저장한다. 원문 · 확인값은 저장하지 않는다.

### 0.3 성공 응답

| 상황 | 상태 | 본문 |
|---|---|---|
| 조회 | `200` | 해당 객체 또는 배열 |
| 생성 | `201` | `{ "id": "..." }` (후원은 `{ "donation_id": "..." }`) |
| 수정 · 삭제 · 처리(반환할 내용 없음) | `204` | 없음 |

### 0.4 오류 응답

```json
{
  "code": "EXCEEDS_REMAINING",
  "message": "현재 이 선물에는 최대 30,000원까지 후원할 수 있습니다. 후원 금액을 수정해 주세요.",
  "field_errors": { "amount": "..." },
  "max_available": 30000
}
```

- `field_errors`: 입력값 오류일 때 필드별 문구 (선택)
- `max_available`: 초과 후원일 때만 (F-10)
- `message`는 화면에 그대로 보여준다.

| code | HTTP | 뜻 |
|---|---|---|
| `VALIDATION` | 400 | 입력값 오류 · 처리 조건 불충족 |
| `UNAUTHORIZED` | 401 | 로그인 필요 · 토큰 만료 |
| `INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호 불일치 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 대상 없음 |
| `INVITE_INVALID` | 404 | 없는 초대 링크 |
| `DUPLICATE_EMAIL` | 409 | 이미 가입된 이메일 |
| `CONFLICT` | 409 | 이미 처리됨 · 중복 · 삭제 불가 상태 |
| `GIFT_LOCKED` | 409 | 후원 · 이월 금액이 있어 선물 변경 불가 |
| `GOAL_REACHED` | 409 | 목표 달성으로 후원 마감 |
| `EXCEEDS_REMAINING` | 409 | 남은 금액 초과 후원 |
| `FUNDING_NOT_ACTIVE` | 409 | 펀딩 상태 때문에 처리 불가 (진행 중 아님 / 종료 전 / 종료 후) |
| `INVITE_INACTIVE` | 410 | 비활성화된 초대 링크 |
| `INVITE_EXPIRED` | 410 | 펀딩 종료로 만료된 초대 링크 |
| `AI_UNAVAILABLE` | 502 | AI 호출 실패 · 응답 형식 오류 (백엔드 신규) |
| `INTERNAL` | 500 | 서버 오류 |

---

## 1. 전체 API 목록

구분: **C** = 기본 CRUD (2장 표로 정리) · **B** = 비즈니스 로직 API (도메인별 상세)

| # | Method | Endpoint | 설명 | 권한 | 구분 | 기능 |
|---|---|---|---|---|---|---|
| A1 | POST | `/auth/signup` | 회원가입 | 공개 | B | F-01 |
| A2 | POST | `/auth/login` | 로그인 · 토큰 발급 | 공개 | B | F-01 |
| A3 | POST | `/auth/logout` | 로그아웃 | 로그인 | C | F-01 |
| A4 | GET | `/me` | 내 정보 조회 | 로그인 | C | F-02 |
| A5 | PATCH | `/me` | 내 프로필 수정 | 로그인 | C | F-02 |
| A6 | GET | `/me/preferences` | 선물 취향 조회 | 로그인 | C | F-02 |
| A7 | PUT | `/me/preferences` | 선물 취향 저장 | 로그인 | C | F-02 |
| G1 | GET | `/groups` | 내 그룹 목록 (만든 · 참여한) | 로그인 | C | F-05 |
| G2 | POST | `/groups` | 그룹 생성 | 로그인 | C | F-05 |
| G3 | GET | `/groups/{group_id}` | 그룹 상세 · 참여자 | 그룹 참여자 | C | F-05 |
| G4 | GET | `/groups/{group_id}/invites?funding_id=` | 초대 링크 목록 | 관리자 · 생일자 | B | F-06 |
| G5 | POST | `/groups/{group_id}/invites` | 초대 링크 생성 | 관리자 · 생일자 | B | F-06 |
| G6 | PATCH | `/invites/{token}` | 초대 링크 비활성화 | 관리자 · 생일자 | B | F-06 |
| G7 | GET | `/invites/{token}` | 초대 링크 확인 (참여 전 정보) | 로그인 | B | F-06 |
| G8 | POST | `/invites/{token}/join` | 초대 링크로 참여 | 로그인 | B | F-06 |
| G9 | PATCH | `/groups/{group_id}` | 그룹 이름 · 설명 수정 | 그룹 관리자 | C | F-05 |
| F1 | GET | `/me/fundings` | 내 펀딩 목록 | 본인 | C | F-07 · F-09 |
| F2 | GET | `/me/fundings/{funding_id}` | 내 펀딩 상세 | 생일자 | C | F-07 · F-09 |
| F3 | POST | `/fundings` | 펀딩 생성 (+ 선물 · 이월 선물 다시 열기) | 그룹 관리자(만든 사람) | B | F-07 |
| F14 | PATCH | `/fundings/{funding_id}` | 펀딩 이름 수정 | 생일자 | B | F-07 |
| F4 | DELETE | `/fundings/{funding_id}` | 펀딩 삭제 | 생일자 | B | F-07 |
| F5 | POST | `/fundings/{funding_id}/gifts` | 선물 추가 | 생일자 | B | F-04 |
| F6 | GET | `/me/gifts/{gift_id}` | 선물 수정용 조회 | 생일자 | C | F-04 |
| F7 | PUT | `/gifts/{gift_id}` | 선물 수정 | 생일자 | B | F-04 |
| F8 | DELETE | `/gifts/{gift_id}` | 선물 삭제 | 생일자 | B | F-04 |
| F9 | GET | `/fundings/{funding_id}/donations` | 후원자 내역 (생일자 전용) | 생일자 | C | F-13 |
| F10 | GET | `/fundings/friends` | 친구 펀딩 목록 | 로그인 | C | F-06 · F-13 |
| F11 | GET | `/fundings/{funding_id}` | 친구 펀딩 상세 (후원자용) | 후원자 | C | F-13 |
| F12 | GET | `/gifts/{gift_id}` | 후원할 선물 조회 (후원자용) | 후원자 | C | F-08 |
| F13 | GET | `/me/carryovers` | 다시 열 수 있는 이월 선물 | 본인 | C | F-07 · F-11 |
| D1 | POST | `/donations` | 후원하기 (+ 축하 메시지) | 후원자 | B | F-08 · F-10 · F-14 |
| D2 | GET | `/me/donations?funding_id=` | 내 후원 내역 | 본인 | C | F-08 · F-13 |
| D3 | GET | `/me/donations/{donation_id}` | 내 후원 1건 | 본인 | C | F-08 |
| D4 | GET | `/me/messages?funding_id=` | 받은 축하 메시지 | 생일자 | C | F-14 |
| S1 | POST | `/gifts/{gift_id}/shortfall` | 목표 미달 처리 (이월 / 인출) | 생일자 | B | F-11 |
| S2 | GET | `/fundings/{funding_id}/settlement` | 정산 현황 | 생일자 | B | F-12 |
| S3 | POST | `/fundings/{funding_id}/settlements` | 정산 요청 | 생일자 | B | F-12 |
| C1 | GET | `/birthday-events` | 생일 일정 목록 | 본인 | C | F-15 |
| C2 | GET | `/birthday-events/linkable-fundings` | 연결 가능한 펀딩 | 본인 | C | F-15 |
| C3 | POST | `/birthday-events` | 생일 일정 등록 | 본인 | C | F-15 |
| C4 | PUT | `/birthday-events/{event_id}` | 생일 일정 수정 | 일정 주인 | C | F-15 |
| C5 | DELETE | `/birthday-events/{event_id}` | 생일 일정 삭제 (+ 알림 삭제) | 일정 주인 | C | F-15 |
| N1 | GET | `/notifications` | 알림 목록 | 본인 | B | F-16 |
| N2 | GET | `/notifications/unread-count` | 안 읽은 알림 수 | 본인 | C | F-16 |
| N3 | PATCH | `/notifications/{notification_id}` | 알림 읽음 | 본인 | C | F-16 |
| N4 | POST | `/notifications/read-all` | 모두 읽음 | 본인 | C | F-16 |
| R1 | POST | `/ai/recommendations` | AI 선물 추천 | 로그인 | B | F-03 |

---

## 2. 데이터 형식 (Response 객체)

반복해서 쓰는 응답 객체. `?`는 NULL 가능.

### 2.1 사용자

```
UserDto            { id, name, email, birthday: "YYYY-MM-DD", profile_image_url? }
PreferenceDto      { keywords: string[], categories: string[],
                     price_range?: "under30k" | "30k-100k" | "100k-300k" | "300k-500k" | "over500k" }
AuthTokenDto       { access_token, token_type: "bearer", expires_in: number /*초*/, user: UserDto }
```

### 2.2 그룹 · 초대

```
GroupFundingDto    { id, name, owner_name, is_mine: boolean, status: FundingStatus }
GroupSummaryDto    { id, name, description, member_count, is_admin: boolean,
                     fundings: GroupFundingDto[] }            // 내가 볼 수 있는 연결 펀딩만
GroupDetailDto     GroupSummaryDto + { members: { id, name, is_admin }[] }   // 이메일 없음
InviteDto          { token, group_id, group_name, funding_id?, funding_name?,
                     is_active: boolean, is_expired: boolean, created_at }
InvitePreviewDto   { token, group_name, funding_name?, owner_name?, already_joined: boolean,
                     target_funding_id? }
JoinResultDto      { group_id, target_funding_id?, target_is_mine: boolean, already_joined: boolean }
```

### 2.3 펀딩 · 선물 — 권한별로 다른 응답 (F-13)

```
FundingStatus      "scheduled" | "active" | "ended"           // 저장하지 않고 날짜로 계산
FundingBaseDto     { id, name, group_id, group_name, owner_name, start_date, end_date, status }

SupporterGiftDto   { id, name, price, image_url, product_url, description,
                     achievement_rate: 0~100, is_closed: boolean }          // 모금액 필드 없음
OwnerGiftDto       SupporterGiftDto + {
                     raised_amount, remaining_amount, donation_count,
                     shortfall_action?: "carryover" | "withdraw",
                     settled: boolean,
                     settlement_status?: "requested" | "processing" | "completed" | "failed",
                     carried_over_amount }                                   // 생일자 전용

OwnerFundingDto    FundingBaseDto + { gifts: OwnerGiftDto[], total_raised }
FriendFundingDto   FundingBaseDto + { gifts: SupporterGiftDto[] }

GiftEditDto        { funding_id, name, price, image_url, product_url, description,
                     has_donations: boolean }       // true면 가격 변경 · 삭제 불가
GiftForDonationDto { funding: FundingBaseDto, gift: SupporterGiftDto }
SupporterDonationDto { id, supporter_name, gift_id, gift_name, amount, created_at }
PendingCarryoverDto  { id, funding_name, gift_name, price, image_url, product_url, description,
                       amount /*이월 금액*/, created_at }
```

### 2.4 후원 · 메시지

```
MyDonationDto      { id, funding_id, funding_name, owner_name, gift_id, gift_name, amount,
                     has_message: boolean, created_at, status: "completed" }
ReceivedMessageDto { id, author_name, content, funding_name, gift_name, created_at }
```

### 2.5 정산

```
SettlementRecordDto  { id, funding_id, gift_names: string[], amount, bank,
                       account_number_masked, account_holder,
                       status: "requested" | "processing" | "completed" | "failed",
                       requested_at, failure_reason?: "ACCOUNT_INVALID" | "BANK_ERROR" }
SettlementOverviewDto {
  funding_id, funding_name,
  eligible_gifts:  { id, name, amount, reason: "achieved" | "withdraw" }[],
  eligible_amount,
  carryover_gifts: { id, name, amount }[],
  history: SettlementRecordDto[] }
```

### 2.6 캘린더 · 알림 · AI

```
BirthdayEventDto   { id, friend_name, birthday, linked_funding_id?, linked_funding_name?,
                     can_open_linked_funding: boolean, linked_funding_is_mine: boolean }
LinkableFundingDto { id, name }
NotificationDto    { id, type: "birthday-before" | "birthday-today" | "shortfall-reminder",
                     title, body, created_at, is_read: boolean,
                     event_id?, funding_id?, can_open_funding: boolean, funding_is_mine: boolean }
AiRecommendationDto { id, name, reason, category, price_min, price_max }
```

---

## 3. 사용자 관리 (F-01, F-02)

### 3.1 기본 CRUD

| # | Method | Endpoint | Request | Response |
|---|---|---|---|---|
| A3 | POST | `/auth/logout` | — | `204` |
| A4 | GET | `/me` | — | `200 UserDto` |
| A5 | PATCH | `/me` | `{ name, birthday, profile_image_url? }` | `200 UserDto` · `400 VALIDATION`(이름 · 생년월일) |
| A6 | GET | `/me/preferences` | — | `200 PreferenceDto` |
| A7 | PUT | `/me/preferences` | `{ keywords[], categories[], price_range? }` | `200 PreferenceDto` — 키워드는 공백 · 중복 제거 후 최대 10개(📌 Q3) |

### 3.2 비즈니스 로직 API

#### A1. 회원가입 — `POST /auth/signup`

**Request**
```json
{ "name": "김서연", "email": "seoyeon@example.com", "password": "password123",
  "password_confirm": "password123", "birthday": "1998-10-24" }
```
**Response** `201 { "id": "..." }`

**처리 규칙 (F-01)**
1. 필수값 전부 다시 검증한다 (프론트 검증과 같은 규칙, 실패 시 `field_errors`).

   | 필드 | 규칙 | 문구 |
   |---|---|---|
   | name | 비어 있지 않음 · 📌 최대 50자 | 이름을 입력해 주세요. / 이름은 50자 이내로 입력해 주세요. |
   | email | 형식 | 올바른 이메일 형식으로 입력해 주세요. |
   | password | 8자 이상 | 비밀번호는 8자 이상 입력해 주세요. |
   | password_confirm | password와 같음 | 비밀번호가 일치하지 않습니다. |
   | birthday | 유효한 날짜 · 오늘 이후 불가 | 오늘 이후 날짜는 선택할 수 없습니다. |
2. 이메일은 앞뒤 공백 제거 · 소문자로 바꿔 비교한다. 이미 있으면 `409 DUPLICATE_EMAIL` (`field_errors.email`).
3. 비밀번호는 Argon2 해시로 저장. `password_confirm`은 저장하지 않는다.
4. 빈 선물 취향(키워드 · 카테고리 없음)을 함께 만든다.

**백엔드 보장**: `users.email` UNIQUE (동시 가입 대비)

#### A2. 로그인 — `POST /auth/login`

**Request** `{ "email", "password", "remember_me": boolean }`
**Response** `200 AuthTokenDto`

**처리 규칙 (F-01)**
1. 이메일(소문자) · 비밀번호 해시를 비교한다.
2. 실패 문구는 이메일 가입 여부를 드러내지 않도록 하나로 통일: `401 INVALID_CREDENTIALS` "이메일 또는 비밀번호를 확인해 주세요."
3. 📌 토큰 유효기간은 **30일**이다 (`expires_in` = 2592000초). `remember_me`는 서버 동작에 영향이 없고, 프론트가 브라우저를 닫아도 토큰을 남길지만 정한다 (Q16, 2026-10-19 확정).

---

## 4. 그룹 · 초대 (F-05, F-06)

### 4.1 기본 CRUD

| # | Method | Endpoint | Request | Response |
|---|---|---|---|---|
| G1 | GET | `/groups` | — | `200 { created: GroupSummaryDto[], joined: GroupSummaryDto[] }` — 관리자인 그룹 / 참여만 한 그룹 |
| G2 | POST | `/groups` | `{ name, description }` | `201 { id }` — 만든 사람이 관리자이자 첫 참여자 (그룹 생성 + 참여를 한 트랜잭션) · 이름 비면 `400` "그룹 이름을 입력해 주세요." |
| G3 | GET | `/groups/{group_id}` | — | `200 GroupDetailDto` · 없으면 `404` · 참여자가 아니면 `403` |
| G9 | PATCH | `/groups/{group_id}` | `{ name, description }` | `200 GroupDetailDto` · 관리자가 아니면 `403` "그룹 관리자만 수정할 수 있어요." · 검증은 G2와 같음 (이름 필수 30자 · 설명 100자) |

- 📌 그룹 이름 · 설명은 **그룹을 만든 사람(관리자)만** 수정한다 (G9, 2026-10-19 확정 Q9).
- 그룹 **삭제 API는 없다** (FEATURE_SPEC F-05).
- 📌 펀딩은 **그 그룹을 만든 사람만** 열 수 있다 (F3). 한 사람이 그룹을 여러 개 만들고 그룹마다 펀딩을 열 수 있다.
- `fundings`에는 그 그룹에 연결된 펀딩 중 **요청자가 볼 수 있는 것만** 넣는다.
- 📌 `fundings`는 **최신순**(시작일이 늦은 펀딩이 먼저, 같으면 나중에 만든 것 먼저)으로 준다 (2026-10-19 확정).

### 4.2 비즈니스 로직 API

공통 — **초대 링크 관리 권한**: 그룹 관리자는 그 그룹의 모든 링크, 펀딩 생일자는 **자기 펀딩 지정 링크만** 관리한다 (F-06).
공통 — **만료**: `funding_id`가 있는 링크는 그 펀딩이 `ended`가 되면 만료(저장하지 않고 계산). 그룹 링크는 비활성화 전까지 유효.

#### G4. 초대 링크 목록 — `GET /groups/{group_id}/invites?funding_id=`

**Response** `200 InviteDto[]` (최신순)
- 관리자: 그룹의 모든 링크 · 생일자: `funding_id`로 지정한 자기 펀딩 링크만
- 그룹 참여자가 아니면 `403`, 관리 권한이 없으면 `403` "초대 링크는 그룹 관리자 또는 펀딩 생일자만 관리할 수 있어요."

#### G5. 초대 링크 생성 — `POST /groups/{group_id}/invites`

**Request** `{ "funding_id": "..." | null }` — null이면 그룹 링크
**Response** `201 InviteDto`

**처리 규칙**
1. 요청자가 그룹 참여자인지, 링크 관리 권한이 있는지 확인 (`403`).
2. `funding_id`가 있으면 **이 그룹에 연결된 펀딩**이어야 한다 → 아니면 `400` "이 그룹에 연결된 펀딩만 선택할 수 있어요."
3. 토큰은 Python `secrets`로 예측 불가하게 만든다 (`invites.token` UNIQUE).

#### G6. 초대 링크 비활성화 — `PATCH /invites/{token}`

**Request** `{ "is_active": false }` → **Response** `204`
- 없는 링크 `404` · 권한 없음 `403`. 링크는 **삭제하지 않고** 비활성화만 한다. 다시 활성화하지 않는다.

#### G7. 초대 링크 확인 — `GET /invites/{token}`

**Response** `200 InvitePreviewDto` — 참여 전 화면(UI-17)에 그룹 이름 · 펀딩 이름 · 생일자 이름 표시
**검사 순서** (G8과 공통)

| 순서 | 조건 | 오류 |
|---|---|---|
| 1 | 토큰이 없음 | `404 INVITE_INVALID` "유효하지 않거나 만료된 초대 링크입니다." |
| 2 | `is_active = false` | `410 INVITE_INACTIVE` "비활성화된 초대 링크라 참여할 수 없어요. 친구에게 새 링크를 요청해 주세요." |
| 3 | 지정 펀딩이 종료됨 | `410 INVITE_EXPIRED` "펀딩이 종료되어 만료된 초대 링크입니다." |

**참여 후 이동할 펀딩(`target_funding_id`)** — 📌 2026-10-19 확정 (G7 · G8 공통)

| 링크 종류 | `target_funding_id` | 프론트 이동 |
|---|---|---|
| 펀딩 지정 링크 | 그 펀딩 | 펀딩 상세 (내 펀딩이면 내 펀딩 관리) |
| 그룹 링크 · 진행 중(`active`)인 다른 사람 펀딩 있음 | 그중 **시작일이 가장 최근**인 펀딩 | 친구 펀딩 상세 |
| 그룹 링크 · 진행 중인 다른 사람 펀딩 없음 (예정 · 종료만 있거나 없음) | `null` | **그룹 상세** — 연결 펀딩이 진행 중 / 예정 / 종료 배지와 함께 목록으로 보인다 |

- 예정 · 종료 펀딩, 본인 펀딩으로는 자동 이동하지 않는다.
- G7에서 `target_funding_id`가 null이면 `funding_name` · `owner_name`도 null (화면: "참여 후 그룹 화면으로 이동해요")

#### G8. 초대 링크로 참여 — `POST /invites/{token}/join`

**Response** `200 JoinResultDto`
1. G7과 같은 순서로 링크를 검사한다.
2. 이미 참여 중이면 **새로 등록하지 않고** `already_joined: true`로 같은 결과를 돌려준다 (F-06 중복 참여 방지).
3. 아니면 `group_members`에 추가한다 (복합 PK로 중복 방지). 동시에 두 번 요청돼 PK가 충돌하면 오류가 아니라 `already_joined: true`로 응답한다.
4. **참여 저장(트랜잭션 커밋)을 마친 뒤에 응답한다.** 그래서 프론트가 응답을 받자마자 `target_funding_id`의 펀딩 상세(F11)로 이동해도 이미 그룹 참여자라 `403`이 나지 않는다. 같은 이유로 읽기 전용 복제 DB를 쓰면 F11 권한 확인은 기본(쓰기) DB에서 한다.
5. 📌 참여하면 그 그룹에 연결된 펀딩을 모두 볼 수 있다 (예정 · 진행 중 · 종료). 다른 그룹의 펀딩은 볼 수 없다.
6. 화면 경로는 서버가 주지 않는다. 프론트가 `target_funding_id` · `target_is_mine`으로 이동할 화면을 정한다 (null이면 그룹 상세 `/group-detail/{group_id}`).

---

## 5. 펀딩 · 선물 (F-04, F-07, F-09, F-13)

공통 — **권한**: 생일자 = `fundings.owner_id`. 후원자 = 펀딩이 연결된 그룹의 참여자이면서 생일자가 아닌 사람.
공통 — **계산 값** (저장하지 않음, 조회 때 계산)
- 선물 모금액 = 그 선물의 후원 합계 + 이 선물로 다시 연 이월 금액
- 남은 금액 = `price − 모금액` (최소 0) · 달성률 = `floor(모금액 ÷ price × 100)` (최대 100) · 마감 = 달성률 100
- 펀딩 상태 = 오늘 < 시작일 → `scheduled`, 종료일 이하 → `active`, 이후 → `ended`
- `settlement_status` = 그 선물이 들어간 실패하지 않은 정산의 상태 (없으면 null)

### 5.1 기본 CRUD

| # | Method | Endpoint | Request | Response |
|---|---|---|---|---|
| F1 | GET | `/me/fundings` | — | `200 OwnerFundingDto[]` (시작일 최신순) |
| F2 | GET | `/me/fundings/{funding_id}` | — | `200 OwnerFundingDto` · 없음 `404` · 생일자 아님 `403` |
| F6 | GET | `/me/gifts/{gift_id}` | — | `200 GiftEditDto` — `has_donations`: 후원 또는 이월 금액이 있으면 true |
| F9 | GET | `/fundings/{funding_id}/donations` | — | `200 SupporterDonationDto[]` (최신순) · 생일자만 |
| F10 | GET | `/fundings/friends` | — | `200 FriendFundingDto[]` — 내가 참여한 그룹에 연결된 **다른 사람** 펀딩 (최신순) |
| F11 | GET | `/fundings/{funding_id}` | — | `200 FriendFundingDto` · 본인 펀딩이면 `403` "본인 펀딩은 내 펀딩 메뉴에서 관리해 주세요." · 그룹 참여자 아님 `403` |
| F12 | GET | `/gifts/{gift_id}` | — | `200 GiftForDonationDto` (후원자용 선물 정보, 권한은 F11과 같음) |
| F13 | GET | `/me/carryovers?status=pending` | — | `200 PendingCarryoverDto[]` — 아직 다시 열지 않은 내 이월 선물 (오래된 순) |

> **F-13 비공개 원칙**: 후원자 응답(`FriendFundingDto`, `SupporterGiftDto`)에는 `raised_amount`, `remaining_amount`, `total_raised`, 후원자 목록을 **응답 모델에서 아예 뺀다**. 화면에서 숨기는 방식이 아니다.

### 5.2 비즈니스 로직 API

#### F3. 펀딩 생성 — `POST /fundings`

**Request**
```json
{
  "name": "나의 25번째 생일선물",
  "group_id": "g_college",
  "start_date": "2026-10-20",
  "end_date": "2026-11-05",
  "gifts": [
    { "name": "무선 헤드폰", "price": 359000, "image_url": "...", "product_url": "https://...", "description": "" }
  ],
  "carryover_ids": ["co_camera"]
}
```
**Response** `201 { "id": "..." }`

**처리 규칙 (F-07, F-04)**
1. 입력값 검증 (`400 VALIDATION` + `field_errors`)

   | 필드 | 규칙 | 문구 |
   |---|---|---|
   | name | 필수 | 펀딩 이름을 입력해 주세요. |
   | group_id | 필수 | 그룹을 선택해 주세요. |
   | start_date | 필수 · 📌 **오늘 포함** 이후 (`start_date >= 오늘`, Asia/Seoul). 오늘로 정하면 만들자마자 `active` | 시작일은 오늘 이전으로 선택할 수 없어요. |
   | end_date | 필수 · 시작일 이후 · 📌 시작일 포함 최대 21일 | 펀딩 기간은 최대 3주(21일)까지 설정할 수 있어요. |
   | gifts + carryover_ids | 합쳐서 1개 이상 | 선물을 최소 1개 이상 등록해 주세요. |
   | gifts[*] | 이름 · 가격(>0 정수) · 이미지 · URL 형식 필수 · 📌 가격 최대 50,000,000원 (2026-10-19 확정, F5 · F7 도 같음) | 선물 정보를 확인해 주세요. (가격 초과: "선물 가격은 50,000,000원 이하로 입력해 주세요.") |
2. 📌 요청자가 `group_id` 그룹을 **만든 사람(관리자)**인지 확인 → 아니면(참여만 한 그룹 · 없는 그룹 포함) `403` "내가 만든 그룹에만 펀딩을 열 수 있어요." (2026-10-19 확정 · 이월 선물 다시 열기도 같음)
3. `carryover_ids` 확인: 본인 이월 기록이어야 하고(`404`), `pending`이어야 한다(`409 CONFLICT` "이미 다시 연 이월 선물이에요.").
4. 펀딩 저장 (`owner_id` = 요청자 → 생일자).
5. `gifts`를 선물로 저장한다.
6. 📌 **이월 선물 다시 열기**: 이월 기록의 원래 선물 정보(이름 · 가격 · 이미지 · URL · 설명)를 복사해 새 선물을 만들고, 이월 기록을 `reopened`로 바꾼다(`reopened_funding_id` · `reopened_gift_id` · `reopened_at`). 이월 금액이 새 선물의 **시작 모금액**이 된다. 그룹은 새로 고를 수 있다.

- 📌 한 사용자가 진행 중 · 예정 펀딩을 여러 개 가질 수 있다 (개수 제한 없음, Q18 2026-10-19 확정).

**백엔드 보장**: 4~6을 **한 트랜잭션**으로 처리 · 이월 기록 행 잠금 · `carryovers.reopened_gift_id` UNIQUE

#### F14. 펀딩 이름 수정 — `PATCH /fundings/{funding_id}`

**Request** `{ "name": "바뀐 이름" }` → **Response** `200 OwnerFundingDto`
1. 생일자만 (`403`).
2. 📌 `start_date`, `end_date`, `group_id`가 들어오면 `400` "펀딩 기간과 연결 그룹은 수정할 수 없어요."
3. 📌 종료된 펀딩이면 `409 FUNDING_NOT_ACTIVE` "종료된 펀딩은 수정할 수 없어요." (예정 · 진행 중에는 변경 가능)
4. 이름이 비면 `400` "펀딩 이름을 입력해 주세요."

#### F4. 펀딩 삭제 — `DELETE /fundings/{funding_id}`

**Response** `204`
1. 생일자만 (`403`).
2. 📌 후원이 한 건이라도 있으면 `409 CONFLICT` "후원이 들어온 펀딩은 삭제할 수 없어요."
3. 📌 이월 금액이 들어간(다시 연) 펀딩이면 `409 CONFLICT` "이월 금액이 포함된 펀딩은 삭제할 수 없어요."
4. 삭제 · 연결 해제 (📌 2026-10-19 확정)

   | 연결 데이터 | 처리 |
   |---|---|
   | 선물 | 삭제 (CASCADE) |
   | 이 펀딩 지정 초대 링크 | 삭제 (CASCADE) |
   | **펀딩 알림** (`shortfall-reminder`) | 삭제 (CASCADE) |
   | **생일 알림** (`birthday-before` · `birthday-today`) | **삭제하지 않는다.** 생일 알림은 `funding_id`를 저장하지 않고(항상 NULL), 조회할 때 일정의 현재 연결 펀딩으로 판단한다 → 일정 연결이 끊기므로 `funding_id = null`, `can_open_funding = false`로 내려가고 누르면 생일 캘린더로 이동 |
   | 생일 일정 `linked_funding_id` | NULL로 변경 (SET NULL) |

**백엔드 보장**: 한 트랜잭션 · `donations` FK `ON DELETE RESTRICT`(안전장치) · Hard Delete (화면은 확인 모달 필수)

#### F5. 선물 추가 — `POST /fundings/{funding_id}/gifts`

**Request** `{ name, price, image_url, product_url, description }` → **Response** `201 { id }`
1. 생일자만 (`403`).
2. 📌 종료된 펀딩이면 `409 FUNDING_NOT_ACTIVE` "종료된 펀딩에는 선물을 추가할 수 없어요." (예정 · 진행 중에는 가능)
3. 선물 입력 검증 (F3 표와 같음). 가격 = 목표 금액.

#### F7. 선물 수정 — `PUT /gifts/{gift_id}`

**Request** `{ name, price, image_url, product_url, description }` → **Response** `204`
1. 생일자만 (`403`), 입력 검증 (`400`).
2. F-04: 후원 또는 이월 금액이 있는 선물의 **가격(목표 금액)을 바꾸려 하면** `409 GIFT_LOCKED` "후원 또는 이월 금액이 있는 선물은 가격(목표 금액)을 변경할 수 없어요." (가격이 같으면 다른 항목은 수정 가능)

**백엔드 보장**: 선물 행 잠금 후 후원 여부 확인 (수정 중 후원이 들어오는 경쟁 방지)

#### F8. 선물 삭제 — `DELETE /gifts/{gift_id}`

**Response** `204`

| 순서 | 조건 | 오류 |
|---|---|---|
| 1 | 생일자 아님 | `403` |
| 2 | 이월 금액이 들어간 선물 | `409 GIFT_LOCKED` "이월 금액이 포함된 선물은 삭제할 수 없어요." |
| 3 | 후원이 있는 선물 | `409 GIFT_LOCKED` "후원이 발생한 선물은 삭제할 수 없어요." |
| 4 | 펀딩의 마지막 선물 | `409 GIFT_LOCKED` "펀딩에는 선물이 최소 1개 있어야 해요." |

**백엔드 보장**: 선물 행 잠금 · `donations.gift_id ON DELETE RESTRICT`

---

## 6. 후원 · 축하 메시지 (F-08, F-10, F-13, F-14)

### 6.1 기본 CRUD

| # | Method | Endpoint | Request | Response |
|---|---|---|---|---|
| D2 | GET | `/me/donations?funding_id=` | — | `200 MyDonationDto[]` — **본인 후원만** (같은 선물 여러 번 후원도 각각, 최신순) |
| D3 | GET | `/me/donations/{donation_id}` | — | `200 MyDonationDto` · 없음 `404` · 남의 후원 `403` "본인의 후원 내역만 확인할 수 있어요." |
| D4 | GET | `/me/messages?funding_id=` | — | `200 ReceivedMessageDto[]` — 내 펀딩으로 온 메시지만 (최신순). `funding_id`가 남의 펀딩이면 `403` |

- 후원 · 메시지는 **수정 · 삭제 API가 없다** (기록 보호, 📌 후원 취소 · 환불은 이번 범위에서 제외, Q19).
- 메시지 작성자 이름은 항상 후원자 계정의 실명(`users.name`)이다. 요청 값으로 받지 않는다.

### 6.2 비즈니스 로직 API

#### D1. 후원하기 — `POST /donations`

**Request**
```json
{ "gift_id": "gift_headphone", "amount": 30000, "message": "생일 축하해!", "idempotency_key": "d4f1c2..." }
```
- `message`: 빈 문자열이면 메시지 없음
- `idempotency_key`: 프론트가 후원 시도마다 만든다. 네트워크 재전송 시에는 같은 값을 다시 보낸다.

**Response** `201 { "donation_id": "..." }`

**처리 순서 (F-08, F-10)**

| 순서 | 검사 · 처리 | 실패 시 |
|---|---|---|
| 0 | 📌 `idempotency_key`가 비었거나 64자 초과 (2026-10-19 확정) | `400 VALIDATION` "잘못된 요청이에요. 다시 시도해 주세요." |
| 1 | 같은 (후원자, `idempotency_key`)로 이미 저장된 후원이 있으면 **새로 저장하지 않고** 그 `donation_id`를 `201`로 돌려준다. **2~8의 검사를 하지 않는다** (아래 참고) | — (성공) |
| 2 | 선물 존재 | `404` "선물을 찾을 수 없어요." |
| 3 | 📌 후원자 권한: 생일자 본인이 아니고, 펀딩이 연결된 그룹의 참여자 | `403` "본인 펀딩은 내 펀딩 메뉴에서 관리해 주세요." / "이 펀딩에 접근할 권한이 없어요." |
| 4 | 📌 금액: 1원 단위 정수, 1원 이상 | `400 VALIDATION` "0원보다 큰 금액을 입력해 주세요." |
| 5 | 펀딩이 진행 중 (`active`) | `409 FUNDING_NOT_ACTIVE` "진행 중인 펀딩이 아니라 후원할 수 없어요." |
| 6 | 📌 메시지 최대 200자 | `400 VALIDATION` "축하 메시지는 200자 이내로 작성해 주세요." |
| 7 | **최신 모금액**으로 남은 금액 계산 → 0이면 마감 | `409 GOAL_REACHED` "후원이 마감된 선물입니다." |
| 8 | 금액 > 남은 금액 | `409 EXCEEDS_REMAINING` + `max_available` = 남은 금액 |
| 9 | 후원 저장 (+ 메시지가 있으면 메시지 저장) | — |

> ⚠️ **재전송(Retry) 규칙 — 순서 1은 반드시 다른 모든 검사보다 먼저 실행한다.**
> 첫 요청이 성공한 뒤 응답만 못 받은 클라이언트가 같은 키로 다시 보내면, 그 사이 선물이 마감(남은 금액 0)되었거나 펀딩이 종료되었더라도 **기존 성공 응답 `201 { donation_id }`를 그대로** 돌려준다. 상태 · 금액 검사를 먼저 하면 이미 성공한 후원에 `409 GOAL_REACHED` · `FUNDING_NOT_ACTIVE`를 잘못 보내게 된다.
> - 같은 키로 다시 온 요청은 금액 · 메시지가 달라도 새로 처리하지 않고 기존 결과를 돌려준다 (Mock과 같음).
> - 같은 키 요청 두 개가 **동시에** 들어와 UNIQUE 충돌이 나면, 늦은 쪽은 오류 대신 먼저 저장된 후원의 `donation_id`를 `201`로 돌려준다.
> - 키는 후원자별로 구분한다 (다른 사람의 키와 겹쳐도 상관없음).

**백엔드 보장 (F-10, 기능명세서 4.5)**
- 7~9를 **하나의 트랜잭션**으로 처리하고, 7 전에 **선물 행을 잠근다**(`SELECT … FOR UPDATE`). 동시에 여러 사람이 후원해도 목표 금액을 넘지 않는다.
- `(supporter_id, idempotency_key)` UNIQUE — 같은 요청이 동시에 두 번 들어와도 한 건만 저장된다.
- 후원과 메시지는 같은 트랜잭션 — 후원이 실패하면 메시지도 저장되지 않는다.
- 같은 사람이 **새 요청**(새 키)으로 같은 선물에 여러 번 후원하는 것은 허용한다.
- 실제 결제는 없다 (모의 후원, `status = completed`).

---

## 7. 목표 미달 · 정산 (F-11, F-12)

### 7.1 기본 CRUD

해당 없음 — 이 영역은 모두 비즈니스 로직 API다. (정산 · 이월 기록은 삭제 · 수정 API 없음)

### 7.2 비즈니스 로직 API

공통 — **정산 대상 선물** = 종료된 펀딩에서 (목표 달성 선물 + 인출을 고른 미달 선물) 중 모금액 > 0이고, 실패하지 않은 정산에 아직 들어가지 않은 선물. 이월한 선물은 제외.

#### S1. 목표 미달 처리 — `POST /gifts/{gift_id}/shortfall`

**Request** `{ "action": "carryover" | "withdraw" }` → **Response** `204`

| 순서 | 조건 | 오류 |
|---|---|---|
| 1 | `action` 값 | `400` "처리 방식을 선택해 주세요." |
| 2 | 선물 존재 · 생일자 | `404` / `403` |
| 3 | 펀딩 종료 | `409 FUNDING_NOT_ACTIVE` "펀딩이 종료된 후에 처리할 수 있어요." |
| 4 | 목표 달성 선물 아님 | `400` "목표를 달성한 선물은 정상 정산 대상이에요." |
| 5 | 📌 모금액 > 0 (0원 선물은 처리 대상 아님, 아래 참고) | `400` "모금액이 없어 처리할 금액이 없어요." |
| 6 | 아직 처리하지 않음 (한 번만, 변경 불가) | `409 CONFLICT` "이미 처리한 선물이에요. 같은 금액을 다시 처리할 수 없어요." |

**0원 선물 (📌 2026-10-19 확정 — 저장하지 않고 계산으로 판단)**
- 종료된 펀딩에서 모금액이 0원인 선물은 `shortfall_action`을 **NULL 그대로** 둔다. 새 상태 값을 저장하지 않고, 종료 시점에 따로 도는 작업도 없다.
- 조회 · 판단할 때 "펀딩 `ended` + 모금액 0원"이면 아래 모두에서 **제외**한다.

  | 대상 | 0원 선물 |
  |---|---|
  | S1 미달 처리 | 거절 (`400`) — 화면에도 선택지를 보여주지 않음 |
  | 미달 처리 필요 안내 (F2 응답을 보고 프론트가 계산) | 세지 않음 |
  | S2 `eligible_gifts` · S3 정산 | 제외 (`400` "정산할 수 없는 선물이 포함되어 있어요.") |
  | 7일 경과 `shortfall-reminder` | 세지 않음 (미처리 미달 선물 = `shortfall_action IS NULL AND 0 < 모금액 < price`) |
- 화면 배지는 "종료됨" (생일자 응답의 `raised_amount = 0`, `shortfall_action = null`로 프론트가 판단).

**처리**
- 공통: `gifts.shortfall_action` 기록 (+ `shortfall_decided_at`)
- `carryover`: 이월 기록 생성 `{ gift_id, amount = 현재 모금액, status: "pending" }` → 📌 다음 생일 펀딩(F3)에서 다시 열 수 있다. 📌 다시 연 선물이 또 미달이면 다시 이월할 수 있다(누적).
- `withdraw`: 별도 기록 없음 → S2 정산 대상에 들어간다.
- 개인 자금을 플랫폼 안에서 충전하는 기능은 없다 (기능명세서 4.6).

**백엔드 보장**: 선물 행 잠금 · 상태 기록과 이월 생성을 한 트랜잭션 · `carryovers.gift_id` UNIQUE

**함께 돌아야 하는 작업 (📌 Q12)**: 종료 후 **7일**이 지나도 처리하지 않은 미달 선물(모금액 > 0)이 있는 펀딩마다, 생일자에게 `shortfall-reminder` 알림을 **한 번** 만든다 (`dedupe_key = {funding_id}:shortfall-reminder`). 알림 후에도 S1은 계속 가능하다.

#### S2. 정산 현황 — `GET /fundings/{funding_id}/settlement`

**Response** `200 SettlementOverviewDto`
- 생일자만 (`403`). 후원자에게는 정산 정보를 주지 않는다.
- `eligible_gifts`: 정산 대상 선물과 금액, 이유(`achieved` 목표 달성 / `withdraw` 인출). 종료 전이면 빈 배열.
- `carryover_gifts`: 이월한 선물 (정산 제외 안내용)
- `history`: 이 펀딩의 정산 기록 (최신순), **계좌번호는 마스킹** (뒤 4자리만)

#### S3. 정산 요청 — `POST /fundings/{funding_id}/settlements`

**Request**
```json
{ "gift_ids": ["gift_speaker"], "bank": "국민은행", "account_number": "123456-78-901234", "account_holder": "김서연" }
```
**Response** `201 { "id": "..." }`

**처리 순서 (F-12)**

| 순서 | 조건 | 오류 |
|---|---|---|
| 1 | 생일자 · 펀딩 종료 | `403` / `409 FUNDING_NOT_ACTIVE` |
| 2 | 은행: 목록 안의 값 (📌 9개 은행: 국민 · 신한 · 우리 · 하나 · 농협 · 기업 · 카카오뱅크 · 토스뱅크 · 케이뱅크) | `400` "은행을 선택해 주세요." |
| 3 | 계좌번호: `-` 제거 후 숫자 10~14자리 (📌 Q10) | `400` "계좌번호는 숫자 10~14자리로 입력해 주세요." |
| 4 | 예금주: 본인 명의 (계정 이름과 같음, 문자열 비교, 📌 Q10) | `400` "본인 명의 계좌만 등록할 수 있어요." |
| 5 | `gift_ids` 1개 이상 | `400` "정산할 선물을 선택해 주세요." |
| 6 | 각 선물이 이 펀딩의 선물 | `404` |
| 7 | 이미 정산에 들어간 선물 아님 — **`requested` · `processing` · `completed`** 정산에 포함된 선물은 거절. 정산 이력이 없거나 **`failed`** 정산에만 있는 선물만 요청 가능 | `409 CONFLICT` "이미 정산 요청한 선물이 포함되어 있어요." |
| 8 | 정산 대상 선물 (달성 또는 인출, 모금액 > 0) | `400` "정산할 수 없는 선물이 포함되어 있어요." |
| 9 | 금액 = 선택 선물 모금액의 합 (**서버가 계산**, 요청으로 받지 않음) → 정산 + 정산 항목 저장, `status = requested` | — |

**정산 상태 처리 (📌 Q11, 프로그램이 자동으로 변경)**
- `requested` → `processing` → `completed` 또는 `failed`. 사람이 바꾸지 않는다. 실제 송금은 없는 **모의 정산**이다.
- 📌 실패하면 `failure_reason`(`ACCOUNT_INVALID` 계좌 정보 오류 / `BANK_ERROR` 은행 오류)과 `processed_at`을 기록하고, 그 선물은 **다시 정산 대상**이 된다 → 계좌를 다시 입력해 재요청.
- 📌 완료되면 F1 · F2 응답의 `settlement_status = completed` → 화면에 "정산됨".
- 📌 모의 진행 시점 (Q11-1 ①, 2026-10-19 확정): 요청 **즉시 `processing`**, **1분 뒤 `completed`**(또는 `failed`). 실패 확인용으로 계좌 끝 `0000` → 계좌 오류, `9999` → 은행 오류로 흉내낸다.

**백엔드 보장**
- 6~9를 한 트랜잭션으로 처리하고, 7 전에 요청한 **선물 행을 모두 잠근다**(`SELECT … FOR UPDATE`, ID 순서로 잠가 교착 방지). 처리 중(`processing`)에 같은 선물로 다시 요청하거나, 버튼을 두 번 눌러 동시에 두 요청이 와도 하나만 저장된다.
- DB 안전장치: `settlement_items.is_active`(정산이 `failed`가 되면 같은 트랜잭션에서 false) + 부분 UNIQUE 인덱스 `ON settlement_items (gift_id) WHERE is_active` → 유효한 정산에 같은 선물이 두 번 들어갈 수 없다 (`docs/backend/ERD.md` 3.5). 충돌하면 `409 CONFLICT`.
- 금액은 원 단위 정수로만 계산한다 (선물 모금액 합).
- 계좌번호 **암호화 저장** — 📌 Fernet(파이썬 `cryptography`), 열쇠는 `.env`의 `ACCOUNT_ENCRYPTION_KEY` (2026-10-19 확정). 응답은 마스킹(뒤 4자리)

---

## 8. 생일 캘린더 · 알림 (F-15, F-16)

### 8.1 기본 CRUD

| # | Method | Endpoint | Request | Response |
|---|---|---|---|---|
| C1 | GET | `/birthday-events` | — | `200 BirthdayEventDto[]` — 본인 일정만 |
| C2 | GET | `/birthday-events/linkable-fundings` | — | `200 LinkableFundingDto[]` — 내가 볼 수 있는 펀딩만 |
| C3 | POST | `/birthday-events` | `{ friend_name, birthday, linked_funding_id? }` | `201 { id }` |
| C4 | PUT | `/birthday-events/{event_id}` | `{ friend_name, birthday, linked_funding_id? }` | `204` |
| C5 | DELETE | `/birthday-events/{event_id}` | — | `204` — 📌 이 일정으로 만든 **알림도 함께 삭제** |
| N2 | GET | `/notifications/unread-count` | — | `200 { count }` (홈 종 아이콘 빨간 점) |
| N3 | PATCH | `/notifications/{notification_id}` | `{ is_read: true }` | `204` · 남의 알림 · 없는 알림 `404` |
| N4 | POST | `/notifications/read-all` | — | `204` |

**C3 · C4 검증 (F-15)**: 친구 이름 필수 "친구 이름을 입력해 주세요." · 생일 유효 날짜 "올바른 생일을 선택해 주세요." · 연결 펀딩은 **볼 권한이 있는 것만** "접근 가능한 펀딩만 연결할 수 있어요." · 남의 일정 수정 · 삭제 `403`
**C1 응답 규칙**: 연결 펀딩을 볼 권한이 없으면 `linked_funding_name = null`, `can_open_linked_funding = false` (이름도 공개하지 않음)

### 8.2 비즈니스 로직 API

#### N1. 알림 목록 — `GET /notifications`

**Response** `200 NotificationDto[]` (최신순, 본인 알림만)

**알림 생성 규칙 (F-16)** — 백엔드는 **매일 도는 작업(APScheduler)**으로 만든다 (Mock은 조회할 때 만든다)

| 종류 | 조건 | 중복 방지 키 | 받는 사람 |
|---|---|---|---|
| `birthday-before` | 일정의 생일이 내일 (`funding_id`는 저장하지 않음) | `{event_id}:birthday-before:{날짜}` | 일정 주인 |
| `birthday-today` | 일정의 생일이 오늘 (`funding_id`는 저장하지 않음) | `{event_id}:birthday-today:{날짜}` | 일정 주인 |
| `shortfall-reminder` | 📌 종료 후 7일 지남 + 처리 안 한 미달 선물(모금액 > 0) 있음 | `{funding_id}:shortfall-reminder` (펀딩당 1회) | 생일자 |

**응답 규칙**
- 생일 알림: 저장된 값이 아니라 일정의 **현재** 연결 펀딩과 열람 권한으로 `funding_id` · `can_open_funding` · `funding_is_mine`을 채운다. 연결이 없거나(펀딩 삭제 · 연결 해제 포함) 권한이 없으면 `funding_id = null`, `can_open_funding = false` (프론트는 생일 캘린더로 이동). 이렇게 해서 펀딩이 지워져도 알림 목록 조회가 깨지지 않는다.
- 미달 알림: `funding_id` = 본인 펀딩, `can_open_funding = true`, `funding_is_mine = true` (프론트는 목표 미달 처리 화면으로 이동).
- 화면 경로(`href`)는 서버가 주지 않는다.

**백엔드 보장**: `(user_id, dedupe_key)` UNIQUE (작업이 두 번 돌아도 안전) · 일정 삭제 시 그 일정 알림 `ON DELETE CASCADE`(`event_id`) · 펀딩 삭제 시 펀딩 알림만 `ON DELETE CASCADE`(`funding_id`는 `shortfall-reminder`만 채우므로 생일 알림은 영향 없음) · 📌 알림 생성: 지금은 조회할 때 생성, 나중에 매일 0시 스케줄러. 2월 29일생은 평년에 2월 28일 기준 (Q17)

---

## 9. AI 선물 추천 (F-03)

### 9.1 기본 CRUD

해당 없음 — 추천 결과는 저장하지 않는다.

### 9.2 비즈니스 로직 API

#### R1. AI 선물 추천 — `POST /ai/recommendations`

**Request**
```json
{ "keywords": ["캠핑", "음악"], "categories": ["전자기기"], "budget_min": 50000, "budget_max": 200000,
  "exclude_ids": ["ai_speaker"] }
```
- `exclude_ids`: "다시 추천받기" 때 이전 결과 ID → 다른 후보를 우선

**Response** `200 { "items": AiRecommendationDto[] }`

> 📌 **지금 구현 (2026-10-20 확정)**: **GPT(OpenAI)** `gpt-4o-mini`(빠르고 저렴한 mini급 · `.env`의 `OPENAI_MODEL`로 변경 가능)를 httpx로 부른다 — Chat Completions + Structured Outputs(`json_schema`, strict). 키(`OPENAI_API_KEY`)가 없으면 **모의 추천**(준비된 후보 20개에서 4개). 받은 응답은 Pydantic으로 다시 검사(가격 범위 · 카테고리). 15초 시간 초과 · 형식 오류 · 429 · 5xx는 1번 재시도(400 · 401 · 403 · 404는 재시도 안 함) → `502 AI_UNAVAILABLE` "AI 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." · 1인당 1분 5회 초과 → `429 RATE_LIMITED` "잠시 후 다시 시도해 주세요." (실제 AI 사용 시만). 📌 추천은 종류가 아니라 **브랜드 + 제품명**(예: '조말론 우드 세이지 앤 씨 솔트 코롱 30ml')으로 받는다 — 가격은 GPT가 아는 정보로 추측한 **예상 가격대**라 실제와 다를 수 있다 (2026-10-20). "다시 추천받기"는 서버가 기억해 둔 이전 결과 이름을 프롬프트의 제외 목록에 넣는다. (Gemini는 프로젝트 접근이 막혀 GPT로 변경, 코드는 `GEMINI_API_KEY`가 있을 때만 쓰는 예비로 남김.) 네이버 쇼핑은 나중에.

**처리 규칙 (F-03)**
1. 관심사 · 카테고리 · 예산이 모두 비어 있으면 `400 VALIDATION` "관심사, 카테고리, 예산 중 하나 이상 입력해 주세요."
2. 서버가 OpenAI API를 호출한다 (httpx). **API 키는 서버 환경 변수에만** 둔다.
3. 프롬프트에는 조건만 넣고 이름 · 이메일 등 개인정보는 넣지 않는다.
4. 응답을 JSON 형식으로 받아 Pydantic으로 검증한다: 이름 · 이유 · 카테고리 · 가격(`price_min ≤ price_max`, 숫자)
5. 시간 초과 · 형식 오류 · 호출 실패 → `502 AI_UNAVAILABLE` (화면은 다시 시도 안내)
6. 결과는 **참고용**이며 저장 · 자동 등록하지 않는다. 실제 가격 · 이미지 · 링크는 생일자가 확인해 등록한다.

**📌 확정 (2026-10-20, Q21~Q24)**: GPT `gpt-4o-mini` + Structured Outputs · 15초 · 재시도 1번 · 4개 · 1인당 1분 5회. 네이버 쇼핑 검색(상품명 · 가격 · 사진)은 나중에 추가

---

## 10. 백엔드에서 따로 처리할 것 (확정 내용 · 나중에 할 일)

> 미정 · 나중에 할 일 전체 목록과 배포 전 체크리스트는 [PENDING.md](./PENDING.md)에 모았다 (2026-10-19).

| 항목 | 내용 | 관련 |
|---|---|---|
| 이미지 업로드 | 📌 형식 JPG · PNG · WEBP · GIF, 최대 5MB (Q2 확정). 지금은 data URL 문자열을 `image_url` · `profile_image_url`에 저장 → **배포 전에 파일 저장소 + 업로드 API로 변경** | F-02 · F-04 |
| 토큰 갱신 · 로그아웃 무효화 | 📌 유효기간 30일 확정 (Q16). 리프레시 토큰 · 서버 측 로그아웃 무효화는 없음 | F-01 |
| 정산 처리 작업 | 📌 진행 시점 확정 (요청 즉시 처리 중 → 1분 뒤 완료, Q11-1 ①). 지금은 조회할 때 상태를 진행시키고, 실제 송금 연동 시 결과 수신 방식으로 교체 | F-12 |
| 알림 생성 작업 | 📌 지금은 조회할 때 생성 → 나중에 매일 0시 스케줄러. 2월 29일생은 평년 2월 28일 (Q17) | F-16 |
| 계좌 검증 | 📌 은행 9개 · 숫자 10~14자리 · 예금주 = 회원 이름 (Q10 확정) | F-12 |
| AI 추천 연결 | Gemini 무료 + 네이버 쇼핑 (방향 확정). 모델 · 시간 초과 · 개수 · 요청 횟수 제한은 연결할 때 결정 | F-03 · ❓ Q21~Q24 |

---

## 11. 백엔드 구현 체크리스트 (pytest로 확인)

- [x] 인증 없이 보호된 API 호출 → `401`
- [x] 후원자 응답에 `raised_amount` · `remaining_amount` · `total_raised`가 없음 (F-13)
- [x] 본인 펀딩 후원 · 다른 그룹 펀딩 열람 → `403`
- [x] 초과 후원 → `409 EXCEEDS_REMAINING` + `max_available`
- [x] 같은 `idempotency_key` 두 번 → 후원 1건, 마감 · 종료 뒤 재전송도 기존 `201` 응답
- [x] **동시 후원**으로 목표 금액을 넘지 않음
- [x] 목표 달성 후 · 종료 후 후원 거부
- [x] 펀딩 기간 3주 초과 · 과거 시작일 거부
- [x] 후원 있는 선물 가격 변경 · 삭제, 마지막 선물 삭제 거부
- [x] 후원 있는 펀딩 · 이월 금액 들어간 펀딩 삭제 거부, 삭제 시 연결 데이터 처리 (미달 알림 삭제 · 생일 알림 유지)
- [x] 미달 처리 두 번 거부, 0원 선물 처리 거부
- [x] 이월 선물 다시 열기 → 시작 모금액 반영, 같은 이월 두 번 다시 열기 거부
- [x] 정산 중복 요청(요청 · 처리 중 · 완료) 거부, 동시 요청 1건만 저장, 실패 후 재요청 허용, 완료 시 `settlement_status = completed`
- [x] 0원 선물: 미달 처리 · 정산 · 7일 알림 대상에서 제외
- [x] 초대 링크 비활성 · 만료 · 중복 참여, 그룹 링크 참여 시 진행 중 펀딩 없으면 `target_funding_id = null`
- [x] 그룹 정보 수정은 관리자만 (G9), 펀딩은 내가 만든 그룹에만 (F3 확인 함수)
- [x] 일정 삭제 시 알림 삭제, 같은 알림 두 번 생성 안 됨
