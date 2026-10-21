/**
 * Mock 서버 — AI 선물 추천 (API_SPEC 3.7, F-03)
 *
 * 실제 서비스에서는 FastAPI 가 OpenAI API 를 호출하고(API 키는 서버에만 보관), 응답 형식을 검증한 뒤 돌려준다.
 * Mock 은 미리 준비한 후보에서 관심사 · 카테고리 · 예산으로 점수를 매겨 추천한다. 추천은 참고용이며 자동 등록되지 않는다.
 */
import { ApiError } from "@/lib/api/client";
import type { AiRecommendation, AiRecommendationRequest } from "@/types";
import { bodyOf, requireUser, route, type MockContext } from "./context";

interface Candidate extends Omit<AiRecommendation, "reason"> {
  tags: string[];
  reasonTemplate: string;
}

const CANDIDATES: Candidate[] = [
  { id: "ai_headphone", name: "노이즈캔슬링 무선 헤드폰", category: "전자기기", priceMin: 250000, priceMax: 450000, tags: ["음악", "출퇴근", "여행"], reasonTemplate: "음악을 즐기고 이동이 잦다면 매일 쓰기 좋은 선물이에요." },
  { id: "ai_earbuds", name: "무선 이어폰", category: "전자기기", priceMin: 100000, priceMax: 300000, tags: ["음악", "운동", "출퇴근"], reasonTemplate: "가볍게 들고 다니며 음악과 통화를 즐길 수 있어요." },
  { id: "ai_speaker", name: "블루투스 미니 스피커", category: "전자기기", priceMin: 50000, priceMax: 150000, tags: ["음악", "캠핑", "홈파티"], reasonTemplate: "캠핑이나 홈파티 분위기를 살려줘요." },
  { id: "ai_camera", name: "즉석 카메라", category: "취미", priceMin: 90000, priceMax: 160000, tags: ["사진", "여행", "기록"], reasonTemplate: "추억을 바로 사진으로 남기는 재미가 있어요." },
  { id: "ai_lego", name: "꽃다발 블록 세트", category: "취미", priceMin: 50000, priceMax: 90000, tags: ["만들기", "인테리어", "꽃"], reasonTemplate: "조립하는 즐거움과 오래 두고 보는 장식을 함께 선물할 수 있어요." },
  { id: "ai_chair", name: "캠핑 릴렉스 체어", category: "스포츠·아웃도어", priceMin: 60000, priceMax: 180000, tags: ["캠핑", "피크닉", "여행"], reasonTemplate: "캠핑을 좋아한다면 가장 오래 쓰는 장비 중 하나예요." },
  { id: "ai_lantern", name: "감성 LED 랜턴", category: "스포츠·아웃도어", priceMin: 30000, priceMax: 80000, tags: ["캠핑", "인테리어", "조명"], reasonTemplate: "캠핑장과 방 안 모두에서 분위기를 만들어 줘요." },
  { id: "ai_shoes", name: "쿠셔닝 러닝화", category: "스포츠·아웃도어", priceMin: 100000, priceMax: 200000, tags: ["운동", "러닝", "건강"], reasonTemplate: "운동을 꾸준히 한다면 실용도가 아주 높아요." },
  { id: "ai_perfume", name: "플로럴 향수 50ml", category: "뷰티", priceMin: 80000, priceMax: 200000, tags: ["향수", "꽃", "데일리"], reasonTemplate: "취향에 맞는 향은 매일 기분 좋게 해 주는 선물이에요." },
  { id: "ai_diffuser", name: "프리미엄 디퓨저", category: "리빙", priceMin: 30000, priceMax: 90000, tags: ["향수", "인테리어", "휴식"], reasonTemplate: "집 안에 은은한 향을 더해 휴식에 도움을 줘요." },
  { id: "ai_moodlight", name: "레트로 무드등", category: "리빙", priceMin: 25000, priceMax: 60000, tags: ["인테리어", "조명", "레트로"], reasonTemplate: "부담 없는 가격으로 방 분위기를 바꿀 수 있어요." },
  { id: "ai_blanket", name: "극세사 담요", category: "리빙", priceMin: 20000, priceMax: 50000, tags: ["휴식", "캠핑", "겨울"], reasonTemplate: "쌀쌀한 계절에 꼭 필요한 포근한 선물이에요." },
  { id: "ai_wallet", name: "가죽 카드지갑", category: "패션·잡화", priceMin: 40000, priceMax: 150000, tags: ["데일리", "출퇴근", "패션"], reasonTemplate: "매일 들고 다니는 물건이라 자주 떠올려 줄 거예요." },
  { id: "ai_bag", name: "미니 크로스백", category: "패션·잡화", priceMin: 80000, priceMax: 300000, tags: ["패션", "여행", "데일리"], reasonTemplate: "가볍게 외출할 때 활용도가 높아요." },
  { id: "ai_books", name: "에세이 베스트셀러 세트", category: "도서", priceMin: 25000, priceMax: 60000, tags: ["독서", "휴식", "기록"], reasonTemplate: "조용히 쉬는 시간을 좋아한다면 마음에 들 거예요." },
  { id: "ai_ebook", name: "전자책 리더기", category: "전자기기", priceMin: 150000, priceMax: 350000, tags: ["독서", "출퇴근", "여행"], reasonTemplate: "책 여러 권을 가볍게 들고 다닐 수 있어요." },
  { id: "ai_coffee", name: "핸드드립 커피 세트", category: "식품", priceMin: 40000, priceMax: 120000, tags: ["커피", "휴식", "홈카페"], reasonTemplate: "집에서 카페처럼 커피를 즐길 수 있어요." },
  { id: "ai_dessert", name: "프리미엄 디저트 박스", category: "식품", priceMin: 30000, priceMax: 70000, tags: ["디저트", "홈파티", "기념일"], reasonTemplate: "생일 당일 함께 나눠 먹기 좋아요." },
  { id: "ai_console", name: "휴대용 게임기", category: "전자기기", priceMin: 350000, priceMax: 550000, tags: ["게임", "여행", "취미"], reasonTemplate: "여럿이 함께 마련하기 좋은 고가 선물이에요." },
  { id: "ai_watch", name: "스마트워치", category: "전자기기", priceMin: 300000, priceMax: 700000, tags: ["운동", "건강", "데일리"], reasonTemplate: "운동 기록과 알림을 손목에서 확인할 수 있어요." },
];

