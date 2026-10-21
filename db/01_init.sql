-- =====================================================================
-- 01_init.sql — 테이블 생성 (docs/backend/ERD.md 기준)
--
-- PostgreSQL 16 · 기준 시간대 Asia/Seoul (docker-compose.yml 에서 설정)
-- 도커 컨테이너가 "처음" 만들어질 때 /docker-entrypoint-initdb.d 에서 자동 실행된다.
-- 다시 적용하려면: docker compose down -v && docker compose up -d
--
-- 규칙
-- - ID: UUID (gen_random_uuid(), PostgreSQL 13+ 기본 제공)
-- - 금액: INTEGER (원 단위)
-- - 삭제: Hard Delete
-- - 모금액 · 달성률 · 펀딩 상태 · 초대 링크 만료 · 정산 표시는 저장하지 않는다 (조회할 때 계산)
-- - 글자 수: 화면 = 서버 = DB (ERD 0장, 2026-10-19 확정)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 3.1 사용자
-- ---------------------------------------------------------------------

-- 회원 (F-01, F-02) — 로그인: email + password_hash(Argon2)
CREATE TABLE users (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(50)  NOT NULL,
  email              VARCHAR(255) NOT NULL,
  password_hash      TEXT         NOT NULL,
  birthday           DATE         NOT NULL,
  profile_image_url  TEXT         NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT ck_users_email_lower CHECK (email = lower(email))
);

-- 선물 취향 (F-02, F-03) — 사용자당 1행
CREATE TABLE user_preferences (
  user_id      UUID        PRIMARY KEY REFERENCES users (id),
  keywords     TEXT[]      NOT NULL DEFAULT '{}',
  categories   TEXT[]      NOT NULL DEFAULT '{}',
  price_range  VARCHAR(20) NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 키워드 최대 10개(Q3 확정)는 서버가 잘라서 저장한다 (DB CHECK 없음)
  CONSTRAINT ck_user_preferences_price_range CHECK (
    price_range IS NULL OR price_range IN ('under30k', '30k-100k', '100k-300k', '300k-500k', 'over500k')
  )
);

-- ---------------------------------------------------------------------
-- 3.2 그룹 · 초대
-- ---------------------------------------------------------------------

