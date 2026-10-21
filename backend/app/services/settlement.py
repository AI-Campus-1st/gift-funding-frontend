"""
목표 미달 처리 · 정산 서비스 (F-11, F-12 · docs/backend/API.SPEC.md 7장 · business-logic/06-shortfall-settlement.md)

⚠️ 실제 송금이 없는 "모의 정산"이다.

정산 대상 선물 = 종료된 펀딩에서 (목표 달성 선물 + 인출을 고른 미달 선물) 중
                 모금액 > 0 이고, 실패하지 않은 정산에 아직 들어가지 않은 선물. 이월한 선물은 제외.

모의 정산 진행 (Q11 · Q11-1 ① 확정)
- 요청 → 바로 "처리 중" → 1분 뒤 "완료" (계좌 끝 0000 → 계좌 정보 오류, 9999 → 은행 오류로 "실패")
- 실패하면 그 정산의 항목을 is_active = false 로 바꿔 선물이 다시 정산 대상이 된다 (같은 트랜잭션).
- 지금은 조회할 때(정산 현황 · 내 펀딩) 상태를 진행시킨다. 실제 송금 연동 시 결과 수신 방식으로 바꾼다.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crypto import decrypt_account, encrypt_account, mask_account
from app.errors import ApiError
from app.models import Carryover, Funding, Gift, Settlement, SettlementItem, User
from app.schemas.settlement import CarryoverGiftDto, EligibleGiftDto, SettlementOverviewDto, SettlementRecordDto, SettlementRequest, ShortfallRequest
from app.services.funding import assert_owner, get_funding_or_404, get_gift_or_404, gift_stats
from app.services.group import funding_status, parse_uuid

BANKS = ["국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", "카카오뱅크", "토스뱅크", "케이뱅크"]  # 프론트 constants.ts 와 같음 (Q10)
PROCESSING_AFTER = timedelta(seconds=0)  # 요청 즉시 처리 중
DONE_AFTER = timedelta(seconds=60)  # 1분 뒤 완료 / 실패


def _ended_owned_funding(db: Session, funding: Funding, user: User) -> Funding:
    assert_owner(funding, user)
    if funding_status(funding) != "ended":
        raise ApiError("FUNDING_NOT_ACTIVE", "펀딩이 종료된 후에 처리할 수 있어요.")
    return funding


# ───────── S1 목표 미달 처리 ─────────


def apply_shortfall(db: Session, gift_id: str, user: User, req: ShortfallRequest) -> None:
    """S1 목표 미달 선물: 다음 생일로 이월(carryover) 또는 현재 모금액 인출(withdraw) — 한 번만, 바꿀 수 없다"""
    action = req.action
    if action not in ("carryover", "withdraw"):
        raise ApiError("VALIDATION", "처리 방식을 선택해 주세요.")
    gift = get_gift_or_404(db, gift_id, lock=True)  # 같은 선물을 동시에 두 번 처리하지 않도록 잠근다
    funding = _ended_owned_funding(db, get_funding_or_404(db, gift.funding_id), user)
    raised = gift_stats(db, [gift.id])[gift.id].raised
    if raised >= gift.price:
        raise ApiError("VALIDATION", "목표를 달성한 선물은 정상 정산 대상이에요.")
    if raised <= 0:  # 0원 선물은 처리 대상이 아니다 (화면은 "종료됨")
        raise ApiError("VALIDATION", "모금액이 없어 처리할 금액이 없어요.")
    if gift.shortfall_action is not None:
        raise ApiError("CONFLICT", "이미 처리한 선물이에요. 같은 금액을 다시 처리할 수 없어요.")

    gift.shortfall_action = action
    gift.shortfall_decided_at = datetime.now(UTC)
    if action == "carryover":
        # 다음 생일 펀딩(F3)에서 "이월 선물 불러오기"로 다시 열 수 있다 (다시 연 선물이 또 미달이면 또 이월 가능)
        db.add(Carryover(owner_id=user.id, funding_id=funding.id, gift_id=gift.id, amount=raised, status="pending"))
    try:
        db.commit()
    except IntegrityError:  # carryovers.gift_id UNIQUE — 이미 이월한 선물
        db.rollback()
        raise ApiError("CONFLICT", "이미 처리한 선물이에요. 같은 금액을 다시 처리할 수 없어요.") from None


# ───────── 모의 정산 진행 ─────────


def _mock_failure(account_number: str) -> str | None:
    if account_number.endswith("0000"):
        return "ACCOUNT_INVALID"
    if account_number.endswith("9999"):
        return "BANK_ERROR"
    return None


def advance_settlements(db: Session, *, owner_id: uuid.UUID, now: datetime | None = None, commit: bool = True) -> None:
    """이 사용자의 진행 중 정산을 시간에 맞춰 다음 상태로 (조회할 때 호출). commit=False 면 저장만 하고 잠금은 유지"""
    now = now or datetime.now(UTC)
    rows = db.scalars(
        select(Settlement).where(Settlement.owner_id == owner_id, Settlement.status.in_(("requested", "processing"))).with_for_update(skip_locked=True)
    ).all()
    if not rows:
        return
    for s in rows:
        elapsed = now - s.requested_at
        if elapsed >= DONE_AFTER:
            failure = _mock_failure(decrypt_account(s.account_number))
            s.status = "failed" if failure else "completed"
            s.failure_reason = failure
            s.processed_at = now
            if failure:
                # 실패한 정산의 선물은 다시 정산 대상 (부분 UNIQUE 인덱스에서 빠진다)
                for item in db.scalars(select(SettlementItem).where(SettlementItem.settlement_id == s.id)):
                    item.is_active = False
        elif elapsed >= PROCESSING_AFTER and s.status == "requested":
            s.status = "processing"
    if commit:
        db.commit()
    else:
        db.flush()


# ───────── S2 정산 현황 ─────────


def _active_settled_gift_ids(db: Session, gift_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    """실패하지 않은 정산에 들어가 있는 선물"""
    if not gift_ids:
        return set()
    return set(db.scalars(select(SettlementItem.gift_id).where(SettlementItem.gift_id.in_(gift_ids), SettlementItem.is_active.is_(True))))


def get_overview(db: Session, funding_id: str, user: User) -> SettlementOverviewDto:
    """S2 정산 현황 (생일자만): 정산 가능 선물 · 이월 선물 · 정산 기록(계좌번호 마스킹)"""
    funding = get_funding_or_404(db, funding_id)
    assert_owner(funding, user)
    advance_settlements(db, owner_id=user.id)
    ended = funding_status(funding) == "ended"

    gifts = list(db.scalars(select(Gift).where(Gift.funding_id == funding.id).order_by(Gift.sort_order, Gift.created_at, Gift.id)))
    stats = gift_stats(db, [g.id for g in gifts])
    settled = _active_settled_gift_ids(db, [g.id for g in gifts])
    eligible: list[EligibleGiftDto] = []
    carryover: list[CarryoverGiftDto] = []
    for g in gifts:
        raised = stats[g.id].raised
        if g.shortfall_action == "carryover":
            carryover.append(CarryoverGiftDto(id=g.id, name=g.name, amount=raised))
        if not ended or g.id in settled or raised <= 0:
            continue
        if raised >= g.price:
            eligible.append(EligibleGiftDto(id=g.id, name=g.name, amount=raised, reason="achieved"))
        elif g.shortfall_action == "withdraw":
            eligible.append(EligibleGiftDto(id=g.id, name=g.name, amount=raised, reason="withdraw"))

    history: list[SettlementRecordDto] = []
    for s in db.scalars(select(Settlement).where(Settlement.funding_id == funding.id).order_by(Settlement.requested_at.desc(), Settlement.id)):
        names = db.scalars(
            select(Gift.name).join(SettlementItem, SettlementItem.gift_id == Gift.id).where(SettlementItem.settlement_id == s.id).order_by(Gift.sort_order, Gift.id)
        ).all()
        history.append(
            SettlementRecordDto(
                id=s.id,
                funding_id=s.funding_id,
                gift_names=list(names),
                amount=s.amount,
                bank=s.bank,
                account_number_masked=mask_account(decrypt_account(s.account_number)),
                account_holder=s.account_holder,
                status=s.status,
                requested_at=s.requested_at,
                failure_reason=s.failure_reason,
            )
        )
    return SettlementOverviewDto(
        funding_id=funding.id,
        funding_name=funding.name,
        eligible_gifts=eligible,
        eligible_amount=sum(g.amount for g in eligible),
        carryover_gifts=carryover,
        history=history,
    )


# ───────── S3 정산 요청 ─────────


def _validate_account(req: SettlementRequest, owner_name: str) -> dict[str, str]:
    """프론트 lib/validation.ts validateAccount 와 같은 규칙 · 문구 (Q10)"""
    errors: dict[str, str] = {}
    if req.bank not in BANKS:
        errors["bank"] = "은행을 선택해 주세요."
    digits = (req.account_number or "").replace("-", "")
    if not digits:
        errors["account_number"] = "계좌번호를 입력해 주세요."
    elif not (digits.isascii() and digits.isdigit() and 10 <= len(digits) <= 14):
        errors["account_number"] = "계좌번호는 숫자 10~14자리로 입력해 주세요."
    holder = (req.account_holder or "").strip()
    if not holder:
        errors["account_holder"] = "예금주를 입력해 주세요."
    elif holder != owner_name:
        errors["account_holder"] = "본인 명의 계좌만 등록할 수 있어요."
    return errors


def request_settlement(db: Session, funding_id: str, user: User, req: SettlementRequest) -> uuid.UUID:
    """S3 정산 요청 — 금액은 서버가 선택 선물의 모금액 합으로 계산한다"""
    funding = _ended_owned_funding(db, get_funding_or_404(db, funding_id), user)
    errors = _validate_account(req, user.name)
    if errors:
        raise ApiError("VALIDATION", "계좌 정보를 확인해 주세요.", field_errors=errors)
    raw_ids = list(dict.fromkeys(req.gift_ids))
    if not raw_ids:
        raise ApiError("VALIDATION", "정산할 선물을 선택해 주세요.")
    gift_ids = [parse_uuid(g) for g in raw_ids]
    if any(g is None for g in gift_ids):
        raise ApiError("NOT_FOUND", "선물을 찾을 수 없어요.")

    # 선택한 선물을 ID 순서로 모두 잠근다 → 버튼을 두 번 눌러 동시에 와도 한 건만 저장 (교착 방지)
    locked = {g.id: g for g in db.scalars(select(Gift).where(Gift.id.in_(gift_ids)).order_by(Gift.id).with_for_update())}
    advance_settlements(db, owner_id=user.id, commit=False)  # 방금 실패로 끝난 정산이 있으면 반영 (선물 잠금은 유지)
    settled = _active_settled_gift_ids(db, gift_ids)
    stats = gift_stats(db, gift_ids)
    amount = 0
    for gid in gift_ids:
        gift = locked.get(gid)
        if gift is None or gift.funding_id != funding.id:
            raise ApiError("NOT_FOUND", "선물을 찾을 수 없어요.")
        if gid in settled:
            raise ApiError("CONFLICT", "이미 정산 요청한 선물이 포함되어 있어요.")
        raised = stats[gid].raised
        if raised <= 0 or not (raised >= gift.price or gift.shortfall_action == "withdraw"):
            raise ApiError("VALIDATION", "정산할 수 없는 선물이 포함되어 있어요.")
        amount += raised

    settlement = Settlement(
        owner_id=user.id,
        funding_id=funding.id,
        amount=amount,
        bank=req.bank,
        account_number=encrypt_account(req.account_number.replace("-", "")),  # 암호화 저장
        account_holder=req.account_holder.strip(),
        status="requested",
        requested_at=datetime.now(UTC),  # DB now()는 트랜잭션 시작 시각이라, 실제 요청 시각을 직접 넣는다
    )
    db.add(settlement)
    try:
        db.flush()
        for gid in gift_ids:
            raised = stats[gid].raised
            reason = "achieved" if raised >= locked[gid].price else "withdraw"
            db.add(SettlementItem(settlement_id=settlement.id, gift_id=gid, amount=raised, reason=reason, is_active=True))
        db.commit()
    except IntegrityError:  # 부분 UNIQUE 인덱스 — 유효한 정산에 같은 선물이 두 번 들어갈 수 없다
        db.rollback()
        raise ApiError("CONFLICT", "이미 정산 요청한 선물이 포함되어 있어요.") from None
    return settlement.id
