"use client";

/**
 * UI-20 후원 완료 (/donation-complete/[donationId])
 * - 서버 성공 응답 후에만 이 화면으로 이동한다. (후원 화면에서 replace 로 이동 → 뒤로 가기로 재제출 방지)
 * - 본인 후원만 조회 가능. 메시지를 남긴 경우에만 "메시지 전달" 안내를 보여준다.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { Mail } from "lucide-react";
import { MockBadge } from "@/components/common/MockNotice";
import { AsyncBoundary } from "@/components/common/StateViews";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { formatWon } from "@/lib/format";
import { useMyDonationQuery } from "@/hooks/queries/donations";
import { withFreshState } from "@/lib/withFreshState";

function DonationCompletePage() {
  const { donationId } = useParams<{ donationId: string }>();
  const state = useMyDonationQuery(donationId);

  return (
    <Screen title="후원 완료" backHref={state.data ? `/friend-funding-detail/${state.data.fundingId}` : "/friend-funding"}>
      <AsyncBoundary state={state} deniedBackHref="/friend-funding">
        {(donation) => (
          <>
            <RetroWindow title="success.exe" tone="pink" bodyClassName="bg-holo px-5 py-8 text-center">
              <div className="text-6xl" aria-hidden>🎉</div>
              <h2 className="mt-3 text-display-lg text-ink" role="status">
                후원이 완료되었습니다!
              </h2>
              <p className="mt-1 text-body-sm text-body">{donation.ownerName}님에게 마음이 전해졌어요.</p>
            </RetroWindow>

            <RetroWindow title="후원 정보" action={<MockBadge label="모의 후원" />}>
              <dl className="flex flex-col gap-2 text-body-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">후원한 선물</dt>
                  <dd className="text-right font-semibold text-ink">{donation.giftName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">내가 후원한 금액</dt>
                  <dd className="text-title-md tabular-nums text-ink">{formatWon(donation.amount)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">상태</dt>
                  <dd className="font-semibold text-success">후원 완료</dd>
                </div>
              </dl>
              {donation.hasMessage && (
                <p className="mt-3 flex items-center gap-2 rounded-sm bg-surface-soft px-3 py-2 text-body-sm text-body">
                  <Mail className="size-4 text-primary-active" aria-hidden />
                  축하 메시지도 {donation.ownerName}님에게 전달되었어요.
                </p>
              )}
            </RetroWindow>

            <div className="flex flex-col gap-2">
              <Button asChild block>
                <Link href={`/friend-funding-detail/${donation.fundingId}`}>친구 펀딩으로 돌아가기</Link>
              </Button>
              <Button asChild variant="secondary" block size="md">
                <Link href="/my-donations">내 후원 내역 보기</Link>
              </Button>
            </div>
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(DonationCompletePage);