-- 비공개 그룹 (F-05) — 삭제 기능 없음
CREATE TABLE groups (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(30)  NOT NULL,
  description  VARCHAR(100) NOT NULL DEFAULT '',
  admin_id     UUID         NOT NULL REFERENCES users (id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 그룹 참여 (F-05, F-06) — 복합 PK로 중복 참여 방지. 관리자도 한 행
CREATE TABLE group_members (
  group_id   UUID        NOT NULL REFERENCES groups (id),
  user_id    UUID        NOT NULL REFERENCES users (id),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- ---------------------------------------------------------------------
-- 3.3 펀딩 · 선물
-- ---------------------------------------------------------------------

-- 생일 펀딩 (F-07) — 상태(예정 · 진행 중 · 종료)는 날짜로 계산
CREATE TABLE fundings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES users (id),
  group_id    UUID        NOT NULL REFERENCES groups (id),
  name        VARCHAR(40) NOT NULL,
  start_date  DATE        NOT NULL,   -- 오늘 포함 이후: 서버 검증 (DB CHECK 불가)
  end_date    DATE        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 종료일 ≥ 시작일, 시작일 포함 최대 21일
  CONSTRAINT ck_fundings_period CHECK (end_date >= start_date AND end_date <= start_date + 20)
);

-- 초대 링크 (F-06) — funding_id NULL = 그룹 링크, 값 = 펀딩 지정 링크. 삭제 대신 비활성화
CREATE TABLE invites (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           VARCHAR(64) NOT NULL,
  group_id        UUID        NOT NULL REFERENCES groups (id),
  funding_id      UUID        NULL REFERENCES fundings (id) ON DELETE CASCADE,
  created_by      UUID        NOT NULL REFERENCES users (id),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at  TIMESTAMPTZ NULL,
  CONSTRAINT uq_invites_token UNIQUE (token)
);

-- 펀딩 선물 (F-04, F-09, F-11) — price = 목표 금액
CREATE TABLE gifts (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_id            UUID         NOT NULL REFERENCES fundings (id) ON DELETE CASCADE,
  name                  VARCHAR(100) NOT NULL,
  price                 INTEGER      NOT NULL,
  image_url             TEXT         NOT NULL,
  product_url           TEXT         NOT NULL,
  description           VARCHAR(100) NOT NULL DEFAULT '',
  sort_order            INTEGER      NOT NULL,
  shortfall_action      VARCHAR(10)  NULL,   -- 0원 선물은 NULL 그대로 (계산으로 판단)
  shortfall_decided_at  TIMESTAMPTZ  NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_gifts_price CHECK (price > 0),
  CONSTRAINT ck_gifts_shortfall_action CHECK (shortfall_action IS NULL OR shortfall_action IN ('carryover', 'withdraw'))
);

-- ---------------------------------------------------------------------
-- 3.4 후원 · 메시지
-- ---------------------------------------------------------------------

-- 후원 (F-08, F-10) — 후원이 있는 선물 · 펀딩은 삭제 불가 (RESTRICT)
CREATE TABLE donations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_id       UUID        NOT NULL REFERENCES fundings (id) ON DELETE RESTRICT,
  gift_id          UUID        NOT NULL REFERENCES gifts (id) ON DELETE RESTRICT,
  supporter_id     UUID        NOT NULL REFERENCES users (id),
  amount           INTEGER     NOT NULL,
  idempotency_key  VARCHAR(64) NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_donations_amount CHECK (amount > 0),
  CONSTRAINT ck_donations_status CHECK (status IN ('completed')),
  -- 같은 후원 요청 중복 저장 방지
  CONSTRAINT uq_donations_idempotency UNIQUE (supporter_id, idempotency_key)
);

-- 축하 메시지 (F-14) — 후원 1건당 최대 1개. 작성자 · 펀딩 · 선물은 donations 로 조회
CREATE TABLE messages (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id  UUID         NOT NULL REFERENCES donations (id),
  content      VARCHAR(200) NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_messages_donation UNIQUE (donation_id),
  CONSTRAINT ck_messages_content_not_blank CHECK (length(btrim(content)) > 0)
);

-- ---------------------------------------------------------------------
-- 3.5 목표 미달 · 정산
-- ---------------------------------------------------------------------

-- 다음 생일로 이월 (F-11)
CREATE TABLE carryovers (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             UUID        NOT NULL REFERENCES users (id),
  funding_id           UUID        NOT NULL REFERENCES fundings (id),
  gift_id              UUID        NOT NULL REFERENCES gifts (id),
  amount               INTEGER     NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'pending',
  reopened_funding_id  UUID        NULL REFERENCES fundings (id),
  reopened_gift_id     UUID        NULL REFERENCES gifts (id),
  reopened_at          TIMESTAMPTZ NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_carryovers_gift UNIQUE (gift_id),
  CONSTRAINT uq_carryovers_reopened_gift UNIQUE (reopened_gift_id),
  CONSTRAINT ck_carryovers_amount CHECK (amount > 0),
  CONSTRAINT ck_carryovers_status CHECK (status IN ('pending', 'reopened')),
  -- 상태 값과 "다시 연" 정보의 짝
  CONSTRAINT ck_carryovers_reopened CHECK (
    (status = 'pending'  AND reopened_funding_id IS NULL     AND reopened_gift_id IS NULL     AND reopened_at IS NULL)
    OR
    (status = 'reopened' AND reopened_funding_id IS NOT NULL AND reopened_gift_id IS NOT NULL AND reopened_at IS NOT NULL)
  )
);

-- 정산 요청 (F-12) — 상태는 프로그램이 자동 변경. 계좌번호는 암호화된 문자열
CREATE TABLE settlements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID        NOT NULL REFERENCES users (id),
  funding_id      UUID        NOT NULL REFERENCES fundings (id),
  amount          INTEGER     NOT NULL,
  bank            VARCHAR(30) NOT NULL,
  account_number  TEXT        NOT NULL,
  account_holder  VARCHAR(50) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'requested',
  failure_reason  VARCHAR(30) NULL,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ NULL,
  CONSTRAINT ck_settlements_amount CHECK (amount > 0),
  CONSTRAINT ck_settlements_status CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  CONSTRAINT ck_settlements_failure_reason CHECK (failure_reason IS NULL OR failure_reason IN ('ACCOUNT_INVALID', 'BANK_ERROR'))
);

