# API_SPEC.md — 프론트엔드 ↔ 백엔드 API 명세 (S2)

> 작성일: 2026-10-16 · 상태: 작성 완료
> 근거: `docs/product/FEATURE_SPEC.md`, `docs/design/pages/*.md`, `docs/DATA_MODEL.md` 6장, 현재 코드 `frontend/src/lib/api/*.ts`
> 이 문서는 **FastAPI 백엔드와 Mock 라우터가 똑같이 따라야 하는 계약**이다. Mock 라우터(S4)는 이 문서의 경로 · 상태 코드 · JSON 형식을 그대로 흉내 낸다.
> **그룹 삭제 API는 없다** (plan.md 7.1 D8).

---

## 1. 공통 규칙

### 1.1 기본

| 항목 | 규칙 |
|---|---|
| 기본 경로 | `{API_BASE_URL}/api/v1` (예: `http://localhost:8000/api/v1`). 프론트 환경 변수 `NEXT_PUBLIC_API_BASE_URL` |
| 형식 | 요청 · 응답 본문은 JSON (`Content-Type: application/json`). 필드 이름은 **snake_case** |
| 인증 | `Authorization: Bearer <access_token>`. 표의 "인증" 열이 ✅인 API는 토큰이 없거나 만료되면 `401 UNAUTHORIZED` |
| 금액 | 원 단위 정수 |
| 날짜 · 시각 | 날짜 `"YYYY-MM-DD"`, 시각 ISO 8601 (`"2026-10-16T03:00:00Z"`) |
| ID | 문자열. 프론트는 형식에 의존하지 않는다 |
| 성공 상태 코드 | 조회 `200`, 생성 `201`, 본문 없는 변경 · 삭제 `204` |
| 목록 | MVP는 페이지 나눔 없이 전체 배열을 돌려준다 (데이터가 늘면 `?cursor=` 추가 예정) |
| 비공개 정보 | 권한별로 **응답에서 필드를 빼고** 돌려준다 (DATA_MODEL 6.5). 화면에서 숨기는 방식이 아니다 |

### 1.2 오류 응답

모든 오류는 같은 형식이다. 프론트 매퍼가 `ApiError(code, message, { fieldErrors, maxAvailable })`로 바꾼다.

```json
{
  "code": "EXCEEDS_REMAINING",
  "message": "현재 이 선물에는 최대 9,000원까지 후원할 수 있습니다. 후원 금액을 수정해 주세요.",
  "field_errors": { "amount": "..." },
  "max_available": 9000
}
```

