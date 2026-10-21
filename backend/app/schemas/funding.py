"""
요청 · 응답 형식 — docs/backend/API.SPEC.md 2.3 · 5장 (snake_case)

📌 F-13 비공개 원칙: 후원자용 응답(SupporterGiftDto · FriendFundingDto)에는 모금액 · 남은 금액 · 총 모금액 필드가
**모델에 아예 없다.** 생일자용(OwnerGiftDto · OwnerFundingDto)에만 있다.
"""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.schemas.group import FundingStatus

# ───────── 요청 ─────────
# 내용 검증(필수 · 길이 · 형식)은 services 에서 한다 → 오류 문구를 프론트와 같게 맞추려고 넓게 받는다.


class GiftRequest(BaseModel):
    name: str = ""
    price: Any = None  # 정수가 아니면 "금액은 원 단위 정수로 입력해 주세요."
    image_url: str = ""
    product_url: str = ""
    description: str = ""


class FundingCreateRequest(BaseModel):
    name: str = ""
    group_id: str = ""
    start_date: str = ""
    end_date: str = ""
    gifts: list[GiftRequest] = []
    carryover_ids: list[str] = []


class FundingUpdateRequest(BaseModel):
    """F14 — 이름만 바꿀 수 있다. 기간 · 그룹이 들어오면 거절하려고 필드를 받아 둔다"""

    name: str | None = None
    start_date: Any = None
    end_date: Any = None
    group_id: Any = None


# ───────── 응답 ─────────


class FundingBaseDto(BaseModel):
    id: uuid.UUID
    name: str
    group_id: uuid.UUID
    group_name: str
    owner_name: str
    start_date: date
    end_date: date
    status: FundingStatus


class SupporterGiftDto(BaseModel):
    id: uuid.UUID
    name: str
    price: int
    image_url: str
    product_url: str
    description: str
    achievement_rate: int
    is_closed: bool


class OwnerGiftDto(SupporterGiftDto):
    raised_amount: int
    remaining_amount: int
    donation_count: int
    shortfall_action: Literal["carryover", "withdraw"] | None
    settled: bool
    settlement_status: Literal["requested", "processing", "completed", "failed"] | None
    carried_over_amount: int


class OwnerFundingDto(FundingBaseDto):
    gifts: list[OwnerGiftDto]
    total_raised: int


class FriendFundingDto(FundingBaseDto):
    gifts: list[SupporterGiftDto]


class GiftEditDto(BaseModel):
    funding_id: uuid.UUID
    name: str
    price: int
    image_url: str
    product_url: str
    description: str
    has_donations: bool


class GiftForDonationDto(BaseModel):
    funding: FundingBaseDto
    gift: SupporterGiftDto


class SupporterDonationDto(BaseModel):
    id: uuid.UUID
    supporter_name: str
    gift_id: uuid.UUID
    gift_name: str
    amount: int
    created_at: datetime


class PendingCarryoverDto(BaseModel):
    id: uuid.UUID
    funding_name: str
    gift_name: str
    price: int
    image_url: str
    product_url: str
    description: str
    amount: int
    created_at: datetime
