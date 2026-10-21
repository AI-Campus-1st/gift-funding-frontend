"""D1 ~ D4 후원 · 축하 메시지 API (docs/backend/API.SPEC.md 6장)

후원 · 메시지는 수정 · 삭제 API가 없다 (기록 보호, 후원 취소 · 환불은 이번 범위에서 제외 Q19).
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas.donation import DonationRequest, DonationResultDto, MyDonationDto, ReceivedMessageDto
from app.security import get_current_user
from app.services import donation as service

router = APIRouter(tags=["후원 · 축하 메시지"])


@router.post("/donations", status_code=status.HTTP_201_CREATED, response_model=DonationResultDto, summary="D1 후원하기 (+ 축하 메시지)")
def donate(req: DonationRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DonationResultDto:
    return DonationResultDto(donation_id=service.donate(db, user, req))


@router.get("/me/donations", response_model=list[MyDonationDto], summary="D2 내 후원 내역")
def list_my_donations(funding_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[MyDonationDto]:
    return service.list_my_donations(db, user, funding_id)


@router.get("/me/donations/{donation_id}", response_model=MyDonationDto, summary="D3 내 후원 1건")
def get_my_donation(donation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MyDonationDto:
    return service.get_my_donation(db, donation_id, user)


@router.get("/me/messages", response_model=list[ReceivedMessageDto], summary="D4 받은 축하 메시지 (생일자)")
def list_received_messages(funding_id: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ReceivedMessageDto]:
    return service.list_received_messages(db, user, funding_id)
