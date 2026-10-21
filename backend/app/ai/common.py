"""
AI 추천 공통 부분 — 응답 검사 · 프롬프트 · "다시 추천받기"용 기억 (GPT · Gemini 가 함께 쓴다)

- 보내는 것: 관심사 · 카테고리 · 예산만 (이름 · 이메일 등 개인정보 없음).
- 받은 응답은 Pydantic 으로 다시 검사한다: 가격 범위(최소 ≤ 최대) · 정해진 카테고리.
"""

import secrets
from collections import OrderedDict
from threading import Lock

from pydantic import BaseModel, Field, model_validator

from app.ai.mock_provider import RECOMMEND_COUNT, Recommendation

CATEGORIES = ["전자기기", "패션·잡화", "뷰티", "취미", "리빙", "도서", "식품", "스포츠·아웃도어"]  # 프론트 constants.ts 와 같음


class AiUnavailable(Exception):
    """시간 초과 · 호출 실패 · 형식 오류 (재시도 후에도)"""

    def __init__(self, message: str, *, retryable: bool = True):
        super().__init__(message)
        self.retryable = retryable


class Item(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=300)
    category: str
    price_min: int = Field(ge=0)
    price_max: int = Field(ge=0)

    @model_validator(mode="after")
    def _check(self) -> "Item":
        if self.price_min > self.price_max:
            raise ValueError("price_min > price_max")
        if self.category not in CATEGORIES:
            raise ValueError("unknown category")
        return self


class Answer(BaseModel):
    items: list[Item] = Field(min_length=1)


# "다시 추천받기" 때 프론트는 이전 결과 ID만 보낸다 → 서버가 최근에 만든 ID → 이름을 잠시 기억해 둔다 (메모리, 최대 2,000개)
_recent: "OrderedDict[str, str]" = OrderedDict()
_recent_lock = Lock()
_RECENT_MAX = 2000


def remember(rec_id: str, name: str) -> None:
    with _recent_lock:
        _recent[rec_id] = name
        while len(_recent) > _RECENT_MAX:
            _recent.popitem(last=False)


def names_of(ids: list[str]) -> list[str]:
    with _recent_lock:
        return [_recent[i] for i in ids if i in _recent]


def build_prompt(keywords: list[str], categories: list[str], budget_min: int | None, budget_max: int | None, avoid: list[str]) -> str:
    lines = [
        "생일 선물 아이디어를 추천해 주세요. 친구들이 함께 돈을 모아 사 주는 선물이에요.",
        f"- 정확히 {RECOMMEND_COUNT}개를 추천해요.",
        "- 종류만 말하지 말고 **브랜드와 제품명**까지 구체적으로 추천해요. 예) '조말론 우드 세이지 앤 씨 솔트 코롱 30ml' (O), '고급 향수 세트' (X)",
        "- 한국의 온라인몰 · 백화점에서 실제로 살 수 있는 정식 판매 제품만 추천하고, 단종됐거나 확실하지 않은 제품은 고르지 않아요.",
        "- name 은 '브랜드 제품명 (용량 · 구성)' 형식으로 써요.",
        "- 가격은 한국 원화 기준 정가 근처의 예상 가격대예요.",
        "- reason 은 받는 사람의 관심사와 연결해서, 이 제품을 고른 이유를 한두 문장의 한국어 존댓말로 써요.",
    ]
    if keywords:
        lines.append(f"- 받는 사람의 관심사: {', '.join(keywords)}")
    if categories:
        lines.append(f"- 이 카테고리 안에서만 골라요: {', '.join(categories)}")
    if budget_min is not None or budget_max is not None:
        low = f"{budget_min:,}원" if budget_min is not None else "제한 없음"
        high = f"{budget_max:,}원" if budget_max is not None else "제한 없음"
        lines.append(f"- 예산: 최소 {low}, 최대 {high} (가격대가 예산과 겹쳐야 해요)")
    if avoid:
        lines.append(f"- 이미 보여준 선물이라 제외해요: {', '.join(avoid)}")
    return "\n".join(lines)


def to_recommendations(answer: "Answer", categories: list[str]) -> list[Recommendation]:
    """검사를 통과한 응답 → 추천 목록 (최대 4개, 고른 카테고리 밖은 뺀다). 쓸 게 없으면 AiUnavailable"""
    items: list[Recommendation] = []
    for item in answer.items[:RECOMMEND_COUNT]:
        if categories and item.category not in categories:
            continue
        rec_id = "ai_" + secrets.token_hex(6)
        remember(rec_id, item.name)
        items.append(Recommendation(id=rec_id, name=item.name, category=item.category, price_min=item.price_min, price_max=item.price_max, reason=item.reason))
    if not items:
        raise AiUnavailable("no usable items")
    return items
