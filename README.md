# 🎁 Gift Funding — 프론트엔드 (AI 생일선물 공동 펀딩)

생일자가 받고 싶은 선물을 등록하면, 초대받은 친구들이 원하는 선물을 골라 **원하는 금액만큼 함께 후원**하는 **비공개 생일선물 공동 펀딩 서비스**의 화면(Next.js)이에요.
선물이 고민될 때는 **AI가 관심사 · 예산에 맞는 선물(브랜드 · 제품명)을 추천**해 줘요.

> ⚠️ 실제 결제 · 은행 송금은 연결되어 있지 않은 **모의 후원 · 모의 정산**이에요.

| 저장소 | 내용 | 배포 |
|---|---|---|
| **gift-funding-frontend** (여기) | Next.js 화면 · 화면 설계 문서 | Vercel |
| [gift-funding-backend](https://github.com/AI-Campus-1st/gift-funding-backend) | FastAPI 서버 · DB · **기획 · 정책 · API 문서** · docker-compose | Render |

## 배포 주소

| 구분 | 주소 |
|---|---|
| 화면 | https://gift-funding-frontend-tau.vercel.app |
| 백엔드 API | https://minji-gift-funding.onrender.com (`/docs`) |

- 백엔드는 무료 서버라 15분 동안 요청이 없으면 잠들어요. 처음 열 때 30초 ~ 1분 걸릴 수 있어요.
- 배포 과정 · 오류와 해결: [backend 저장소 docs/deploy/DEPLOY_LOG.md](https://github.com/AI-Campus-1st/gift-funding-backend/blob/main/docs/deploy/DEPLOY_LOG.md)

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · TanStack Query 5 · shadcn/ui 방식 컴포넌트(Radix) · Lucide React · FullCalendar · Pretendard · Vitest + React Testing Library

## 실행 방법

### 방법 1. 화면만 바로바로 고치면서 보기 (`npm run dev`)

백엔드는 backend 저장소에서 docker compose 로 켜 두고(`docker compose stop frontend`로 3000번은 비우기), 이 폴더에서:

```bash
npm install
echo "NEXT_PUBLIC_API_MODE=http" > .env.local
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" >> .env.local
npm run dev        # http://localhost:3000
```

### 방법 2. DB · 백엔드 · 프론트를 한꺼번에 (Docker)

backend 저장소와 이 저장소를 **같은 폴더 안에 나란히** 받은 뒤, backend 폴더에서 실행해요.

```bash
cd ~/Desktop/workspace/gift-funding-backend
docker compose up -d --build
```

자세한 방법은 [backend README](https://github.com/AI-Campus-1st/gift-funding-backend#로컬-실행-docker--db--백엔드--프론트-3개)를 봐요.

### 환경 변수

| 이름 | 값 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_API_MODE` | `http` / `mock` | `http`: 실제 백엔드 사용, `mock`(또는 없음): 브라우저 안의 모의 API |
| `NEXT_PUBLIC_API_BASE_URL` | 예: `http://localhost:8000` | 백엔드 주소 (끝에 `/` 없이, `/api/v1`은 코드가 붙임) |

- 로컬은 `.env.local`(GitHub에 올라가지 않음), 배포는 Vercel 환경 변수에 넣어요.
- `NEXT_PUBLIC_*` 값은 **빌드할 때** 들어가요. 바꾸면 다시 빌드 · 배포해야 해요.

### 테스트 계정

비밀번호는 모두 `password123` — `seoyeon@example.com`, `jihoon@example.com`, `mina@example.com`, `doyoon@example.com`

## 테스트 · 점검

```bash
npm test           # 95개 (Mock API 위에서 실행)
npm run lint
npm run build      # 배포용 빌드 확인
```

## 폴더 구조

```
gift-funding-frontend/
├── src/
│   ├── app/            화면 (App Router) — (public) 로그인 · 회원가입 / (app) 로그인 후 화면
│   ├── components/     공통 · 기능별 컴포넌트
│   ├── hooks/queries/  TanStack Query 훅
│   └── lib/
│       ├── api/        API 함수 (http.ts: 실제 백엔드 / mock 전환)
│       └── mock/       모의 API (테스트용)
├── docs/
│   ├── design/         화면 설계 (페이지 · 컴포넌트)
│   ├── frontend/       프론트 개발 메모
│   └── API_SPEC.md     프론트가 부르는 API 목록
├── Dockerfile          docker compose 용 (Vercel 은 사용하지 않음)
└── next.config.ts
```

## 문서

| 문서 | 위치 |
|---|---|
| 화면 설계 | [docs/design/](docs/design/) |
| 기능 명세 · 비즈니스 규칙 · 확정 정책 | [backend 저장소 docs/product · docs/business-logic](https://github.com/AI-Campus-1st/gift-funding-backend/tree/main/docs) |
| API 명세 (백엔드) | [backend 저장소 docs/backend/API.SPEC.md](https://github.com/AI-Campus-1st/gift-funding-backend/blob/main/docs/backend/API.SPEC.md) |

## 개발 기록

- 이 저장소는 원래 프론트 · 백엔드를 함께 담은 `minji_gift_funding` 저장소였어요. 2026-10-21 이름을 바꾸고 프론트만 남겼어요.
- 그래서 **Issue #1 · PR #2(비밀번호 변경, 코드 리뷰 포함)** 와 그 전의 전체 커밋 기록이 이 저장소에 있어요.
