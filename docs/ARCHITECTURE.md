# ARCHITECTURE.md — 프론트엔드 구조 (UI · API 분리)

> 작성일: 2026-10-16 · 관련 문서: `docs/API_SPEC.md`(API 계약), `docs/DATA_MODEL.md`(데이터 설계), `rules.md` 9 · 10장(규칙)
> 목표: 화면 코드를 고치지 않고 **Mock 서버 ↔ FastAPI**를 환경 변수 하나로 바꿀 수 있게 한다.

---

## 1. 계층 구조

```text
┌──────────────────────────────────────────────────────────────┐
│ ① 화면 (app/**/page.tsx)                                      │
│    - 화면 상태(입력값 · 모달 열림 등)와 화면 이동만 담당          │
│    - 데이터는 ② 의 훅으로만 가져오고 바꾼다                       │
├──────────────────────────────────────────────────────────────┤
│ ② 데이터 훅 (hooks/queries/*.ts)  ← TanStack Query             │
│    - useXxxQuery: 조회 · 캐시 · 로딩/오류 상태                   │
│    - useXxxMutation: 저장 · 삭제 후 관련 캐시 무효화             │
│    - 쿼리 키는 hooks/queryKeys.ts 한곳에서 관리                  │
├──────────────────────────────────────────────────────────────┤
│ ③ 도메인 API (lib/api/{auth,groups,fundings,...}.ts)          │
│    - 함수 이름 · 입력 · 반환 타입 = 화면 쪽 계약 (기존 그대로)    │
│    - http 호출 + 매퍼(snake_case ↔ camelCase)만 한다             │
├──────────────────────────────────────────────────────────────┤
│ ④ HTTP 클라이언트 (lib/api/http.ts)                            │
│    - 토큰 첨부, JSON 변환, 오류 응답 → ApiError                  │
│    - NEXT_PUBLIC_API_MODE 에 따라 전송 대상 선택                 │
├───────────────────────────┬──────────────────────────────────┤
│ mock: lib/mock/router.ts   │ http: FastAPI                      │
│  → handlers/* (서버 역할)  │  ${NEXT_PUBLIC_API_BASE_URL}/api/v1│
│  → localStorage Mock DB    │                                    │
└───────────────────────────┴──────────────────────────────────┘

⑤ 컴포넌트 (components/**) — props 로 받은 데이터를 그리기만 한다. ② ③ ④ 를 import 하지 않는다.
```

| 계층 | 할 일 | 하지 않을 일 |
|---|---|---|
| ① 화면 | 훅 호출, 입력 상태, 화면 이동, 토스트 | `lib/api` · `lib/mock` 직접 import, 금액 계산 |
| ② 데이터 훅 | 쿼리 키, 캐시 시간, 성공 후 무효화 | 화면 이동, 토스트 문구 |
| ③ 도메인 API | 경로 · 요청 본문 구성, 매핑 | 권한 판단, 저장 로직 (서버 책임) |
| ④ HTTP | 인증 헤더, 오류 변환, 모드 전환 | 도메인 지식 |
| Mock 핸들러 | 서버 역할 흉내 (권한 · 검증 · 계산 · 저장) | 화면 경로 만들기, camelCase 응답 |
| ⑤ 컴포넌트 | 표시 · 사용자 입력 이벤트 전달 | 데이터 조회 · 저장 |

---

## 2. 폴더 구조 (S4 ~ S8 이후)

```text
frontend/src/
├── app/                         # ① 화면
├── components/                  # ⑤ 표시용 컴포넌트
│   ├── providers/QueryProvider.tsx   # QueryClientProvider (S5)
│   └── common/DeleteConfirmDialog.tsx # 공통 삭제 확인 모달 (S6)
├── hooks/
│   ├── queryKeys.ts             # 쿼리 키 모음 (S5)
│   └── queries/                 # ② 도메인별 useQuery · useMutation 훅
│       ├── auth.ts  groups.ts  fundings.ts  donations.ts
│       ├── settlements.ts  schedule.ts  ai.ts
├── lib/
│   ├── api/                     # ③ ④
│   │   ├── http.ts              # HTTP 클라이언트 · 모드 전환 (S4)
│   │   ├── case.ts              # snake_case ↔ camelCase 변환 · Snake<T> 타입
│   │   ├── dto.ts               # 응답 · 요청 타입 (snake_case, API_SPEC 2장)
│   │   ├── mappers.ts           # dto ↔ 도메인 타입 변환
│   │   ├── client.ts            # ApiError · 토큰 보관
│   │   └── auth.ts groups.ts fundings.ts donations.ts settlements.ts schedule.ts ai.ts
│   ├── mock/                    # Mock 서버 (연동 후 폴더째 삭제)
│   │   ├── router.ts            # (method, path) → handler · 오류 → HTTP 상태
│   │   ├── token.ts             # Mock 토큰 발급 · 해석 (JWT 역할)
│   │   ├── handlers/context.ts  # 핸들러 공통 타입 · requireUser
│   │   ├── handlers/*.ts        # 도메인별 서버 로직 (auth · groups · fundings · donations · settlements · schedule · ai)
│   │   ├── db.ts  seed.ts  access.ts
│   ├── constants.ts             # 카테고리 · 가격대 · 은행 · 메시지 길이
│   ├── paths.ts                 # 화면 경로 만들기 (서버는 경로를 주지 않음)
│   ├── validation.ts            # 입력 형식 검증 (화면 안내용)
│   └── format.ts  utils.ts  fundingDraft.ts  image.ts  auth.tsx  withFreshState.tsx
└── types/index.ts               # 도메인 타입 (camelCase, 권한별 분리)
```

