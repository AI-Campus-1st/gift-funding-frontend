"use client";

/**
 * UI-10 선물 등록 및 수정 (/add-gift)
 *
 * 쿼리에 따라 4가지 경우를 처리한다.
 * - (없음)                      : 펀딩 생성 중 새 선물 → 임시 목록에 추가 후 /create-funding
 * - ?draftIndex=n               : 펀딩 생성 중 임시 선물 수정
 * - ?fundingId=..               : 이미 만든 펀딩에 선물 추가 → API 저장 후 펀딩 상세
 * - ?fundingId=..&giftId=..     : 기존 선물 수정 (후원 · 이월 금액이 있으면 가격 변경 · 삭제 제한)
 *   선물 삭제는 공통 삭제 확인 모달(DeleteSection) → "삭제되었습니다." → 펀딩 상세
 * AI 추천에서 넘어오면 ?name=.. 으로 선물 이름만 미리 채운다. (가격 · 이미지 · URL 은 생일자가 직접 확인)
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { DeleteSection } from "@/components/common/DeleteSection";
import { InlineAlert } from "@/components/common/FormField";
import { AccessDeniedState, LoadingState } from "@/components/common/StateViews";
import { GiftForm } from "@/components/gift/GiftForm";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { useAddGiftMutation, useDeleteGiftMutation, useGiftForEditQuery, useUpdateGiftMutation } from "@/hooks/queries/fundings";
import { loadFundingDraft, upsertDraftGift } from "@/lib/fundingDraft";
import type { GiftInput } from "@/types";
import { withFreshState } from "@/lib/withFreshState";

const EMPTY_GIFT: GiftInput = { name: "", price: 0, imageUrl: "", productUrl: "", description: "" };

function AddGiftPage() {
  const router = useRouter();
  const params = useSearchParams();
  const fundingId = params.get("fundingId");
  const giftId = params.get("giftId");
  const draftIndexParam = params.get("draftIndex");
  const draftIndex = draftIndexParam === null ? null : Number(draftIndexParam);
  const aiName = params.get("name");

  // 임시 저장 선물 · AI 추천 이름은 바로 초기값으로, 기존 선물은 서버에서 불러온 값으로 채운다
  const [localInitial] = useState<GiftInput | null>(() => {
    if (giftId) return null;
    if (draftIndex !== null) return (typeof window !== "undefined" && loadFundingDraft().gifts[draftIndex]) || EMPTY_GIFT;
    return { ...EMPTY_GIFT, name: aiName ?? "" };
  });
  const giftQuery = useGiftForEditQuery(giftId);
  const remote = giftQuery.data;
  const initial: GiftInput | null = giftId
    ? remote
      ? { name: remote.name, price: remote.price, imageUrl: remote.imageUrl, productUrl: remote.productUrl, description: remote.description }
      : null
    : localInitial;
  const priceLocked = remote?.hasDonations ?? false;
  const loadError = giftQuery.error;
  const addMutation = useAddGiftMutation(fundingId ?? "");
  const updateMutation = useUpdateGiftMutation(fundingId ?? "", giftId ?? "");
  const submitting = addMutation.isPending || updateMutation.isPending;
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const deleteMutation = useDeleteGiftMutation(fundingId ?? "");

  const isExisting = !!fundingId;
  const isEdit = !!giftId || draftIndex !== null;
  const backHref = fundingId ? `/my-funding-detail/${fundingId}` : "/create-funding";

  async function handleSubmit(gift: GiftInput) {
    setFormError(null);
    setServerErrors({});
    if (!isExisting) {
      if (!upsertDraftGift(gift, draftIndex)) {
        setFormError("저장 공간이 부족해 선물을 임시 저장하지 못했어요. 더 작은 이미지를 사용해 주세요.");
        return;
      }
      router.push("/create-funding");
      return;
    }
    try {
      if (giftId) await updateMutation.mutateAsync(gift);
      else await addMutation.mutateAsync(gift);
      toast.success(giftId ? "선물 정보를 수정했어요." : "선물을 추가했어요.");
      router.push(backHref);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setServerErrors(error.fieldErrors);
      setFormError(getErrorMessage(error, "저장하지 못했어요. 잠시 후 다시 시도해 주세요."));
    }
  }

  const aiHref = `/ai-recommend${fundingId ? `?fundingId=${fundingId}` : ""}`;

  return (
    <Screen title={isEdit ? "선물 수정" : "선물 등록"} backHref={backHref}>
      {loadError ? (
        <AccessDeniedState message={getErrorMessage(loadError, "선물을 불러오지 못했어요.")} backHref={backHref} backLabel="돌아가기" />
      ) : !initial ? (
        <LoadingState />
      ) : (
        <>
          {!isEdit && (
            <div className="flex items-center justify-between gap-3 rounded-sm border-2 border-dashed border-lavender bg-surface-soft px-3 py-2.5">
              <p className="text-body-sm text-body">무엇을 받을지 고민된다면?</p>
              <Button asChild variant="secondary" size="sm">
                <Link href={aiHref}>
                  <Sparkles aria-hidden /> AI 추천
                </Link>
              </Button>
            </div>
          )}
          {aiName && !isEdit && (
            <InlineAlert tone="info">AI 추천 결과는 참고용이에요. 실제 가격 · 이미지 · 구매 링크는 판매처에서 확인한 뒤 입력해 주세요.</InlineAlert>
          )}
          <RetroWindow title="gift_form.exe" tone="pink">
            <GiftForm
              initial={initial}
              priceLocked={priceLocked}
              submitLabel={isEdit ? "저장" : isExisting ? "선물 추가" : "선물 목록에 담기"}
              submitting={submitting}
              serverErrors={serverErrors}
              onSubmit={handleSubmit}
              onCancel={() => router.push(backHref)}
            />
          </RetroWindow>
          {formError && <InlineAlert>{formError}</InlineAlert>}
          {giftId && (
            <DeleteSection
              buttonLabel="선물 삭제"
              disabledReason={priceLocked ? "후원 또는 이월 금액이 있는 선물은 삭제할 수 없어요." : null}
              onConfirm={() => deleteMutation.mutateAsync(giftId)}
              onDeleted={() => router.push(backHref)}
            />
          )}
        </>
      )}
    </Screen>
  );
}

export default withFreshState(AddGiftPage);
