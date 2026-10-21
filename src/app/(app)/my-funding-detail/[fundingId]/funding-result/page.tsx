"use client";

/**
 * UI-22 펀딩 종료 결과 (/my-funding-detail/[fundingId]/funding-result) — 생일자 전용
 * - 선물별 목표 금액 · 실제 모금액 · 달성 여부 · 종료일
 * - 정산이 끝나면 펀딩 · 선물에 "정산됨" 배지 (진행 중이면 "정산 진행 중")
 * - 목표 미달 선물이 남아 있으면 "목표 미달 처리"(UI-23), 정산은 "정산 관리"(UI-24)
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { AsyncBoundary } from "@/components/common/StateViews";
import { InlineAlert } from "@/components/common/FormField";
import { FundingProgress } from "@/components/funding/FundingProgress";
import { SettlementStateBadge } from "@/components/funding/SettlementStateBadge";
import { ShortfallBadge } from "@/components/funding/ShortfallBadge";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { formatDate, formatWon } from "@/lib/format";
import { useMyFundingQuery } from "@/hooks/queries/fundings";
import { withFreshState } from "@/lib/withFreshState";

function FundingResultPage() {
  const { fundingId } = useParams<{ fundingId: string }>();
  const state = useMyFundingQuery(fundingId);

  return (
    <Screen title="펀딩 종료 결과" backHref={`/my-funding-detail/${fundingId}`}>
      <AsyncBoundary state={state} deniedBackHref="/my-funding">
        {(funding) => {
          if (funding.status !== "ended") {
            return <InlineAlert tone="info">펀딩이 {formatDate(funding.endDate)}에 종료된 뒤 결과를 확인할 수 있어요.</InlineAlert>;
          }
          const pending = funding.gifts.filter((g) => g.achievementRate < 100 && g.raisedAmount > 0 && !g.shortfallAction);
          return (
            <>
              <RetroWindow title="result.exe" tone="lavender">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-display-md text-ink">{funding.name}</p>
                  <SettlementStateBadge funding={funding} />
                </div>
                <p className="mt-1 text-body-sm text-muted">{formatDate(funding.endDate)} 종료</p>
                <p className="mt-3 text-body-sm text-body">
                  전체 모금액 <strong className="text-title-md tabular-nums text-ink">{formatWon(funding.totalRaised)}</strong>
                </p>
              </RetroWindow>

              {pending.length > 0 && (
                <InlineAlert tone="warning">목표에 도달하지 못한 선물이 {pending.length}개 있어요. 이월 또는 인출 중 하나를 선택해 주세요.</InlineAlert>
              )}

              <ul className="flex flex-col gap-3">
                {funding.gifts.map((gift) => (
                  <li key={gift.id} className="rounded-xs border-2 border-line bg-surface p-3.5 shadow-window">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-title-sm text-ink">{gift.name}</h3>
                      <ShortfallBadge gift={gift} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-body-sm">
                      <div>
                        <dt className="text-caption text-muted">목표 금액</dt>
                        <dd className="tabular-nums text-ink">{formatWon(gift.price)}</dd>
                      </div>
                      <div>
                        <dt className="text-caption text-muted">실제 모금액</dt>
                        <dd className="font-bold tabular-nums text-ink">{formatWon(gift.raisedAmount)}</dd>
                      </div>
                    </dl>
                    <div className="mt-2">
                      <FundingProgress rate={gift.achievementRate} label={`${gift.name} 달성률`} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-2">
                {pending.length > 0 && (
                  <Button asChild block>
                    <Link href={`/my-funding-detail/${funding.id}/unmet-goal`}>목표 미달 처리</Link>
                  </Button>
                )}
                <Button asChild variant={pending.length > 0 ? "secondary" : "primary"} block>
                  <Link href={`/my-funding-detail/${funding.id}/settlement`}>정산 관리</Link>
                </Button>
                <Button asChild variant="tertiary" block size="md">
                  <Link href="/my-funding">내 펀딩으로</Link>
                </Button>
              </div>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(FundingResultPage);
