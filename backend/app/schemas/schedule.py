"""
요청 · 응답 형식 — docs/backend/API.SPEC.md 2.6 · 8장 (snake_case)
"""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

# ───────── 요청 ─────────


class BirthdayEventRequest(BaseModel):
    """C3 · C4 — 내용 검증은 services 에서 (오류 문구를 프론트와 같게)"""

    friend_name: str = ""
    birthday: str = ""
    linked_funding_id: str | None = None


class NotificationReadRequest(BaseModel):
    is_read: bool | None = True


# ───────── 응답 ─────────


class BirthdayEventDto(BaseModel):
    id: uuid.UUID
    friend_name: str
    birthday: date
    linked_funding_id: uuid.UUID | None
    linked_funding_name: str | None  # 볼 권한이 없으면 null (이름도 공개하지 않음)
    can_open_linked_funding: bool
    linked_funding_is_mine: bool


class LinkableFundingDto(BaseModel):
    id: uuid.UUID
    name: str


class NotificationDto(BaseModel):
    id: uuid.UUID
    type: Literal["birthday-before", "birthday-today", "shortfall-reminder"]
    title: str
    body: str
    created_at: datetime
    is_read: bool
    event_id: uuid.UUID | None
    funding_id: uuid.UUID | None
    can_open_funding: bool
    funding_is_mine: bool


class UnreadCountDto(BaseModel):
    count: int
