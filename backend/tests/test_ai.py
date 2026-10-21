"""AI 선물 추천 (R1) — docs/backend/API.SPEC.md 9장 (모의 추천)"""

import random

from app.ai.mock_provider import CANDIDATES, recommend
from tests.conftest import API, token_of


def ask(client, headers, **body):
    return client.post(f"{API}/ai/recommendations", headers=headers, json=body)


def test_requires_login(client):
    assert ask(client, {}, keywords=["캠핑"]).status_code == 401


def test_requires_at_least_one_condition(client):
    res = ask(client, token_of(client, "seoyeon@example.com"), keywords=[], categories=[], budget_min=None, budget_max=None)
    assert res.status_code == 400 and res.json()["message"] == "관심사, 카테고리, 예산 중 하나 이상 입력해 주세요."


def test_returns_four_items_with_matching_keywords_first(client):
    res = ask(client, token_of(client, "seoyeon@example.com"), keywords=["캠핑"])
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 4
    assert set(items[0]) == {"id", "name", "reason", "category", "price_min", "price_max"}
    # 캠핑 태그 후보는 5개 → 위 4개는 모두 캠핑 관련, 이유에 관심사가 나온다
    camping = {c.id for c in CANDIDATES if "캠핑" in c.tags}
    assert all(i["id"] in camping for i in items)
    assert all(i["reason"].startswith("'캠핑' 관심사와 잘 맞아요.") for i in items)


def test_budget_and_category_filters():
    for _ in range(20):
        items = recommend([], ["리빙"], 40000, 60000, [])
        assert items and all(i.category == "리빙" and i.price_max >= 40000 and i.price_min <= 60000 for i in items)
    assert recommend([], ["없는 카테고리"], None, None, []) == []
    assert len(recommend([], [], None, 10000, [])) == 0  # 1만 원 이하 후보 없음


def test_retry_prefers_new_candidates():
    rng = random.Random(1)
    first = recommend(["음악"], [], None, None, [], rng)
    again = recommend(["음악"], [], None, None, [i.id for i in first], rng)
    assert len(again) == 4 and not {i.id for i in first} & {i.id for i in again}


# ───────── Gemini (가짜 응답으로 확인 — 실제 호출 없음) ─────────

import json as _json

import httpx
import pytest

from app.ai import gemini_provider
from app.config import get_settings


def _gemini_reply(items):
    return {"candidates": [{"content": {"parts": [{"text": _json.dumps({"items": items})}]}}]}


GOOD = [
    {"name": "캠핑 랜턴", "reason": "캠핑을 좋아하시니 밤을 밝혀 줄 거예요.", "category": "스포츠·아웃도어", "price_min": 30000, "price_max": 80000},
    {"name": "블루투스 스피커", "reason": "음악과 캠핑을 함께 즐길 수 있어요.", "category": "전자기기", "price_min": 50000, "price_max": 150000},
    {"name": "보온 텀블러", "reason": "야외에서 따뜻한 음료를 즐겨요.", "category": "리빙", "price_min": 20000, "price_max": 50000},
    {"name": "접이식 의자", "reason": "캠핑장에서 편하게 쉬어요.", "category": "스포츠·아웃도어", "price_min": 40000, "price_max": 120000},
]


def _transport(*responses):
    calls = []

    def handler(request: httpx.Request):
        calls.append(_json.loads(request.content))
        r = responses[min(len(calls) - 1, len(responses) - 1)]
        if isinstance(r, Exception):
            raise r
        return httpx.Response(r[0], json=r[1])

    return httpx.MockTransport(handler), calls


def _call(transport, **kw):
    args = dict(keywords=["캠핑"], categories=[], budget_min=None, budget_max=None, exclude_ids=[])
    args.update(kw)
    return gemini_provider.recommend(**args, api_key="test", model="models/gemini-3.8-flash", transport=transport)


def test_gemini_success_and_prompt_has_no_personal_info():
    transport, calls = _transport((200, _gemini_reply(GOOD)))
    items = _call(transport, budget_min=30000, budget_max=100000)
    assert [i.name for i in items] == ["캠핑 랜턴", "블루투스 스피커", "보온 텀블러", "접이식 의자"]
    assert all(i.id.startswith("ai_") for i in items)
    prompt = calls[0]["contents"][0]["parts"][0]["text"]
    assert "캠핑" in prompt and "30,000원" in prompt and "@" not in prompt
    assert calls[0]["generationConfig"]["responseMimeType"] == "application/json"
    # 다시 추천받기: 이전 결과 ID → 이름을 프롬프트에 "제외"로 넣는다
    transport2, calls2 = _transport((200, _gemini_reply(GOOD)))
    _call(transport2, exclude_ids=[items[0].id])
    assert "제외해요: 캠핑 랜턴" in calls2[0]["contents"][0]["parts"][0]["text"]


