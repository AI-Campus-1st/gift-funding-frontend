# backend — FastAPI 서버

`docs/backend/API.SPEC.md` 기준. 모든 API 는 `/api/v1` 아래에 있다 (프론트 `lib/api/http.ts` 와 같음).
DB 는 먼저 도커로 띄워 둔다 (`db/README.md`).

## 지금 만든 범위 (1단계: 뼈대 + 인증)

| # | API | 설명 |
|---|---|---|
| A1 | `POST /api/v1/auth/signup` | 회원가입 (Argon2 해시 저장, 빈 취향 생성) |
| A2 | `POST /api/v1/auth/login` | 로그인 → JWT 발급 |
| A3 | `POST /api/v1/auth/logout` | 로그아웃 (서버 저장 없음, 프론트가 토큰 삭제) |
| A4 | `GET /api/v1/me` | 내 정보 |
| A5 | `PATCH /api/v1/me` | 프로필 수정 |
| A6 | `GET /api/v1/me/preferences` | 선물 취향 조회 |
| A7 | `PUT /api/v1/me/preferences` | 선물 취향 저장 |
| G1 | `GET /api/v1/groups` | 내 그룹 목록 (만든 · 참여한) |
| G2 | `POST /api/v1/groups` | 그룹 생성 (만든 사람 = 관리자) |
| G3 | `GET /api/v1/groups/{group_id}` | 그룹 상세 · 참여자 |
| G9 | `PATCH /api/v1/groups/{group_id}` | 그룹 이름 · 설명 수정 (만든 사람만) |
| G4 | `GET /api/v1/groups/{group_id}/invites` | 초대 링크 목록 |
| G5 | `POST /api/v1/groups/{group_id}/invites` | 초대 링크 생성 |
| G6 | `PATCH /api/v1/invites/{token}` | 초대 링크 비활성화 |
| G7 | `GET /api/v1/invites/{token}` | 초대 링크 확인 (참여 전 정보) |
| G8 | `POST /api/v1/invites/{token}/join` | 초대 링크로 참여 |
| F1 | `GET /api/v1/me/fundings` | 내 펀딩 목록 (시작일 최신순, 모금액 포함) |
| F2 | `GET /api/v1/me/fundings/{funding_id}` | 내 펀딩 상세 (생일자만) |
| F3 | `POST /api/v1/fundings` | 펀딩 생성 (내가 만든 그룹에만, 이월 선물 다시 열기) |
| F14 | `PATCH /api/v1/fundings/{funding_id}` | 펀딩 이름 수정 (종료 전까지) |
| F4 | `DELETE /api/v1/fundings/{funding_id}` | 펀딩 삭제 (후원 · 이월 금액 있으면 불가) |
| F5 | `POST /api/v1/fundings/{funding_id}/gifts` | 선물 추가 (종료 전까지) |
| F6 | `GET /api/v1/me/gifts/{gift_id}` | 선물 수정용 조회 |
| F7 | `PUT /api/v1/gifts/{gift_id}` | 선물 수정 (후원 있으면 가격 변경 불가) |
| F8 | `DELETE /api/v1/gifts/{gift_id}` | 선물 삭제 |
| F9 | `GET /api/v1/fundings/{funding_id}/donations` | 후원자 내역 (생일자 전용) |
| F10 | `GET /api/v1/fundings/friends` | 친구 펀딩 목록 (모금액 없음) |
| F11 | `GET /api/v1/fundings/{funding_id}` | 친구 펀딩 상세 (모금액 없음) |
| F12 | `GET /api/v1/gifts/{gift_id}` | 후원할 선물 조회 (모금액 없음) |
| F13 | `GET /api/v1/me/carryovers` | 다시 열 수 있는 이월 선물 |
| D1 | `POST /api/v1/donations` | 후원하기 (+ 축하 메시지, 중복 방지 · 동시 후원 처리) |
| D2 | `GET /api/v1/me/donations` | 내 후원 내역 |
| D3 | `GET /api/v1/me/donations/{donation_id}` | 내 후원 1건 |
| D4 | `GET /api/v1/me/messages` | 받은 축하 메시지 (생일자) |
| S1 | `POST /api/v1/gifts/{gift_id}/shortfall` | 목표 미달 처리 (이월 / 인출) |
| S2 | `GET /api/v1/fundings/{funding_id}/settlement` | 정산 현황 (생일자) |
| S3 | `POST /api/v1/fundings/{funding_id}/settlements` | 정산 요청 (모의, 계좌번호 암호화 저장) |
| C1 | `GET /api/v1/birthday-events` | 내 생일 일정 |
| C2 | `GET /api/v1/birthday-events/linkable-fundings` | 일정에 연결할 수 있는 펀딩 |
| C3 | `POST /api/v1/birthday-events` | 생일 일정 등록 |
| C4 | `PUT /api/v1/birthday-events/{event_id}` | 생일 일정 수정 |
| C5 | `DELETE /api/v1/birthday-events/{event_id}` | 생일 일정 삭제 (+ 그 일정의 알림 삭제) |
| N1 | `GET /api/v1/notifications` | 알림 목록 (조회할 때 생일 · 미달 처리 알림 생성) |
| N2 | `GET /api/v1/notifications/unread-count` | 안 읽은 알림 수 |
| N3 | `PATCH /api/v1/notifications/{notification_id}` | 알림 읽음 |
| N4 | `POST /api/v1/notifications/read-all` | 모두 읽음 |
| R1 | `POST /api/v1/ai/recommendations` | AI 선물 추천 — GPT `gpt-4o-mini` (`.env` 에 `OPENAI_API_KEY` 가 없으면 모의 추천), 1인당 1분 5회 |
| — | `GET /health` | 서버 · DB 연결 확인 |

