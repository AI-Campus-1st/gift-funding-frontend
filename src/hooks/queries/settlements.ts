/**
 * 목표 미달 처리 · 정산 데이터 훅 (F-11 · F-12) — 모의 정산
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyShortfall, getSettlementOverview, requestSettlement } from "@/lib/api/settlements";
import type { SettlementRequest, ShortfallAction } from "@/types";
import { queryKeys } from "../queryKeys";

/** 정산 현황 — 처리 중인 정산이 있으면 3초마다 다시 불러와 상태 변화(처리 중 → 완료 / 실패)를 보여준다 */
export function useSettlementQuery(fundingId: string) {
  return useQuery({
    queryKey: queryKeys.settlement(fundingId),
    queryFn: () => getSettlementOverview(fundingId),
    refetchInterval: (query) => (query.state.data?.history.some((h) => h.status === "requested" || h.status === "processing") ? 3_000 : false),
  });
}

export function useApplyShortfallMutation(fundingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ giftId, action }: { giftId: string; action: ShortfallAction }) => applyShortfall(fundingId, giftId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fundings.myDetail(fundingId) });
      qc.invalidateQueries({ queryKey: queryKeys.fundings.mine, exact: true });
      qc.invalidateQueries({ queryKey: queryKeys.settlement(fundingId) });
      qc.invalidateQueries({ queryKey: queryKeys.carryovers.all });
    },
  });
}

export function useRequestSettlementMutation(fundingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: SettlementRequest) => requestSettlement(fundingId, request),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settlement(fundingId) });
      qc.invalidateQueries({ queryKey: queryKeys.fundings.myDetail(fundingId) });
    },
  });
}
