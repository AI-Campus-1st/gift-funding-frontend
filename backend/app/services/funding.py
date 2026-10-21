"""
펀딩 · 선물 서비스 (F-04, F-07, F-09, F-13 · docs/backend/API.SPEC.md 5장 · business-logic/04-funding.md)

권한
- 생일자 = fundings.owner_id
- 후원자 = 펀딩이 연결된 그룹의 참여자이면서 생일자가 아닌 사람

계산 값 (저장하지 않고 조회할 때 계산)
- 선물 모금액 = 그 선물의 후원 합계 + 이 선물로 다시 연 이월 금액
- 남은 금액 = price - 모금액 (최소 0) · 달성률 = floor(모금액 / price * 100) (최대 100) · 마감 = 모금액 >= price
- settlement_status = 그 선물이 들어간 "실패하지 않은" 정산의 상태 (settlement_items.is_active)
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Carryover, Donation, Funding, Gift, Group, Notification, Settlement, SettlementItem, User
from app.schemas.funding import (
    FriendFundingDto,
    FundingBaseDto,
    FundingCreateRequest,
    FundingUpdateRequest,
    GiftEditDto,
    GiftForDonationDto,
    GiftRequest,
    OwnerFundingDto,
    OwnerGiftDto,
    PendingCarryoverDto,
    SupporterDonationDto,
    SupporterGiftDto,
)
from app.services import validation as v
from app.services.group import assert_can_open_funding, funding_status, is_member, parse_uuid

FUNDING_NOT_FOUND = "펀딩을 찾을 수 없어요."
GIFT_NOT_FOUND = "선물을 찾을 수 없어요."

# ───────── 조회 · 권한 공통 ─────────


def get_funding_or_404(db: Session, funding_id: str | uuid.UUID, *, lock: bool = False) -> Funding:
    fid = parse_uuid(str(funding_id))
    funding = None
    if fid:
        stmt = select(Funding).where(Funding.id == fid)
        funding = db.scalar(stmt.with_for_update() if lock else stmt)
    if funding is None:
        raise ApiError("NOT_FOUND", FUNDING_NOT_FOUND)
    return funding


def get_gift_or_404(db: Session, gift_id: str | uuid.UUID, *, lock: bool = False) -> Gift:
    gid = parse_uuid(str(gift_id))
    gift = None
    if gid:
        stmt = select(Gift).where(Gift.id == gid)
        gift = db.scalar(stmt.with_for_update() if lock else stmt)
    if gift is None:
        raise ApiError("NOT_FOUND", GIFT_NOT_FOUND)
    return gift


def assert_owner(funding: Funding, user: User) -> None:
    """생일자 전용 기능"""
    if funding.owner_id != user.id:
        raise ApiError("FORBIDDEN", "이 펀딩을 관리할 권한이 없어요.")


def assert_supporter(db: Session, funding: Funding, user: User) -> None:
    """친구 펀딩(후원자) 접근: 본인 펀딩이 아니고 그 그룹의 참여자여야 한다"""
    if funding.owner_id == user.id:
        raise ApiError("FORBIDDEN", "본인 펀딩은 내 펀딩 메뉴에서 관리해 주세요.")
    if not is_member(db, funding.group_id, user.id):
        raise ApiError("FORBIDDEN", "이 펀딩에 접근할 권한이 없어요.")


# ───────── 계산 ─────────


@dataclass
class GiftStats:
    donated: int = 0
    donation_count: int = 0
    carried_over: int = 0
    settlement_status: str | None = None

    @property
    def raised(self) -> int:
        return self.donated + self.carried_over


def gift_stats(db: Session, gift_ids: list[uuid.UUID]) -> dict[uuid.UUID, GiftStats]:
    """선물별 후원 합계 · 후원 수 · 다시 연 이월 금액 · 정산 상태를 한 번에 모은다"""
    stats = {gid: GiftStats() for gid in gift_ids}
    if not gift_ids:
        return stats
    for gid, total, count in db.execute(
        select(Donation.gift_id, func.sum(Donation.amount), func.count()).where(Donation.gift_id.in_(gift_ids)).group_by(Donation.gift_id)
    ):
        stats[gid].donated, stats[gid].donation_count = int(total), int(count)
    for gid, total in db.execute(
        select(Carryover.reopened_gift_id, func.sum(Carryover.amount)).where(Carryover.reopened_gift_id.in_(gift_ids)).group_by(Carryover.reopened_gift_id)
    ):
        stats[gid].carried_over = int(total)
    for gid, status in db.execute(
        select(SettlementItem.gift_id, Settlement.status)
        .join(Settlement, Settlement.id == SettlementItem.settlement_id)
        .where(SettlementItem.gift_id.in_(gift_ids), SettlementItem.is_active.is_(True), Settlement.status != "failed")
    ):
        stats[gid].settlement_status = status
    return stats


def achievement_rate(raised: int, price: int) -> int:
    if price <= 0:
        return 0
    return min(100, max(0, raised * 100 // price))


def to_funding_base(db: Session, f: Funding) -> FundingBaseDto:
    group = db.get(Group, f.group_id)
    owner = db.get(User, f.owner_id)
    return FundingBaseDto(
        id=f.id,
        name=f.name,
        group_id=f.group_id,
        group_name=group.name if group else "",
        owner_name=owner.name if owner else "알 수 없음",
        start_date=f.start_date,
        end_date=f.end_date,
        status=funding_status(f),
    )


def _gifts_of(db: Session, funding_id: uuid.UUID) -> list[Gift]:
    return list(db.scalars(select(Gift).where(Gift.funding_id == funding_id).order_by(Gift.sort_order, Gift.created_at, Gift.id)))


def to_supporter_gift(g: Gift, s: GiftStats) -> SupporterGiftDto:
    """후원자용 — 모금액 · 남은 금액은 넣지 않는다 (F-13)"""
    return SupporterGiftDto(
        id=g.id,
        name=g.name,
        price=g.price,
        image_url=g.image_url,
        product_url=g.product_url,
        description=g.description,
        achievement_rate=achievement_rate(s.raised, g.price),
        is_closed=s.raised >= g.price,
    )


def to_owner_gift(g: Gift, s: GiftStats) -> OwnerGiftDto:
    return OwnerGiftDto(
        **to_supporter_gift(g, s).model_dump(),
        raised_amount=s.raised,
        remaining_amount=max(0, g.price - s.raised),
        donation_count=s.donation_count,
        shortfall_action=g.shortfall_action,
        settled=s.settlement_status is not None,
        settlement_status=s.settlement_status,
        carried_over_amount=s.carried_over,
    )


def to_owner_funding(db: Session, f: Funding) -> OwnerFundingDto:
    gifts = _gifts_of(db, f.id)
    stats = gift_stats(db, [g.id for g in gifts])
    owner_gifts = [to_owner_gift(g, stats[g.id]) for g in gifts]
    return OwnerFundingDto(**to_funding_base(db, f).model_dump(), gifts=owner_gifts, total_raised=sum(g.raised_amount for g in owner_gifts))


def to_friend_funding(db: Session, f: Funding) -> FriendFundingDto:
    gifts = _gifts_of(db, f.id)
    stats = gift_stats(db, [g.id for g in gifts])
    return FriendFundingDto(**to_funding_base(db, f).model_dump(), gifts=[to_supporter_gift(g, stats[g.id]) for g in gifts])


def _advance_settlements(db: Session, user: User) -> None:
    """정산 상태("정산됨" 표시)를 최신으로 맞춘다 (모의 정산은 조회할 때 진행)"""
    from app.services.settlement import advance_settlements  # 순환 import 방지

    advance_settlements(db, owner_id=user.id)


_NEWEST = (Funding.start_date.desc(), Funding.created_at.desc(), Funding.id)  # 시작일 최신순

# ───────── 내 펀딩 (생일자) ─────────


def list_my_fundings(db: Session, user: User) -> list[OwnerFundingDto]:
    """F1 내 펀딩 목록 (시작일 최신순)"""
    _advance_settlements(db, user)
    fundings = db.scalars(select(Funding).where(Funding.owner_id == user.id).order_by(*_NEWEST))
    return [to_owner_funding(db, f) for f in fundings]


def get_my_funding(db: Session, funding_id: str, user: User) -> OwnerFundingDto:
    """F2 내 펀딩 상세 (생일자만)"""
    funding = get_funding_or_404(db, funding_id)
    assert_owner(funding, user)
    _advance_settlements(db, user)
    return to_owner_funding(db, funding)


def _check_gift(req: GiftRequest) -> dict:
    errors = v.validate_gift(req.name, req.price, req.image_url, req.product_url, req.description)
    if errors:
        raise ApiError("VALIDATION", "선물 정보를 확인해 주세요.", field_errors=errors)
    return {
        "name": req.name.strip(),
        "price": v.parse_amount(req.price),
        "image_url": req.image_url,
        "product_url": req.product_url.strip(),
        "description": (req.description or "").strip(),
    }


def _next_sort_order(db: Session, funding_id: uuid.UUID) -> int:
    return int(db.scalar(select(func.coalesce(func.max(Gift.sort_order), 0)).where(Gift.funding_id == funding_id))) + 1


def create_funding(db: Session, user: User, req: FundingCreateRequest) -> uuid.UUID:
    """
    F3 펀딩 생성 (+ 선물 · 이월 선물 다시 열기)
    입력 검증 → 선물 검증 → 내가 만든 그룹인지 → 이월 기록 확인(행 잠금) → 저장 (한 트랜잭션)
    """
    carryover_ids = list(dict.fromkeys(req.carryover_ids))  # 같은 ID 중복 제거
    errors = v.validate_funding(req.name, req.group_id, req.start_date, req.end_date, len(req.gifts) + len(carryover_ids))
    if errors:
        raise ApiError("VALIDATION", "입력값을 확인해 주세요.", field_errors=errors)
    gifts = [_check_gift(g) for g in req.gifts]
    group = assert_can_open_funding(db, req.group_id, user)

    carryovers: list[Carryover] = []
    for raw in carryover_ids:
        cid = parse_uuid(raw)
        c = db.scalar(select(Carryover).where(Carryover.id == cid, Carryover.owner_id == user.id).with_for_update()) if cid else None
        if c is None:
            raise ApiError("NOT_FOUND", "이월 기록을 찾을 수 없어요.")
        if c.status != "pending":
            raise ApiError("CONFLICT", "이미 다시 연 이월 선물이에요. 목록을 새로 고친 뒤 다시 선택해 주세요.")
        carryovers.append(c)

    funding = Funding(
        owner_id=user.id,  # 펀딩을 만든 사람이 생일자
        group_id=group.id,
        name=req.name.strip(),
        start_date=v.parse_date(req.start_date),
        end_date=v.parse_date(req.end_date),
    )
    db.add(funding)
    db.flush()
    order = 0
    for g in gifts:
        order += 1
        db.add(Gift(funding_id=funding.id, sort_order=order, **g))
    now = datetime.now(UTC)
    for c in carryovers:
        # 이월 선물 다시 열기: 지난 선물 정보를 그대로 복사, 이월 금액은 계산으로 시작 모금액에 더해진다
        source = db.get(Gift, c.gift_id)
        order += 1
        new_gift = Gift(
            funding_id=funding.id,
            sort_order=order,
            name=source.name,
            price=source.price,
            image_url=source.image_url,
            product_url=source.product_url,
            description=source.description,
        )
        db.add(new_gift)
        db.flush()
        c.status, c.reopened_funding_id, c.reopened_gift_id, c.reopened_at = "reopened", funding.id, new_gift.id, now
    db.commit()
    return funding.id


def update_funding(db: Session, funding_id: str, user: User, req: FundingUpdateRequest) -> OwnerFundingDto:
    """F14 펀딩 이름 수정 — 종료 전까지. 기간 · 연결 그룹은 수정 불가"""
    funding = get_funding_or_404(db, funding_id, lock=True)
    assert_owner(funding, user)
    if {"start_date", "end_date", "group_id"} & req.model_fields_set:
        raise ApiError("VALIDATION", "펀딩 기간과 연결 그룹은 수정할 수 없어요.")
    if funding_status(funding) == "ended":
        raise ApiError("FUNDING_NOT_ACTIVE", "종료된 펀딩은 수정할 수 없어요.")
    name = (req.name or "").strip()
    if not name:
        raise ApiError("VALIDATION", "펀딩 이름을 입력해 주세요.", field_errors={"name": "펀딩 이름을 입력해 주세요."})
    if len(name) > v.TEXT_LIMITS["funding_name"]:
        message = v.too_long("펀딩 이름은", v.TEXT_LIMITS["funding_name"])
        raise ApiError("VALIDATION", message, field_errors={"name": message})
    funding.name = name
    db.commit()
    return to_owner_funding(db, funding)


def delete_funding(db: Session, funding_id: str, user: User) -> None:
    """
    F4 펀딩 삭제 — 후원 · 이월 금액이 있으면 거절
    선물 · 이 펀딩 지정 초대 링크 · 미달 처리 알림은 DB CASCADE 로 삭제, 생일 일정 연결은 SET NULL.
    생일 알림은 funding_id 를 저장하지 않아(CHECK) 그대로 남는다.
    """
    funding = get_funding_or_404(db, funding_id, lock=True)
    assert_owner(funding, user)
    if db.scalar(select(func.count()).select_from(Donation).where(Donation.funding_id == funding.id)):
        raise ApiError("CONFLICT", "후원이 들어온 펀딩은 삭제할 수 없어요.")
    if db.scalar(select(func.count()).select_from(Carryover).where(Carryover.reopened_funding_id == funding.id)):
        raise ApiError("CONFLICT", "이월 금액이 포함된 펀딩은 삭제할 수 없어요.")
    # CASCADE 가 처리하지만, 의도를 분명히 하려고 미달 처리 알림은 직접 지운다
    db.execute(delete(Notification).where(Notification.type == "shortfall-reminder", Notification.funding_id == funding.id))
    db.delete(funding)
    db.commit()


# ───────── 선물 (생일자) ─────────


def add_gift(db: Session, funding_id: str, user: User, req: GiftRequest) -> uuid.UUID:
    """F5 선물 추가 — 펀딩이 끝나기 전(예정 · 진행 중)에만 (Q8 · Q8-1)"""
    funding = get_funding_or_404(db, funding_id, lock=True)
    assert_owner(funding, user)
    if funding_status(funding) == "ended":
        raise ApiError("FUNDING_NOT_ACTIVE", "종료된 펀딩에는 선물을 추가할 수 없어요.")
    data = _check_gift(req)
    gift = Gift(funding_id=funding.id, sort_order=_next_sort_order(db, funding.id), **data)
    db.add(gift)
    db.commit()
    return gift.id


def get_gift_for_edit(db: Session, gift_id: str, user: User) -> GiftEditDto:
    """F6 선물 수정용 조회 — has_donations: 후원 또는 이월 금액이 있어 가격 · 삭제가 잠김"""
    gift = get_gift_or_404(db, gift_id)
    assert_owner(get_funding_or_404(db, gift.funding_id), user)
    raised = gift_stats(db, [gift.id])[gift.id].raised
    return GiftEditDto(
        funding_id=gift.funding_id,
        name=gift.name,
        price=gift.price,
        image_url=gift.image_url,
        product_url=gift.product_url,
        description=gift.description,
        has_donations=raised > 0,
    )


def update_gift(db: Session, gift_id: str, user: User, req: GiftRequest) -> None:
    """F7 선물 수정 — 후원 · 이월 금액이 있으면 가격(목표 금액)은 바꿀 수 없다 (선물 행 잠금 후 확인)"""
    gift = get_gift_or_404(db, gift_id, lock=True)
    assert_owner(get_funding_or_404(db, gift.funding_id), user)
    data = _check_gift(req)
    if data["price"] != gift.price and gift_stats(db, [gift.id])[gift.id].raised > 0:
        raise ApiError("GIFT_LOCKED", "후원 또는 이월 금액이 있는 선물은 가격(목표 금액)을 변경할 수 없어요.")
    for key, value in data.items():
        setattr(gift, key, value)
    db.commit()


def delete_gift(db: Session, gift_id: str, user: User) -> None:
    """F8 선물 삭제 — 이월 금액 · 후원이 있거나 마지막 1개면 거절 (선물 행 잠금 후 확인)"""
    gift = get_gift_or_404(db, gift_id, lock=True)
    funding = get_funding_or_404(db, gift.funding_id, lock=True)
    assert_owner(funding, user)
    s = gift_stats(db, [gift.id])[gift.id]
    if s.carried_over > 0:
        raise ApiError("GIFT_LOCKED", "이월 금액이 포함된 선물은 삭제할 수 없어요.")
    if s.donated > 0:
        raise ApiError("GIFT_LOCKED", "후원이 발생한 선물은 삭제할 수 없어요.")
    if db.scalar(select(func.count()).select_from(Gift).where(Gift.funding_id == funding.id)) <= 1:
        raise ApiError("GIFT_LOCKED", "펀딩에는 선물이 최소 1개 있어야 해요.")
    db.delete(gift)
    db.commit()


def list_supporter_donations(db: Session, funding_id: str, user: User) -> list[SupporterDonationDto]:
    """F9 생일자 전용: 후원자별 이름 · 금액 · 일시 (최신순)"""
    funding = get_funding_or_404(db, funding_id)
    assert_owner(funding, user)
    rows = db.execute(
        select(Donation, User.name, Gift.name)
        .join(User, User.id == Donation.supporter_id)
        .join(Gift, Gift.id == Donation.gift_id)
        .where(Donation.funding_id == funding.id)
        .order_by(Donation.created_at.desc(), Donation.id)
    )
    return [
        SupporterDonationDto(id=d.id, supporter_name=supporter, gift_id=d.gift_id, gift_name=gift_name, amount=d.amount, created_at=d.created_at)
        for d, supporter, gift_name in rows
    ]


def list_pending_carryovers(db: Session, user: User) -> list[PendingCarryoverDto]:
    """F13 다시 열 수 있는 내 이월 선물 (pending 만, 오래된 순)"""
    rows = db.execute(
        select(Carryover, Gift, Funding.name)
        .join(Gift, Gift.id == Carryover.gift_id)
        .join(Funding, Funding.id == Carryover.funding_id)
        .where(Carryover.owner_id == user.id, Carryover.status == "pending")
        .order_by(Carryover.created_at, Carryover.id)
    )
    return [
        PendingCarryoverDto(
            id=c.id,
            funding_name=funding_name,
            gift_name=g.name,
            price=g.price,
            image_url=g.image_url,
            product_url=g.product_url,
            description=g.description,
            amount=c.amount,
            created_at=c.created_at,
        )
        for c, g, funding_name in rows
    ]


# ───────── 친구 펀딩 (후원자) ─────────


def list_friend_fundings(db: Session, user: User) -> list[FriendFundingDto]:
    """F10 내가 참여한 그룹에 연결된 다른 사람 펀딩 (시작일 최신순)"""
    from app.models import GroupMember

    fundings = db.scalars(
        select(Funding)
        .join(GroupMember, (GroupMember.group_id == Funding.group_id) & (GroupMember.user_id == user.id))
        .where(Funding.owner_id != user.id)
        .order_by(*_NEWEST)
    )
    return [to_friend_funding(db, f) for f in fundings]


def get_friend_funding(db: Session, funding_id: str, user: User) -> FriendFundingDto:
    """F11 친구 펀딩 상세 (후원자용 — 모금액 없음)"""
    funding = get_funding_or_404(db, funding_id)
    assert_supporter(db, funding, user)
    return to_friend_funding(db, funding)


def get_gift_for_donation(db: Session, gift_id: str, user: User) -> GiftForDonationDto:
    """F12 후원 화면(UI-19)용 선물 정보 — 후원자용 뷰만"""
    gift = get_gift_or_404(db, gift_id)
    funding = get_funding_or_404(db, gift.funding_id)
    assert_supporter(db, funding, user)
    s = gift_stats(db, [gift.id])[gift.id]
    return GiftForDonationDto(funding=to_funding_base(db, funding), gift=to_supporter_gift(gift, s))
