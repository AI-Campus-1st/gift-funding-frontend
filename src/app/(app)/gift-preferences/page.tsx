"use client";

/**
 * UI-26 선물 취향 설정 (/gift-preferences)
 *
 * 화면 구성
 * - 위쪽 입력 폼(draft): 처음에는 아무것도 입력 · 선택되지 않은 빈 상태
 *   관심사 키워드를 입력하면 그때 #키워드 칩이 나타난다.
 * - "취향 저장": 입력한 내용을 저장된 취향에 "추가"하고 입력 폼은 다시 비운다.
 *   · 관심사 키워드 · 카테고리: 기존 저장값에 합친다(중복 제외, 키워드 최대 10개)
 *   · 선호 가격대: 선택했을 때만 새 값으로 바꾼다
 * - 아래 "저장된 내 취향" 카드: 각 항목의 × 를 누르면 그 항목만 바로 삭제된다.
 * 저장된 취향은 AI 선물 추천(UI-11)의 기본 조건으로 사용된다.
 */
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { LoadingState } from "@/components/common/StateViews";
import { KeywordInput, ToggleChips } from "@/components/gift/KeywordInput";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { GIFT_CATEGORIES, MAX_KEYWORDS, PRICE_RANGES } from "@/lib/constants";
import { usePreferenceQuery, useUpdatePreferenceMutation } from "@/hooks/queries/auth";
import { getErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { GiftPreference } from "@/types";
import { withFreshState } from "@/lib/withFreshState";

const EMPTY_DRAFT: GiftPreference = { keywords: [], categories: [], priceRange: null };

/** 입력 폼 내용을 저장된 취향에 합친다 */
function mergePreference(saved: GiftPreference, draft: GiftPreference): GiftPreference {
  return {
    keywords: Array.from(new Set([...saved.keywords, ...draft.keywords])),
    categories: Array.from(new Set([...saved.categories, ...draft.categories])),
    priceRange: draft.priceRange ?? saved.priceRange,
  };
}

/** 저장된 취향의 항목 하나를 지우는 × 버튼 */
function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid size-7 place-items-center rounded-full text-muted hover:bg-primary-disabled hover:text-ink disabled:opacity-40"
      aria-label={`${label} 삭제`}
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}