| code | HTTP | 의미 | 주로 쓰는 API |
|---|---|---|---|
| `VALIDATION` | 400 | 입력값 오류. `field_errors`에 필드별 문구 | 모든 생성 · 수정 |
| `UNAUTHORIZED` | 401 | 로그인 필요 · 토큰 만료 | 인증 필요한 모든 API |
| `INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호 불일치 (가입 여부를 드러내지 않는 한 문구) | 로그인 |
| `FORBIDDEN` | 403 | 권한 없음 (다른 사람 펀딩 · 그룹 미참여 등) | 대부분 |
| `NOT_FOUND` | 404 | 대상 없음 | 대부분 |
| `INVITE_INVALID` | 404 | 존재하지 않는 초대 링크 | 초대 |
| `DUPLICATE_EMAIL` | 409 | 이미 가입한 이메일 | 회원가입 |
| `CONFLICT` | 409 | 이미 처리된 요청 · 삭제 조건 불충족 (이월 · 인출 · 정산 중복, 후원 있는 펀딩 삭제 등) | 삭제 · 정산 · 이월 |
| `GIFT_LOCKED` | 409 | 후원 · 이월 금액이 있는 선물의 가격 변경 · 삭제, 마지막 선물 삭제 | 선물 |
| `GOAL_REACHED` | 409 | 목표 달성으로 후원 마감 | 후원 |
| `EXCEEDS_REMAINING` | 409 | 남은 금액 초과. `max_available` 포함 | 후원 |
| `FUNDING_NOT_ACTIVE` | 409 | 시작 전 · 종료된 펀딩에 후원, 종료 전 미달 처리 · 정산 | 후원 · 정산 |
| `INVITE_INACTIVE` | 410 | 비활성화된 초대 링크 | 초대 |
| `INVITE_EXPIRED` | 410 | **펀딩이 끝나 만료된 초대 링크** (D-S1-4, 신규) | 초대 |
| `NETWORK` | — | 프론트 전용: 서버에 닿지 못함 (응답 없음) | — |

### 1.3 권한 표기

| 표기 | 의미 |
|---|---|
| 공개 | 로그인 없이 호출 가능 |
| 본인 | 로그인한 사용자 자신의 데이터만 |
| 생일자 | 해당 펀딩을 만든 사람만 |
| 후원자 | 펀딩이 연결된 그룹의 참여자이면서 생일자가 아닌 사람 (D-S1-2: 초대받아 참여한 그룹의 펀딩만) |
| 그룹 참여자 / 그룹 관리자 | 해당 그룹 참여자 / `groups.admin_id` |
| 링크 관리자 | 그룹 관리자 또는 (펀딩 지정 링크의) 펀딩 생일자 |

---

## 2. 응답 스키마 (snake_case)

프론트 타입(`types/index.ts`, camelCase)과 1:1로 대응한다. 변환은 `lib/api/mappers.ts`에서만 한다.

### 2.1 사용자

```ts
UserDto            { id, name, email, birthday, profile_image_url: string | null }
PreferenceDto      { keywords: string[], categories: string[], price_range: PriceRangeKey | null }
AuthTokenDto       { access_token, token_type: "bearer", expires_in: number /*초*/, user: UserDto }
```

### 2.2 그룹 · 초대

```ts
GroupFundingDto    { id, name, owner_name, is_mine: boolean, status: "scheduled" | "active" | "ended" }
GroupSummaryDto    { id, name, description, member_count, is_admin: boolean, fundings: GroupFundingDto[] }
GroupDetailDto     GroupSummaryDto + { members: { id, name, is_admin: boolean }[] }
InviteDto          { token, group_id, group_name, funding_id: string | null, funding_name: string | null,
                     is_active: boolean, is_expired: boolean /*신규*/, created_at }
InvitePreviewDto   { token, group_name, funding_name: string | null, owner_name: string | null,
                     already_joined: boolean, target_funding_id: string | null }
JoinResultDto      { group_id, target_funding_id: string | null, target_is_mine: boolean, already_joined: boolean }
```

> `JoinResultDto`는 화면 경로를 주지 않는다. 이동할 경로(`/friend-funding-detail/...` 등)는 프론트 매퍼가 만든다. (현재 Mock은 `redirectPath`를 직접 만듦 → S4에서 변경)

### 2.3 펀딩 · 선물

```ts
FundingBaseDto     { id, name, group_id, group_name, owner_name, start_date, end_date,
                     status: "scheduled" | "active" | "ended" }
SupporterGiftDto   { id, name, price, image_url, product_url, description,
                     achievement_rate: number /*0~100*/, is_closed: boolean }
OwnerGiftDto       SupporterGiftDto + { raised_amount, remaining_amount, donation_count,
                     shortfall_action: "carryover" | "withdraw" | null, settled: boolean,
                     settlement_status: "requested" | "processing" | "completed" | "failed" | null,
                     carried_over_amount: number }
                   // settlement_status: 이 선물이 포함된 정산의 상태. completed 이면 화면에 "정산됨" 표시
                   //   (실패하면 다시 정산 대상이 되어 null 로 돌아간다)
OwnerFundingDto    FundingBaseDto + { gifts: OwnerGiftDto[], total_raised }
FriendFundingDto   FundingBaseDto + { gifts: SupporterGiftDto[] }        // 모금액 필드 없음
GiftEditDto        { funding_id, name, price, image_url, product_url, description, has_donations: boolean }
SupporterDonationDto { id, supporter_name, gift_id, gift_name, amount, created_at }
```

> `GiftEditDto.has_donations`는 "후원 또는 이월 금액이 있음"(가격 변경 · 삭제 잠금)을 뜻한다.

### 2.4 후원 · 메시지

```ts
MyDonationDto      { id, funding_id, funding_name, owner_name, gift_id, gift_name, amount,
                     has_message: boolean, created_at, status: "completed" }
