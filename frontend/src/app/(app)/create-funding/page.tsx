"use client";

/**
 * UI-09 펀딩 생성 (/create-funding, /create-funding?groupId=...)
 *
 * - 입력: 펀딩 이름(그룹 이름과 별도) · 그룹 선택 · 시작일 · 종료일 · 선물 최소 1개
 * - 그룹은 "내가 만든 그룹"만 고를 수 있다. 펀딩은 그 그룹을 만든 사람만 열 수 있다. (2026-10-19 확정)
 * - 선물 등록(UI-10)/AI 추천(UI-11) 화면을 오가도 입력이 유지되도록 임시 저장(lib/fundingDraft.ts) 사용
 * - "펀딩 생성 완료" 성공 시 임시 저장을 비우고 내 펀딩 상세(UI-12)로 이동
 * - 이월 선물 불러오기: 지난 펀딩에서 이월한 선물이 있으면 버튼이 보인다. 고른 선물은 그대로 복사되고
 *   이월 금액이 시작 모금액이 된다. 그룹은 새로 고를 수 있다. (DATA_MODEL 6.9 D-S1-3)
 */
import { TEXT_LIMITS } from "@/lib/constants";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { History, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { AsyncBoundary } from "@/components/common/StateViews";
import { CarryoverPickerDialog } from "@/components/funding/CarryoverPickerDialog";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { maxFundingEndDate, validateFundingInput } from "@/lib/validation";
import { useCreateFundingMutation, usePendingCarryoversQuery } from "@/hooks/queries/fundings";
import { useMyGroupsQuery } from "@/hooks/queries/groups";
import { formatWon, todayString } from "@/lib/format";
import { clearFundingDraft, EMPTY_DRAFT, loadFundingDraft, saveFundingDraft, type FundingDraft } from "@/lib/fundingDraft";
import { withFreshState } from "@/lib/withFreshState";

function CreateFundingPage() {
  const router = useRouter();
  const presetGroupId = useSearchParams().get("groupId");
  const groupsState = useMyGroupsQuery();
  const carryoverState = usePendingCarryoversQuery();
  const createMutation = useCreateFundingMutation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  // 임시 저장 불러오기 — 이 화면은 쿼리(useSearchParams)를 읽어 브라우저에서만 그려지므로 초기값에서 바로 읽는다
  const [draft, setDraft] = useState<FundingDraft>(() => {
    if (typeof window === "undefined") return EMPTY_DRAFT;
    const saved = loadFundingDraft();
    return presetGroupId && !saved.groupId ? { ...saved, groupId: presetGroupId } : saved;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = createMutation.isPending;

  function update(patch: Partial<FundingDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveFundingDraft(next);
    setErrors((prev) => {
      const cleared = { ...prev };
      for (const key of Object.keys(patch)) delete cleared[key];
      return cleared;
    });
  }

  function removeGift(index: number) {
    update({ gifts: draft.gifts.filter((_, i) => i !== index) });
  }

  // 아직 다시 열 수 있는 이월 선물만 (다른 탭에서 이미 다시 열었으면 목록에서 빠진다)
  const pendingCarryovers = carryoverState.data ?? [];
  const selectedCarryovers = pendingCarryovers.filter((c) => draft.carryoverIds.includes(c.id));
  const giftCount = draft.gifts.length + selectedCarryovers.length;
  // 내가 만든 그룹이 아닌 ID(주소의 groupId · 예전 임시 저장)는 선택하지 않은 것으로 본다
  const myGroupIds = new Set((groupsState.data?.created ?? []).map((g) => g.id));
  const groupId = myGroupIds.has(draft.groupId) ? draft.groupId : "";

  function openPicker() {
    setPickerKey((k) => k + 1);
    setPickerOpen(true);
  }

  function applyCarryovers(ids: string[]) {
    update({ carryoverIds: ids });
    setErrors((prev) => {
      const cleared = { ...prev };
      delete cleared.gifts;
      return cleared;
    });
    setPickerOpen(false);
    if (ids.length > 0) toast.success(`이월 선물 ${ids.length}개를 불러왔어요.`);
  }

  function removeCarryover(id: string) {
    update({ carryoverIds: draft.carryoverIds.filter((v) => v !== id) });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const next = validateFundingInput({ ...draft, groupId, giftCount });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = ["name", "groupId", "startDate", "endDate"].find((k) => next[k]);
      if (first) document.getElementById(`funding-${first}`)?.focus();
      return;
    }
    setFormError(null);
    try {
      const { id } = await createMutation.mutateAsync({ ...draft, groupId, carryoverIds: selectedCarryovers.map((c) => c.id) });
      clearFundingDraft();
      toast.success("펀딩을 만들었어요! 친구들을 초대해 보세요 🎉");
      router.replace(`/my-funding-detail/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      // 이미 다시 연 이월 선물이면 mutation 이 이월 목록을 새로 고친다
      setFormError(getErrorMessage(error, "펀딩 생성에 실패했어요. 잠시 후 다시 시도해 주세요."));
    }
  }

  return (
    <Screen title="펀딩 만들기" backHref="/my-funding">
      <AsyncBoundary state={groupsState}>
        {({ created }) => {
          const groups = created;
          return (
            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
              <RetroWindow title="펀딩 정보" tone="pink" bodyClassName="flex flex-col gap-4 p-4">
                <FormField id="funding-name" label="펀딩 이름" required error={errors.name} hint="그룹 이름과 별도로 정해요. 예) 나의 24번째 생일선물">
                  {(p) => <Input {...p} maxLength={TEXT_LIMITS.fundingName} placeholder="펀딩 이름을 입력해 주세요" value={draft.name} onChange={(e) => update({ name: e.target.value })} />}
                </FormField>
                <FormField id="funding-groupId" label="그룹" required error={errors.groupId} hint="내가 만든 그룹에만 펀딩을 열 수 있어요.">
                  {(p) =>
                    groups.length === 0 ? (
                      <div id={p.id} tabIndex={-1} className="rounded-sm border-2 border-dashed border-line bg-surface-soft p-3 text-body-sm text-body">
                        내가 만든 그룹이 없어요. 먼저 그룹을 만들어 주세요.
                      </div>
                    ) : (
                      <NativeSelect {...p} value={groupId} onChange={(e) => update({ groupId: e.target.value })}>
                        <option value="">그룹을 선택해 주세요</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({g.memberCount}명)
                          </option>
                        ))}
                      </NativeSelect>
                    )
                  }
                </FormField>
                <Button asChild variant="tertiary" size="sm" className="-mt-2 self-start">
                  <Link href="/create-group?returnTo=/create-funding">
                    <Plus aria-hidden /> 새 그룹 만들기
                  </Link>
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <FormField id="funding-startDate" label="시작일" required error={errors.startDate}>
                    {(p) => <Input {...p} type="date" min={todayString()} value={draft.startDate} onChange={(e) => update({ startDate: e.target.value })} />}
                  </FormField>
                  <FormField id="funding-endDate" label="종료일" required error={errors.endDate}>
                    {(p) => (
                      <Input
                        {...p}
                        type="date"
                        min={draft.startDate || todayString()}
                        max={draft.startDate ? maxFundingEndDate(draft.startDate) : undefined}
                        value={draft.endDate}
                        onChange={(e) => update({ endDate: e.target.value })}
                      />
                    )}
                  </FormField>
                </div>
                <p className="-mt-2 text-caption text-muted">시작일은 오늘부터 고를 수 있고, 펀딩 기간은 최대 3주예요. 만든 뒤에는 기간과 그룹을 바꿀 수 없어요.</p>
              </RetroWindow>

              <RetroWindow title={`선물 목록 (${giftCount}개)`} tone="sky" bodyClassName="flex flex-col gap-3 p-4">
                {giftCount === 0 && (
                  <p className="rounded-sm bg-surface-soft p-3 text-body-sm text-body">선물을 최소 1개 이상 등록해야 펀딩을 만들 수 있어요.</p>
                )}
                {errors.gifts && <InlineAlert>{errors.gifts}</InlineAlert>}
                {selectedCarryovers.length > 0 && (
                  <ul className="flex flex-col gap-2" aria-label="불러온 이월 선물">
                    {selectedCarryovers.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 rounded-sm border-2 border-line bg-memo p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.imageUrl} alt="" className="size-14 rounded-md object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge tone="info">이월</Badge>
                            <p className="truncate text-title-sm text-ink">{c.giftName}</p>
                          </div>
                          <p className="text-body-sm tabular-nums text-body">
                            목표 {formatWon(c.price)} · 이월 {formatWon(c.amount)} 포함
                          </p>
                        </div>
                        <button type="button" onClick={() => removeCarryover(c.id)} className="grid size-10 place-items-center rounded-sm text-muted hover:bg-surface-strong" aria-label={`${c.giftName} 불러오기 취소`}>
                          <X className="size-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="flex flex-col gap-2">
                  {draft.gifts.map((gift, index) => (
                    <li key={`${gift.name}-${index}`} className="flex items-center gap-3 rounded-sm border-2 border-line bg-surface p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={gift.imageUrl} alt="" className="size-14 rounded-md object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-title-sm text-ink">{gift.name}</p>
                        <p className="text-body-sm tabular-nums text-body">목표 {formatWon(gift.price)}</p>
                      </div>
                      <Link href={`/add-gift?draftIndex=${index}`} className="grid size-10 place-items-center rounded-sm hover:bg-surface-strong" aria-label={`${gift.name} 수정`}>
                        <Pencil className="size-4" aria-hidden />
                      </Link>
                      <button type="button" onClick={() => removeGift(index)} className="grid size-10 place-items-center rounded-sm text-error hover:bg-surface-strong" aria-label={`${gift.name} 삭제`}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                {pendingCarryovers.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-sm border-2 border-dashed border-line bg-surface-soft p-3">
                    <p className="text-body-sm text-body">
                      지난 펀딩에서 이월한 선물이 <strong className="text-ink">{pendingCarryovers.length}개</strong> 있어요. 불러오면 이월 금액부터 모금을 시작해요.
                    </p>
                    <Button type="button" variant="secondary" size="md" onClick={openPicker}>
                      <History aria-hidden /> 이월 선물 불러오기
                    </Button>
                  </div>
                )}
                {carryoverState.isError && (
                  <InlineAlert tone="info">
                    이월 선물 목록을 불러오지 못했어요.{" "}
                    <button type="button" className="underline" onClick={() => void carryoverState.refetch()}>
                      다시 시도
                    </button>
                  </InlineAlert>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild variant="secondary" size="md">
                    <Link href="/add-gift">
                      <Plus aria-hidden /> 선물 등록
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="md">
                    <Link href="/ai-recommend">
                      <Sparkles aria-hidden /> AI 추천
                    </Link>
                  </Button>
                </div>
              </RetroWindow>

              <CarryoverPickerDialog
                key={pickerKey}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                carryovers={pendingCarryovers}
                selectedIds={selectedCarryovers.map((c) => c.id)}
                onConfirm={applyCarryovers}
              />

              {formError && <InlineAlert>{formError}</InlineAlert>}
              <Button type="submit" block loading={submitting} loadingText="펀딩 생성 중..." disabled={groups.length === 0}>
                펀딩 생성 완료
              </Button>
            </form>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(CreateFundingPage);
