"""
인증 도구 — 비밀번호 해시(Argon2) · JWT 발급/검증 · 현재 사용자 확인

- 비밀번호 원문은 저장하지 않는다. db/02_data.sql 의 테스트 계정도 같은 Argon2 방식이다.
- JWT 의 sub 에 users.id 를 넣는다. 서버는 토큰을 저장하지 않는다 (로그아웃 = 프론트가 토큰 삭제).
"""

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import unauthorized
from app.models import User

_hasher = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    """(토큰, 만료까지 초) — 유효기간 30일"""
    settings = get_settings()
    expires_in = int(timedelta(days=settings.token_expire_days).total_seconds())
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(seconds=expires_in)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), expires_in


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Authorization: Bearer {token} → 사용자. 없거나 만료 · 위조면 401 UNAUTHORIZED"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    settings = get_settings()
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized() from None
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized()
    return user
