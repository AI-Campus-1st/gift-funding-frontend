/**
 * AI 선물 추천 훅 (F-03) — 사용자가 버튼을 눌러 요청하므로 mutation 으로 다룬다 (캐시하지 않음)
 */
import { useMutation } from "@tanstack/react-query";
import { recommendGifts } from "@/lib/api/ai";
import type { AiRecommendationRequest } from "@/types";

export function useRecommendGiftsMutation() {
  return useMutation({
    mutationFn: ({ request, excludeIds }: { request: AiRecommendationRequest; excludeIds: string[] }) => recommendGifts(request, excludeIds),
  });
}
