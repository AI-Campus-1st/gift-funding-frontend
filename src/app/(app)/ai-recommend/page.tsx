"use client";

/**
 * UI-11 AI 선물 추천 (/ai-recommend, ?fundingId=.. | ?from=preferences)
 *
 * - 마이페이지 선물 취향(관심사 · 카테고리 · 가격대)을 기본값으로 불러온다.
 * - "추천받기" / "다시 추천받기" → 추천 카드(이름 · 추천 이유 · 예상 가격대 · 카테고리)
 * - "선물로 등록" → 선물 등록(UI-10)에 이름만 채워서 이동. 자동 등록은 하지 않는다.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RotateCw, Sparkles } from "lucide-react";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { LoadingState } from "@/components/common/StateViews";
import { KeywordInput, ToggleChips } from "@/components/gift/KeywordInput";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { useRecommendGiftsMutation } from "@/hooks/queries/ai";
import { usePreferenceQuery } from "@/hooks/queries/auth";
import { GIFT_CATEGORIES, PRICE_RANGES } from "@/lib/constants";
import { getErrorMessage } from "@/lib/api/client";
import { formatWon } from "@/lib/format";
import type { AiRecommendation, GiftPreference, PriceRangeKey } from "@/types";
import { withFreshState } from "@/lib/withFreshState";

function AiRecommendPage() {
  const params = useSearchParams();
  const fundingId = params.get("fundingId");
  const fromPreferences = params.get("from") === "preferences";
  const backHref = fundingId ? `/my-funding-detail/${fundingId}` : fromPreferences ? "/gift-preferences" : "/create-funding";
  // 저장된 취향을 기본 조건으로 쓴다. 불러오기 전에 추천받으면 빈 조건이 되므로 불러온 뒤 폼을 그린다.
  // (취향을 못 불러와도 직접 입력해서 추천받을 수 있다)
  const pref = usePreferenceQuery();
  return (
    <Screen title="AI 선물 추천" backHref={backHref}>
      {pref.isPending ? <LoadingState label="내 취향 불러오는 중..." /> : <AiRecommendForm initial={pref.data ?? null} fundingId={fundingId} fromPreferences={fromPreferences} backHref={backHref} />}
    </Screen>
  );
}

/** 추천 조건 입력 + 결과 — 취향을 불러온 뒤 그 값을 초기값으로 그린다 */
function AiRecommendForm({ initial, fundingId, fromPreferences, backHref }: { initial: GiftPreference | null; fundingId: string | null; fromPreferences: boolean; backHref: string }) {
  const router = useRouter();
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);
  const [priceRange, setPriceRange] = useState<PriceRangeKey | "">(initial?.priceRange ?? "");
  const [results, setResults] = useState<AiRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recommend = useRecommendGiftsMutation();
  const loading = recommend.isPending;

  async function handleRecommend(e?: FormEvent) {
    e?.preventDefault();
    if (loading) return;
    const range = PRICE_RANGES.find((r) => r.key === priceRange);
    setError(null);
    try {
      const next = await recommend.mutateAsync({
        request: { keywords, categories, budgetMin: range?.min ?? null, budgetMax: range?.max ?? null },
        excludeIds: results?.map((r) => r.id) ?? [],
      });
      setResults(next);
    } catch (err) {
      setError(getErrorMessage(err, "추천을 받지 못했어요. 잠시 후 다시 시도해 주세요."));
    }
  }

  function registerAsGift(rec: AiRecommendation) {
    const query = new URLSearchParams({ name: rec.name });
    if (fundingId) query.set("fundingId", fundingId);
    router.push(`/add-gift?${query.toString()}`);
  }

  return (
    <>
      {/* 실제 AI(GPT)가 추천한다 — "모의" 표시 제거 (2026-10-20 확정) */}
      <RetroWindow
        title="ai_recommend.exe"
        tone="lavender"
        action={
          <Badge tone="info">
            <Sparkles className="size-3" aria-hidden /> AI 추천
          </Badge>
        }
      >
        <form noValidate onSubmit={handleRecommend} className="flex flex-col gap-4">
          <FormField id="ai-keywords" label="관심사" hint="Enter 로 추가해요.">
            {(p) => <KeywordInput id={p.id} value={keywords} onChange={setKeywords} describedBy={p["aria-describedby"]} />}
          </FormField>
          <div className="flex flex-col gap-1.5">
            <span className="text-title-sm text-ink">선호 카테고리</span>
            <ToggleChips label="선호 카테고리" options={GIFT_CATEGORIES} value={categories} onChange={setCategories} />
          </div>
          <FormField id="ai-budget" label="예산">
            {(p) => (
              <NativeSelect {...p} value={priceRange} onChange={(e) => setPriceRange(e.target.value as PriceRangeKey | "")}>
                <option value="">상관없음</option>
                {PRICE_RANGES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <Button type="submit" block loading={loading} loadingText="AI가 고르는 중...">
            <Sparkles aria-hidden /> {results ? "다시 추천받기" : "추천받기"}
          </Button>
        </form>
      </RetroWindow>

      {error && <InlineAlert>{error}</InlineAlert>}
      {loading && !results && <LoadingState label="취향에 맞는 선물을 찾고 있어요" />}

      {results && (
        <section aria-labelledby="ai-results" aria-busy={loading} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="ai-results" className="text-display-md text-ink">
              추천 결과
            </h2>
            <Button variant="tertiary" size="sm" onClick={() => handleRecommend()} disabled={loading}>
              <RotateCw aria-hidden /> 다시 추천
            </Button>
          </div>
          <p className="rounded-sm bg-memo px-3 py-2 text-caption font-medium text-warning">
            추천 가격은 예상 가격대예요. 실제 가격 · 이미지 · 구매 링크는 직접 확인해서 등록해 주세요.
          </p>
          {results.length === 0 ? (
            <InlineAlert tone="info">조건에 맞는 추천 결과가 없어요. 예산이나 카테고리를 바꿔 보세요.</InlineAlert>
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((rec) => (
                <li key={rec.id} className="rounded-xs border-2 border-line bg-surface p-4 shadow-window">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-title-md text-ink">{rec.name}</h3>
                    <Badge tone="info">{rec.category}</Badge>
                  </div>
                  <p className="mt-1 text-body-sm tabular-nums text-body">
                    예상 가격대 {formatWon(rec.priceMin)} ~ {formatWon(rec.priceMax)}
                  </p>
                  <p className="mt-2 rounded-sm bg-surface-soft px-3 py-2 text-body-sm text-body">💡 {rec.reason}</p>
                  {!fromPreferences && (
                    <Button variant="secondary" size="sm" block className="mt-3" onClick={() => registerAsGift(rec)}>
                      선물로 등록
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Button asChild variant="secondary" block size="md">
        <Link href={backHref}>돌아가기</Link>
      </Button>
    </>
  );
}

export default withFreshState(AiRecommendPage);
