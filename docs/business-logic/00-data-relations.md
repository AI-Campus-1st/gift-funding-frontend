# 데이터 구조 관계 (테이블 · 관계 · 제약)

> 상태: **설계 문서 (코드 구현 없음)** · 작성일: 2026-10-19
> 근거: `docs/DATA_MODEL.md` 6장, `docs/API_SPEC.md`
> 비즈니스 규칙(무엇을 허용하고 막는지)은 [00-business-rules.md](./00-business-rules.md)에 따로 정리했다.
> 컬럼별 타입 · 기본값 전체는 `DATA_MODEL.md` 6.2를 본다. 이 문서는 **테이블끼리 어떻게 이어지는지**만 다룬다.

---

## 1. 테이블 목록

| 영역 | 테이블 | 한 행의 뜻 |
|---|---|---|
| 사용자 | `users` | 회원 1명 |
| | `user_preferences` | 회원 1명의 선물 취향 |
| 그룹 | `groups` | 비공개 그룹 1개 |
| | `group_members` | (그룹, 회원) 참여 1건 |
| | `invites` | 초대 링크 1개 |
| 펀딩 | `fundings` | 생일 펀딩 1개 |
| | `gifts` | 펀딩에 올린 선물 1개 |
| 후원 | `donations` | 후원 1건 |
| | `messages` | 후원에 붙은 축하 메시지 1개 |
| 미달 · 정산 | `carryovers` | 선물 1개의 이월 기록 |
| | `settlements` | 정산 요청 1건 (계좌 · 상태) |
| | `settlement_items` | 정산 요청에 포함된 선물 1개 |
| 일정 · 알림 | `birthday_events` | 친구 생일 일정 1개 |
| | `notifications` | 알림 1개 |

---

## 2. ERD

```mermaid
erDiagram
  users ||--|| user_preferences : "user_id"
  users ||--o{ group_members : "user_id"
  groups ||--o{ group_members : "group_id"
  users ||--o{ groups : "admin_id"
  groups ||--o{ invites : "group_id"
  fundings |o--o{ invites : "funding_id (NULL 가능)"
  users ||--o{ invites : "created_by"
  users ||--o{ fundings : "owner_id"
  groups ||--o{ fundings : "group_id"
  fundings ||--|{ gifts : "funding_id"
  gifts ||--o{ donations : "gift_id"
  fundings ||--o{ donations : "funding_id"
  users ||--o{ donations : "supporter_id"
  donations ||--o| messages : "donation_id"
  gifts ||--o| carryovers : "gift_id"
  gifts |o--o| carryovers : "reopened_gift_id"
  fundings ||--o{ carryovers : "funding_id / reopened_funding_id"
  fundings ||--o{ settlements : "funding_id"
  users ||--o{ settlements : "owner_id"
  settlements ||--|{ settlement_items : "settlement_id"
  gifts ||--o{ settlement_items : "gift_id"
  users ||--o{ birthday_events : "owner_id"
  fundings |o--o{ birthday_events : "linked_funding_id"
  users ||--o{ notifications : "user_id"
  birthday_events |o--o{ notifications : "event_id"
  fundings |o--o{ notifications : "funding_id"

  users { uuid id PK; string name; string email UK; string password_hash; date birthday }
  user_preferences { uuid user_id PK_FK; text_arr keywords; text_arr categories; string price_range }
  groups { uuid id PK; string name; uuid admin_id FK }
  group_members { uuid group_id PK_FK; uuid user_id PK_FK; timestamp joined_at }
  invites { uuid id PK; string token UK; uuid group_id FK; uuid funding_id FK; uuid created_by FK; bool is_active }
  fundings { uuid id PK; uuid owner_id FK; uuid group_id FK; string name; date start_date; date end_date }
  gifts { uuid id PK; uuid funding_id FK; int price; string shortfall_action; int sort_order }
  donations { uuid id PK; uuid funding_id FK; uuid gift_id FK; uuid supporter_id FK; int amount; string idempotency_key; string status }
  messages { uuid id PK; uuid donation_id UK_FK; string content }
  carryovers { uuid id PK; uuid gift_id UK_FK; int amount; string status; uuid reopened_funding_id FK; uuid reopened_gift_id UK_FK }
  settlements { uuid id PK; uuid funding_id FK; uuid owner_id FK; int amount; string account_number; string status; string failure_reason }
  settlement_items { uuid settlement_id PK_FK; uuid gift_id PK_FK; int amount; string reason }
  birthday_events { uuid id PK; uuid owner_id FK; string friend_name; date birthday; uuid linked_funding_id FK }
  notifications { uuid id PK; uuid user_id FK; string type; uuid event_id FK; uuid funding_id FK; string dedupe_key; bool is_read }
```

---

## 3. 관계 상세

