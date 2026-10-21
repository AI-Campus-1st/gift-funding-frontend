"""S1 ~ S3 목표 미달 처리 · 정산 API (docs/backend/API.SPEC.md 7장) — 모의 정산 (실제 송금 없음)"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas.auth import IdDto
from app.schemas.settlement import SettlementOverviewDto, SettlementRequest, ShortfallRequest
from app.security import get_current_user
from app.services import settlement as service

router = APIRouter(tags=["목표 미달 · 정산"])


@router.post("/gifts/{gift_id}/shortfall", status_code=status.HTTP_204_NO_CONTENT, summary="S1 목표 미달 처리 (이월 / 인출)")
def apply_shortfall(gift_id: str, req: ShortfallRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.apply_shortfall(db, gift_id, user, req)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/fundings/{funding_id}/settlement", response_model=SettlementOverviewDto, summary="S2 정산 현황 (생일자)")
def get_overview(funding_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SettlementOverviewDto:
    return service.get_overview(db, funding_id, user)


@router.post("/fundings/{funding_id}/settlements", status_code=status.HTTP_201_CREATED, response_model=IdDto, summary="S3 정산 요청 (모의)")
def request_settlement(funding_id: str, req: SettlementRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> IdDto:
    return IdDto(id=service.request_settlement(db, funding_id, user, req))