---

## 3. 모드 전환 (Mock ↔ FastAPI)

| 환경 변수 | 값 | 동작 |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | `mock` (기본) | `http.ts`가 요청을 `lib/mock/router.ts`로 보낸다. 네트워크 없음 |
| | `http` | `fetch(NEXT_PUBLIC_API_BASE_URL + "/api/v1" + path)` |
| `NEXT_PUBLIC_API_BASE_URL` | 예: `http://localhost:8000` | `http` 모드에서만 사용 |

- Mock 라우터는 FastAPI와 **같은 경로 · 상태 코드 · snake_case JSON · 오류 형식**을 돌려준다 (API_SPEC 1.2). 그래서 모드를 바꿔도 ③ 이상은 그대로다.
- Mock 라우터 응답도 `structuredClone`으로 복사해 돌려준다 (화면이 받은 객체를 고쳐도 Mock DB가 바뀌지 않게).
- 연동이 끝나면 `lib/mock/` 폴더와 `mock` 분기를 지운다.

---

## 4. 요청 · 응답 흐름 예시 — 후원하기

```text
donation/[giftId]/page.tsx
  └─ const donate = useDonateMutation()            // ② hooks/queries/donations.ts
       └─ mutationFn: donate(request)               // ③ lib/api/donations.ts
            └─ http.post("/donations", toDonationRequestDto(request))   // ④
                 ├─ mock → router → handlers/donations.ts (멱등 키 · 초과 검증 · 저장)
                 └─ http → FastAPI POST /api/v1/donations
            ← 201 { donation_id } → { donationId }  // mappers
       onSuccess: invalidate fundings.friendDetail · gifts.donation · donations.mine
  └─ router.push(`/donation-complete/${donationId}`) // ① 화면 이동은 화면이
```

오류 흐름: 서버 `409 { code: "EXCEEDS_REMAINING", max_available: 9000 }` → `http.ts`가 `ApiError("EXCEEDS_REMAINING", message, { maxAvailable: 9000 })` → 화면이 `error.maxAvailable`로 안내.

---

## 5. TanStack Query 사용 기준

### 5.1 기본 설정 (`components/providers/QueryProvider.tsx`)

