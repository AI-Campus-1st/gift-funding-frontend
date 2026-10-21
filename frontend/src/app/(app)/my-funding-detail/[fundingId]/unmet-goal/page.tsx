"use client";

/**
 * UI-23 목표 미달 처리 (/my-funding-detail/[fundingId]/unmet-goal) — 생일자 전용
 *
 * 선택지는 두 가지뿐 (본인 부담금 추가 기능 없음)
 * - 다음 생일로 이월: 모금액을 이월금으로 기록 → 같은 금액은 인출 불가
 *   다음 생일 펀딩을 만들 때 "이월 선물 불러오기"(UI-09)로 같은 선물을 다시 열 수 있다.
 * - 현재 모금액 인출: 정산 대상에 포함 → 정산 관리(UI-24)로 이동
 * 선택 → 최종 확인 모달 → 처리. 이미 처리한 선물은 다시 처리할 수 없다.
 */
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { InlineAlert } from "@/components/common/FormField";
import { MockNotice } from "@/components/common/MockNotice";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { FundingProgress } from "@/components/funding/FundingProgress";
import { ShortfallBadge } from "@/components/funding/ShortfallBadge";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api/client";
import { useMyFundingQuery } from "@/hooks/queries/fundings";
import { useApplyShortfallMutation } from "@/hooks/queries/settlements";
import { formatDate, formatWon, parseLocalDate, toDateString, todayString } from "@/lib/format";
import { SHORTFALL_DEADLINE_DAYS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { OwnerGiftView, ShortfallAction } from "@/types";
import { withFreshState } from "@/lib/withFreshState";

const OPTIONS: { value: ShortfallAction; title: string; desc: string }[] = [
  { value: "carryover", title: "다음 생일로 이월", desc: "다음 생일에 같은 선물로 펀딩을 다시 열어요. 지금 모인 금액이 시작 모금액이 돼요." },
  { value: "withdraw", title: "현재 모금액 인출", desc: "지금까지 모인 금액을 본인 명의 계좌로 정산받아요. 부족한 금액은 직접 보태 선물을 살 수 있어요." },
];

function ShortfallChoiceCard({ gift, onChoose }: { gift: OwnerGiftView; onChoose: (action: ShortfallAction) => void }) {
  const [choice, setChoice] = useState<ShortfallAction | null>(null);
  const done = !!gift.shortfallAction;
  return (
    <article className="rounded-xs border-2 border-line bg-surface p-3.5 shadow-window">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={gift.imageUrl} alt="" className="size-16 rounded-md border border-hairline object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-title-sm text-ink">{gift.name}</h3>
            <ShortfallBadge gift={gift} />
          </div>
          <p className="mt-1 text-body-sm tabular-nums text-body">
            모금 {formatWon(gift.raisedAmount)} / 목표 {formatWon(gift.price)}
          </p>
        </div>
      </div>
      <div className="mt-2">
        <FundingProgress rate={gift.achievementRate} label={`${gift.name} 달성률`} size="sm" />
      </div>
      {done ? (
        <p className="mt-3 rounded-sm bg-surface-strong px-3 py-2 text-body-sm text-body">
          {gift.shortfallAction === "carryover"
            ? "이월한 선물이에요. 다음 생일 펀딩을 만들 때 '이월 선물 불러오기'로 다시 열 수 있어요."
            : "이미 처리한 선물이에요. 같은 금액은 다시 처리할 수 없어요."}
        </p>
      ) : (
        <fieldset className="mt-3 flex flex-col gap-2">
          <legend className="sr-only">{gift.name} 처리 방식 선택</legend>
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-sm border-2 p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-info",
                choice === o.value ? "border-line-strong bg-surface-soft" : "border-line bg-surface",
              )}
            >
              <input type="radio" name={`shortfall-${gift.id}`} value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="mt-1 accent-primary-active" />
              <span>
                <span className="block text-title-sm text-ink">{o.title}</span>
                <span className="block text-body-sm text-muted">{o.desc}</span>
              </span>
            </label>
          ))}
          <Button size="md" disabled={!choice} onClick={() => choice && onChoose(choice)}>
            선택 확인
          </Button>
        </fieldset>
      )}
    </article>
  );
}

