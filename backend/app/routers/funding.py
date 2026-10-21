"""F1 ~ F14 펀딩 · 선물 API (docs/backend/API.SPEC.md 5장)"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas.auth import IdDto
from app.schemas.funding import (
    FriendFundingDto,
    FundingCreateRequest,
    FundingUpdateRequest,
    GiftEditDto,
    GiftForDonationDto,
    GiftRequest,
    OwnerFundingDto,
    PendingCarryoverDto,
    SupporterDonationDto,
)
from app.security import get_current_user
from app.services import funding as service

router = APIRouter(tags=["펀딩 · 선물"])

# ───────── 내 펀딩 (생일자) ─────────


@router.get("/me/fundings", response_model=list[OwnerFundingDto], summary="F1 내 펀딩 목록")
def list_my_fundings(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[OwnerFundingDto]:
    return service.list_my_fundings(db, user)


@router.get("/me/fundings/{funding_id}", response_model=OwnerFundingDto, summary="F2 내 펀딩 상세")
def get_my_funding(funding_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OwnerFundingDto:
    return service.get_my_funding(db, funding_id, user)


@router.post("/fundings", status_code=status.HTTP_201_CREATED, response_model=IdDto, summary="F3 펀딩 생성 (+ 이월 선물 다시 열기)")
def create_funding(req: FundingCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> IdDto:
    return IdDto(id=service.create_funding(db, user, req))


# /fundings/friends 는 /fundings/{funding_id} 보다 먼저 등록해야 "friends"가 ID로 잡히지 않는다
@router.get("/fundings/friends", response_model=list[FriendFundingDto], summary="F10 친구 펀딩 목록")
def list_friend_fundings(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[FriendFundingDto]:
    return service.list_friend_fundings(db, user)


@router.patch("/fundings/{funding_id}", response_model=OwnerFundingDto, summary="F14 펀딩 이름 수정")
def update_funding(funding_id: str, req: FundingUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OwnerFundingDto:
    return service.update_funding(db, funding_id, user, req)


@router.delete("/fundings/{funding_id}", status_code=status.HTTP_204_NO_CONTENT, summary="F4 펀딩 삭제")
def delete_funding(funding_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.delete_funding(db, funding_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/fundings/{funding_id}/donations", response_model=list[SupporterDonationDto], summary="F9 후원자 내역 (생일자 전용)")
def list_supporter_donations(funding_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[SupporterDonationDto]:
    return service.list_supporter_donations(db, funding_id, user)


@router.get("/me/carryovers", response_model=list[PendingCarryoverDto], summary="F13 다시 열 수 있는 이월 선물")
def list_pending_carryovers(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PendingCarryoverDto]:
    return service.list_pending_carryovers(db, user)


# ───────── 선물 (생일자) ─────────


@router.post("/fundings/{funding_id}/gifts", status_code=status.HTTP_201_CREATED, response_model=IdDto, summary="F5 선물 추가")
def add_gift(funding_id: str, req: GiftRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> IdDto:
    return IdDto(id=service.add_gift(db, funding_id, user, req))


@router.get("/me/gifts/{gift_id}", response_model=GiftEditDto, summary="F6 선물 수정용 조회")
def get_gift_for_edit(gift_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GiftEditDto:
    return service.get_gift_for_edit(db, gift_id, user)


@router.put("/gifts/{gift_id}", status_code=status.HTTP_204_NO_CONTENT, summary="F7 선물 수정")
def update_gift(gift_id: str, req: GiftRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.update_gift(db, gift_id, user, req)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/gifts/{gift_id}", status_code=status.HTTP_204_NO_CONTENT, summary="F8 선물 삭제")
def delete_gift(gift_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.delete_gift(db, gift_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ───────── 친구 펀딩 (후원자) ─────────


@router.get("/fundings/{funding_id}", response_model=FriendFundingDto, summary="F11 친구 펀딩 상세 (후원자용)")
def get_friend_funding(funding_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> FriendFundingDto:
    return service.get_friend_funding(db, funding_id, user)


@router.get("/gifts/{gift_id}", response_model=GiftForDonationDto, summary="F12 후원할 선물 조회 (후원자용)")
def get_gift_for_donation(gift_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> GiftForDonationDto:
    return service.get_gift_for_donation(db, gift_id, user)