| 옵션 | 값 | 이유 |
|---|---|---|
| `staleTime` | 30초 | 탭 이동마다 다시 부르지 않되, 후원 · 모금액은 금방 갱신 |
| `retry` (조회) | 1회. 단 `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `VALIDATION`은 재시도 안 함 | 권한 오류를 반복 요청하지 않음 |
| `retry` (변경) | 0회 | 후원 · 정산이 두 번 처리되지 않게 (멱등 키는 서버가 따로 보장) |
| `refetchOnWindowFocus` | false | 입력 중 화면이 바뀌지 않게 |
| 로그아웃 | `queryClient.clear()` | 다른 계정 데이터가 남지 않게 |

### 5.2 쿼리 키 (`hooks/queryKeys.ts`)

| 도메인 | 키 | 사용 화면 |
|---|---|---|
| 사용자 | `["me"]`, `["me","preference"]` | AuthProvider, UI-25, UI-26, UI-11 |
| 그룹 | `["groups"]`, `["groups", groupId]` | UI-06, UI-09, UI-15 |
| 초대 | `["invites", groupId, fundingId \| null]`, `["invites","preview", token]` | UI-16, UI-17 |
| 내 펀딩 | `["fundings","mine"]`, `["fundings","mine", fundingId]`, `["fundings", fundingId, "supporters"]` | UI-04, 05, 12, 13, 22, 23 |
| 친구 펀딩 | `["fundings","friends"]`, `["fundings","friend", fundingId]` | UI-04, 07, 18 |
| 선물 | `["gifts","edit", giftId]`, `["gifts","donation", giftId]` | UI-10, UI-19 |
| 이월 | `["carryovers","pending"]` | UI-09 |
| 후원 | `["donations","mine", fundingId \| "all"]`, `["donations", donationId]` | UI-20, UI-21 |
| 메시지 | `["messages", fundingId \| "all"]` | UI-27 |
| 정산 | `["settlement", fundingId]` | UI-24 |
| 캘린더 | `["birthday-events"]`, `["birthday-events","linkable"]` | UI-04, UI-28 |
| 알림 | `["notifications"]`, `["notifications","unread"]` | UI-04, UI-29, 헤더 |

AI 추천은 사용자가 버튼을 눌러 요청하므로 **mutation**으로 다룬다 (캐시하지 않음).

### 5.3 변경 후 무효화 규칙

| 변경 | 무효화 (앞부분이 같은 키 전체) | 그 밖에 |
|---|---|---|
| 프로필 수정 | `["me"]` | — |
| 취향 저장 · 삭제 | `["me","preference"]` | — |
| 그룹 생성 | `["groups"]` | — |
| 초대 생성 · 비활성화 | `["invites", groupId]` | — |
| 초대로 참여 | `["groups"]`, `["fundings","friends"]` | — |
| 펀딩 생성 | `["fundings","mine"]`, `["groups"]`, `["carryovers"]` | — |
| **펀딩 삭제** | `["fundings"]`, `["groups"]`, `["notifications"]`, `["birthday-events"]` | 삭제한 상세 키는 `removeQueries` |
| 선물 추가 · 수정 | `["fundings","mine", fundingId]`, `["fundings","mine"]`, `["gifts","edit", giftId]` | — |
| **선물 삭제** | `["fundings","mine", fundingId]`, `["fundings","mine"]` | `["gifts","edit", giftId]` 제거 |
| 후원 | `["fundings","friend", fundingId]`, `["fundings","friends"]`, `["gifts","donation", giftId]`, `["donations","mine"]` | — |
| 미달 처리 | `["fundings","mine", fundingId]`, `["settlement", fundingId]`, `["carryovers"]` | — |
| 정산 요청 | `["settlement", fundingId]`, `["fundings","mine", fundingId]` | — |
| 생일 일정 등록 · 수정 · 삭제 | `["birthday-events"]`, `["notifications"]` | — |
| 알림 읽음 | `["notifications"]` | — |
| 로그아웃 | 전체 `clear()` | — |

### 5.4 화면 상태 표시

- 로딩 · 오류 · 권한 없음 · 빈 목록은 기존 `AsyncBoundary`(`components/common/StateViews.tsx`)로 그린다. S5에서 `UseQueryResult`도 받도록 맞춘다.
- 오류 문구는 `getErrorMessage(error)`로 통일한다. `FORBIDDEN` · `NOT_FOUND`는 "접근 권한 없음" 화면.

---

## 6. 공통 삭제 확인 모달 (`components/common/DeleteConfirmDialog.tsx`)

| 항목 | 내용 |
|---|---|
| 기본 문구 | 제목 "정말 삭제하시겠습니까?" · 설명 "삭제한 데이터는 복구할 수 없습니다." |
| 버튼 | "취소"(secondary) · "삭제"(danger). 취소 → 모달만 닫힘 |
| props | `open`, `onOpenChange`, `onConfirm: () => Promise<void>`, `title?`, `description?`, `confirmLabel?`, `successMessage?`(기본 "삭제되었습니다.") |
| 진행 중 | "삭제" 버튼 로딩, 닫기 · 취소 잠금, 두 번 누르기 방지 |
| 성공 | 모달 닫기 → 토스트 `successMessage` (캐시 무효화와 화면 이동은 mutation · 화면이 한다) |
| 실패 | 모달 안에 오류 문구 (`role="alert"`), 데이터 유지, 다시 시도 가능 |
| 적용 | UI-12 펀딩 삭제, UI-10 선물 삭제, UI-28 생일 일정 삭제 |

---

## 7. 새 API를 추가할 때 순서

1. `docs/API_SPEC.md`에 경로 · 요청 · 응답 · 오류 · 권한을 적는다.
2. `lib/api/dto.ts`에 snake_case 타입, `types/index.ts`에 camelCase 타입을 추가한다.
3. `lib/api/mappers.ts`에 변환 함수를 추가한다.
4. `lib/api/<도메인>.ts`에 함수를 추가한다 (`http.*` + 매퍼만).
5. `lib/mock/handlers/<도메인>.ts`에 서버 로직을, `lib/mock/router.ts`에 경로를 등록한다.
6. `hooks/queryKeys.ts`, `hooks/queries/<도메인>.ts`에 훅과 무효화 규칙을 추가한다.
7. Mock 핸들러 테스트(`lib/api/mockApi.test.ts`)와 화면 흐름을 확인한다.
