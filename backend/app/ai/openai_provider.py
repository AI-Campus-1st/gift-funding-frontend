"""
GPT(OpenAI) AI 추천 (2026-10-20 확정: GPT API 사용 — Gemini 는 프로젝트 접근이 막혀 변경, 네이버 쇼핑은 나중에)

- Chat Completions API 를 httpx 로 직접 부른다 (SDK 없음). 키는 서버 .env 의 OPENAI_API_KEY 에만 둔다.
- 보내는 것: 관심사 · 카테고리 · 예산만 (이름 · 이메일 등 개인정보 없음).
- Structured Outputs(json_schema, strict)로 형식을 강제하고, 받은 뒤 Pydantic 으로 한 번 더 검사한다 (Q21).
- 15초 안에 답이 없거나 형식이 틀리면 1번만 다시 시도 → 그래도 안 되면 AiUnavailable (Q22).
  400 · 401 · 403 · 404 같은 요청 문제는 다시 보내도 같아서 재시도하지 않는다 (429 · 5xx 는 재시도).
"""

import json
import logging

import httpx
from pydantic import ValidationError

from app.ai.common import CATEGORIES, AiUnavailable, Answer, build_prompt, names_of, to_recommendations
from app.ai.mock_provider import Recommendation

log = logging.getLogger("uvicorn.error")  # docker compose logs backend 에 보인다 (키는 남기지 않음)

API_URL = "https://api.openai.com/v1/chat/completions"

SYSTEM_PROMPT = "당신은 한국 사용자를 위한 생일 선물 추천 도우미예요. 요청한 JSON 형식으로만 답해요."

# strict 모드: 모든 필드 필수 + 정의하지 않은 필드 금지
RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "gift_recommendations",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "브랜드 + 제품명 (예: '조말론 우드 세이지 앤 씨 솔트 코롱 30ml')"},
                            "reason": {"type": "string", "description": "추천 이유 한두 문장, 한국어 존댓말"},
                            "category": {"type": "string", "enum": CATEGORIES},
                            "price_min": {"type": "integer", "description": "예상 최저 가격 (원)"},
                            "price_max": {"type": "integer", "description": "예상 최고 가격 (원)"},
                        },
                        "required": ["name", "reason", "category", "price_min", "price_max"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["items"],
            "additionalProperties": False,
        },
    },
}


def _call_once(client: httpx.Client, api_key: str, body: dict) -> Answer:
    res = client.post(API_URL, headers={"Authorization": f"Bearer {api_key}"}, json=body)
    if res.status_code != 200:
        retryable = res.status_code == 429 or res.status_code >= 500
        raise AiUnavailable(f"openai status {res.status_code}: {res.text[:300]}", retryable=retryable)
    try:
        message = res.json()["choices"][0]["message"]
        if message.get("refusal"):
            raise AiUnavailable(f"openai refusal: {message['refusal'][:200]}")
        return Answer.model_validate(json.loads(message["content"]))
    except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as e:
        raise AiUnavailable(f"openai format error: {e}") from None


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
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(keywords, categories, budget_min, budget_max, names_of(exclude_ids))},
        ],
        "response_format": RESPONSE_FORMAT,
    }
    last_error: Exception | None = None
    answer: Answer | None = None
    with httpx.Client(timeout=timeout_seconds, transport=transport) as client:
        for _ in range(2):  # 처음 + 재시도 1번 (Q22)
            try:
                answer = _call_once(client, api_key, body)
                break
            except (httpx.HTTPError, AiUnavailable) as e:
                last_error = e
                log.warning("GPT 추천 실패 (%s): %s", type(e).__name__, str(e)[:300])
                if isinstance(e, AiUnavailable) and not e.retryable:
                    break
    if answer is None:
        raise AiUnavailable(str(last_error))
    return to_recommendations(answer, categories)
