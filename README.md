# 🎁 Gift Funding — AI 생일선물 공동 펀딩

생일자가 받고 싶은 선물을 등록하면, 초대받은 친구들이 원하는 선물을 골라 **원하는 금액만큼 함께 후원**하는 **비공개 생일선물 공동 펀딩 서비스**예요.
선물이 고민될 때는 **AI가 관심사 · 예산에 맞는 선물(브랜드 · 제품명)을 추천**해 줘요.

> ⚠️ 실제 결제 · 은행 송금은 연결되어 있지 않은 **모의 후원 · 모의 정산**이에요.

---

## 해결하려는 문제

- **선물 고르기가 어렵다** → 생일자가 원하는 선물을 직접 등록하고, AI가 선물 아이디어를 추천
- **비싼 선물은 혼자 부담하기 어렵다** → 여러 친구가 원하는 금액만큼 나눠서 후원
- **함께 준비하는 과정이 번거롭다** → 초대 링크로 참여, 모금 현황 · 달성률을 자동으로 계산
- **원하지 않는 선물 · 중복 선물** → 선물마다 목표 금액을 두고, 목표를 넘는 후원은 막음

## 주요 기능

| 구분 | 기능 |
|---|---|
| 회원 | 회원가입 · 로그인(30일 유지), 프로필 · 선물 취향(관심사 · 카테고리 · 가격대) |
| 그룹 · 초대 | 관계별 비공개 그룹, 초대 링크(그룹 / 펀딩 지정), 그룹을 만든 사람만 그 그룹에 펀딩을 연다 |
| 펀딩 · 선물 | 펀딩 만들기(최대 21일), 선물 등록(최대 5,000만 원), 진행 · 예정 · 종료 상태 |
| 후원 | 1원 단위 후원, 남은 금액 초과 · 중복 후원 방지, 비공개 축하 메시지 |
| 공개 범위 | 후원자에게는 **달성률만** 보이고 모금액 · 다른 후원자는 보이지 않음 |
| 목표 미달 · 정산 | 미달 선물은 다음 생일로 **이월** 또는 **인출**, 본인 명의 계좌로 모의 정산(계좌번호 암호화 저장) |
| 캘린더 · 알림 | 친구 생일 캘린더, 생일 하루 전 · 당일 알림, 미달 처리 알림 |
| AI 추천 | GPT(`gpt-4o-mini`)가 브랜드 · 제품명 · 예상 가격대 · 추천 이유를 4개 추천 |

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query · Vitest |
| 백엔드 | FastAPI · SQLAlchemy 2 · Pydantic 2 · PyJWT · Argon2 · Fernet(계좌 암호화) · Pytest |
| 데이터베이스 | PostgreSQL 16 |
| AI | OpenAI GPT API (`gpt-4o-mini`, Structured Outputs) — 키가 없으면 모의 추천 |
| 실행 환경 | Docker Compose (DB + 백엔드 컨테이너 2개) |

## 폴더 구조

```
gift-funding/
├── frontend/          Next.js 화면 (실제 API · Mock 모드 전환 가능)
├── backend/           FastAPI 서버 (API 47개, /api/v1)
├── db/                01_init.sql(테이블 14개) · 02_data.sql(테스트 데이터)
├── docs/              기획 · 명세 · 설계 문서
│   ├── product/       제품 정의 · 기능 명세(F-01 ~ F-16) · 기술 스택
│   ├── backend/       API 명세 · ERD · 남은 일(PENDING)
│   ├── business-logic/ 비즈니스 규칙 · 확정 정책
│   └── design/        화면 설계
├── docker-compose.yml
└── .env.example       환경 변수 양식 (복사해서 .env 로 사용)
```

## 실행 방법

### 1. 환경 변수

```bash
cp .env.example .env
```

`.env`에서 아래 값을 채워요.

| 이름 | 설명 | 만드는 방법 |
|---|---|---|
| `JWT_SECRET` | 로그인 토큰 비밀키 | `openssl rand -hex 32` |
| `ACCOUNT_ENCRYPTION_KEY` | 정산 계좌번호 암호화 열쇠 (한 번 정하면 바꾸지 않기) | `python3 -c "import base64,os;print(base64.urlsafe_b64encode(os.urandom(32)).decode())"` |
| `OPENAI_API_KEY` | AI 추천 (선택 — 비우면 모의 추천) | platform.openai.com |

### 2. DB + 백엔드 (Docker)

```bash
docker compose up -d --build
```

- 백엔드: http://localhost:8000 · API 문서: http://localhost:8000/docs
- 처음 켤 때 `db/01_init.sql` → `db/02_data.sql`이 자동으로 실행돼요.
- DB를 처음부터 다시 만들기 (⚠️ 데이터 삭제): `docker compose down -v && docker compose up -d --build`

### 3. 프론트엔드

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_MODE=http" > .env.local
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" >> .env.local
npm run dev
```

→ http://localhost:3000

### 테스트 계정

비밀번호는 모두 `password123` — `seoyeon@example.com`, `jihoon@example.com`, `mina@example.com`, `doyoon@example.com`

## 테스트

```bash
docker compose exec backend pytest     # 백엔드 (79개)
cd frontend && npm test                # 프론트엔드 (93개)
```

## 문서

- [기능 명세서](docs/product/FEATURE_SPEC.md)
- [백엔드 API 명세서](docs/backend/API.SPEC.md)
- [ERD](docs/backend/ERD.md)
- [확정 정책 · 남은 질문](docs/business-logic/99-open-questions.md)
- [미정 · 나중에 할 일](docs/backend/PENDING.md)
