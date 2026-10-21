"use client";

/**
 * UI-18 친구 펀딩 상세 (/friend-funding-detail/[fundingId])
 * - 후원자용 데이터만 받는다: 선물 이름 · 이미지 · 가격 · 구매 링크 · 달성률 · 진행률 바
 *   (현재 모금액 · 남은 금액 · 다른 후원자 정보는 응답에 없음)
 * - 종료된 펀딩 / 목표 100% 달성 선물은 후원 버튼 비활성화
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { AsyncBoundary } from "@/components/common/StateViews";
import { FundingInfo } from "@/components/funding/FundingInfo";
import { SupporterGiftCard } from "@/components/funding/GiftCard";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import type { FriendFundingView, SupporterGiftView } from "@/types";
import { useFriendFundingQuery } from "@/hooks/queries/fundings";
import { withFreshState } from "@/lib/withFreshState";

function donateBlockReason(funding: FriendFundingView, gift: SupporterGiftView): string | null {
  if (funding.status === "ended") return "종료된 펀딩이라 후원할 수 없어요.";
  if (funding.status === "scheduled") return "펀딩 시작 전이에요.";
  if (gift.isClosed) return "후원이 마감된 선물입니다.";
  return null;
}

function FriendFundingDetailPage() {
  const { fundingId } = useParams<{ fundingId: string }>();
  const state = useFriendFundingQuery(fundingId);

  return (
    <Screen title="친구 펀딩 상세" backHref="/friend-funding">
      <AsyncBoundary state={state} deniedBackHref="/friend-funding">
        {(funding) => (
          <>
            <FundingInfo funding={funding} />
            <section aria-labelledby="gift-list-title" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 id="gift-list-title" className="text-display-md text-ink">
                  선물 목록 <span className="text-body-sm font-normal text-muted">{funding.gifts.length}개</span>
                </h2>
                <Button asChild variant="tertiary" size="sm">
                  <Link href={`/my-donations?fundingId=${funding.id}`}>
                    <ReceiptText aria-hidden /> 내 후원 내역
                  </Link>
                </Button>
              </div>
              <ul className="flex flex-col gap-4">
                {funding.gifts.map((gift) => {
                  const blocked = donateBlockReason(funding, gift);
                  return (
                    <li key={gift.id}>
                      <SupporterGiftCard
                        gift={gift}
                        footer={
                          blocked ? (
                            <div className="flex flex-col gap-1.5">
                              <Button block size="md" disabled>
                                후원하기
                              </Button>
                              <p className="text-center text-caption text-muted">{blocked}</p>
                            </div>
                          ) : (
                            <Button asChild block size="md">
                              <Link href={`/donation/${gift.id}`} aria-label={`${gift.name} 후원하기`}>
                                후원하기
                              </Link>
                            </Button>
                          )
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(FriendFundingDetailPage);
