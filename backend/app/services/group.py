"""
그룹 · 초대 링크 서비스 (F-05, F-06 · docs/backend/API.SPEC.md 4장 · business-logic/02-group-invite.md)

📌 2026-10-19 확정
- 그룹 이름 · 설명은 그룹을 만든 사람(관리자)만 수정한다 (G9).
- 펀딩은 그 그룹을 만든 사람만 열 수 있다 → 펀딩 생성(F3)에서 확인 (assert_can_open_funding).
- 그룹 삭제 API 는 없다.
"""

import secrets
import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Funding, Group, GroupMember, Invite, User
from app.schemas.group import (
    GroupDetailDto,
    GroupFundingDto,
    GroupListDto,
    GroupMemberDto,
    GroupRequest,
    GroupSummaryDto,
    InviteDto,
    InvitePreviewDto,
    JoinResultDto,
)
from app.services import validation as v

GROUP_NOT_FOUND = "존재하지 않는 그룹이에요."
GROUP_FORBIDDEN = "이 그룹에 접근할 권한이 없어요."
GROUP_EDIT_FORBIDDEN = "그룹 관리자만 수정할 수 있어요."
OPEN_FUNDING_FORBIDDEN = "내가 만든 그룹에만 펀딩을 열 수 있어요."
INVITE_INVALID = "유효하지 않거나 만료된 초대 링크입니다."


def parse_uuid(value: str | None) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value)) if value else None
    except ValueError:
        return None


# ───────── 공통 계산 ─────────


def funding_status(f: Funding, today: date | None = None) -> str:
    """펀딩 상태 = 날짜로 계산 (저장하지 않음). 시작 전 scheduled · 종료일까지 active · 이후 ended"""
    today = today or v.today()
    if today < f.start_date:
        return "scheduled"
    if today <= f.end_date:
        return "active"
    return "ended"


