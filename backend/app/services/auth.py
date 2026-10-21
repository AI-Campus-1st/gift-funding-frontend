"""
사용자 관리 · 인증 서비스 (F-01, F-02 · docs/backend/API.SPEC.md 3장 · business-logic/01-user.md)
"""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import User, UserPreference
from app.schemas.auth import AuthTokenDto, LoginRequest, PasswordChangeRequest, PreferenceDto, PreferenceRequest, ProfileRequest, SignupRequest, UserDto
from app.security import create_access_token, hash_password, verify_password
from app.services import validation as v

DUPLICATE_EMAIL = "이미 사용 중인 이메일입니다."


def to_user_dto(user: User) -> UserDto:
    return UserDto(id=user.id, name=user.name, email=user.email, birthday=user.birthday, profile_image_url=user.profile_image_url)


def _raise_if_errors(field_errors: dict[str, str]) -> None:
    errors = {k: m for k, m in field_errors.items() if m}
    if errors:
        raise ApiError("VALIDATION", "입력값을 확인해 주세요.", field_errors=errors)


def signup(db: Session, req: SignupRequest) -> uuid.UUID:
    """A1 회원가입: 필수값 재검증 → 이메일 중복 확인 → Argon2 해시 저장 + 빈 취향 생성"""
    _raise_if_errors(
        {
            "name": v.validate_name(req.name),
            "email": v.validate_email(req.email),
            "password": v.validate_password(req.password),
            "password_confirm": v.validate_password_confirm(req.password, req.password_confirm),
            "birthday": v.validate_birthday(req.birthday),
        }
    )
    email = req.email.strip().lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise ApiError("DUPLICATE_EMAIL", DUPLICATE_EMAIL, field_errors={"email": DUPLICATE_EMAIL})

    user = User(name=req.name.strip(), email=email, password_hash=hash_password(req.password), birthday=v.parse_date(req.birthday))
    db.add(user)
    try:
        db.flush()  # id 받기 + 동시 가입 시 UNIQUE 충돌을 여기서 잡는다
        db.add(UserPreference(user_id=user.id, keywords=[], categories=[], price_range=None))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError("DUPLICATE_EMAIL", DUPLICATE_EMAIL, field_errors={"email": DUPLICATE_EMAIL}) from None
    return user.id


def login(db: Session, req: LoginRequest) -> AuthTokenDto:
    """A2 로그인: 실패 문구는 이메일 가입 여부를 드러내지 않도록 하나로 통일"""
    user = db.scalar(select(User).where(User.email == req.email.strip().lower()))
    if user is None or not verify_password(user.password_hash, req.password):
        raise ApiError("INVALID_CREDENTIALS", "이메일 또는 비밀번호를 확인해 주세요.")
    token, expires_in = create_access_token(user.id)
    return AuthTokenDto(access_token=token, expires_in=expires_in, user=to_user_dto(user))


def update_profile(db: Session, user: User, req: ProfileRequest) -> UserDto:
    """A5 프로필 수정 (이메일은 바꿀 수 없음)"""
    _raise_if_errors({"name": v.validate_name(req.name), "birthday": v.validate_birthday(req.birthday)})
    user.name = req.name.strip()
    user.birthday = v.parse_date(req.birthday)
    user.profile_image_url = req.profile_image_url or None
    db.commit()
    db.refresh(user)
    return to_user_dto(user)


def change_password(db: Session, user: User, req: PasswordChangeRequest) -> None:
    """
    A8 비밀번호 변경 (2026-10-21 확정 · docs/features/password-change.md)
    입력 검사 → 현재 비밀번호 확인 → 현재와 같은 비밀번호 거절 → 새 Argon2 해시 저장. 로그인(토큰)은 유지된다.
    틀린 현재 비밀번호도 401 이 아니라 400 으로 돌려준다 (프론트는 401 을 "로그인 만료"로 보고 로그아웃시킨다).
    """
    _raise_if_errors(
        {
            "current_password": "현재 비밀번호를 입력해 주세요." if not req.current_password else None,
            "new_password": v.validate_password(req.new_password),
            "new_password_confirm": v.validate_password_confirm(req.new_password, req.new_password_confirm),
        }
    )
    if not verify_password(user.password_hash, req.current_password):
        message = "현재 비밀번호가 일치하지 않습니다."
        raise ApiError("VALIDATION", message, field_errors={"current_password": message})
    if verify_password(user.password_hash, req.new_password):
        message = "현재 비밀번호와 다른 비밀번호를 입력해 주세요."
        raise ApiError("VALIDATION", message, field_errors={"new_password": message})
    user.password_hash = hash_password(req.new_password)
    db.commit()


def _get_or_create_preference(db: Session, user: User) -> UserPreference:
    pref = db.get(UserPreference, user.id)
    if pref is None:  # 예전 데이터 등으로 행이 없으면 빈 취향을 만든다
        pref = UserPreference(user_id=user.id, keywords=[], categories=[], price_range=None)
        db.add(pref)
        db.flush()
    return pref


def get_preference(db: Session, user: User) -> PreferenceDto:
    pref = _get_or_create_preference(db, user)
    db.commit()
    return PreferenceDto(keywords=pref.keywords, categories=pref.categories, price_range=pref.price_range)


def update_preference(db: Session, user: User, req: PreferenceRequest) -> PreferenceDto:
    """A7 취향 저장: 키워드 공백 제거 · 중복 제거 · 최대 10개 (Mock 과 같은 처리)"""
    if req.price_range is not None and req.price_range not in v.PRICE_RANGES:
        raise ApiError("VALIDATION", "입력값을 확인해 주세요.", field_errors={"price_range": "가격대를 다시 선택해 주세요."})
    keywords: list[str] = []
    for k in req.keywords:
        k = k.strip()
        if k and k not in keywords:
            keywords.append(k)
    pref = _get_or_create_preference(db, user)
    pref.keywords = keywords[: v.MAX_KEYWORDS]
    pref.categories = list(dict.fromkeys(c.strip() for c in req.categories if c.strip()))
    pref.price_range = req.price_range
    db.commit()
    return PreferenceDto(keywords=pref.keywords, categories=pref.categories, price_range=pref.price_range)
