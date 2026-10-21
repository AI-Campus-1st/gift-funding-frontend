"""
DB 연결 (SQLAlchemy 2 + psycopg 3)

테이블은 db/01_init.sql 로 만든다. 여기서는 만들지 않는다 (create_all 사용 안 함).
"""

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.sqlalchemy_url,
    pool_pre_ping=True,  # 끊긴 연결은 다시 연결 (클라우드 DB · pooler 대비)
    pool_size=5,  # 클라우드 DB(Supabase 무료) 연결 수 제한을 넘지 않게 작게
    max_overflow=5,
    pool_recycle=300,  # 오래된 연결은 5분마다 새로 (pooler 가 끊기 전에)
)


@event.listens_for(engine, "connect")
def _set_timezone(dbapi_connection, _record) -> None:
    """
    연결마다 시간대를 서울로 맞춘다 (CURRENT_DATE · 펀딩 상태 계산 기준).
    접속 주소의 options 파라미터 대신 SET 을 쓴다 → Supabase Session pooler 처럼 시작 옵션을 막는 곳에서도 동작한다.
    """
    with dbapi_connection.cursor() as cur:
        cur.execute(f"SET TIME ZONE '{settings.timezone}'")
    dbapi_connection.commit()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """요청마다 세션 하나. 처리 중 오류가 나면 되돌린다."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
