# db — PostgreSQL (Docker)

`docs/backend/ERD.md` 기준 데이터베이스. 백엔드(FastAPI)보다 먼저 띄운다.

| 파일 | 내용 |
|---|---|
| `01_init.sql` | 테이블 14개 · PK · FK · CHECK · 인덱스 생성 |
| `02_data.sql` | 개발 · 테스트용 초기 데이터 (Mock 과 같은 계정 · 그룹 · 펀딩 · 후원). **직접 고치지 말고** 스크립트로 다시 만든다 |
| `scripts/generate_seed.py` | `02_data.sql` 생성 스크립트 (비밀번호 Argon2 해시, 날짜는 오늘 기준) |

## 실행 (프로젝트 루트 `gift-funding/`에서)

```bash
cp .env.example .env          # 처음 한 번 (이미 있으면 생략)
docker compose up -d          # DB 실행 → 처음이면 01 → 02 SQL 자동 실행
docker compose ps             # STATUS 가 healthy 이면 준비 완료
```

## 확인

```bash
docker exec -it gift-funding-db psql -U gift_user -d gift_funding -c "\dt"
docker exec -it gift-funding-db psql -U gift_user -d gift_funding -c "SELECT name, email FROM users;"
```

테이블 14개, 테스트 계정 4개(비밀번호 모두 `password123`)가 보이면 성공.

## 자주 쓰는 명령

| 하고 싶은 것 | 명령 |
|---|---|
| 중지 (데이터 유지) | `docker compose down` |
| SQL 을 고친 뒤 처음부터 다시 만들기 (⚠️ 데이터 삭제) | `docker compose down -v && docker compose up -d` |
| 초기 데이터 다시 생성 | `pip install argon2-cffi` → `python db/scripts/generate_seed.py` |
| DB 직접 접속 | `docker exec -it gift-funding-db psql -U gift_user -d gift_funding` |
| 로그 보기 | `docker compose logs db` |

## 참고

- SQL 은 컨테이너를 **처음 만들 때만** 실행된다. 이미 만든 뒤 SQL 을 바꿨다면 `down -v` 로 저장 공간을 지우고 다시 띄운다.
- 시간대는 Asia/Seoul. 펀딩 상태(예정 · 진행 중 · 종료)는 저장하지 않고 날짜로 계산한다.
- 초기 데이터의 펀딩 기간은 DB 규칙(최대 21일)에 맞춰 Mock 보다 짧게 넣었다 (상태 · 모금액은 Mock 과 같음).
- 5432 포트를 이미 쓰고 있으면 `.env` 의 `POSTGRES_PORT` 를 바꾼다 (예: 5433).
- 테이블 변경 관리(Alembic) 도입은 백엔드 단계에서 결정한다.
