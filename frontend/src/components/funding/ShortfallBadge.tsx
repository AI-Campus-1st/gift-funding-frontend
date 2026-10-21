/** ShortfallBadge — 종료된 선물의 처리 상태 (정산됨 / 정산 진행 중 / 목표 달성 / 이월 / 인출 / 처리 필요 / 종료됨) */
import { Badge } from "@/components/ui/badge";
import type { OwnerGiftView } from "@/types";

export function ShortfallBadge({ gift }: { gift: OwnerGiftView }) {
  if (gift.settlementStatus === "completed") return <Badge tone="success">정산됨</Badge>;
  if (gift.settlementStatus === "requested" || gift.settlementStatus === "processing") return <Badge tone="info">정산 진행 중</Badge>;
  if (gift.achievementRate >= 100) return <Badge tone="success">목표 달성</Badge>;
  if (gift.shortfallAction === "carryover") return <Badge tone="info">다음 생일로 이월</Badge>;
  if (gift.shortfallAction === "withdraw") return <Badge tone="pink">현재 모금액 인출</Badge>;
  // 모금액이 0원인 미달 선물은 처리할 금액이 없어 그대로 끝난다 (FEATURE_SPEC F-11, 2026-10-16 확정)
  if (gift.raisedAmount === 0) return <Badge tone="neutral">종료됨</Badge>;
  return <Badge tone="warning">목표 미달 · 처리 필요</Badge>;
}
