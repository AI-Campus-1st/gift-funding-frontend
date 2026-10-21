"""C1 ~ C5 생일 캘린더 · N1 ~ N4 알림 API (docs/backend/API.SPEC.md 8장)"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas.auth import IdDto
from app.schemas.schedule import BirthdayEventDto, BirthdayEventRequest, LinkableFundingDto, NotificationDto, NotificationReadRequest, UnreadCountDto
from app.security import get_current_user
from app.services import schedule as service

router = APIRouter(tags=["생일 캘린더 · 알림"])


@router.get("/birthday-events", response_model=list[BirthdayEventDto], summary="C1 내 생일 일정")
def list_events(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[BirthdayEventDto]:
    return service.list_events(db, user)


# linkable-fundings 는 /birthday-events/{event_id} 보다 먼저 (GET 은 {event_id} 경로가 없지만 순서를 지켜 둔다)
@router.get("/birthday-events/linkable-fundings", response_model=list[LinkableFundingDto], summary="C2 연결할 수 있는 펀딩")
def list_linkable(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[LinkableFundingDto]:
    return service.list_linkable_fundings(db, user)


@router.post("/birthday-events", status_code=status.HTTP_201_CREATED, response_model=IdDto, summary="C3 생일 일정 등록")
def create_event(req: BirthdayEventRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> IdDto:
    return IdDto(id=service.create_event(db, user, req))


@router.put("/birthday-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT, summary="C4 생일 일정 수정")
def update_event(event_id: str, req: BirthdayEventRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.update_event(db, event_id, user, req)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/birthday-events/{event_id}", status_code=status.HTTP_204_NO_CONTENT, summary="C5 생일 일정 삭제 (+ 알림 삭제)")
def delete_event(event_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.delete_event(db, event_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/notifications", response_model=list[NotificationDto], summary="N1 알림 목록")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[NotificationDto]:
    return service.list_notifications(db, user)


@router.get("/notifications/unread-count", response_model=UnreadCountDto, summary="N2 안 읽은 알림 수")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UnreadCountDto:
    return UnreadCountDto(count=service.unread_count(db, user))


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT, summary="N4 모두 읽음")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.mark_all_read(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT, summary="N3 알림 읽음")
def mark_read(notification_id: str, req: NotificationReadRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    service.mark_read(db, notification_id, user, req.is_read)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