ReceivedMessageDto { id, author_name, content, funding_name, gift_name, created_at }
```

### 2.5 이월 · 정산

```ts
PendingCarryoverDto { id, funding_name, gift_name, price, image_url, product_url, description, amount, created_at }
SettlementRecordDto { id, funding_id, gift_names: string[], amount, bank,
                      account_number_masked, account_holder,
                      status: "requested" | "processing" | "completed" | "failed", requested_at }
SettlementOverviewDto {
  funding_id, funding_name,
  eligible_gifts: { id, name, amount, reason: "achieved" | "withdraw" }[],
  eligible_amount,
  carryover_gifts: { id, name, amount }[],
  history: SettlementRecordDto[]
}
```

### 2.6 캘린더 · 알림 · AI

```ts
BirthdayEventDto   { id, friend_name, birthday, linked_funding_id: string | null,
                     linked_funding_name: string | null,   // 열람 권한 없으면 null
                     can_open_linked_funding: boolean, linked_funding_is_mine: boolean }
LinkableFundingDto { id, name }
NotificationDto    { id, type: "birthday-before" | "birthday-today", title, body, created_at, is_read,
                     event_id: string | null, funding_id: string | null,
                     can_open_funding: boolean, funding_is_mine: boolean }
AiRecommendationDto { id, name, reason, category, price_min, price_max }
```

> `NotificationDto`도 경로(`href`)를 주지 않는다. 프론트 매퍼가 `can_open_funding`이면 펀딩 상세, 아니면 `/birthday-calendar`로 만든다.

---

## 3. 엔드포인트 목록 (45개)

"프론트 함수"는 `frontend/src/lib/api/*.ts`의 함수 이름이다. 함수 이름 · 입력 · 반환 타입은 그대로 두고 내부만 이 API를 호출하도록 바꾼다.

### 3.1 인증 · 사용자 관리 (F-01, F-02) — 8개

| # | 메서드 · 경로 | 프론트 함수 | 인증 · 권한 | 요청 | 응답 | 주요 오류 |
|---|---|---|---|---|---|---|
| A1 | `POST /auth/signup` | `signup` | 공개 | `{ name, email, password, password_confirm, birthday }` | `201 { id }` | VALIDATION, DUPLICATE_EMAIL |
| A2 | `POST /auth/login` | `login` | 공개 | `{ email, password, remember_me }` | `200 AuthTokenDto` | INVALID_CREDENTIALS |
| A3 | `POST /auth/logout` | `logout` | 본인 | — | `204` | — |
| A4 | `GET /me` | `getMe` | 본인 | — | `200 UserDto` | UNAUTHORIZED |
| A5 | `PATCH /me` | `updateProfile` | 본인 | `{ name, birthday, profile_image_url }` | `200 UserDto` | VALIDATION |
| A6 | `GET /me/preferences` | `getPreference` | 본인 | — | `200 PreferenceDto` | — |
| A7 | `PUT /me/preferences` | `updatePreference` | 본인 | `PreferenceDto` | `200 PreferenceDto` | VALIDATION (키워드 10개 초과, 없는 카테고리) |
| A8 | `PATCH /me/password` | `changePassword` | 본인 | `{ current_password, new_password, new_password_confirm }` | `204` | VALIDATION (현재 비밀번호 틀림 · 현재와 같음 포함), UNAUTHORIZED |

- A1: 서버가 모든 값을 다시 검증한다. 이메일은 소문자로 저장, 비밀번호는 Argon2 해시. `password_confirm`은 저장하지 않는다.
- A2: 토큰 유효기간은 항상 30일이다 (Q16, 2026-10-19 확정). `remember_me`는 프론트 보관 위치만 정한다: true면 localStorage(브라우저를 닫아도 유지), false면 sessionStorage(브라우저를 닫으면 로그아웃).
- A3: JWT는 서버에 저장하지 않으므로 서버는 204만 돌려주고, 프론트가 토큰을 지운다.
- A5: `profile_image_url`은 지금은 data URL을 그대로 받는다. 이미지 업로드 API는 연동 시 추가한다 (DATA_MODEL 6.1).

### 3.2 그룹 · 초대 (F-05, F-06) — 9개

| # | 메서드 · 경로 | 프론트 함수 | 인증 · 권한 | 요청 | 응답 | 주요 오류 |
|---|---|---|---|---|---|---|
| G1 | `GET /groups` | `listMyGroups` | 본인 | — | `200 { created: GroupSummaryDto[], joined: GroupSummaryDto[] }` | — |
| G2 | `POST /groups` | `createGroup` | 본인 | `{ name, description }` | `201 { id }` | VALIDATION |
| G3 | `GET /groups/{group_id}` | `getGroupDetail` | 그룹 참여자 | — | `200 GroupDetailDto` | NOT_FOUND, FORBIDDEN |
| G4 | `GET /groups/{group_id}/invites?funding_id=` | `listInvites` | 링크 관리자 | — | `200 InviteDto[]` (최신순) | FORBIDDEN |
| G5 | `POST /groups/{group_id}/invites` | `createInvite` | 링크 관리자 | `{ funding_id: string \| null }` | `201 InviteDto` | FORBIDDEN, VALIDATION (다른 그룹 펀딩) |
| G6 | `PATCH /invites/{token}` | `deactivateInvite` | 링크 관리자 | `{ is_active: false }` | `204` | NOT_FOUND, FORBIDDEN |
| G7 | `GET /invites/{token}` | `previewInvite` | 로그인 사용자 | — | `200 InvitePreviewDto` | INVITE_INVALID, INVITE_INACTIVE, **INVITE_EXPIRED** |
| G8 | `POST /invites/{token}/join` | `joinByInvite` | 로그인 사용자 | — | `200 JoinResultDto` | INVITE_INVALID, INVITE_INACTIVE, **INVITE_EXPIRED** |
| G9 | `PATCH /groups/{group_id}` | `updateGroup` | 그룹 관리자 | `{ name, description }` | `200 GroupDetailDto` | VALIDATION, FORBIDDEN, NOT_FOUND |

- G1 · G3: 그룹의 `fundings`는 최신순(시작일이 늦은 펀딩이 먼저)이다. (2026-10-19 확정)
- G2: 만든 사람이 관리자가 되고 참여자 목록에도 들어간다.
- G9: 그룹 이름 · 설명은 만든 사람(관리자)만 수정한다. 아니면 `403` "그룹 관리자만 수정할 수 있어요." (2026-10-19 확정)
- G4: 그룹 관리자는 그룹의 모든 링크, 펀딩 생일자는 `funding_id`로 지정한 본인 펀딩 링크만 받는다.
- G5: 토큰은 서버가 Python `secrets`로 만든다 (예측 불가).
- G7 · G8 만료 규칙 (D-S1-4): 링크에 펀딩이 지정돼 있고 그 펀딩이 `ended`면 `410 INVITE_EXPIRED` ("펀딩이 종료되어 만료된 초대 링크입니다."). 그룹 링크는 비활성화 전까지 유효하다.
- G8: 이미 참여한 경우에도 `200`과 `already_joined: true`를 돌려준다 (중복 등록 없음). 이동 대상 펀딩은 지정 펀딩 → 없으면 그룹의 진행 중인 다른 사람 펀딩(시작일 최신) → 없으면 null(프론트가 그룹 상세로 이동). 참여 저장을 마친 뒤 응답한다. (2026-10-19 확정)
- **그룹 삭제 (`DELETE /groups/{group_id}`)는 제공하지 않는다.** 참여자 제외 · 그룹 나가기도 없다.

### 3.3 펀딩 · 선물 (F-04, F-07, F-09, F-13) — 13개

| # | 메서드 · 경로 | 프론트 함수 | 인증 · 권한 | 요청 | 응답 | 주요 오류 |
|---|---|---|---|---|---|---|
| F1 | `GET /me/fundings` | `listMyFundings` | 본인 (생일자) | — | `200 OwnerFundingDto[]` (시작일 최신순) | — |
| F2 | `GET /me/fundings/{funding_id}` | `getMyFunding` | 생일자 | — | `200 OwnerFundingDto` | NOT_FOUND, FORBIDDEN |
| F3 | `POST /fundings` | `createFunding` | 본인 · 그룹 관리자(만든 사람) | `{ name, group_id, start_date, end_date, gifts: GiftInput[], carryover_ids: string[] }` | `201 { id }` | VALIDATION, FORBIDDEN, NOT_FOUND / CONFLICT (이월) |
| F4 | `DELETE /fundings/{funding_id}` | `deleteFunding` | 생일자 | — | `204` | FORBIDDEN, **CONFLICT** |
| F5 | `POST /fundings/{funding_id}/gifts` | `addGift` | 생일자 | `GiftInput` | `201 { id }` | VALIDATION, FORBIDDEN |
| F6 | `GET /me/gifts/{gift_id}` | `getGiftForEdit` | 생일자 | — | `200 GiftEditDto` | NOT_FOUND, FORBIDDEN |
| F7 | `PUT /gifts/{gift_id}` | `updateGift` | 생일자 | `GiftInput` | `204` | VALIDATION, GIFT_LOCKED |
| F8 | `DELETE /gifts/{gift_id}` | `deleteGift` | 생일자 | — | `204` | GIFT_LOCKED |
| F9 | `GET /fundings/{funding_id}/donations` | `listSupporterDonations` | 생일자 | — | `200 SupporterDonationDto[]` (최신순) | FORBIDDEN |
| F10 | `GET /fundings/friends` | `listFriendFundings` | 본인 | — | `200 FriendFundingDto[]` | — |
| F11 | `GET /fundings/{funding_id}` | `getFriendFunding` | 후원자 | — | `200 FriendFundingDto` | NOT_FOUND, FORBIDDEN |
| F12 | `GET /gifts/{gift_id}` | `getGiftForDonation` | 후원자 | — | `200 { funding: FundingBaseDto, gift: SupporterGiftDto }` | NOT_FOUND, FORBIDDEN |
| F13 | `GET /me/carryovers?status=pending` | `listPendingCarryovers` | 본인 | — | `200 PendingCarryoverDto[]` (오래된 순) | — |

`GiftInput` = `{ name, price, image_url, product_url, description }`

- F3 검증: 이름 · 그룹 · 시작일 · 종료일 필수, 시작일 ≥ 오늘(오늘 포함, 문구 "시작일은 오늘 이전으로 선택할 수 없어요."), 종료일 ≥ 시작일 · 최대 21일, 선물(직접 등록 + 이월) 최소 1개, 그룹 참여자만.
- F3 이월 (D-S1-3): `carryover_ids`는 본인의 `pending` 이월 기록만 허용 (아니면 `404 NOT_FOUND`, 이미 다시 열었으면 `409 CONFLICT`). 서버가 선물을 같은 이름 · 가격 · 이미지 · 링크로 복사하고 이월 금액을 시작 모금액으로 넣는다. 그룹은 지난 펀딩과 달라도 된다. 펀딩 생성 · 선물 복사 · 이월 상태 변경은 하나의 트랜잭션.
- F4 삭제 조건 (D6 · D7): 후원이 1건이라도 있으면 `409 CONFLICT` "후원이 들어온 펀딩은 삭제할 수 없어요.", 이월 금액이 들어간 펀딩도 `409` "이월 금액이 포함된 펀딩은 삭제할 수 없어요." 삭제 시 선물 · 이 펀딩 지정 초대 링크 · **이 펀딩의 알림** 삭제, 생일 일정 연결은 null.
- F7: 후원 또는 이월 금액이 있는 선물은 가격을 바꿀 수 없다 (`GIFT_LOCKED`). 다른 항목은 수정 가능.
- F8: 후원 · 이월 금액이 있거나 펀딩의 마지막 선물이면 `GIFT_LOCKED`.
- F10 · F11 · F12: **모금액 · 남은 금액 필드를 응답에 넣지 않는다** (F-13).

### 3.4 후원 · 축하 메시지 (F-08, F-10, F-14) — 4개

| # | 메서드 · 경로 | 프론트 함수 | 인증 · 권한 | 요청 | 응답 | 주요 오류 |
|---|---|---|---|---|---|---|
| D1 | `POST /donations` | `donate` | 후원자 | `{ gift_id, amount, message, idempotency_key }` | `201 { donation_id }` | VALIDATION, FUNDING_NOT_ACTIVE, GOAL_REACHED, **EXCEEDS_REMAINING** |
| D2 | `GET /me/donations?funding_id=` | `listMyDonations` | 본인 | — | `200 MyDonationDto[]` (최신순) | — |
| D3 | `GET /me/donations/{donation_id}` | `getMyDonation` | 본인 | — | `200 MyDonationDto` | NOT_FOUND, FORBIDDEN |
| D4 | `GET /me/messages?funding_id=` | `listReceivedMessages` | 생일자 | — | `200 ReceivedMessageDto[]` (최신순) | FORBIDDEN (다른 사람 펀딩) |

D1 처리 순서 (서버 트랜잭션)
1. 같은 `(후원자, idempotency_key)` 요청이 이미 있으면 **새로 저장하지 않고** 이전 `donation_id`를 `201`로 돌려준다. **이 확인을 다른 모든 검사보다 먼저 한다** — 그 사이 마감 · 종료돼도 재전송은 기존 성공 응답을 받는다.
2. 선물 행을 잠그고(`SELECT … FOR UPDATE`) 최신 모금액으로 남은 금액을 계산한다.
3. 금액 ≤ 0 → `VALIDATION`, 펀딩이 진행 중이 아님 → `FUNDING_NOT_ACTIVE`, 남은 금액 0 → `GOAL_REACHED`, 금액 > 남은 금액 → `EXCEEDS_REMAINING` + `max_available`.
4. 메시지가 200자를 넘으면 `VALIDATION`. 빈 메시지는 저장하지 않는다.
5. 후원과 메시지를 함께 저장한다. 하나라도 실패하면 둘 다 저장하지 않는다.

- D4: `funding_id`가 있으면 그 펀딩(본인 것만)의 메시지, 없으면 내 모든 펀딩의 메시지. 작성자 이름은 계정 실명.

### 3.5 목표 미달 · 정산 (F-11, F-12) — 3개

| # | 메서드 · 경로 | 프론트 함수 | 인증 · 권한 | 요청 | 응답 | 주요 오류 |
|---|---|---|---|---|---|---|
| S1 | `POST /gifts/{gift_id}/shortfall` | `applyShortfall` | 생일자 | `{ action: "carryover" \| "withdraw" }` | `204` | FUNDING_NOT_ACTIVE (종료 전), VALIDATION (달성 · 모금 0원), CONFLICT (이미 처리) |
| S2 | `GET /fundings/{funding_id}/settlement` | `getSettlementOverview` | 생일자 | — | `200 SettlementOverviewDto` | FORBIDDEN |
| S3 | `POST /fundings/{funding_id}/settlements` | `requestSettlement` | 생일자 | `{ gift_ids, bank, account_number, account_holder }` | `201 { id }` | VALIDATION (계좌 · 본인 명의), CONFLICT (이미 정산), FUNDING_NOT_ACTIVE |

- S1: `carryover`면 이월 기록을 `pending`으로 만든다 (다음 생일에 F3로 다시 엶). `withdraw`면 정산 대상이 된다. 한 선물에 한 번만.
- S3: `requested` · `processing` · `completed` 정산에 들어간 선물은 다시 요청할 수 없다(`409`). 정산 이력이 없거나 `failed`인 선물만 가능. 정산 금액은 서버가 선물별 모금액 합으로 계산한다 (요청에 금액 없음). 계좌번호는 암호화 저장, 응답은 마스킹. 실제 송금 없는 **모의 정산**.

### 3.6 생일 캘린더 · 알림 (F-15, F-16) — 9개

| # | 메서드 · 경로 | 프론트 함수 | 인증 · 권한 | 요청 | 응답 | 주요 오류 |
|---|---|---|---|---|---|---|
| C1 | `GET /birthday-events` | `listBirthdayEvents` | 본인 | — | `200 BirthdayEventDto[]` | — |
| C2 | `GET /birthday-events/linkable-fundings` | `listLinkableFundings` | 본인 | — | `200 LinkableFundingDto[]` | — |
| C3 | `POST /birthday-events` | `createBirthdayEvent` | 본인 | `{ friend_name, birthday, linked_funding_id }` | `201 { id }` | VALIDATION (열람 불가 펀딩 연결 포함) |
| C4 | `PUT /birthday-events/{event_id}` | `updateBirthdayEvent` | 본인 (등록자) | C3와 같음 | `204` | NOT_FOUND, FORBIDDEN, VALIDATION |
| C5 | `DELETE /birthday-events/{event_id}` | `deleteBirthdayEvent` | 본인 (등록자) | — | `204` | NOT_FOUND, FORBIDDEN |
| N1 | `GET /notifications` | `listNotifications` | 본인 | — | `200 NotificationDto[]` (최신순) | — |
| N2 | `GET /notifications/unread-count` | `hasUnreadNotifications` | 본인 | — | `200 { count }` | — |
| N3 | `PATCH /notifications/{notification_id}` | `markNotificationRead` | 본인 | `{ is_read: true }` | `204` | NOT_FOUND |
| N4 | `POST /notifications/read-all` | `markAllNotificationsRead` | 본인 | — | `204` | — |

- C5: 일정 삭제 시 **이 일정의 알림도 함께 삭제** (D-S1-1).
- N1 · N2: 알림 생성은 서버 스케줄러(APScheduler)가 매일 한다. 생일 하루 전 · 당일, `(user_id, dedupe_key)` 고유 제약으로 중복 없음. (Mock은 조회할 때 생성)
- N2: 프론트 함수는 `count > 0`을 boolean으로 바꿔 돌려준다.

### 3.7 AI 선물 추천 (F-03) — 1개

| # | 메서드 · 경로 | 프론트 함수 | 인증 · 권한 | 요청 | 응답 | 주요 오류 |
|---|---|---|---|---|---|---|
| R1 | `POST /ai/recommendations` | `recommendGifts` | 본인 | `{ keywords, categories, budget_min, budget_max, exclude_ids }` | `200 { items: AiRecommendationDto[] }` | VALIDATION (조건 없음), 502 `AI_UNAVAILABLE` (연동 시) |

- 서버가 OpenAI를 호출하고 응답 형식을 검증한 뒤 돌려준다. API 키는 서버 환경 변수에만 둔다.
- 연동 시 추가 오류 코드 `AI_UNAVAILABLE`(502): AI 응답 실패 · 형식 오류 → 프론트는 "다시 시도" 안내.

---

## 4. API가 아닌 프론트 상수 · 검증 함수

서버에서도 같은 규칙으로 검증하지만, 화면의 빠른 안내를 위해 프론트에도 둔다. S8에서 `lib/api` 밖(`lib/constants.ts`, `lib/validation.ts`)으로 옮긴다.

| 이름 | 현재 위치 | 용도 |
|---|---|---|
| `GIFT_CATEGORIES`, `PRICE_RANGES` | `lib/api/ai.ts` | 취향 · AI 추천 선택지 |
| `BANKS` | `lib/api/settlements.ts` | 정산 은행 선택지 |
| `MESSAGE_MAX_LENGTH` (200) | `lib/api/donations.ts` | 축하 메시지 글자 수 |
| `validateGiftInput`, `validateFundingInput` | `lib/api/fundings.ts` | 선물 · 펀딩 입력 검증 |
| `validateAccount` | `lib/api/settlements.ts` | 계좌 입력 검증 |
| `extractInviteToken` | `lib/api/groups.ts` | 붙여 넣은 링크에서 토큰 꺼내기 |
| `fundingPathOf` | `lib/api/schedule.ts` | 일정 → 펀딩 상세 경로 |

---

## 5. 현재 Mock과 달라지는 점 (S4에서 반영)

| 항목 | 현재 Mock | 이 명세 |
|---|---|---|
| 호출 방식 | 함수 안에서 Mock DB를 직접 읽고 씀 | `http.get/post…` → Mock 라우터(또는 FastAPI) |
| 필드 표기 | camelCase 객체를 그대로 반환 | snake_case JSON → 매퍼에서 camelCase |
| 초대 참여 결과 | `redirectPath` (서버가 화면 경로 생성) | `JoinResultDto` → 매퍼가 경로 생성 |
| 알림 | `href` (서버가 화면 경로 생성) | `NotificationDto`의 대상 정보 → 매퍼가 경로 생성 |
| 읽지 않은 알림 | boolean | `{ count }` |
| 초대 링크 만료 | 없음 | `INVITE_EXPIRED`, `InviteDto.is_expired` |
| 펀딩 삭제 | 알림 남음 | 이 펀딩의 미달 처리 알림만 삭제, 생일 알림은 남고 펀딩 연결만 해제 (2026-10-19) |
| 생일 일정 삭제 | 알림 남음 | 이 일정의 알림 삭제 |
| 그룹 삭제 | `deleteGroup` 있음 | **없음** (S6에서 제거) |
| 로그인 응답 | 사용자 정보 (토큰은 Mock이 직접 저장) | `AuthTokenDto` → 프론트가 토큰 저장 |