-- 정산에 포함된 선물 (F-12) — 정산이 failed 가 되면 같은 트랜잭션에서 is_active = false
CREATE TABLE settlement_items (
  settlement_id  UUID        NOT NULL REFERENCES settlements (id),
  gift_id        UUID        NOT NULL REFERENCES gifts (id),
  amount         INTEGER     NOT NULL,
  reason         VARCHAR(10) NOT NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  PRIMARY KEY (settlement_id, gift_id),
  CONSTRAINT ck_settlement_items_reason CHECK (reason IN ('achieved', 'withdraw'))
);

-- 유효한(실패하지 않은) 정산 항목에서 같은 선물은 한 번만 → 중복 정산 방지, 실패 후 재요청 허용
CREATE UNIQUE INDEX uq_settlement_items_active_gift ON settlement_items (gift_id) WHERE is_active;

-- ---------------------------------------------------------------------
-- 3.6 생일 캘린더 · 알림
-- ---------------------------------------------------------------------

-- 친구 생일 일정 (F-15) — 펀딩 삭제 시 연결만 해제
CREATE TABLE birthday_events (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID        NOT NULL REFERENCES users (id),
  friend_name        VARCHAR(20) NOT NULL,
  birthday           DATE        NOT NULL,
  linked_funding_id  UUID        NULL REFERENCES fundings (id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 알림 (F-16) — 생일 알림은 event_id 만, 미달 처리 알림은 funding_id 만
CREATE TABLE notifications (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users (id),
  type        VARCHAR(20)  NOT NULL,
  title       VARCHAR(100) NOT NULL,
  body        TEXT         NOT NULL,
  event_id    UUID         NULL REFERENCES birthday_events (id) ON DELETE CASCADE,
  funding_id  UUID         NULL REFERENCES fundings (id) ON DELETE CASCADE,
  dedupe_key  VARCHAR(100) NOT NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ  NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_notifications_dedupe UNIQUE (user_id, dedupe_key),
  CONSTRAINT ck_notifications_type CHECK (type IN ('birthday-before', 'birthday-today', 'shortfall-reminder')),
  CONSTRAINT ck_notifications_target CHECK (
    (type IN ('birthday-before', 'birthday-today') AND event_id IS NOT NULL AND funding_id IS NULL)
    OR
    (type = 'shortfall-reminder' AND funding_id IS NOT NULL AND event_id IS NULL)
  )
);

-- ---------------------------------------------------------------------
-- 조회용 인덱스 (ERD 5장 권장)
-- ---------------------------------------------------------------------
CREATE INDEX ix_group_members_user        ON group_members (user_id);
CREATE INDEX ix_invites_group             ON invites (group_id);
CREATE INDEX ix_fundings_owner            ON fundings (owner_id);
CREATE INDEX ix_fundings_group            ON fundings (group_id);
CREATE INDEX ix_gifts_funding             ON gifts (funding_id);
CREATE INDEX ix_donations_gift            ON donations (gift_id);
CREATE INDEX ix_donations_funding         ON donations (funding_id);
CREATE INDEX ix_donations_supporter       ON donations (supporter_id);
CREATE INDEX ix_carryovers_owner_status   ON carryovers (owner_id, status);
CREATE INDEX ix_settlements_funding       ON settlements (funding_id);
CREATE INDEX ix_birthday_events_owner     ON birthday_events (owner_id);
CREATE INDEX ix_notifications_user_read   ON notifications (user_id, is_read);

COMMIT;
