"""
생일 캘린더 · 알림 서비스 (F-15, F-16 · docs/backend/API.SPEC.md 8장 · business-logic/07-calendar-notification.md)

알림 생성 (Q12 · Q17 확정)
- 지금은 알림을 **조회할 때**(N1 · N2) 만든다. 나중에 매일 0시 스케줄러로 옮긴다 (ensure_notifications 를 그대로 호출하면 된다).
- 생일 하루 전 / 당일: 일정 주인에게. 2월 29일생은 평년에 2월 28일. 생일 알림은 funding_id 를 저장하지 않는다.
- 미달 처리 알림: 종료 후 7일이 지나도 이월 / 인출을 고르지 않은 선물(0 < 모금액 < 목표)이 있으면 펀딩마다 한 번.
- (user_id, dedupe_key) UNIQUE + ON CONFLICT DO NOTHING → 동시에 조회해도 한 번만 만들어진다.
"""

import calendar
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import BirthdayEvent, Funding, Gift, GroupMember, Notification, User
from app.schemas.schedule import BirthdayEventDto, BirthdayEventRequest, LinkableFundingDto, NotificationDto
from app.services import validation as v
from app.services.funding import gift_stats
from app.services.group import is_member, parse_uuid

SHORTFALL_DEADLINE_DAYS = 7  # 프론트 constants.ts 와 같음 (Q12)


# ───────── 공통 ─────────


def can_view_funding(db: Session, funding: Funding, user: User) -> bool:
    """펀딩 열람 권한: 생일자 본인이거나 펀딩이 연결된 그룹의 참여자"""
    return funding.owner_id == user.id or is_member(db, funding.group_id, user.id)


def days_until_next_birthday(birthday: date, today: date) -> int:
    """다음 생일까지 남은 날 (오늘이면 0). 그 해에 없는 날(2월 29일)은 그 달 마지막 날(2월 28일)로 본다"""

    def occurrence(year: int) -> date:
        last = calendar.monthrange(year, birthday.month)[1]
        return date(year, birthday.month, min(birthday.day, last))

    nxt = occurrence(today.year)
    if nxt < today:
        nxt = occurrence(today.year + 1)
    return (nxt - today).days


def _to_event(db: Session, e: BirthdayEvent, user: User) -> BirthdayEventDto:
    funding = db.get(Funding, e.linked_funding_id) if e.linked_funding_id else None
    can_open = funding is not None and can_view_funding(db, funding, user)
    return BirthdayEventDto(
        id=e.id,
        friend_name=e.friend_name,
        birthday=e.birthday,
        linked_funding_id=e.linked_funding_id,
        linked_funding_name=funding.name if can_open else None,  # 볼 권한이 없으면 이름도 공개하지 않는다
        can_open_linked_funding=can_open,
        linked_funding_is_mine=can_open and funding.owner_id == user.id,
    )


# ───────── 생일 일정 (C1 ~ C5) ─────────


def list_events(db: Session, user: User) -> list[BirthdayEventDto]:
    """C1 내 생일 일정"""
    events = db.scalars(select(BirthdayEvent).where(BirthdayEvent.owner_id == user.id).order_by(BirthdayEvent.created_at, BirthdayEvent.id))
    return [_to_event(db, e, user) for e in events]


def list_linkable_fundings(db: Session, user: User) -> list[LinkableFundingDto]:
    """C2 일정에 연결할 수 있는 펀딩 = 내가 볼 수 있는 펀딩 (내 펀딩 + 참여한 그룹의 펀딩, 시작일 최신순)"""
    my_groups = select(GroupMember.group_id).where(GroupMember.user_id == user.id)
    rows = db.execute(
        select(Funding.id, Funding.name)
        .where((Funding.owner_id == user.id) | Funding.group_id.in_(my_groups))
        .order_by(Funding.start_date.desc(), Funding.created_at.desc(), Funding.id)
    )
    return [LinkableFundingDto(id=fid, name=name) for fid, name in rows]


def _validate_event(db: Session, req: BirthdayEventRequest, user: User) -> tuple[str, date, uuid.UUID | None]:
    errors: dict[str, str] = {}
    name = (req.friend_name or "").strip()
    if not name:
        errors["friend_name"] = "친구 이름을 입력해 주세요."
    elif len(name) > v.TEXT_LIMITS["friend_name"]:
        errors["friend_name"] = v.too_long("친구 이름은", v.TEXT_LIMITS["friend_name"])
    birthday = v.parse_date(req.birthday or "")
    if birthday is None:
        errors["birthday"] = "올바른 생일을 선택해 주세요."
    funding_id = None
    if req.linked_funding_id:
        funding_id = parse_uuid(req.linked_funding_id)
        funding = db.get(Funding, funding_id) if funding_id else None
        if funding is None or not can_view_funding(db, funding, user):
            errors["linked_funding_id"] = "접근 가능한 펀딩만 연결할 수 있어요."
    if errors:
        raise ApiError("VALIDATION", "입력값을 확인해 주세요.", field_errors=errors)
    return name, birthday, funding_id


def _own_event(db: Session, event_id: str, user: User) -> BirthdayEvent:
    eid = parse_uuid(event_id)
    event = db.get(BirthdayEvent, eid) if eid else None
    if event is None:
        raise ApiError("NOT_FOUND", "존재하지 않는 일정이에요.")
    if event.owner_id != user.id:
        raise ApiError("FORBIDDEN", "본인이 등록한 일정만 관리할 수 있어요.")
    return event