| # | 부모 → 자식 | 수 | 연결 컬럼 | 부모 삭제 시 | 비고 |
|---|---|---|---|---|---|
| R1 | `users` → `user_preferences` | 1 : 1 | `user_preferences.user_id` (PK) | — | 사용자 삭제 기능 없음 |
| R2 | `users` ↔ `groups` | N : M | `group_members (group_id, user_id)` | — | 복합 PK |
| R3 | `users` → `groups` (관리자) | 1 : N | `groups.admin_id` | — | 관리자도 R2에 한 행 |
| R4 | `groups` → `invites` | 1 : N | `invites.group_id` | — | 그룹 삭제 기능 없음 |
| R5 | `fundings` → `invites` | 1 : N (선택) | `invites.funding_id` NULL 가능 | **CASCADE** | NULL이면 그룹 전체 링크 |
| R6 | `users` → `fundings` (생일자) | 1 : N | `fundings.owner_id` | — | |
| R7 | `groups` → `fundings` | 1 : N | `fundings.group_id` | — | 만든 뒤 변경하지 않음 |
| R8 | `fundings` → `gifts` | 1 : N (최소 1) | `gifts.funding_id` | **CASCADE** | 최소 1개는 서버가 보장 |
| R9 | `gifts` → `donations` | 1 : N | `donations.gift_id` | **RESTRICT** | |
| R10 | `fundings` → `donations` | 1 : N | `donations.funding_id` | **RESTRICT** | 조회용 중복 컬럼 (= 선물의 펀딩) |
| R11 | `users` → `donations` (후원자) | 1 : N | `donations.supporter_id` | — | |
| R12 | `donations` → `messages` | 1 : 0..1 | `messages.donation_id` UNIQUE | — | 후원 삭제 기능 없음 |
| R13 | `gifts` → `carryovers` (이월한 선물) | 1 : 0..1 | `carryovers.gift_id` UNIQUE | — | 후원이 있어야 이월이 생김 → R9가 보호 |
| R14 | `carryovers` → `gifts` (다시 연 선물) | 0..1 : 0..1 | `carryovers.reopened_gift_id` UNIQUE | — | 다시 연 펀딩 · 선물은 삭제 불가로 서버가 보장 |
| R15 | `fundings` → `settlements` | 1 : N | `settlements.funding_id` | — | |
| R16 | `settlements` ↔ `gifts` | N : M | `settlement_items (settlement_id, gift_id)` | — | 실패하지 않은 정산 기준으로 선물당 1건 (부분 UNIQUE) |
| R17 | `users` → `birthday_events` | 1 : N | `birthday_events.owner_id` | — | |
| R18 | `fundings` → `birthday_events` | 1 : N (선택) | `birthday_events.linked_funding_id` | **SET NULL** | |
| R19 | `users` → `notifications` | 1 : N | `notifications.user_id` | — | |
| R20 | `birthday_events` → `notifications` | 1 : N (선택) | `notifications.event_id` | **CASCADE** | |
| R21 | `fundings` → `notifications` | 1 : N (선택) | `notifications.funding_id` | **CASCADE** | 미달 처리 알림만 채움. 생일 알림은 NULL (일정의 현재 연결로 판단) → 펀딩 삭제 시 생일 알림은 남음 |

---

## 4. 키 · 제약

| 종류 | 위치 | 막는 것 |
|---|---|---|
| UNIQUE | `users.email` | 같은 이메일 중복 |
| 복합 PK | `group_members (group_id, user_id)` | 같은 그룹 중복 참여 |
| UNIQUE | `invites.token` | 같은 초대 토큰 |
| UNIQUE | `donations (supporter_id, idempotency_key)` | 같은 후원 요청 중복 저장 |
| UNIQUE | `messages.donation_id` | 후원 1건에 메시지 여러 개 |
| UNIQUE | `carryovers.gift_id` | 같은 선물 이중 이월 |
| UNIQUE | `carryovers.reopened_gift_id` | 이월 금액을 두 선물에 반영 |
| 복합 PK | `settlement_items (settlement_id, gift_id)` | 한 정산에 같은 선물 두 번 |
| 부분 UNIQUE | `settlement_items(gift_id) WHERE is_active` | 같은 선물 이중 정산 (실패 후 재요청은 허용) |
| UNIQUE | `notifications (user_id, dedupe_key)` | 같은 알림 중복 생성 |
| CHECK | `fundings.end_date >= start_date` | 거꾸로 된 기간 |
| CHECK | `gifts.price > 0`, `donations.amount > 0`, `carryovers.amount > 0`, `settlements.amount > 0` | 0원 · 음수 |
| CHECK (값 목록) | `gifts.shortfall_action`, `carryovers.status`, `settlements.status`, `settlements.failure_reason`, `settlement_items.reason`, `notifications.type`, `user_preferences.price_range` | 정해지지 않은 값 |
| FK RESTRICT | `donations.gift_id`, `donations.funding_id` | 후원이 있는 선물 · 펀딩 삭제 |

> 부분 UNIQUE는 `settlement_items.is_active`(정산 실패 시 false)를 두고 `CREATE UNIQUE INDEX … ON settlement_items (gift_id) WHERE is_active`로 건다 (2026-10-19 확정, `docs/backend/ERD.md` 3.5).

