"""A1 ~ A7 인증 · 사용자 관리 API (docs/backend/API.SPEC.md 3장)"""

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas.auth import AuthTokenDto, IdDto, LoginRequest, PreferenceDto, PreferenceRequest, ProfileRequest, SignupRequest, UserDto
from app.security import get_current_user
from app.services import auth as service

router = APIRouter(tags=["인증 · 사용자"])


@router.post("/auth/signup", status_code=status.HTTP_201_CREATED, response_model=IdDto, summary="A1 회원가입")
def signup(req: SignupRequest, db: Session = Depends(get_db)) -> IdDto:
    return IdDto(id=service.signup(db, req))


@router.post("/auth/login", response_model=AuthTokenDto, summary="A2 로그인")
def login(req: LoginRequest, db: Session = Depends(get_db)) -> AuthTokenDto:
    return service.login(db, req)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT, summary="A3 로그아웃")
def logout() -> Response:
    # 서버는 토큰을 저장하지 않는다 → 프론트가 토큰을 지운다. (서버 무효화는 미정 ❓ Q16)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserDto, summary="A4 내 정보")
def me(user: User = Depends(get_current_user)) -> UserDto:
    return service.to_user_dto(user)


@router.patch("/me", response_model=UserDto, summary="A5 프로필 수정")
def update_me(req: ProfileRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserDto:
    return service.update_profile(db, user, req)


@router.get("/me/preferences", response_model=PreferenceDto, summary="A6 선물 취향 조회")
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PreferenceDto:
    return service.get_preference(db, user)


@router.put("/me/preferences", response_model=PreferenceDto, summary="A7 선물 취향 저장")
def put_preferences(req: PreferenceRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PreferenceDto:
    return service.update_preference(db, user, req)
