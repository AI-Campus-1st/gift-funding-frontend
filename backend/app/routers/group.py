"""G1 ~ G9 그룹 · 초대 링크 API (docs/backend/API.SPEC.md 4장)"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas.auth import IdDto
from app.schemas.group import (
    GroupDetailDto,
    GroupListDto,
    GroupRequest,
    InviteCreateRequest,
    InviteDto,
    InvitePreviewDto,
    InviteUpdateRequest,
    JoinResultDto,
)
from app.security import get_current_user
from app.services import group as service

router = APIRouter(tags=["그룹 · 초대"])


@router.get("/groups", response_model=GroupListDto, summary="G1 내 그룹 목록")
def list_groups(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GroupListDto:
    return service.list_my_groups(db, user)


@router.post("/groups", status_code=status.HTTP_201_CREATED, response_model=IdDto, summary="G2 그룹 생성")
def create_group(req: GroupRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> IdDto:
    return IdDto(id=service.create_group(db, user, req))


@router.get("/groups/{group_id}", response_model=GroupDetailDto, summary="G3 그룹 상세")
def get_group(group_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GroupDetailDto:
    return service.get_group_detail(db, group_id, user)


@router.patch("/groups/{group_id}", response_model=GroupDetailDto, summary="G9 그룹 이름 · 설명 수정 (관리자만)")
def update_group(group_id: str, req: GroupRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GroupDetailDto:
    return service.update_group(db, group_id, user, req)


@router.get("/groups/{group_id}/invites", response_model=list[InviteDto], summary="G4 초대 링크 목록")
def list_invites(group_id: str, funding_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[InviteDto]:
    return service.list_invites(db, group_id, user, funding_id)


@router.post("/groups/{group_id}/invites", status_code=status.HTTP_201_CREATED, response_model=InviteDto, summary="G5 초대 링크 생성")
def create_invite(group_id: str, req: InviteCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> InviteDto:
    return service.create_invite(db, group_id, user, req.funding_id)


@router.patch("/invites/{token}", status_code=status.HTTP_204_NO_CONTENT, summary="G6 초대 링크 비활성화")
def deactivate_invite(token: str, req: InviteUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.deactivate_invite(db, token, user, req.is_active)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/invites/{token}", response_model=InvitePreviewDto, summary="G7 초대 링크 확인")
def preview_invite(token: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> InvitePreviewDto:
    return service.preview_invite(db, token, user)


@router.post("/invites/{token}/join", response_model=JoinResultDto, summary="G8 초대 링크로 참여")
def join_invite(token: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> JoinResultDto:
    return service.join_by_invite(db, token, user)
