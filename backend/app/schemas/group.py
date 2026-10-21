"""
요청 · 응답 형식 — docs/backend/API.SPEC.md 2.2 · 4장 (snake_case)
"""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

FundingStatus = Literal["scheduled", "active", "ended"]

# ───────── 요청 ─────────


class GroupRequest(BaseModel):
    """G2 그룹 생성 · G9 그룹 정보 수정"""

    name: str = ""
    description: str = ""


class InviteCreateRequest(BaseModel):
    funding_id: str | None = None  # null 이면 그룹 링크. 형식이 틀린 ID 도 "이 그룹 펀딩 아님"으로 처리하려고 문자열로 받는다


class InviteUpdateRequest(BaseModel):
    is_active: bool | None = None


# ───────── 응답 ─────────


class GroupFundingDto(BaseModel):
    id: uuid.UUID
    name: str
    owner_name: str
    is_mine: bool
    status: FundingStatus


class GroupSummaryDto(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    member_count: int
    is_admin: bool
    fundings: list[GroupFundingDto]


class GroupListDto(BaseModel):
    created: list[GroupSummaryDto]
    joined: list[GroupSummaryDto]


class GroupMemberDto(BaseModel):
    id: uuid.UUID
    name: str
    is_admin: bool


class GroupDetailDto(GroupSummaryDto):
    members: list[GroupMemberDto]  # 이메일은 보내지 않는다


class InviteDto(BaseModel):
    token: str
    group_id: uuid.UUID
    group_name: str
    funding_id: uuid.UUID | None
    funding_name: str | None
    is_active: bool
    is_expired: bool
    created_at: datetime


class InvitePreviewDto(BaseModel):
    token: str
    group_name: str
    funding_name: str | None
    owner_name: str | None
    already_joined: bool
    target_funding_id: uuid.UUID | None


class JoinResultDto(BaseModel):
    group_id: uuid.UUID
    target_funding_id: uuid.UUID | None
    target_is_mine: bool
    already_joined: bool