/** 미달 처리 기한 안내 — 종료 후 7일 (지나면 알림이 한 번 가고, 그 뒤에도 선택할 수 있다) */
function DeadlineNotice({ endDate }: { endDate: string }) {
  const end = parseLocalDate(endDate);
  if (!end) return null;
  const deadline = toDateString(new Date(end.getFullYear(), end.getMonth(), end.getDate() + SHORTFALL_DEADLINE_DAYS));
  const passed = todayString() > deadline;
  return (
    <InlineAlert tone={passed ? "warning" : "info"}>
      {passed
        ? `선택 기한(${formatDate(deadline)})이 지났어요. 지금 이월 또는 인출을 선택해 주세요.`
        : `${formatDate(deadline)}까지 이월 또는 인출을 선택해 주세요. (펀딩 종료 후 ${SHORTFALL_DEADLINE_DAYS}일)`}
    </InlineAlert>
  );
}

function UnmetGoalPage() {
  const { fundingId } = useParams<{ fundingId: string }>();
  const router = useRouter();
  const state = useMyFundingQuery(fundingId);
  const shortfallMutation = useApplyShortfallMutation(fundingId);
  const [pending, setPending] = useState<{ gift: OwnerGiftView; action: ShortfallAction } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!pending) return;
    setProcessing(true);
    setError(null);
    try {
      await shortfallMutation.mutateAsync({ giftId: pending.gift.id, action: pending.action });
      if (pending.action === "withdraw") {
        toast.success("인출을 선택했어요. 정산 관리에서 정산을 요청해 주세요.");
        router.push(`/my-funding-detail/${fundingId}/settlement`);
      } else {
        toast.success("다음 생일로 이월했어요. 펀딩을 만들 때 불러올 수 있어요.");
        setPending(null);
      }
    } catch (err) {
      setError(getErrorMessage(err, "처리하지 못했어요. 잠시 후 다시 시도해 주세요."));
      setPending(null);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Screen title="목표 미달 처리" backHref={`/my-funding-detail/${fundingId}/funding-result`}>
      <AsyncBoundary state={state} deniedBackHref="/my-funding">
        {(funding) => {
          if (funding.status !== "ended") return <InlineAlert tone="info">펀딩이 종료된 후에 처리할 수 있어요.</InlineAlert>;
          const unmet = funding.gifts.filter((g) => g.achievementRate < 100 && g.raisedAmount > 0);
          return (
            <>
              <p className="text-body-sm text-body">
                <strong className="text-ink">{funding.name}</strong>이 종료되었어요. 목표에 도달하지 못한 선물의 모금액을 어떻게 처리할지 선택해 주세요.
              </p>
              {unmet.some((g) => !g.shortfallAction) && <DeadlineNotice endDate={funding.endDate} />}
              <MockNotice>실제 송금 없이 처리되는 모의 정산이에요.</MockNotice>
              {error && <InlineAlert>{error}</InlineAlert>}
              {unmet.length === 0 ? (
                <EmptyState message="처리할 목표 미달 선물이 없어요." />
              ) : (
                <ul className="flex flex-col gap-4">
                  {unmet.map((gift) => (
                    <li key={gift.id}>
                      <ShortfallChoiceCard gift={gift} onChoose={(action) => setPending({ gift, action })} />
                    </li>
                  ))}
                </ul>
              )}
              <ConfirmDialog
                open={pending !== null}
                onOpenChange={(open) => !open && setPending(null)}
                title="처리 방식 확인"
                description={
                  pending && (
                    <>
                      <strong>{pending.gift.name}</strong>의 모금액 <strong>{formatWon(pending.gift.raisedAmount)}</strong>을{" "}
                      <strong>{pending.action === "carryover" ? "다음 생일로 이월" : "현재 모금액 인출"}</strong>할까요? 처리 후에는 바꿀 수 없어요.
                    </>
                  )
                }
                confirmLabel={pending?.action === "carryover" ? "이월하기" : "인출하기"}
                loading={processing}
                onConfirm={confirm}
              />
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(UnmetGoalPage);