---

## 5. 저장되는 상태 값

| 컬럼 | 값 | 바뀌는 순간 |
|---|---|---|
| `invites.is_active` | `true` → `false` | 비활성화 (되돌리지 않음) |
| `gifts.shortfall_action` | `NULL` → `carryover` / `withdraw` | 미달 처리 (한 번만) |
| `carryovers.status` | `pending` → `reopened` | 다음 생일 펀딩 생성 시 (`reopened_funding_id` · `reopened_gift_id` · `reopened_at`도 같이 채움) |
| `settlements.status` | `requested` → `processing` → `completed` / `failed` | 정산 처리 작업 (`processed_at`, 실패면 `failure_reason`) |
| `donations.status` | `completed` | 현재 값 하나 (모의 후원) |
| `notifications.is_read` | `false` → `true` | 알림 열기 · 모두 읽음 (`read_at`) |

---

## 6. 저장하지 않는 값과 원천 데이터

| 값 | 원천 (어느 테이블의 무엇) |
|---|---|
| 선물 모금액 `raised_amount` | `donations.amount`(그 `gift_id`) 합계 + `carryovers.amount`(`reopened_gift_id` = 그 선물) |
| 남은 금액 · 달성률 · 후원 마감 | 모금액, `gifts.price` |
| 펀딩 상태 `status` | `fundings.start_date`, `fundings.end_date`, 오늘(Asia/Seoul) |
| 펀딩 총 모금액 `total_raised` | 그 펀딩 `gifts`의 모금액 합 |
| 초대 링크 만료 | `invites.funding_id` → 그 펀딩의 상태 |
| 정산 가능 선물 | `gifts`(달성 또는 `shortfall_action = withdraw`) − `carryovers` − `settlement_items`(정산이 `failed` 아님) |
| 선물 정산 상태 `settlement_status` | `settlement_items` → `settlements.status` (`failed` 제외, 없으면 NULL) |
| 미달 처리 기한 | `fundings.end_date` + 7일 |
| 후원자 · 메시지 작성자 이름 | `donations.supporter_id` → `users.name` |

---

## 7. 삭제가 데이터에 미치는 범위

```
펀딩 삭제 (후원 0건일 때만 서버가 허용)
 ├─ gifts ............ CASCADE 삭제
 ├─ invites(지정) .... CASCADE 삭제
 ├─ notifications .... 미달 처리 알림만 CASCADE 삭제 (생일 알림은 funding_id가 없어 남음)
 └─ birthday_events .. linked_funding_id → NULL

생일 일정 삭제
 └─ notifications .... CASCADE 삭제

선물 삭제 (후원 0건 · 선물 2개 이상일 때만 서버가 허용)
 └─ 연결 데이터 없음 (후원이 있으면 donations RESTRICT로 DB도 거부)
```

삭제 API가 없는 테이블: `users`, `groups`, `group_members`, `invites`(비활성화만), `donations`, `messages`, `carryovers`, `settlements`, `settlement_items`.

---

## 8. 지금 Mock과 DB 설계의 차이

| 데이터 | 지금 Mock (`lib/mock/db.ts`) | DB 설계 | 화면 영향 |
|---|---|---|---|
| 취향 | `DbUser.preference` (사용자 안에 객체) | `user_preferences` 테이블 | 없음 |
| 그룹 참여자 | `DbGroup.memberIds` 배열 | `group_members` 테이블 | 없음 |
| 정산 포함 선물 | `DbGift.settlementId` + `DbSettlement.giftIds` | `settlement_items` 테이블 | 없음 |
| 그 밖 | 같은 이름의 배열 (`fundings`, `gifts`, `donations`, `messages`, `carryovers`, `settlements`, `birthdayEvents`, `notifications`, `invites`) | 같은 이름의 테이블 | 없음 |

저장 위치: 브라우저 localStorage `gift-funding:mock-db` (버전 4). 화면이 받는 응답 형식은 같으므로 DB로 바꿔도 화면 코드는 그대로다.

---

## 9. 테이블 ↔ 코드 ↔ API

| 테이블 | Mock 처리 (`lib/mock/handlers/`) | API (API_SPEC) |
|---|---|---|
| `users`, `user_preferences` | `auth.ts` | A1~A7 |
| `groups`, `group_members`, `invites` | `groups.ts` | G1~G8 |
| `fundings`, `gifts` | `fundings.ts` | F1~F14 |
| `donations`, `messages` | `donations.ts` | D1~D4 |
| `carryovers`, `settlements`, `settlement_items` | `settlements.ts` (이월 불러오기는 `fundings.ts`) | S1~S3, F13 |
| `birthday_events`, `notifications` | `schedule.ts` | C1~C5, N1~N4 |
| (저장 없음) AI 추천 | `ai.ts` | R1 |
| 공통 권한 · 계산 | `lib/mock/access.ts` | — |
