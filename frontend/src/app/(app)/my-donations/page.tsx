"use client";

/**
 * UI-21 내 후원 내역 (/my-donations, /my-donations?fundingId=...)
 * - 로그인 사용자 본인의 후원만 표시 (같은 선물에 여러 번 후원하면 각각 표시)
 * - 친구 펀딩 상세에서 들어오면 해당 펀딩의 내역만 보여준다.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { MockBadge } from "@/components/common/MockNotice";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatWon } from "@/lib/format";
import { useMyDonationsQuery } from "@/hooks/queries/donations";
import { withFreshState } from "@/lib/withFreshState";

function MyDonationsPage() {
  const fundingId = useSearchParams().get("fundingId") ?? undefined;
  const state = useMyDonationsQuery(fundingId);

  return (
    <Screen title="내 후원 내역" backHref={fundingId ? `/friend-funding-detail/${fundingId}` : "/friend-funding"}>
      <AsyncBoundary state={state}>
        {(donations) => {
          if (donations.length === 0) {
            return (
              <EmptyState
                message="아직 후원한 내역이 없어요."
                action={
                  <Button asChild size="md">
                    <Link href="/friend-funding">친구 펀딩 보러 가기</Link>
                  </Button>
                }
              />
            );
          }
          const total = donations.reduce((s, d) => s + d.amount, 0);
          return (
            <>
              <div className="flex items-center justify-between rounded-sm border-2 border-line bg-surface-soft px-4 py-3">
                <div>
                  <p className="text-caption text-muted">{fundingId ? `${donations[0].fundingName} 후원 합계` : "내 후원 합계"}</p>
                  <p className="text-display-md tabular-nums text-ink">{formatWon(total)}</p>
                </div>
                <MockBadge label="모의 후원" />
              </div>
              <ul className="flex flex-col gap-3">
                {donations.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/friend-funding-detail/${d.fundingId}`}
                      className="flex items-center gap-3 rounded-xs border-2 border-line bg-surface p-3.5 shadow-window hover:shadow-window-hover"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-caption text-muted">
                          {d.ownerName}님 · {d.fundingName}
                        </p>
                        <p className="truncate text-title-sm text-ink">{d.giftName}</p>
                        <p className="mt-0.5 text-caption font-normal text-muted">{formatDateTime(d.createdAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-title-sm tabular-nums text-ink">{formatWon(d.amount)}</span>
                        <Badge tone="success">후원 완료</Badge>
                      </div>
                      <ChevronRight className="size-4 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(MyDonationsPage);