def is_member(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    return db.get(GroupMember, (group_id, user_id)) is not None


def _user_names(db: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    return dict(db.execute(select(User.id, User.name).where(User.id.in_(ids))).all())


def _get_group_for_member(db: Session, group_id: str, user: User) -> Group:
    gid = parse_uuid(group_id)
    group = db.get(Group, gid) if gid else None
    if group is None:
        raise ApiError("NOT_FOUND", GROUP_NOT_FOUND)
    if not is_member(db, group.id, user.id):
        raise ApiError("FORBIDDEN", GROUP_FORBIDDEN)
    return group


def _summaries(db: Session, groups: list[Group], user: User) -> list[GroupSummaryDto]:
    """그룹 요약. 참여자는 그 그룹에 연결된 펀딩을 모두 볼 수 있다 (예정 · 진행 중 · 종료). 펀딩은 최신순(시작일 최신 → 먼저)"""
    if not groups:
        return []
    ids = [g.id for g in groups]
    counts: dict[uuid.UUID, int] = {}
    for gid in db.scalars(select(GroupMember.group_id).where(GroupMember.group_id.in_(ids))):
        counts[gid] = counts.get(gid, 0) + 1
    fundings = list(db.scalars(select(Funding).where(Funding.group_id.in_(ids)).order_by(Funding.start_date.desc(), Funding.created_at.desc(), Funding.id)))
    names = _user_names(db, {f.owner_id for f in fundings})
    today = v.today()
    by_group: dict[uuid.UUID, list[GroupFundingDto]] = {gid: [] for gid in ids}
    for f in fundings:
        by_group[f.group_id].append(
            GroupFundingDto(id=f.id, name=f.name, owner_name=names.get(f.owner_id, "알 수 없음"), is_mine=f.owner_id == user.id, status=funding_status(f, today))
        )
    return [
        GroupSummaryDto(id=g.id, name=g.name, description=g.description, member_count=counts.get(g.id, 0), is_admin=g.admin_id == user.id, fundings=by_group[g.id])
        for g in groups
    ]


def _validate_group(req: GroupRequest) -> tuple[str, str]:
    name = (req.name or "").strip()
    description = (req.description or "").strip()
    if not name:
        message = "그룹 이름을 입력해 주세요."
        raise ApiError("VALIDATION", message, field_errors={"name": message})
    errors: dict[str, str] = {}
    if len(name) > v.TEXT_LIMITS["group_name"]:
        errors["name"] = v.too_long("그룹 이름은", v.TEXT_LIMITS["group_name"])
    if len(description) > v.TEXT_LIMITS["group_description"]:
        errors["description"] = v.too_long("그룹 설명은", v.TEXT_LIMITS["group_description"])
    if errors:
        raise ApiError("VALIDATION", "입력값을 확인해 주세요.", field_errors=errors)
    return name, description


# ───────── 그룹 (G1 · G2 · G3 · G9) ─────────


def list_my_groups(db: Session, user: User) -> GroupListDto:
    """G1 관리자인 그룹(created) / 참여만 한 그룹(joined)"""
    groups = list(
        db.scalars(
            select(Group).join(GroupMember, GroupMember.group_id == Group.id).where(GroupMember.user_id == user.id).order_by(Group.created_at, Group.id)
        )
    )
    summaries = _summaries(db, groups, user)
    return GroupListDto(created=[s for s in summaries if s.is_admin], joined=[s for s in summaries if not s.is_admin])


def create_group(db: Session, user: User, req: GroupRequest) -> uuid.UUID:
    """G2 그룹 생성 — 만든 사람이 관리자이자 첫 참여자 (한 트랜잭션)"""
    name, description = _validate_group(req)
    group = Group(name=name, description=description, admin_id=user.id)
    db.add(group)
    db.flush()
    db.add(GroupMember(group_id=group.id, user_id=user.id))
    db.commit()
    return group.id


def get_group_detail(db: Session, group_id: str, user: User) -> GroupDetailDto:
    """G3 그룹 상세 · 참여자 (참여자만, 이메일 없음)"""
    group = _get_group_for_member(db, group_id, user)
    summary = _summaries(db, [group], user)[0]
    rows = db.execute(
        select(User.id, User.name).join(GroupMember, GroupMember.user_id == User.id).where(GroupMember.group_id == group.id).order_by(GroupMember.joined_at, User.id)
    ).all()
    members = [GroupMemberDto(id=uid, name=name, is_admin=uid == group.admin_id) for uid, name in rows]
    members.sort(key=lambda m: not m.is_admin)  # 관리자를 맨 앞에
    return GroupDetailDto(**summary.model_dump(), members=members)


def update_group(db: Session, group_id: str, user: User, req: GroupRequest) -> GroupDetailDto:
    """G9 그룹 이름 · 설명 수정 — 그룹을 만든 사람(관리자)만 (2026-10-19 확정)"""
    group = _get_group_for_member(db, group_id, user)
    if group.admin_id != user.id:
        raise ApiError("FORBIDDEN", GROUP_EDIT_FORBIDDEN)
    group.name, group.description = _validate_group(req)
    db.commit()
    return get_group_detail(db, str(group.id), user)


def assert_can_open_funding(db: Session, group_id: str, user: User) -> Group:
    """F3 펀딩 생성 전에 확인: 펀딩은 그 그룹을 만든 사람만 열 수 있다 (2026-10-19 확정)"""
    gid = parse_uuid(group_id)
    group = db.get(Group, gid) if gid else None
    if group is None or group.admin_id != user.id:
        raise ApiError("FORBIDDEN", OPEN_FUNDING_FORBIDDEN)
    return group


# ───────── 초대 링크 (G4 ~ G8) ─────────


def _can_manage_invite(db: Session, group: Group, user: User, funding_id: uuid.UUID | None) -> bool:
    """관리자: 그룹의 모든 링크 · 펀딩 생일자: 자기 펀딩 지정 링크만 (F-06)"""
    if group.admin_id == user.id:
        return True
    if funding_id is None:
        return False
    f = db.get(Funding, funding_id)
    return f is not None and f.group_id == group.id and f.owner_id == user.id


def _is_expired(db: Session, invite: Invite) -> bool:
    """펀딩 지정 링크는 그 펀딩이 끝나면 만료 (저장하지 않고 계산). 그룹 링크는 비활성화 전까지 유효"""
    if invite.funding_id is None:
        return False
    f = db.get(Funding, invite.funding_id)
    return f is not None and funding_status(f) == "ended"


def _to_invite_dto(db: Session, invite: Invite) -> InviteDto:
    group = db.get(Group, invite.group_id)
    funding = db.get(Funding, invite.funding_id) if invite.funding_id else None
    return InviteDto(
        token=invite.token,
        group_id=invite.group_id,
        group_name=group.name if group else "",
        funding_id=invite.funding_id,
        funding_name=funding.name if funding else None,
        is_active=invite.is_active,
        is_expired=_is_expired(db, invite),
        created_at=invite.created_at,
    )


def list_invites(db: Session, group_id: str, user: User, funding_id: str | None) -> list[InviteDto]:
    """G4 관리자: 그룹의 모든 링크 · 생일자: funding_id 로 지정한 자기 펀딩 링크만 (최신순)"""
    group = _get_group_for_member(db, group_id, user)
    fid = parse_uuid(funding_id)
    if not _can_manage_invite(db, group, user, fid):
        raise ApiError("FORBIDDEN", "초대 링크는 그룹 관리자 또는 펀딩 생일자만 관리할 수 있어요.")
    stmt = select(Invite).where(Invite.group_id == group.id)
    if group.admin_id != user.id:
        stmt = stmt.where(Invite.funding_id == fid)
    invites = db.scalars(stmt.order_by(Invite.created_at.desc(), Invite.id))
    return [_to_invite_dto(db, i) for i in invites]


def create_invite(db: Session, group_id: str, user: User, funding_id: str | None) -> InviteDto:
    """G5 초대 링크 생성 — funding_id 를 지정하면 참여 후 그 펀딩으로 바로 이동"""
    group = _get_group_for_member(db, group_id, user)
    fid = parse_uuid(funding_id)
    if funding_id and fid is None:
        raise ApiError("VALIDATION", "이 그룹에 연결된 펀딩만 선택할 수 있어요.")
    if not _can_manage_invite(db, group, user, fid):
        raise ApiError("FORBIDDEN", "초대 링크는 그룹 관리자 또는 펀딩 생일자만 만들 수 있어요.")
    if fid is not None:
        f = db.get(Funding, fid)
        if f is None or f.group_id != group.id:
            raise ApiError("VALIDATION", "이 그룹에 연결된 펀딩만 선택할 수 있어요.")
    # 예측하기 어려운 토큰 (Python secrets). 겹칠 확률은 사실상 0 이지만 UNIQUE 로 한 번 더 막는다
    invite = Invite(token="INV_" + secrets.token_hex(16).upper(), group_id=group.id, funding_id=fid, created_by=user.id)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return _to_invite_dto(db, invite)


def deactivate_invite(db: Session, token: str, user: User, is_active: bool | None) -> None:
    """G6 초대 링크 비활성화 — 삭제하지 않고 비활성화만. 다시 활성화하지 않는다"""
    invite = db.scalar(select(Invite).where(Invite.token == token))
    if invite is None:
        raise ApiError("NOT_FOUND", "초대 링크를 찾을 수 없어요.")
    group = _get_group_for_member(db, str(invite.group_id), user)
    if not _can_manage_invite(db, group, user, invite.funding_id):
        raise ApiError("FORBIDDEN", "이 초대 링크를 관리할 권한이 없어요.")
    if is_active is False and invite.is_active:
        invite.is_active = False
        invite.deactivated_at = datetime.now(UTC)
        db.commit()


def _find_valid_invite(db: Session, token: str) -> tuple[Invite, Group]:
    """G7 · G8 공통 검사 순서: 없음 → 비활성 → 지정 펀딩 종료"""
    invite = db.scalar(select(Invite).where(Invite.token == token))
    group = db.get(Group, invite.group_id) if invite else None
    if invite is None or group is None:
        raise ApiError("INVITE_INVALID", INVITE_INVALID)
    if not invite.is_active:
        raise ApiError("INVITE_INACTIVE", "비활성화된 초대 링크라 참여할 수 없어요. 친구에게 새 링크를 요청해 주세요.")
    if _is_expired(db, invite):
        raise ApiError("INVITE_EXPIRED", "펀딩이 종료되어 만료된 초대 링크입니다.")
    return invite, group


def _target_funding(db: Session, invite: Invite, user: User) -> Funding | None:
    """
    참여 후 이동할 펀딩 (2026-10-19 확정)
    - 펀딩 지정 링크 → 그 펀딩
    - 그룹 링크 → 그룹의 다른 사람 펀딩 중 진행 중인 것 (시작일이 가장 최근)
    - 없으면 None → 프론트가 그룹 상세로 보낸다
    """
    if invite.funding_id is not None:
        return db.get(Funding, invite.funding_id)
    today = v.today()
    return db.scalar(
        select(Funding)
        .where(Funding.group_id == invite.group_id, Funding.owner_id != user.id, Funding.start_date <= today, Funding.end_date >= today)
        .order_by(Funding.start_date.desc(), Funding.created_at.desc())
        .limit(1)
    )


def preview_invite(db: Session, token: str, user: User) -> InvitePreviewDto:
    """G7 참여 전 정보 (UI-17)"""
    invite, group = _find_valid_invite(db, token)
    funding = _target_funding(db, invite, user)
    owner_name = _user_names(db, {funding.owner_id}).get(funding.owner_id) if funding else None
    return InvitePreviewDto(
        token=invite.token,
        group_name=group.name,
        funding_name=funding.name if funding else None,
        owner_name=owner_name,
        already_joined=is_member(db, group.id, user.id),
        target_funding_id=funding.id if funding else None,
    )


def join_by_invite(db: Session, token: str, user: User) -> JoinResultDto:
    """G8 초대 링크로 참여 — 이미 참여했으면 새로 등록하지 않고 같은 결과. 커밋을 마친 뒤 응답한다"""
    invite, group = _find_valid_invite(db, token)
    already = is_member(db, group.id, user.id)
    if not already:
        # 동시에 두 번 요청돼도 복합 PK 충돌을 오류로 만들지 않는다
        result = db.execute(insert(GroupMember).values(group_id=group.id, user_id=user.id).on_conflict_do_nothing(index_elements=["group_id", "user_id"]))
        already = result.rowcount == 0
        db.commit()
    funding = _target_funding(db, invite, user)
    return JoinResultDto(
        group_id=group.id,
        target_funding_id=funding.id if funding else None,
        target_is_mine=funding is not None and funding.owner_id == user.id,
        already_joined=already,
    )
