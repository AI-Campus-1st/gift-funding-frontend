-- =====================================================================
-- 03_supabase.sql — 클라우드 DB(Supabase) 전용 보안 설정 (2026-10-21)
--
-- Supabase 는 public 스키마의 테이블을 Data API(REST)로 자동 공개한다.
-- RLS(행 수준 보안)를 켜 두면 Data API(anon · authenticated 키)로는 아무 행도 읽고 쓸 수 없다.
-- 우리 백엔드는 테이블 주인(postgres)으로 접속하므로 영향이 없다.
--
-- 실행 순서: 01_init.sql → 02_data.sql → 03_supabase.sql  (로컬 도커에서는 실행하지 않는다)
-- =====================================================================

BEGIN;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE carryovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
COMMIT;

-- 확인: 14개 테이블 모두 rowsecurity = true 여야 한다
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
