"use client";

/**
 * UI-13 후원자 및 후원 내역 조회 (/my-funding-detail/[fundingId]/supporter-list) — 생일자 전용
 * - 후원자 이름 · 후원 선물 · 금액 · 일시, 선물 필터
 * - 서버가 생일자 여부를 확인하므로 다른 사람은 접근할 수 없다.
 */
import { useParams } from "next/navigation";
import { useState } from "react";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { Screen } from "@/components/layout/Screen";
import { NativeSelect, Label } from "@/components/ui/input";
import { formatDateTime, formatWon } from "@/lib/format";
import { useSupporterDonationsQuery } from "@/hooks/queries/fundings";
import { withFreshState } from "@/lib/withFreshState";

function SupporterListPage() {
  const { fundingId } = useParams<{ fundingId: string }>();
  const state = useSupporterDonationsQuery(fundingId);
  const [giftFilter, setGiftFilter] = useState("");

  return (
    <Screen title="후원자 내역" backHref={`/my-funding-detail/${fundingId}`}>
      <AsyncBoundary state={state} deniedBackHref="/my-funding">
        {(donations) => {
          if (donations.length === 0) return <EmptyState message="아직 후원 내역이 없어요." description="초대 링크를 공유해 친구들을 초대해 보세요." />;
          const gifts = Array.from(new Map(donations.map((d) => [d.giftId, d.giftName])).entries());
          const visible = giftFilter ? donations.filter((d) => d.giftId === giftFilter) : donations;
          const total = visible.reduce((s, d) => s + d.amount, 0);
          const supporterCount = new Set(visible.map((d) => d.supporterName)).size;
          return (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gift-filter">선물 필터</Label>
                <NativeSelect id="gift-filter" value={giftFilter} onChange={(e) => setGiftFilter(e.target.value)}>
                  <option value="">전체 선물</option>
                  {gifts.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                <div className="rounded-sm border-2 border-line bg-surface-soft px-3 py-2">
                  <dt className="text-caption text-muted">모금액 합계</dt>
                  <dd className="text-title-md tabular-nums text-ink">{formatWon(total)}</dd>
                </div>
                <div className="rounded-sm border-2 border-line bg-surface-soft px-3 py-2">
                  <dt className="text-caption text-muted">후원 · 후원자</dt>
                  <dd className="text-title-md tabular-nums text-ink">
                    {visible.length}건 · {supporterCount}명
                  </dd>
                </div>
              </dl>
              <ul className="divide-y-2 divide-hairline rounded-xs border-2 border-line bg-surface" aria-label="후원 내역">
                {visible.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-line bg-surface-soft text-title-sm text-primary-active" aria-hidden>
                      {d.supporterName.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-title-sm text-ink">{d.supporterName}</p>
                      <p className="truncate text-caption font-normal text-muted">
                        {d.giftName} · {formatDateTime(d.createdAt)}
                      </p>
                    </div>
                    <span className="text-title-sm tabular-nums text-ink">{formatWon(d.amount)}</span>
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

export default withFreshState(SupporterListPage);
