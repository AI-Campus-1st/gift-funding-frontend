"""
테스트 공통 설정

- 도커 DB(db/01_init.sql + 02_data.sql 이 들어간 상태)에 연결해서 실행한다.
- 테스트마다 트랜잭션을 열고 끝나면 되돌린다 → 개발 DB 데이터가 바뀌지 않는다.
  (서비스의 commit() 은 SAVEPOINT 안에서만 반영된다)
"""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import engine, get_db
from app.main import app


@pytest.fixture()
def db() -> Iterator[Session]:
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


API = "/api/v1"


def login(client: TestClient, email: str = "seoyeon@example.com", password: str = "password123", remember: bool = False) -> dict:
    res = client.post(f"{API}/auth/login", json={"email": email, "password": password, "remember_me": remember})
    assert res.status_code == 200, res.text
    return res.json()


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


SEED_NAMESPACE = uuid.UUID("6f1c2a52-6b1e-4c0b-9a52-0d3c5e7f9a11")  # db/scripts/generate_seed.py 와 같은 값


def seed_id(mock_id: str) -> str:
    """시드 데이터의 Mock ID(g_college 등) → DB 에 들어간 UUID"""
    return str(uuid.uuid5(SEED_NAMESPACE, mock_id))


def token_of(client: TestClient, email: str) -> dict:
    """로그인해서 Authorization 헤더를 돌려준다"""
    return auth_header(login(client, email=email)["access_token"])


@pytest.fixture(autouse=True)
def _no_real_ai(monkeypatch):
    """테스트는 진짜 Gemini 를 부르지 않는다 (.env 에 키가 있어도 모의 추천). Gemini 테스트는 가짜 응답을 직접 넣는다"""
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "gemini_api_key", "")
    monkeypatch.setattr(get_settings(), "openai_api_key", "")
