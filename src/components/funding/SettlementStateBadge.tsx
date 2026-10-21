/**
 * SettlementStateBadge — 종료된 펀딩 전체의 정산 상태
 *
 * 정산 대상 선물 = 모금액이 있고, 목표를 달성했거나 "현재 모금액 인출"을 고른 선물 (이월 선물 제외)
 * - 정산 대상이 모두 정산 완료 → "정산됨"
 * - 하나라도 정산 요청 · 처리 중 → "정산 진행 중"
 * - 일부만 정산 완료 → "일부 정산됨"
 * - 그 밖(정산 전, 정산 대상 없음) → 배지 없음
 */
import { Badge } from "@/components/ui/badge";
import type { OwnerFundingView, OwnerGiftView } from "@/types";

export type FundingSettlementState = "settled" | "in-progress" | "partial" | null;

function isSettlementTarget(g: OwnerGiftView): boolean {
  return g.raisedAmount > 0 && g.shortfallAction !== "carryover" && (g.achievementRate >= 100 || g.shortfallAction === "withdraw");
}

export function getFundingSettlementState(funding: OwnerFundingView): FundingSettlementState {
  if (funding.status !== "ended") return null;
  const targets = funding.gifts.filter(isSettlementTarget);
  if (targets.length === 0) return null;
  if (targets.some((g) => g.settlementStatus === "requested" || g.settlementStatus === "processing")) return "in-progress";
  const done = targets.filter((g) => g.settlementStatus === "completed").length;
  if (done === targets.length) return "settled";
  return done > 0 ? "partial" : null;
}

const LABEL = {
  settled: { text: "정산됨", tone: "success" },
  "in-progress": { text: "정산 진행 중", tone: "info" },
  partial: { text: "일부 정산됨", tone: "warning" },
} as const;

export function SettlementStateBadge({ funding }: { funding: OwnerFundingView }) {
  const state = getFundingSettlementState(funding);
  if (!state) return null;
  return <Badge tone={LABEL[state].tone}>{LABEL[state].text}</Badge>;
}
