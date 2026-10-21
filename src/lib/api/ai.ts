/**
 * AI 선물 추천 API (API_SPEC 3.7, F-03)
 *
 * 서버가 OpenAI 를 호출하고(API 키는 서버에만 보관) 응답 형식을 검증한 뒤 돌려준다. (지금은 Mock 추천)
 * 추천 결과는 참고용이며, 자동으로 선물이 등록되지 않는다.
 */
import type { AiRecommendation, AiRecommendationRequest } from "@/types";
import type { AiRecommendationListDto } from "./dto";
import { http } from "./http";
import { fromDto, toDto } from "./mappers";

/**
 * R1 추천 요청
 * @param excludeIds 이전에 보여준 추천 ID — "다시 추천받기" 시 다른 후보를 우선 보여준다.
 */
export async function recommendGifts(request: AiRecommendationRequest, excludeIds: string[] = []): Promise<AiRecommendation[]> {
  const res = await http.post<AiRecommendationListDto>("/ai/recommendations", { ...toDto(request), exclude_ids: excludeIds });
  return fromDto<AiRecommendation[]>(res.items);
}