남은 일: docs/backend/PENDING.md 참고

## 실행 — 도커 (기본)

DB 와 백엔드를 프로젝트 루트의 `docker-compose.yml` 하나로 함께 관리한다 (컨테이너 2개: `db`, `backend`).

```bash
cd ~/Desktop/workspace/gift-funding
docker compose up -d --build        # 켜기 (처음 · 코드 수정 후)
docker compose ps                   # db, backend 모두 healthy 면 준비 완료
```

| 하고 싶은 것 | 명령 (프로젝트 루트에서) |
|---|---|
| 코드 수정 반영 | `docker compose down && docker compose up -d --build` |
| 끄기 (DB 데이터 유지) | `docker compose down` |
| 백엔드 로그 보기 | `docker compose logs -f backend` (빠져나오기: Ctrl + C) |
| 테스트 | `docker compose exec backend pytest` |
| DB 를 처음부터 다시 (⚠️ 데이터 삭제) | `docker compose down -v && docker compose up -d --build` |

- `.env` 에 `JWT_SECRET` 이 있어야 백엔드가 켜진다. 없으면: `echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env`
- `.env` 에 `ACCOUNT_ENCRYPTION_KEY`(정산 계좌번호 암호화 열쇠)도 있어야 한다. 없으면: `echo "ACCOUNT_ENCRYPTION_KEY=$(python3 -c 'import base64,os;print(base64.urlsafe_b64encode(os.urandom(32)).decode())')" >> .env` — 한 번 정하면 바꾸지 않는다 (바꾸면 저장된 계좌번호를 못 읽음)
- `.env` 에 `OPENAI_API_KEY`(AI 추천)가 있으면 GPT 를 쓰고(모델은 `OPENAI_MODEL`, 기본 `gpt-4o-mini`), 없으면 모의 추천으로 동작한다. 연결 점검: `docker compose exec backend python -m app.ai.check`. 테스트(pytest)는 키가 있어도 진짜 AI 를 부르지 않는다
- 맥북에서 `uvicorn` 을 직접 켜 둔 상태면 8000 포트가 겹친다 → 그 터미널에서 Ctrl + C 로 먼저 끈다.

확인

- 서버: http://localhost:8000/health → `{"status":"ok","db":"ok"}`
- API 테스트 화면: http://localhost:8000/docs → `POST /api/v1/auth/login` → Try it out
  `{"email": "seoyeon@example.com", "password": "password123", "remember_me": false}` → Execute → Server response 의 Code 200

## (선택) 도커 없이 맥북에서 직접 실행

코드를 자주 고칠 때 편하다. DB 는 도커로 켜 두고, 백엔드 컨테이너는 끈다 (`docker compose stop backend`).

```bash
cd backend
python3 -m venv .venv                     # 처음 한 번
source .venv/bin/activate                 # 터미널을 새로 열 때마다
pip install -r requirements.txt           # 처음 한 번
uvicorn app.main:app --reload --reload-dir app
```

## 프론트를 실제 백엔드에 연결

`frontend/.env.local` 파일을 만들고 두 줄을 넣은 뒤 `npm run dev` 를 다시 실행한다.

```
NEXT_PUBLIC_API_MODE=http
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

⚠️ 지금은 인증 · 그룹 · 초대 · 펀딩 · 선물 · 후원 · 정산 · 캘린더 · 알림 · AI 추천(모의) API 까지 모두 있다.
Mock 으로 돌아가려면 `.env.local` 을 지우거나 `NEXT_PUBLIC_API_MODE=mock` 으로 바꾸고 다시 실행한다.

## 테스트

```bash
docker compose exec backend pytest      # 도커로 실행 중일 때
# 또는 (직접 실행 중일 때) cd backend && source .venv/bin/activate && pytest
```

- 도커 DB(초기 데이터 포함)에 연결해서 실행한다. 테스트마다 트랜잭션을 되돌려서 DB 데이터는 바뀌지 않는다.

## 폴더

```
backend/
├── app/
│   ├── main.py        서버 시작점 · CORS · 라우터 등록 (/api/v1)
│   ├── config.py      .env 읽기 (DATABASE_URL, JWT_SECRET, ACCOUNT_ENCRYPTION_KEY, CORS_ORIGINS)
│   ├── crypto.py      정산 계좌번호 암호화 · 마스킹
│   ├── db.py          DB 연결 (SQLAlchemy 2 + psycopg 3, 시간대 Asia/Seoul)
│   ├── errors.py      오류 형식 { code, message, field_errors }
│   ├── security.py    Argon2 · JWT · 현재 사용자 확인
│   ├── models/        테이블 ↔ 파이썬 (users, user_preferences)
│   ├── schemas/       요청 · 응답 형식
│   ├── services/      비즈니스 로직 · 검증 (프론트와 같은 문구)
│   └── routers/       API 주소
├── tests/             pytest
├── Dockerfile         도커 이미지 (Python 3.13)
└── requirements.txt
```

## 참고

- 테이블은 `db/01_init.sql` 로 만든다. 서버가 테이블을 만들지 않는다 (Alembic 은 테이블 변경이 생길 때 도입).
- 로그인 토큰 유효기간은 30일 (2026-10-19 확정). "로그인 상태 유지"는 프론트가 브라우저를 닫아도 토큰을 남길지만 정한다.
