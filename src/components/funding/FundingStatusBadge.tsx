import { Badge } from "@/components/ui/badge";
import { FUNDING_STATUS_LABEL } from "@/lib/format";
import type { FundingStatus } from "@/types";

/** 펀딩 상태 배지: 예정 / 진행 중 / 종료 */
export function FundingStatusBadge({ status }: { status: FundingStatus }) {
  const tone = status === "active" ? "pink" : status === "scheduled" ? "info" : "neutral";
  return <Badge tone={tone}>{FUNDING_STATUS_LABEL[status]}</Badge>;
}
