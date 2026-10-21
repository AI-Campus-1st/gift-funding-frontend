"use client";

/**
 * UI-19 선물 후원 및 축하 메시지 작성 (/donation/[giftId])
 *
 * 처리 순서
 * 1) 추천 금액 선택 또는 직접 입력  2) (선택) 축하 메시지 작성
 * 3) "{금액}원 후원하기" → 서버 검증 → 성공 시 완료 화면으로 자동 이동(replace)
 *
 * 중복 처리 방지
 * - 처리 중에는 버튼 비활성화
 * - idempotencyKey: 같은 금액·메시지로 다시 보내는 요청(네트워크 재시도 등)은 같은 키를 사용 →
 *   서버가 한 번만 처리한다. 금액이나 메시지를 바꾸면 새 요청으로 보고 키를 새로 만든다.
 * 실패 시: 금액 · 메시지를 그대로 유지하고, 초과 후원이면 입력창 아래에 최대 후원 가능 금액 안내
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { InlineAlert } from "@/components/common/FormField";
import { MockBadge } from "@/components/common/MockNotice";
import { AsyncBoundary } from "@/components/common/StateViews";
import { DonationAmountForm } from "@/components/donation/DonationAmountForm";
import { DonationMessageCard } from "@/components/donation/DonationMessageCard";
import { FundingProgress } from "@/components/funding/FundingProgress";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { useDonateMutation } from "@/hooks/queries/donations";
import { useGiftForDonationQuery } from "@/hooks/queries/fundings";
import { useAuth } from "@/lib/auth";
import { formatWon } from "@/lib/format";
import { withFreshState } from "@/lib/withFreshState";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function DonationPage() {
  const { giftId } = useParams<{ giftId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const state = useGiftForDonationQuery(giftId);
  const donateMutation = useDonateMutation(state.data?.funding.id ?? "", giftId);

  const [amount, setAmount] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);
  const keyRef = useRef<string | null>(null);

  function changeAmount(next: number | null) {
    setAmount(next);
    setLimitMessage(null);
    keyRef.current = null;
  }
  function changeMessage(next: string) {
    setMessage(next);
    keyRef.current = null;
  }

  const amountValid = amount !== null && Number.isInteger(amount) && amount > 0;

  async function handleSubmit() {
    if (!amountValid || submitting || closed) return;
    keyRef.current ??= newKey();
    setSubmitting(true);
    setFormError(null);
    setLimitMessage(null);
    try {
      const { donationId } = await donateMutation.mutateAsync({ giftId, amount: amount!, message, idempotencyKey: keyRef.current });
      router.replace(`/donation-complete/${donationId}`);
    } catch (error) {
      if (error instanceof ApiError) {
        // 서버가 명확히 거절한 요청은 같은 키로 다시 보낼 필요가 없으므로 키 초기화
        keyRef.current = null;
        if (error.code === "EXCEEDS_REMAINING") setLimitMessage(error.message);
        else if (error.code === "GOAL_REACHED" || error.code === "FUNDING_NOT_ACTIVE") {
          setClosed(true);
          setFormError(error.message);
        } else setFormError(error.message);
      } else {
        setFormError(getErrorMessage(error, "후원 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요."));
      }
      setSubmitting(false);
    }
  }

  return (
    <Screen title="선물 후원하기" backHref={state.data ? `/friend-funding-detail/${state.data.funding.id}` : "/friend-funding"}>
      <AsyncBoundary state={state} deniedBackHref="/friend-funding">
        {({ funding, gift }) => {
          const blocked = closed || gift.isClosed || funding.status !== "active";
          return (
            <>
              <RetroWindow title={`${funding.ownerName}님의 선물`} tone="pink" action={<MockBadge label="모의 후원" />}>
                <div className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gift.imageUrl} alt={gift.name} className="size-20 shrink-0 rounded-md border border-hairline object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-caption text-muted">{funding.name}</p>
                    <h2 className="text-title-md text-ink">{gift.name}</h2>
                    <p className="text-body-sm text-body">
                      목표 금액 <strong className="tabular-nums text-ink">{formatWon(gift.price)}</strong>
                    </p>
                    <a href={gift.productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-caption text-info underline underline-offset-2">
                      상품 구매 링크 <ExternalLink className="size-3" aria-hidden />
                      <span className="sr-only">(새 창)</span>
                    </a>
                  </div>
                </div>
                <div className="mt-3">
                  <FundingProgress rate={gift.achievementRate} label={`${gift.name} 목표 달성률`} />
                </div>
              </RetroWindow>

              {blocked ? (
                <InlineAlert tone="warning">
                  {formError ?? (funding.status !== "active" ? "진행 중인 펀딩이 아니라 후원할 수 없어요." : "후원이 마감된 선물입니다.")}
                </InlineAlert>
              ) : (
                <>
                  <DonationAmountForm amount={amount} onChange={changeAmount} limitMessage={limitMessage} disabled={submitting} />
                  <DonationMessageCard authorName={user?.name ?? ""} recipientName={funding.ownerName} message={message} onChange={changeMessage} disabled={submitting} />
                  {formError && <InlineAlert>{formError}</InlineAlert>}
                  <div className="flex flex-col gap-2">
                    <Button block onClick={handleSubmit} disabled={!amountValid} loading={submitting} loadingText="후원 처리 중...">
                      {amountValid ? `${formatWon(amount!)} 후원하기` : "후원 금액을 선택해 주세요"}
                    </Button>
                    <Button asChild variant="secondary" block size="md">
                      <Link href={`/friend-funding-detail/${funding.id}`}>취소</Link>
                    </Button>
                  </div>
                  <p className="text-center text-caption font-normal text-muted">
                    실제 결제 없이 처리되는 모의 후원이에요. 다른 후원자의 금액은 공개되지 않아요.
                  </p>
                </>
              )}
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(DonationPage);
