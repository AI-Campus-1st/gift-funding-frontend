"""
후원 · 축하 메시지 서비스 (F-08, F-10, F-13, F-14 · docs/backend/API.SPEC.md 6장 · business-logic/05-donation-message.md)

D1 후원하기 처리 순서
  0. 중복 방지 키 형식 확인 (비었거나 64자 초과 → 400, 2026-10-19 확정)
  1. 같은 (후원자, 키)로 저장된 후원이 있으면 새로 저장하지 않고 그 결과를 돌려준다 ← 다른 검사보다 먼저
  2. 선물 존재 → 3. 후원자 권한 → 4. 금액 → 5. 펀딩 진행 중 → 6. 메시지 200자
  7. 선물 행을 잠그고(FOR UPDATE) 최신 모금액으로 남은 금액 계산 → 0이면 마감
  8. 금액 > 남은 금액이면 거절 (+ max_available)
  9. 후원 + 메시지를 한 트랜잭션으로 저장
"""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Donation, Funding, Gift, Message, User
from app.schemas.donation import DonationRequest, MyDonationDto, ReceivedMessageDto
from app.services import validation as v
from app.services.funding import assert_owner, assert_supporter, get_funding_or_404, get_gift_or_404, gift_stats
from app.services.group import funding_status, parse_uuid

IDEMPOTENCY_KEY_MAX = 64  # donations.idempotency_key VARCHAR(64)
MESSAGE_MAX = v.TEXT_LIMITS["message"]  # 200자


def _find_by_key(db: Session, user: User, key: str) -> Donation | None:
    return db.scalar(select(Donation).where(Donation.supporter_id == user.id, Donation.idempotency_key == key))


def donate(db: Session, user: User, req: DonationRequest) -> uuid.UUID:
    """D1 후원하기 (+ 축하 메시지)"""
    key = req.idempotency_key or ""
    if not key.strip() or len(key) > IDEMPOTENCY_KEY_MAX:
        raise ApiError("VALIDATION", "잘못된 요청이에요. 다시 시도해 주세요.")

    # 1) 재전송이면 이전 결과 그대로 (마감 · 종료 뒤에 다시 와도 성공 응답)
    existing = _find_by_key(db, user, key)
    if existing is not None:
        return existing.id

    # 2) ~ 3) 선물 · 권한
    gift = get_gift_or_404(db, req.gift_id)
    funding = get_funding_or_404(db, gift.funding_id)
    assert_supporter(db, funding, user)

    # 4) 금액: 1원 단위 정수, 1원 이상 (Q5)
    amount = v.parse_amount(req.amount)
    if amount is None or amount <= 0:
        raise ApiError("VALIDATION", "0원보다 큰 금액을 입력해 주세요.", field_errors={"amount": "0원보다 큰 금액을 입력해 주세요."})

    # 5) 진행 중인 펀딩만
    if funding_status(funding) != "active":
        raise ApiError("FUNDING_NOT_ACTIVE", "진행 중인 펀딩이 아니라 후원할 수 없어요.")

    # 6) 메시지 (앞뒤 공백 제거 후 비면 메시지 없음)
    message = (req.message or "").strip()
    if len(message) > MESSAGE_MAX:
        text = f"축하 메시지는 {MESSAGE_MAX}자 이내로 작성해 주세요."
        raise ApiError("VALIDATION", text, field_errors={"message": text})

    # 7) 선물 행 잠금 → 동시에 여러 명이 후원해도 한 명씩 차례로 남은 금액을 계산한다
    gift = db.scalar(select(Gift).where(Gift.id == gift.id).with_for_update())
    # 같은 키 요청이 동시에 들어와 앞 요청이 먼저 저장했을 수 있다 → 잠금 뒤 한 번 더 확인
    existing = _find_by_key(db, user, key)
    if existing is not None:
        db.rollback()
        return existing.id
    remaining = gift.price - gift_stats(db, [gift.id])[gift.id].raised
    if remaining <= 0:
        raise ApiError("GOAL_REACHED", "후원이 마감된 선물입니다.")
    # 8) 남은 금액 초과
    if amount > remaining:
        raise ApiError(
            "EXCEEDS_REMAINING",
            f"현재 이 선물에는 최대 {remaining:,}원까지 후원할 수 있습니다. 후원 금액을 수정해 주세요.",
            max_available=remaining,
        )

    # 9) 후원 + 메시지 (같은 트랜잭션: 후원이 실패하면 메시지도 저장되지 않는다)
    donation = Donation(funding_id=funding.id, gift_id=gift.id, supporter_id=user.id, amount=amount, idempotency_key=key)
    db.add(donation)
    try:
        db.flush()
        if message:
            db.add(Message(donation_id=donation.id, content=message))
        db.commit()
    except IntegrityError:
        # 같은 키로 다른 선물에 동시에 보낸 경우 등 UNIQUE 충돌 → 먼저 저장된 후원을 돌려준다
        db.rollback()
        existing = _find_by_key(db, user, key)
        if existing is None:
            raise
        return existing.id
    return donation.id


