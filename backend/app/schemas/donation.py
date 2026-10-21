"""
요청 · 응답 형식 — docs/backend/API.SPEC.md 2.4 · 6장 (snake_case)
"""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

# ───────── 요청 ─────────


class DonationRequest(BaseModel):
    """D1 — 내용 검증은 services 에서 (오류 문구를 프론트와 같게)"""

    gift_id: str = ""
    amount: Any = None
    message: str | None = ""  # 빈 문자열이면 메시지 없음
    idempotency_key: str = ""  # 후원 시도마다 프론트가 만든다 (재전송이면 같은 값)


# ───────── 응답 ─────────


class DonationResultDto(BaseModel):
    donation_id: uuid.UUID


class MyDonationDto(BaseModel):
    id: uuid.UUID
    funding_id: uuid.UUID
    funding_name: str
    owner_name: str
    gift_id: uuid.UUID
    gift_name: str
    amount: int
    has_message: bool
    created_at: datetime
    status: Literal["completed"]


class ReceivedMessageDto(BaseModel):
    id: uuid.UUID
    author_name: str  # 항상 후원자 계정의 실명 (요청 값으로 받지 않음)
    content: str
    funding_name: str
    gift_name: str
    created_at: datetime
