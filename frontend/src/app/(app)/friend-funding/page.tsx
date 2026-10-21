"use client";

/**
 * UI-07 친구 펀딩 (/friend-funding) — 하단 탭 화면
 * - 참여 중인 다른 사람의 펀딩을 진행 중 / 종료로 나눠 보여준다.
 * - 카드에는 달성률 · 진행률 바만 표시 (현재 모금액 · 남은 금액 비공개)
 * - "+ 친구 펀딩 참여하기" → UI-17, "내 후원 내역" → UI-21
 */
import Link from "next/link";
import { useState } from "react";
import { Plus, ReceiptText } from "lucide-react";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { FriendFundingCard } from "@/components/funding/FundingCards";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFriendFundingsQuery } from "@/hooks/queries/fundings";
import { withFreshState } from "@/lib/withFreshState";

type Filter = "ongoing" | "ended";

function FriendFundingPage() {
  const state = useFriendFundingsQuery();
  const [filter, setFilter] = useState<Filter>("ongoing");

  return (
    <Screen title="친구 펀딩" tabBar>
      <div className="flex flex-col gap-2">
        <Button asChild block>
          <Link href="/join-invite">
            <Plus aria-hidden /> 친구 펀딩 참여하기
          </Link>
        </Button>
        <Button asChild variant="secondary" block size="md">
          <Link href="/my-donations">
            <ReceiptText aria-hidden /> 내 후원 내역
          </Link>
        </Button>
      </div>

      <AsyncBoundary state={state}>
        {(fundings) => {
          if (fundings.length === 0) {
            return (
              <EmptyState
                message="아직 참여한 친구 펀딩이 없어요."
                description="친구에게 받은 초대 링크로 펀딩에 참여해 보세요."
                action={
                  <Button asChild size="md">
                    <Link href="/join-invite">+ 친구 펀딩 참여하기</Link>
                  </Button>
                }
              />
            );
          }
          const ongoing = fundings.filter((f) => f.status !== "ended");
          const ended = fundings.filter((f) => f.status === "ended");
          const visible = filter === "ongoing" ? ongoing : ended;
          return (
            <section aria-label="참여 중인 친구 펀딩" className="flex flex-col gap-4">
              <div role="tablist" aria-label="펀딩 상태" className="grid grid-cols-2 rounded-sm border-2 border-line-strong bg-surface p-1">
                {(
                  [
                    ["ongoing", `진행 중 (${ongoing.length})`],
                    ["ended", `종료 (${ended.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    type="button"
                    aria-selected={filter === key}
                    onClick={() => setFilter(key)}
                    className={cn("min-h-10 rounded-xs text-button", filter === key ? "bg-primary text-on-primary" : "text-muted hover:text-ink")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {visible.length === 0 ? (
                <EmptyState message={filter === "ongoing" ? "진행 중인 친구 펀딩이 없어요." : "종료된 친구 펀딩이 없어요."} />
              ) : (
                <ul className="flex flex-col gap-4">
                  {visible.map((f) => (
                    <li key={f.id}>
                      <FriendFundingCard funding={f} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(FriendFundingPage);
