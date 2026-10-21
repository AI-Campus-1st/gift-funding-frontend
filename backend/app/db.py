"""
DB 연결 (SQLAlchemy 2 + psycopg 3)

테이블은 db/01_init.sql 로 만든다. 여기서는 만들지 않는다 (create_all 사용 안 함).
"""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.sqlalchemy_url,
    pool_pre_ping=True,
    # 세션 시간대를 서울로 맞춘다 (CURRENT_DATE · 펀딩 상태 계산 기준)
    connect_args={"options": f"-c timezone={settings.timezone}"},
)
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