def create_event(db: Session, user: User, req: BirthdayEventRequest) -> uuid.UUID:
    """C3 일정 등록"""
    name, birthday, funding_id = _validate_event(db, req, user)
    event = BirthdayEvent(owner_id=user.id, friend_name=name, birthday=birthday, linked_funding_id=funding_id)
    db.add(event)
    db.commit()
    return event.id


def update_event(db: Session, event_id: str, user: User, req: BirthdayEventRequest) -> None:
    """C4 일정 수정 (본인 일정만)"""
    event = _own_event(db, event_id, user)
    event.friend_name, event.birthday, event.linked_funding_id = _validate_event(db, req, user)
    db.commit()


def delete_event(db: Session, event_id: str, user: User) -> None:
    """C5 일정 삭제 — 이 일정으로 만든 알림도 함께 삭제 (DB CASCADE, 의도를 분명히 하려고 직접도 지운다)"""
    event = _own_event(db, event_id, user)
    db.execute(delete(Notification).where(Notification.event_id == event.id))
    db.delete(event)
    db.commit()


# ───────── 알림 만들기 ─────────


def _add_notification(db: Session, **values) -> None:
    db.execute(insert(Notification).values(**values).on_conflict_do_nothing(index_elements=["user_id", "dedupe_key"]))


def ensure_notifications(db: Session, user: User, today: date | None = None) -> None:
    """오늘 기준으로 만들어야 할 알림을 만든다 (이미 있으면 건너뜀). 나중에 매일 0시 작업도 이 함수를 쓴다"""
    today = today or v.today()

    # 생일 하루 전 / 당일 — funding_id 는 저장하지 않는다 (볼 때 일정의 현재 연결 펀딩으로 판단)
    for e in db.scalars(select(BirthdayEvent).where(BirthdayEvent.owner_id == user.id)):
        days = days_until_next_birthday(e.birthday, today)
        if days > 1:
            continue
        kind = "birthday-today" if days == 0 else "birthday-before"
        _add_notification(
            db,
            user_id=user.id,
            type=kind,
            title=f"오늘은 {e.friend_name}님의 생일이에요 🎂" if days == 0 else f"내일은 {e.friend_name}님의 생일이에요 🎁",
            body="축하 메시지와 함께 마음을 전해 보세요." if days == 0 else "미리 생일 펀딩을 확인해 보세요.",
            event_id=e.id,
            funding_id=None,
            dedupe_key=f"{e.id}:{kind}:{today.isoformat()}",
        )

    # 미달 처리 알림 — 종료 후 7일이 지났는데 처리하지 않은 미달 선물(0원 제외)이 있는 펀딩마다 한 번
    deadline_passed = today - timedelta(days=SHORTFALL_DEADLINE_DAYS)
    for f in db.scalars(select(Funding).where(Funding.owner_id == user.id, Funding.end_date < deadline_passed)):
        gifts = list(db.scalars(select(Gift).where(Gift.funding_id == f.id, Gift.shortfall_action.is_(None))))
        stats = gift_stats(db, [g.id for g in gifts])
        pending = [g for g in gifts if 0 < stats[g.id].raised < g.price]
        if not pending:
            continue
        _add_notification(
            db,
            user_id=user.id,
            type="shortfall-reminder",
            title=f"'{f.name}' 목표 미달 선물을 처리해 주세요",
            body=f"펀딩이 끝난 지 {SHORTFALL_DEADLINE_DAYS}일이 지났어요. 선물 {len(pending)}개의 이월 또는 인출을 선택해 주세요.",
            event_id=None,
            funding_id=f.id,
            dedupe_key=f"{f.id}:shortfall-reminder",
        )
    db.commit()


# ───────── 알림 (N1 ~ N4) ─────────


def _to_notification(db: Session, n: Notification, user: User) -> NotificationDto:
    base = dict(id=n.id, type=n.type, title=n.title, body=n.body, created_at=n.created_at, is_read=n.is_read)
    if n.type == "shortfall-reminder":
        return NotificationDto(**base, event_id=None, funding_id=n.funding_id, can_open_funding=True, funding_is_mine=True)
    event = db.get(BirthdayEvent, n.event_id) if n.event_id else None
    view = _to_event(db, event, user) if event else None
    can_open = bool(view and view.can_open_linked_funding)
    return NotificationDto(
        **base,
        event_id=n.event_id,
        funding_id=view.linked_funding_id if can_open else None,  # 연결이 없거나 볼 수 없으면 null → 프론트는 생일 캘린더로
        can_open_funding=can_open,
        funding_is_mine=bool(view and view.linked_funding_is_mine),
    )


def list_notifications(db: Session, user: User) -> list[NotificationDto]:
    """N1 알림 목록 (최신순, 본인 알림만)"""
    ensure_notifications(db, user)
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc(), Notification.id))
    return [_to_notification(db, n, user) for n in rows]


def unread_count(db: Session, user: User) -> int:
    """N2 안 읽은 알림 수 (홈 종 아이콘 빨간 점)"""
    ensure_notifications(db, user)
    return int(db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))))


def mark_read(db: Session, notification_id: str, user: User, is_read: bool | None) -> None:
    """N3 알림 읽음 — 남의 알림 · 없는 알림은 404"""
    nid = parse_uuid(notification_id)
    n = db.scalar(select(Notification).where(Notification.id == nid, Notification.user_id == user.id)) if nid else None
    if n is None:
        raise ApiError("NOT_FOUND", "알림을 찾을 수 없어요.")
    if is_read is not False and not n.is_read:
        n.is_read = True
        n.read_at = datetime.now(UTC)
        db.commit()


def mark_all_read(db: Session, user: User) -> None:
    """N4 모두 읽음"""
    db.execute(
        update(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)).values(is_read=True, read_at=datetime.now(UTC))
    )
    db.commit()
