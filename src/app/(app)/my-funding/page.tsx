"use client";

/**
 * UI-05 내 펀딩 (/my-funding) — 하단 탭 화면
 * - 내가 생일자로 만든 펀딩 목록 (선물별 달성률 + 실제 모금액)
 * - 바로가기: 펀딩 만들기(UI-09) · AI 선물 추천(UI-11)
 *   (축하 편지함은 펀딩 상세에서 펀딩별로, 마이페이지에서 전체로 확인)
 * - 종료된 펀딩 카드 아래에는 종료 결과 · 정산 관리 바로가기
 */
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { MyFundingCard } from "@/components/funding/FundingCards";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { useMyFundingsQuery } from "@/hooks/queries/fundings";
import { withFreshState } from "@/lib/withFreshState";

function MyFundingPage() {
  const state = useMyFundingsQuery();

  return (
    <Screen title="내 펀딩" tabBar>
      <div className="flex flex-col gap-2">
        <Button asChild block>
          <Link href="/create-funding">
            <Plus aria-hidden /> 펀딩 만들기
          </Link>
        </Button>
        <Button asChild variant="secondary" size="md" block>
          <Link href="/ai-recommend">
            <Sparkles aria-hidden /> AI 선물 추천
          </Link>
        </Button>
      </div>

      <AsyncBoundary state={state}>
        {(fundings) => {
          if (fundings.length === 0) {
            return (
              <EmptyState
                message="아직 만든 펀딩이 없어요."
                description="갖고 싶은 선물을 등록하고 친구들을 초대해 보세요."
                action={
                  <Button asChild size="md">
                    <Link href="/create-funding">펀딩 만들기</Link>
                  </Button>
                }
              />
            );
          }
          const ongoing = fundings.filter((f) => f.status !== "ended");
          const ended = fundings.filter((f) => f.status === "ended");
          return (
            <>
              <section aria-labelledby="ongoing-title" className="flex flex-col gap-3">
                <h2 id="ongoing-title" className="text-display-md text-ink">
                  진행 중 · 예정 <span className="text-body-sm font-normal text-muted">{ongoing.length}개</span>
                </h2>
                {ongoing.length === 0 ? (
                  <EmptyState message="진행 중인 펀딩이 없어요." />
                ) : (
                  <ul className="flex flex-col gap-4">
                    {ongoing.map((f) => (
                      <li key={f.id}>
                        <MyFundingCard funding={f} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {ended.length > 0 && (
                <section aria-labelledby="ended-title" className="flex flex-col gap-3">
                  <h2 id="ended-title" className="text-display-md text-ink">
                    종료된 펀딩 <span className="text-body-sm font-normal text-muted">{ended.length}개</span>
                  </h2>
                  <ul className="flex flex-col gap-4">
                    {ended.map((f) => (
                      <li key={f.id} className="flex flex-col gap-2">
                        <MyFundingCard funding={f} />
                        <div className="grid grid-cols-2 gap-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/my-funding-detail/${f.id}/funding-result`}>종료 결과 · 미달 처리</Link>
                          </Button>
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/my-funding-detail/${f.id}/settlement`}>정산 관리</Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(MyFundingPage);
