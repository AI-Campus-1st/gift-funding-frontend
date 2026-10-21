"""
AI 선물 추천 서비스 (F-03 · docs/backend/API.SPEC.md 9장 · business-logic/03-gift-ai.md)

- 어떤 AI 를 쓸지: .env 에 OPENAI_API_KEY 가 있으면 GPT(app/ai/openai_provider.py, 2026-10-20 확정),
  없고 GEMINI_API_KEY 가 있으면 Gemini(app/ai/gemini_provider.py), 둘 다 없으면 모의 추천(app/ai/mock_provider.py).
- 추천 결과는 참고용이다. 저장하지 않고, 선물로 자동 등록하지 않는다.
- 조건(관심사 · 카테고리 · 예산)만 쓴다. 이름 · 이메일 등 개인정보는 넘기지 않는다.
- 요청 횟수 제한 (Q24): 실제 AI(GPT · Gemini)를 쓸 때만 1인당 1분 5회. 서버 메모리로 센다 (서버를 다시 켜면 초기화).
"""

import time
import uuid
from collections import defaultdict, deque
from threading import Lock

from app.ai import gemini_provider, mock_provider, openai_provider
from app.ai.common import AiUnavailable
from app.config import get_settings
from app.errors import ApiError
from app.schemas.ai import AiRecommendationDto, AiRecommendationListDto, AiRecommendationRequest

_calls: dict[uuid.UUID, deque[float]] = defaultdict(deque)
_calls_lock = Lock()


def _check_rate_limit(user_id: uuid.UUID, limit: int, now: float | None = None) -> None:
    now = time.monotonic() if now is None else now
    with _calls_lock:
        q = _calls[user_id]
        while q and now - q[0] >= 60:
            q.popleft()
        if len(q) >= limit:
            raise ApiError("RATE_LIMITED", "잠시 후 다시 시도해 주세요.")
        q.append(now)


def recommend(req: AiRecommendationRequest, user_id: uuid.UUID) -> AiRecommendationListDto:
    """R1 AI 선물 추천 — 조건이 하나도 없으면 400, AI 실패는 502, 너무 자주 요청하면 429"""
    has_condition = bool(req.keywords) or bool(req.categories) or req.budget_min is not None or req.budget_max is not None
    if not has_condition:
        raise ApiError("VALIDATION", "관심사, 카테고리, 예산 중 하나 이상 입력해 주세요.")

    settings = get_settings()
    args = (req.keywords, req.categories, req.budget_min, req.budget_max, req.exclude_ids)
    if settings.openai_api_key:
        provider, key, model = openai_provider, settings.openai_api_key, settings.openai_model
    elif settings.gemini_api_key:
        provider, key, model = gemini_provider, settings.gemini_api_key, settings.gemini_model
    else:
        provider = None

    if provider is None:
        items = mock_provider.recommend(*args)
    else:
        _check_rate_limit(user_id, settings.ai_rate_limit_per_minute)
        try:
            items = provider.recommend(*args, api_key=key, model=model, timeout_seconds=settings.ai_timeout_seconds)
        except AiUnavailable:
            raise ApiError("AI_UNAVAILABLE", "AI 추천을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.") from None

    return AiRecommendationListDto(
        items=[
            AiRecommendationDto(id=r.id, name=r.name, reason=r.reason, category=r.category, price_min=r.price_min, price_max=r.price_max) for r in items
        ]
    )
