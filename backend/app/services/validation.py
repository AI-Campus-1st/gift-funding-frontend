"""
입력값 검증 — 프론트 frontend/src/lib/validation.ts 와 같은 규칙 · 같은 문구 (서버가 최종 판단)

글자 수: docs/backend/ERD.md 0장 (2026-10-19 확정, 화면 = 서버 = DB)
"""

import re
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.config import get_settings

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PASSWORD_MIN_LENGTH = 8

TEXT_LIMITS = {
    "user_name": 50,
    "email": 255,
    "group_name": 30,
    "group_description": 100,
    "funding_name": 40,
    "gift_name": 100,
    "gift_description": 100,
    "friend_name": 20,
    "message": 200,
}

MAX_KEYWORDS = 10  # Mock 과 같은 임시값 (❓ Q3)
PRICE_RANGES = {"under30k", "30k-100k", "100k-300k", "300k-500k", "over500k"}


def too_long(label: str, limit: int) -> str:
    return f"{label} {limit}자 이내로 입력해 주세요."


def today() -> date:
    return datetime.now(ZoneInfo(get_settings().timezone)).date()


def parse_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value or "") else None
    except ValueError:
        return None


def validate_name(value: str) -> str | None:
    if len(value) == 0:
        return "이름을 입력해 주세요."
    if len(value.strip()) == 0:
        return "올바른 이름을 입력해 주세요."
    if len(value.strip()) > TEXT_LIMITS["user_name"]:
        return too_long("이름은", TEXT_LIMITS["user_name"])
    return None


def validate_email(value: str) -> str | None:
    if len(value.strip()) == 0:
        return "이메일을 입력해 주세요."
    if not EMAIL_PATTERN.match(value.strip()):
        return "올바른 이메일 형식으로 입력해 주세요."
    if len(value.strip()) > TEXT_LIMITS["email"]:
        return too_long("이메일은", TEXT_LIMITS["email"])
    return None


def validate_password(value: str) -> str | None:
    if len(value) == 0:
        return "비밀번호를 입력해 주세요."
    if len(value) < PASSWORD_MIN_LENGTH:
        return f"비밀번호는 {PASSWORD_MIN_LENGTH}자 이상 입력해 주세요."
    return None


def validate_password_confirm(password: str, confirm: str) -> str | None:
    if len(confirm) == 0:
        return "비밀번호를 다시 입력해 주세요."
    if password != confirm:
        return "비밀번호가 일치하지 않습니다."
    return None


def validate_birthday(value: str) -> str | None:
    if not value:
        return "생년월일을 선택해 주세요."
    parsed = parse_date(value)
    if parsed is None:
        return "올바른 생년월일을 선택해 주세요."
    if parsed > today():
        return "오늘 이후 날짜는 선택할 수 없습니다."
    return None


# ───────── 선물 · 펀딩 (F3 · F5 · F7) — 프론트 lib/validation.ts validateGiftInput · validateFundingInput 과 같은 문구 ─────────

FUNDING_MAX_DAYS = 21  # 시작일 포함 최대 3주 (Q6)
GIFT_PRICE_MAX = 50_000_000  # 선물 가격(= 목표 금액) 최대 5,000만 원 (2026-10-19 확정, 프론트 constants.ts 와 같음)


def parse_amount(value: object) -> int | None:
    """정수 금액이면 int, 아니면 None (true/false · 소수 · 문자열은 정수가 아님)"""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def validate_positive_amount(value: object, empty_message: str) -> str | None:
    if value is None or (isinstance(value, float) and value != value):  # None · NaN
        return empty_message
    amount = parse_amount(value)
    if amount is None:
        return "금액은 원 단위 정수로 입력해 주세요."
    if amount <= 0:
        return "0원보다 큰 금액을 입력해 주세요."
    return None


def validate_url(value: str) -> str | None:
    from urllib.parse import urlparse

    if len((value or "").strip()) == 0:
        return "상품 구매 URL을 입력해 주세요."
    parsed = urlparse(value.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return "올바른 URL 형식으로 입력해 주세요. (예: https://...)"
    return None


def validate_gift(name: str, price: object, image_url: str, product_url: str, description: str) -> dict[str, str]:
    errors: dict[str, str] = {}
    if len((name or "").strip()) == 0:
        errors["name"] = "선물 이름을 입력해 주세요."
    elif len(name.strip()) > TEXT_LIMITS["gift_name"]:
        errors["name"] = too_long("선물 이름은", TEXT_LIMITS["gift_name"])
    if len((description or "").strip()) > TEXT_LIMITS["gift_description"]:
        errors["description"] = too_long("선물 설명은", TEXT_LIMITS["gift_description"])
    price_error = validate_positive_amount(price, "선물 가격을 입력해 주세요.")
    if price_error is None and parse_amount(price) > GIFT_PRICE_MAX:
        price_error = f"선물 가격은 {GIFT_PRICE_MAX:,}원 이하로 입력해 주세요."
    if price_error:
        errors["price"] = price_error
    if not image_url:
        errors["image_url"] = "선물 이미지를 등록해 주세요."
    url_error = validate_url(product_url)
    if url_error:
        errors["product_url"] = url_error
    return errors


def validate_funding(name: str, group_id: str, start_date: str, end_date: str, gift_count: int) -> dict[str, str]:
    from datetime import timedelta

    errors: dict[str, str] = {}
    if len((name or "").strip()) == 0:
        errors["name"] = "펀딩 이름을 입력해 주세요."
    elif len(name.strip()) > TEXT_LIMITS["funding_name"]:
        errors["name"] = too_long("펀딩 이름은", TEXT_LIMITS["funding_name"])
    if not group_id:
        errors["group_id"] = "그룹을 선택해 주세요."
    start = parse_date(start_date)
    end = parse_date(end_date)
    if start is None:
        errors["start_date"] = "시작일을 선택해 주세요."
    elif start < today():  # 오늘은 가능 → 만들자마자 진행 중 (Q6)
        errors["start_date"] = "시작일은 오늘 이전으로 선택할 수 없어요."
    if end is None:
        errors["end_date"] = "종료일을 선택해 주세요."
    elif start is not None and end < start:
        errors["end_date"] = "종료일은 시작일보다 빠를 수 없어요."
    elif start is not None and end > start + timedelta(days=FUNDING_MAX_DAYS - 1):
        errors["end_date"] = f"펀딩 기간은 최대 3주({FUNDING_MAX_DAYS}일)까지 설정할 수 있어요."
    if gift_count < 1:
        errors["gifts"] = "선물을 최소 1개 이상 등록해 주세요."
    return errors
