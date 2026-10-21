"""
요청 · 응답 형식 — docs/backend/API.SPEC.md 2.1 · 3장 (snake_case)

요청 필드는 문자열로 받고, 내용 검증(필수 · 길이 · 형식)은 services 에서 한다.
→ 오류 문구를 프론트(lib/validation.ts)와 똑같이 맞추기 위해서다.
"""

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

# ───────── 요청 ─────────


class SignupRequest(BaseModel):
    name: str = ""
    email: str = ""
    password: str = ""
    password_confirm: str = ""
    birthday: str = ""


class LoginRequest(BaseModel):
    email: str = ""
    password: str = ""
    remember_me: bool = False


class ProfileRequest(BaseModel):
    name: str = ""
    birthday: str = ""
    profile_image_url: str | None = None


class PreferenceRequest(BaseModel):
    keywords: list[str] = []
    categories: list[str] = []
    price_range: str | None = None


# ───────── 응답 ─────────


class IdDto(BaseModel):
    id: uuid.UUID


class UserDto(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    birthday: date
    profile_image_url: str | None


class AuthTokenDto(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserDto


class PreferenceDto(BaseModel):
    keywords: list[str]
    categories: list[str]
    price_range: str | None