# ───────── 조회 ─────────


def _to_my_donation(d: Donation, funding: Funding, owner_name: str, gift_name: str, has_message: bool) -> MyDonationDto:
    return MyDonationDto(
        id=d.id,
        funding_id=d.funding_id,
        funding_name=funding.name,
        owner_name=owner_name,
        gift_id=d.gift_id,
        gift_name=gift_name,
        amount=d.amount,
        has_message=has_message,
        created_at=d.created_at,
        status="completed",
    )


def _my_donation_rows(db: Session, user: User, *, funding_id: uuid.UUID | None = None, donation_id: uuid.UUID | None = None):
    owner = User.__table__.alias("owner")
    stmt = (
        select(Donation, Funding, owner.c.name, Gift.name, Message.id)
        .join(Funding, Funding.id == Donation.funding_id)
        .join(owner, owner.c.id == Funding.owner_id)
        .join(Gift, Gift.id == Donation.gift_id)
        .outerjoin(Message, Message.donation_id == Donation.id)
    )
    if donation_id is not None:
        stmt = stmt.where(Donation.id == donation_id)
    else:
        stmt = stmt.where(Donation.supporter_id == user.id)
        if funding_id is not None:
            stmt = stmt.where(Donation.funding_id == funding_id)
    return db.execute(stmt.order_by(Donation.created_at.desc(), Donation.id)).all()


def list_my_donations(db: Session, user: User, funding_id: str | None) -> list[MyDonationDto]:
    """D2 본인 후원 내역 (같은 선물에 여러 번 후원하면 각각, 최신순). funding_id 로 좁힐 수 있다"""
    fid = None
    if funding_id:
        fid = parse_uuid(funding_id)
        if fid is None:
            return []
    rows = _my_donation_rows(db, user, funding_id=fid)
    return [_to_my_donation(d, f, owner_name, gift_name, message_id is not None) for d, f, owner_name, gift_name, message_id in rows]


def get_my_donation(db: Session, donation_id: str, user: User) -> MyDonationDto:
    """D3 본인 후원 1건 (후원 완료 화면) — 남의 후원은 볼 수 없다"""
    did = parse_uuid(donation_id)
    rows = _my_donation_rows(db, user, donation_id=did) if did else []
    if not rows:
        raise ApiError("NOT_FOUND", "후원 내역을 찾을 수 없어요.")
    d, f, owner_name, gift_name, message_id = rows[0]
    if d.supporter_id != user.id:
        raise ApiError("FORBIDDEN", "본인의 후원 내역만 확인할 수 있어요.")
    return _to_my_donation(d, f, owner_name, gift_name, message_id is not None)


def list_received_messages(db: Session, user: User, funding_id: str | None) -> list[ReceivedMessageDto]:
    """D4 생일자 축하 편지함 — 내 펀딩으로 온 메시지만 (최신순). funding_id 가 남의 펀딩이면 403"""
    author = User.__table__.alias("author")
    stmt = (
        select(Message, author.c.name, Funding.name, Gift.name)
        .join(Donation, Donation.id == Message.donation_id)
        .join(author, author.c.id == Donation.supporter_id)
        .join(Funding, Funding.id == Donation.funding_id)
        .join(Gift, Gift.id == Donation.gift_id)
        .where(Funding.owner_id == user.id)
    )
    if funding_id:
        funding = get_funding_or_404(db, funding_id)
        assert_owner(funding, user)
        stmt = stmt.where(Funding.id == funding.id)
    rows = db.execute(stmt.order_by(Message.created_at.desc(), Message.id)).all()
    return [
        ReceivedMessageDto(id=m.id, author_name=author_name, content=m.content, funding_name=funding_name, gift_name=gift_name, created_at=m.created_at)
        for m, author_name, funding_name, gift_name in rows
    ]
