"""요청 · 응답 형식 — docs/backend/API.SPEC.md 2.6 · 9장 (snake_case)"""

from pydantic import BaseModel


class AiRecommendationRequest(BaseModel):
    keywords: list[str] = []
    categories: list[str] = []
    budget_min: int | None = None
    budget_max: int | None = None
    exclude_ids: list[str] = []  # "다시 추천받기" 때 이전 결과 ID → 다른 후보 우선


class AiRecommendationDto(BaseModel):
    id: str
    name: str
    reason: str
    category: str
    price_min: int
    price_max: int


class AiRecommendationListDto(BaseModel):
    items: list[AiRecommendationDto]
