"""
AI 추천 연결 점검 (키는 화면에 나오지 않는다)

    docker compose exec backend python -m app.ai.check
"""

import time

from app.ai import gemini_provider, openai_provider
from app.ai.common import AiUnavailable
from app.config import get_settings


def main() -> None:
    s = get_settings()
    if s.openai_api_key:
        name, provider, key, model = "GPT", openai_provider, s.openai_api_key, s.openai_model
    elif s.gemini_api_key:
        name, provider, key, model = "Gemini", gemini_provider, s.gemini_api_key, s.gemini_model
    else:
        print("OPENAI_API_KEY · GEMINI_API_KEY 가 모두 비어 있어요 → 모의 추천으로 동작 중")
        return
    print(f"{name} · 모델: {model} · 시간 제한: {s.ai_timeout_seconds}초")
    started = time.monotonic()
    try:
        items = provider.recommend(["캠핑"], [], None, None, [], api_key=key, model=model, timeout_seconds=s.ai_timeout_seconds)
        print(f"성공 ({time.monotonic() - started:.1f}초)")
        for i in items:
            print(f"- {i.name} ({i.category}, {i.price_min:,}~{i.price_max:,}원): {i.reason}")
    except AiUnavailable as e:
        print(f"실패 ({time.monotonic() - started:.1f}초): {e}")


if __name__ == "__main__":
    main()
