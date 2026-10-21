/**
 * 펀딩 요약 카드
 * - MyFundingCard     : 내 펀딩(생일자) — 선물별 달성률 + 실제 모금액
 * - FriendFundingCard : 친구 펀딩(후원자) — 선물별 달성률 + 진행률 바만 (모금액 비공개)
 *
 * 여러 선물의 목표 금액을 하나로 합산하지 않는다는 정책(DEFINITION 5.3)에 따라
 * 펀딩 전체 달성률 대신 "선물별" 달성률을 나열한다.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate, formatPeriod, formatWon } from "@/lib/format";
import type { FriendFundingView, OwnerFundingView } from "@/types";
import { FundingProgress } from "./FundingProgress";
import { FundingStatusBadge } from "./FundingStatusBadge";
import { SettlementStateBadge } from "./SettlementStateBadge";

const MAX_GIFTS = 3;

function CardShell({ href, children, label }: { href: string; children: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="group block rounded-xs border-2 border-line bg-surface p-3.5 shadow-window transition-shadow hover:shadow-window-hover"
    >
      {children}
    </Link>
  );
}

export function MyFundingCard({ funding, compact }: { funding: OwnerFundingView; compact?: boolean }) {
  const gifts = funding.gifts.slice(0, MAX_GIFTS);
  return (
    <CardShell href={`/my-funding-detail/${funding.id}`} label={`${funding.name} 상세 보기`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <FundingStatusBadge status={funding.status} />
            <SettlementStateBadge funding={funding} />
            <span className="text-caption text-muted">{funding.groupName}</span>
          </div>
          <h3 className="truncate text-title-md text-ink">{funding.name}</h3>
          <p className="text-caption font-normal text-muted">
            {compact ? `${formatDate(funding.endDate)} 종료` : formatPeriod(funding.startDate, funding.endDate)}
          </p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted group-hover:text-ink" aria-hidden />
      </div>
      <p className="mt-2 text-body-sm text-body">
        전체 모금액 <strong className="tabular-nums text-ink">{formatWon(funding.totalRaised)}</strong>
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {gifts.map((g) => (
          <li key={g.id}>
            <div className="mb-0.5 flex justify-between gap-2 text-caption">
              <span className="truncate text-body">{g.name}</span>
              <span className="shrink-0 font-normal tabular-nums text-muted">
                {formatWon(g.raisedAmount)} / {formatWon(g.price)}
              </span>
            </div>
            <FundingProgress rate={g.achievementRate} label={`${g.name} 목표 달성률`} size="sm" />
          </li>
        ))}
      </ul>
      {funding.gifts.length > MAX_GIFTS && <p className="mt-1.5 text-caption text-muted">외 선물 {funding.gifts.length - MAX_GIFTS}개</p>}
    </CardShell>
  );
}

export function FriendFundingCard({ funding }: { funding: FriendFundingView }) {
  const gifts = funding.gifts.slice(0, MAX_GIFTS);
  return (
    <CardShell href={`/friend-funding-detail/${funding.id}`} label={`${funding.ownerName}님의 ${funding.name} 상세 보기`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <FundingStatusBadge status={funding.status} />
            <span className="text-caption text-muted">{funding.groupName}</span>
          </div>
          <h3 className="truncate text-title-md text-ink">{funding.name}</h3>
          <p className="text-body-sm text-body">
            생일자 <strong className="text-ink">{funding.ownerName}</strong>
          </p>
          <p className="text-caption font-normal text-muted">{formatPeriod(funding.startDate, funding.endDate)}</p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted group-hover:text-ink" aria-hidden />
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {gifts.map((g) => (
          <li key={g.id}>
            <p className="mb-0.5 truncate text-caption text-body">{g.name}</p>
            <FundingProgress rate={g.achievementRate} label={`${g.name} 목표 달성률`} size="sm" />
          </li>
        ))}
      </ul>
      {funding.gifts.length > MAX_GIFTS && <p className="mt-1.5 text-caption text-muted">외 선물 {funding.gifts.length - MAX_GIFTS}개</p>}
    </CardShell>
  );
}
