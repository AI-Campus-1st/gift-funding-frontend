"""
요청 · 응답 형식 — docs/backend/API.SPEC.md 2.5 · 7장 (snake_case)
"""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

# ───────── 요청 ─────────


class ShortfallRequest(BaseModel):
    action: Any = None  # "carryover" | "withdraw" — 다른 값이면 "처리 방식을 선택해 주세요."


class SettlementRequest(BaseModel):
    gift_ids: list[str] = []
    bank: str = ""
    account_number: str = ""
    account_holder: str = ""


# ───────── 응답 ─────────


class EligibleGiftDto(BaseModel):
    id: uuid.UUID
    name: str
    amount: int
    reason: Literal["achieved", "withdraw"]


class CarryoverGiftDto(BaseModel):
    id: uuid.UUID
    name: str
    amount: int


class SettlementRecordDto(BaseModel):
    id: uuid.UUID
    funding_id: uuid.UUID
    gift_names: list[str]
    amount: int
    bank: str
    account_number_masked: str  # 뒤 4자리만
    account_holder: str
    status: Literal["requested", "processing", "completed", "failed"]
    requested_at: datetime
    failure_reason: Literal["ACCOUNT_INVALID", "BANK_ERROR"] | None


class SettlementOverviewDto(BaseModel):
    funding_id: uuid.UUID
    funding_name: str
    eligible_gifts: list[EligibleGiftDto]
    eligible_amount: int
    carryover_gifts: list[CarryoverGiftDto]
    history: list[SettlementRecordDto]
