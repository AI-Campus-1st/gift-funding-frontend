"""
모의 AI 추천 — 프론트 Mock(frontend/src/lib/mock/handlers/ai.ts)과 같은 후보 · 같은 점수 규칙

📌 AI 방향 (2026-10-19 확정): 지금은 준비된 후보에서 고르는 방식. 나중에 Gemini 무료 API + 네이버 쇼핑 검색으로 바꾼다.
바꿀 때는 이 파일과 같은 모양의 recommend(...) 함수를 새로 만들고 services/ai.py 에서 그 함수를 부르면 된다.
(모델 · 대기 시간 · 재시도 · 요청 횟수 제한은 연결할 때 정한다 — ❓ Q21 ~ Q24)
"""

import random
from dataclasses import dataclass

RECOMMEND_COUNT = 4  # Q23 확정값과 같음 (화면 UI-11 이 4개 기준)


@dataclass(frozen=True)
class Candidate:
    id: str
    name: str
    category: str
    price_min: int
    price_max: int
    tags: tuple[str, ...]
    reason: str


@dataclass(frozen=True)
class Recommendation:
    id: str
    name: str
    category: str
    price_min: int
    price_max: int
    reason: str


CANDIDATES: tuple[Candidate, ...] = (
    Candidate("ai_headphone", "노이즈캔슬링 무선 헤드폰", "전자기기", 250000, 450000, ("음악", "출퇴근", "여행"), "음악을 즐기고 이동이 잦다면 매일 쓰기 좋은 선물이에요."),
    Candidate("ai_earbuds", "무선 이어폰", "전자기기", 100000, 300000, ("음악", "운동", "출퇴근"), "가볍게 들고 다니며 음악과 통화를 즐길 수 있어요."),
    Candidate("ai_speaker", "블루투스 미니 스피커", "전자기기", 50000, 150000, ("음악", "캠핑", "홈파티"), "캠핑이나 홈파티 분위기를 살려줘요."),
    Candidate("ai_camera", "즉석 카메라", "취미", 90000, 160000, ("사진", "여행", "기록"), "추억을 바로 사진으로 남기는 재미가 있어요."),
    Candidate("ai_lego", "꽃다발 블록 세트", "취미", 50000, 90000, ("만들기", "인테리어", "꽃"), "조립하는 즐거움과 오래 두고 보는 장식을 함께 선물할 수 있어요."),
    Candidate("ai_chair", "캠핑 릴렉스 체어", "스포츠·아웃도어", 60000, 180000, ("캠핑", "피크닉", "여행"), "캠핑을 좋아한다면 가장 오래 쓰는 장비 중 하나예요."),
    Candidate("ai_lantern", "감성 LED 랜턴", "스포츠·아웃도어", 30000, 80000, ("캠핑", "인테리어", "조명"), "캠핑장과 방 안 모두에서 분위기를 만들어 줘요."),
    Candidate("ai_shoes", "쿠셔닝 러닝화", "스포츠·아웃도어", 100000, 200000, ("운동", "러닝", "건강"), "운동을 꾸준히 한다면 실용도가 아주 높아요."),
    Candidate("ai_perfume", "플로럴 향수 50ml", "뷰티", 80000, 200000, ("향수", "꽃", "데일리"), "취향에 맞는 향은 매일 기분 좋게 해 주는 선물이에요."),
    Candidate("ai_diffuser", "프리미엄 디퓨저", "리빙", 30000, 90000, ("향수", "인테리어", "휴식"), "집 안에 은은한 향을 더해 휴식에 도움을 줘요."),
    Candidate("ai_moodlight", "레트로 무드등", "리빙", 25000, 60000, ("인테리어", "조명", "레트로"), "부담 없는 가격으로 방 분위기를 바꿀 수 있어요."),
    Candidate("ai_blanket", "극세사 담요", "리빙", 20000, 50000, ("휴식", "캠핑", "겨울"), "쌀쌀한 계절에 꼭 필요한 포근한 선물이에요."),
    Candidate("ai_wallet", "가죽 카드지갑", "패션·잡화", 40000, 150000, ("데일리", "출퇴근", "패션"), "매일 들고 다니는 물건이라 자주 떠올려 줄 거예요."),
    Candidate("ai_bag", "미니 크로스백", "패션·잡화", 80000, 300000, ("패션", "여행", "데일리"), "가볍게 외출할 때 활용도가 높아요."),
    Candidate("ai_books", "에세이 베스트셀러 세트", "도서", 25000, 60000, ("독서", "휴식", "기록"), "조용히 쉬는 시간을 좋아한다면 마음에 들 거예요."),
    Candidate("ai_ebook", "전자책 리더기", "전자기기", 150000, 350000, ("독서", "출퇴근", "여행"), "책 여러 권을 가볍게 들고 다닐 수 있어요."),
    Candidate("ai_coffee", "핸드드립 커피 세트", "식품", 40000, 120000, ("커피", "휴식", "홈카페"), "집에서 카페처럼 커피를 즐길 수 있어요."),
    Candidate("ai_dessert", "프리미엄 디저트 박스", "식품", 30000, 70000, ("디저트", "홈파티", "기념일"), "생일 당일 함께 나눠 먹기 좋아요."),
    Candidate("ai_console", "휴대용 게임기", "전자기기", 350000, 550000, ("게임", "여행", "취미"), "여럿이 함께 마련하기 좋은 고가 선물이에요."),
    Candidate("ai_watch", "스마트워치", "전자기기", 300000, 700000, ("운동", "건강", "데일리"), "운동 기록과 알림을 손목에서 확인할 수 있어요."),
)


def _overlaps_budget(c: Candidate, budget_min: int | None, budget_max: int | None) -> bool:
    if budget_min is not None and c.price_max < budget_min:
        return False
    if budget_max is not None and c.price_min > budget_max:
        return False
    return True


def _reason(c: Candidate, matched: list[str]) -> str:
    if not matched:
        return c.reason
    joined = "', '".join(matched)
    return f"'{joined}' 관심사와 잘 맞아요. {c.reason}"


def recommend(
    keywords: list[str], categories: list[str], budget_min: int | None, budget_max: int | None, exclude_ids: list[str], rng: random.Random | None = None
) -> list[Recommendation]:
    """예산 · 카테고리로 거른 뒤, 관심사와 맞는 태그 수(×2) - 이전 추천(-10) + 무작위(0~1) 점수 순으로 4개"""
    rng = rng or random.Random()
    lowered = [k.lower() for k in keywords]
    scored = []
    for c in CANDIDATES:
        if not _overlaps_budget(c, budget_min, budget_max):
            continue
        if categories and c.category not in categories:
            continue
        matched = [t for t in c.tags if any(t in k or k in t for k in lowered)]
        score = len(matched) * 2 + (-10 if c.id in exclude_ids else 0) + rng.random()
        scored.append((score, c, matched))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        Recommendation(
            id=c.id,
            name=c.name,
            category=c.category,
            price_min=c.price_min,
            price_max=c.price_max,
            reason=_reason(c, matched),
        )
        for _, c, matched in scored[:RECOMMEND_COUNT]
    ]