/** 현재 저장된 취향 요약 카드 — 항목별 × 로 삭제 */
function SavedPreferenceSummary({ pref, onRemove, busy }: { pref: GiftPreference; onRemove: (next: GiftPreference, label: string) => void; busy: boolean }) {
  const price = PRICE_RANGES.find((r) => r.key === pref.priceRange);
  const empty = <span className="text-muted">설정 안 함</span>;
  const chip = "inline-flex items-center gap-0.5 rounded-full border border-primary-active bg-surface py-0.5 pl-2.5 pr-0.5 text-ink";
  return (
    <section aria-labelledby="saved-preference" aria-live="polite" aria-busy={busy} className="rounded-xs border-2 border-line bg-surface-soft p-4">
      <h2 id="saved-preference" className="flex items-center gap-1.5 text-title-sm text-ink">
        <CheckCircle2 className="size-4 text-success" aria-hidden /> 저장된 내 취향
      </h2>
      <dl className="mt-3 flex flex-col gap-3 text-body-sm">
        <div>
          <dt className="text-caption text-muted">관심사 키워드</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {pref.keywords.length > 0
              ? pref.keywords.map((k) => (
                  <span key={k} className={chip}>
                    #{k}
                    <RemoveButton label={`관심사 ${k}`} disabled={busy} onClick={() => onRemove({ ...pref, keywords: pref.keywords.filter((v) => v !== k) }, `#${k}`)} />
                  </span>
                ))
              : empty}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">선호 선물 카테고리</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {pref.categories.length > 0
              ? pref.categories.map((c) => (
                  <span key={c} className={chip}>
                    {c}
                    <RemoveButton label={`카테고리 ${c}`} disabled={busy} onClick={() => onRemove({ ...pref, categories: pref.categories.filter((v) => v !== c) }, c)} />
                  </span>
                ))
              : empty}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">선호 가격대</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {price ? (
              <span className={chip}>
                {price.label}
                <RemoveButton label={`가격대 ${price.label}`} disabled={busy} onClick={() => onRemove({ ...pref, priceRange: null }, price.label)} />
              </span>
            ) : (
              empty
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function GiftPreferencesPage() {
  const prefQuery = usePreferenceQuery();
  const updateMutation = useUpdatePreferenceMutation();
  // 항목 삭제 중에는 화면에서 먼저 지운 값을 보여주고, 실패하면 서버 값으로 되돌린다
  const [optimistic, setOptimistic] = useState<GiftPreference | null>(null);
  const saved = optimistic ?? prefQuery.data ?? null;
  const [draft, setDraft] = useState<GiftPreference>(EMPTY_DRAFT);
  const [formKey, setFormKey] = useState(0); // 저장 후 키워드 입력창까지 완전히 비우기 위한 key
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const draftEmpty = draft.keywords.length === 0 && draft.categories.length === 0 && draft.priceRange === null;

  async function handleSave() {
    if (!saved || saving) return;
    if (draftEmpty) {
      setError("저장할 관심사 키워드 · 카테고리 · 가격대를 입력하거나 선택해 주세요.");
      return;
    }
    const next = mergePreference(saved, draft);
    if (next.keywords.length > MAX_KEYWORDS) {
      setError(`관심사 키워드는 최대 ${MAX_KEYWORDS}개까지 저장할 수 있어요. 저장된 키워드를 먼저 삭제해 주세요.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMutation.mutateAsync(next); // 저장 결과로 캐시(saved)가 바뀐다
      setDraft(EMPTY_DRAFT); // 저장 후 입력 폼은 처음 상태로
      setFormKey((k) => k + 1);
      toast.success("선물 취향을 저장했어요.");
    } catch (err) {
      setError(getErrorMessage(err, "저장하지 못했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(next: GiftPreference, label: string) {
    if (!saved || removing) return;
    setOptimistic(next); // 화면에서 먼저 지우고, 실패하면 되돌린다
    setRemoving(true);
    setError(null);
    try {
      await updateMutation.mutateAsync(next);
      toast.success(`${label} 삭제했어요.`);
    } catch (err) {
      setError(getErrorMessage(err, "삭제하지 못했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setOptimistic(null);
      setRemoving(false);
    }
  }

  return (
    <Screen title="선물 취향 설정" backHref="/mypage">
      {!saved ? (
        prefQuery.error ? <InlineAlert>{getErrorMessage(prefQuery.error, "취향 정보를 불러오지 못했어요.")}</InlineAlert> : <LoadingState />
      ) : (
        <>
          <p className="text-body-sm text-body">저장한 취향은 AI 선물 추천에 참고돼요.</p>
          <RetroWindow key={formKey} title="preferences.exe" tone="lavender" bodyClassName="flex flex-col gap-5 p-4">
            <FormField id="pref-keywords" label="관심사 키워드" hint={`Enter 로 추가 · 최대 ${MAX_KEYWORDS}개`}>
              {(p) => (
                <KeywordInput
                  id={p.id}
                  value={draft.keywords}
                  max={Math.max(0, MAX_KEYWORDS - saved.keywords.length)}
                  onChange={(keywords) => setDraft({ ...draft, keywords })}
                  describedBy={p["aria-describedby"]}
                />
              )}
            </FormField>
            <div className="flex flex-col gap-1.5">
              <span className="text-title-sm text-ink">선호 선물 카테고리</span>
              <ToggleChips label="선호 선물 카테고리" options={GIFT_CATEGORIES} value={draft.categories} onChange={(categories) => setDraft({ ...draft, categories })} />
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-title-sm text-ink">선호 가격대</legend>
              <div className="grid grid-cols-2 gap-2">
                {PRICE_RANGES.map((r) => {
                  const selected = draft.priceRange === r.key;
                  return (
                    <label
                      key={r.key}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border-2 px-3 text-body-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-info",
                        selected ? "border-line-strong bg-lavender font-semibold text-ink" : "border-line bg-surface text-body",
                      )}
                    >
                      <input type="radio" name="price-range" className="accent-primary-active" checked={selected} onChange={() => setDraft({ ...draft, priceRange: r.key })} />
                      {r.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </RetroWindow>
          {error && <InlineAlert>{error}</InlineAlert>}
          <div className="flex flex-col gap-2">
            <Button block onClick={handleSave} loading={saving} loadingText="저장 중...">
              취향 저장
            </Button>
            <Button asChild variant="secondary" block size="md">
              <Link href="/ai-recommend?from=preferences">
                <Sparkles aria-hidden /> AI 추천 미리 보기
              </Link>
            </Button>
          </div>
          <SavedPreferenceSummary pref={saved} onRemove={handleRemove} busy={removing} />
        </>
      )}
    </Screen>
  );
}

export default withFreshState(GiftPreferencesPage);