def test_gemini_retries_once_then_fails():
    bad = (200, {"candidates": [{"content": {"parts": [{"text": "not json"}]}}]})
    transport, calls = _transport(bad, (200, _gemini_reply(GOOD)))
    assert len(_call(transport)) == 4 and len(calls) == 2  # 형식 오류 → 1번 재시도 → 성공
    transport, calls = _transport(httpx.ReadTimeout("timeout"), (500, {}))
    with pytest.raises(gemini_provider.AiUnavailable):
        _call(transport)
    assert len(calls) == 2  # 처음 + 재시도 1번까지만
    transport, calls = _transport((404, {"error": {"message": "model not found"}}))
    with pytest.raises(gemini_provider.AiUnavailable):
        _call(transport)
    assert len(calls) == 1  # 404 같은 요청 문제는 다시 보내지 않는다
    wrong = [dict(GOOD[0], price_min=9, price_max=1)]  # 가격 범위가 뒤집힌 응답은 받지 않는다
    transport, _ = _transport((200, _gemini_reply(wrong)))
    with pytest.raises(gemini_provider.AiUnavailable):
        _call(transport)


def test_api_uses_gemini_when_key_set_and_limits_rate(client, monkeypatch):
    from app.services import ai as ai_service

    monkeypatch.setattr(get_settings(), "gemini_api_key", "test")
    monkeypatch.setattr(ai_service, "_calls", ai_service.defaultdict(ai_service.deque))
    transport, _ = _transport((200, _gemini_reply(GOOD)))
    real = gemini_provider.recommend
    monkeypatch.setattr(gemini_provider, "recommend", lambda *a, **k: real(*a, **{**k, "transport": transport}))
    headers = token_of(client, "jihoon@example.com")
    for _ in range(5):
        res = ask(client, headers, keywords=["캠핑"])
        assert res.status_code == 200 and res.json()["items"][0]["name"] == "캠핑 랜턴"
    limited = ask(client, headers, keywords=["캠핑"])
    assert limited.status_code == 429 and limited.json() == {"code": "RATE_LIMITED", "message": "잠시 후 다시 시도해 주세요."}
    # AI 실패 → 502
    monkeypatch.setattr(ai_service, "_calls", ai_service.defaultdict(ai_service.deque))
    fail, _ = _transport((500, {}))
    monkeypatch.setattr(gemini_provider, "recommend", lambda *a, **k: real(*a, **{**k, "transport": fail}))
    res = ask(client, headers, keywords=["캠핑"])
    assert res.status_code == 502 and res.json()["code"] == "AI_UNAVAILABLE"


# ───────── GPT (가짜 응답으로 확인 — 실제 호출 없음) ─────────

from app.ai import openai_provider


def _openai_reply(items):
    return {"choices": [{"message": {"role": "assistant", "content": _json.dumps({"items": items}), "refusal": None}}]}


def _gpt(transport, **kw):
    args = dict(keywords=["캠핑"], categories=[], budget_min=None, budget_max=None, exclude_ids=[])
    args.update(kw)
    return openai_provider.recommend(**args, api_key="test", model="gpt-test-mini", transport=transport)


def test_gpt_success_uses_strict_schema_and_no_personal_info():
    transport, calls = _transport((200, _openai_reply(GOOD)))
    items = _gpt(transport, categories=["스포츠·아웃도어"])
    assert [i.name for i in items] == ["캠핑 랜턴", "접이식 의자"]  # 고른 카테고리 밖은 뺀다
    body = calls[0]
    assert body["model"] == "gpt-test-mini"
    assert body["response_format"]["json_schema"]["strict"] is True
    prompt = body["messages"][1]["content"]
    assert "캠핑" in prompt and "스포츠·아웃도어" in prompt and "@" not in prompt
    assert "브랜드와 제품명" in prompt  # 종류가 아니라 구체적인 제품을 추천하게 한다 (2026-10-20)


def test_gpt_retry_rules():
    bad = (200, {"choices": [{"message": {"content": "not json"}}]})
    transport, calls = _transport(bad, (200, _openai_reply(GOOD)))
    assert len(_gpt(transport)) == 4 and len(calls) == 2  # 형식 오류 → 재시도 → 성공
    transport, calls = _transport((429, {"error": {"message": "rate"}}), (429, {}))
    with pytest.raises(openai_provider.AiUnavailable):
        _gpt(transport)
    assert len(calls) == 2  # 429 는 1번 재시도
    transport, calls = _transport((401, {"error": {"message": "bad key"}}))
    with pytest.raises(openai_provider.AiUnavailable):
        _gpt(transport)
    assert len(calls) == 1  # 키 문제는 재시도하지 않는다
    refusal = (200, {"choices": [{"message": {"content": None, "refusal": "no"}}]})
    transport, _ = _transport(refusal, refusal)
    with pytest.raises(openai_provider.AiUnavailable):
        _gpt(transport)


def test_api_prefers_gpt_when_both_keys(client, monkeypatch):
    from app.services import ai as ai_service

    monkeypatch.setattr(get_settings(), "openai_api_key", "test")
    monkeypatch.setattr(get_settings(), "gemini_api_key", "test")
    monkeypatch.setattr(ai_service, "_calls", ai_service.defaultdict(ai_service.deque))
    transport, calls = _transport((200, _openai_reply(GOOD)))
    real = openai_provider.recommend
    monkeypatch.setattr(openai_provider, "recommend", lambda *a, **k: real(*a, **{**k, "transport": transport}))
    res = ask(client, token_of(client, "mina@example.com"), keywords=["캠핑"])
    assert res.status_code == 200 and len(res.json()["items"]) == 4 and "messages" in calls[0]
