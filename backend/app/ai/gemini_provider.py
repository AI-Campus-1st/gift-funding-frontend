"""
Gemini AI 추천 (2026-10-20 확정: Gemini 무료 모델, 네이버 쇼핑은 나중에)

- REST API 를 httpx 로 직접 부른다 (SDK 없음). 키는 서버 .env 의 GEMINI_API_KEY 에만 둔다.
- 보내는 것: 관심사 · 카테고리 · 예산만 (이름 · 이메일 등 개인정보 없음).
- 응답은 JSON 스키마(responseSchema)로 형식을 강제하고, 받은 뒤 Pydantic 으로 한 번 더 검사한다.
- 15초 안에 답이 없거나 형식이 틀리면 1번만 다시 시도 → 그래도 안 되면 AiUnavailable (Q22).
"""

import json
import logging

import httpx
from pydantic import ValidationError

from app.ai.common import CATEGORIES, AiUnavailable, Answer, build_prompt, names_of, to_recommendations
from app.ai.mock_provider import Recommendation

log = logging.getLogger("uvicorn.error")  # docker compose logs backend 에 보인다 (키는 남기지 않음)

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "items": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "name": {"type": "STRING", "description": "브랜드 + 제품명 (예: '조말론 우드 세이지 앤 씨 솔트 코롱 30ml')"},
                    "reason": {"type": "STRING", "description": "추천 이유 한두 문장, 한국어 존댓말"},
                    "category": {"type": "STRING", "enum": CATEGORIES},
                    "price_min": {"type": "INTEGER", "description": "예상 최저 가격 (원)"},
                    "price_max": {"type": "INTEGER", "description": "예상 최고 가격 (원)"},
                },
                "required": ["name", "reason", "category", "price_min", "price_max"],
                "propertyOrdering": ["name", "reason", "category", "price_min", "price_max"],
            },
        }
    },
    "required": ["items"],
}

def _call_once(client: httpx.Client, url: str, api_key: str, body: dict) -> Answer:
    res = client.post(url, headers={"x-goog-api-key": api_key}, json=body)
    if res.status_code != 200:
        # 400 · 403 · 404 같은 요청 문제는 다시 보내도 같다 → 재시도하지 않는다 (429 · 5xx 는 재시도)
        retryable = res.status_code == 429 or res.status_code >= 500
        raise AiUnavailable(f"gemini status {res.status_code}: {res.text[:300]}", retryable=retryable)
    data = res.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return Answer.model_validate(json.loads(text))
    except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as e:
        raise AiUnavailable(f"gemini format error: {e}") from None


def recommend(
    keywords: list[str],
    categories: list[str],
    budget_min: int | None,
    budget_max: int | None,
    exclude_ids: list[str],
    *,
    api_key: str,
    model: str,
    timeout_seconds: float = 15.0,
    transport: httpx.BaseTransport | None = None,  # 테스트에서 가짜 응답을 넣을 때
) -> list[Recommendation]:
    body = {
        "contents": [{"role": "user", "parts": [{"text": build_prompt(keywords, categories, budget_min, budget_max, names_of(exclude_ids))}]}],
        "generationConfig": {"responseMimeType": "application/json", "responseSchema": RESPONSE_SCHEMA, "temperature": 0.9},
    }
    url = API_URL.format(model=model.removeprefix("models/"))
    last_error: Exception | None = None
    with httpx.Client(timeout=timeout_seconds, transport=transport) as client:
        answer: Answer | None = None
        for _ in range(2):  # 처음 + 재시도 1번 (Q22)
            try:
                answer = _call_once(client, url, api_key, body)
                break
            except (httpx.HTTPError, AiUnavailable) as e:
                last_error = e
                log.warning("Gemini 추천 실패 (%s): %s", type(e).__name__, str(e)[:300])
                if isinstance(e, AiUnavailable) and not e.retryable:
                    break
        if answer is None:
            raise AiUnavailable(str(last_error))

    return to_recommendations(answer, categories)