function overlapsBudget(c: Candidate, min: number | null, max: number | null): boolean {
  if (min !== null && c.priceMax < min) return false;
  if (max !== null && c.priceMin > max) return false;
  return true;
}

/** R1 추천 요청 — excludeIds: 이전에 보여준 추천 ID ("다시 추천받기" 시 다른 후보 우선) */
function recommendGifts(ctx: MockContext) {
  requireUser(ctx);
  const { excludeIds = [], ...request } = bodyOf<AiRecommendationRequest & { excludeIds: string[] }>(ctx);
  const hasCondition = request.keywords.length > 0 || request.categories.length > 0 || request.budgetMin !== null || request.budgetMax !== null;
  if (!hasCondition) {
    throw new ApiError("VALIDATION", "관심사, 카테고리, 예산 중 하나 이상 입력해 주세요.");
  }
  const keywords = request.keywords.map((k) => k.toLowerCase());
  const scored = CANDIDATES.filter((c) => overlapsBudget(c, request.budgetMin, request.budgetMax))
    .filter((c) => request.categories.length === 0 || request.categories.includes(c.category))
    .map((c) => {
      const matched = c.tags.filter((t) => keywords.some((k) => t.includes(k) || k.includes(t)));
      return { c, matched, score: matched.length * 2 + (excludeIds.includes(c.id) ? -10 : 0) + Math.random() };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const items: AiRecommendation[] = scored.map(({ c, matched }) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    priceMin: c.priceMin,
    priceMax: c.priceMax,
    reason: matched.length > 0 ? `'${matched.join("', '")}' 관심사와 잘 맞아요. ${c.reasonTemplate}` : c.reasonTemplate,
  }));
  return { items };
}

export const aiRoutes = [route("POST", "/ai/recommendations", recommendGifts, { delay: 900 })];
