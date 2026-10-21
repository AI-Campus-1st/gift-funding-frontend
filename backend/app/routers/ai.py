"""R1 AI 선물 추천 API (docs/backend/API.SPEC.md 9장) — Gemini (키가 없으면 모의 추천)"""

from fastapi import APIRouter, Depends

from app.models import User
from app.schemas.ai import AiRecommendationListDto, AiRecommendationRequest
from app.security import get_current_user
from app.services import ai as service

router = APIRouter(tags=["AI 선물 추천"])


@router.post("/ai/recommendations", response_model=AiRecommendationListDto, summary="R1 AI 선물 추천 (Gemini, 키가 없으면 모의)")
def recommend(req: AiRecommendationRequest, user: User = Depends(get_current_user)) -> AiRecommendationListDto:
    return service.recommend(req, user.id)
