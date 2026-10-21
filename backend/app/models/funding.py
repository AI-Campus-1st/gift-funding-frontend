"""gifts · donations · messages · carryovers · settlements · settlement_items · birthday_events · notifications (ERD 3.5 ~ 3.12)

펀딩 · 선물 단계(3단계)에서 모금액 · 정산 상태 · 이월 금액을 계산하려고 함께 정의한다.
후원하기 · 정산 · 캘린더 · 알림 기능은 다음 단계에서 이 모델을 그대로 쓴다.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())


def _now() -> Mapped[datetime]:
    return mapped_column(TIMESTAMP(timezone=True), server_default=func.now())


class Gift(Base):
    __tablename__ = "gifts"

    id: Mapped[uuid.UUID] = _uuid_pk()
    funding_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fundings.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    price: Mapped[int] = mapped_column(Integer)  # = 목표 금액
    image_url: Mapped[str] = mapped_column(Text)
    product_url: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(String(100), server_default="")
    sort_order: Mapped[int] = mapped_column(Integer)
    shortfall_action: Mapped[str | None] = mapped_column(String(10), nullable=True)  # carryover | withdraw
    shortfall_decided_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[uuid.UUID] = _uuid_pk()
    funding_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fundings.id", ondelete="RESTRICT"))
    gift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gifts.id", ondelete="RESTRICT"))
    supporter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    amount: Mapped[int] = mapped_column(Integer)
    idempotency_key: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), server_default="completed")
    created_at: Mapped[datetime] = _now()


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = _uuid_pk()
    donation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("donations.id"), unique=True)
    content: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = _now()


class Carryover(Base):
    __tablename__ = "carryovers"

    id: Mapped[uuid.UUID] = _uuid_pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    funding_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fundings.id"))  # 이월한 (지난) 펀딩
    gift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gifts.id"), unique=True)  # 이월한 (지난) 선물
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), server_default="pending")  # pending | reopened
    reopened_funding_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fundings.id"), nullable=True)
    reopened_gift_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("gifts.id"), nullable=True, unique=True)
    reopened_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _now()


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[uuid.UUID] = _uuid_pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    funding_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("fundings.id"))
    amount: Mapped[int] = mapped_column(Integer)
    bank: Mapped[str] = mapped_column(String(30))
    account_number: Mapped[str] = mapped_column(Text)
    account_holder: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), server_default="requested")  # requested | processing | completed | failed
    failure_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    requested_at: Mapped[datetime] = _now()
    processed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)


class SettlementItem(Base):
    __tablename__ = "settlement_items"

    settlement_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("settlements.id"), primary_key=True)
    gift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("gifts.id"), primary_key=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(10))  # achieved | withdraw
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")  # 정산이 실패하면 false → 다시 정산 대상


class BirthdayEvent(Base):
    __tablename__ = "birthday_events"

    id: Mapped[uuid.UUID] = _uuid_pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    friend_name: Mapped[str] = mapped_column(String(20))
    birthday: Mapped[date] = mapped_column(Date)
    linked_funding_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fundings.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(20))  # birthday-before | birthday-today | shortfall-reminder
    title: Mapped[str] = mapped_column(String(100))
    body: Mapped[str] = mapped_column(Text)
    event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("birthday_events.id", ondelete="CASCADE"), nullable=True)
    funding_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("fundings.id", ondelete="CASCADE"), nullable=True)
    dedupe_key: Mapped[str] = mapped_column(String(100))
    is_read: Mapped[bool] = mapped_column(Boolean, server_default="false")
    read_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at: Mapped[datetime] = _now()
