/**
 * FundingInfo — 펀딩 상세 화면 상단 요약 (펀딩 이름 · 생일자 · 그룹 · 기간 · 남은 기간 · 상태)
 * 사용 위치: 친구 펀딩 상세(UI-18), 내 펀딩 상세(UI-12)
 */
import { formatPeriod, formatRemainingPeriod } from "@/lib/format";
import type { FundingBase } from "@/types";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { FundingStatusBadge } from "./FundingStatusBadge";

export function FundingInfo({ funding, tone = "pink" }: { funding: FundingBase; tone?: "pink" | "sky" | "lavender" }) {
  return (
    <RetroWindow title="funding_info.exe" tone={tone}>
      <div className="flex flex-wrap items-center gap-2">
        <FundingStatusBadge status={funding.status} />
        {funding.status !== "ended" && <span className="text-caption text-warning">{formatRemainingPeriod(funding.endDate)}</span>}
      </div>
      <p className="mt-2 text-display-md text-ink">{funding.name}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-sm">
        <dt className="text-muted">생일자</dt>
        <dd className="font-semibold text-ink">{funding.ownerName}</dd>
        <dt className="text-muted">그룹</dt>
        <dd className="text-ink">{funding.groupName}</dd>
        <dt className="text-muted">기간</dt>
        <dd className="text-ink">{formatPeriod(funding.startDate, funding.endDate)}</dd>
      </dl>
    </RetroWindow>
  );
}
