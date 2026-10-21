"use client";

/**
 * GiftForm — 선물 등록 · 수정 폼 (F-04, UI-10)
 *
 * 필수: 선물 이름 · 실제 가격(=목표 금액) · 이미지 · 상품 구매 URL / 선택: 설명
 * - priceLocked: 후원이 발생한 선물은 가격(목표 금액)을 바꿀 수 없다.
 * - 검증 규칙은 서버(mock)와 같은 validateGiftInput 을 사용한다.
 * 사용 위치: src/app/(app)/add-gift/page.tsx
 */
import { TEXT_LIMITS } from "@/lib/constants";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { validateGiftInput } from "@/lib/validation";
import { formatNumber } from "@/lib/format";
import { parseAmountInput } from "@/lib/validation";
import type { GiftInput } from "@/types";
import { GiftImageUploader } from "./GiftImageUploader";

interface GiftFormProps {
  initial: GiftInput;
  priceLocked?: boolean;
  submitLabel: string;
  submitting?: boolean;
  serverErrors?: Record<string, string>;
  onSubmit: (gift: GiftInput) => void;
  onCancel: () => void;
}

export function GiftForm({ initial, priceLocked, submitLabel, submitting, serverErrors, onSubmit, onCancel }: GiftFormProps) {
  const [gift, setGift] = useState<GiftInput>(initial);
  const [priceText, setPriceText] = useState(initial.price > 0 ? formatNumber(initial.price) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const allErrors = { ...serverErrors, ...errors };

  function set<K extends keyof GiftInput>(key: K, value: GiftInput[K]) {
    setGift((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validateGiftInput(gift);
    setErrors(next);
    const first = ["name", "price", "imageUrl", "productUrl"].find((k) => next[k]);
    if (first) {
      document.getElementById(`gift-${first}`)?.focus();
      return;
    }
    onSubmit(gift);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField id="gift-name" label="선물 이름" required error={allErrors.name || null}>
        {(p) => <Input {...p} maxLength={TEXT_LIMITS.giftName} placeholder="예) 노이즈캔슬링 무선 헤드폰" value={gift.name} onChange={(e) => set("name", e.target.value)} />}
      </FormField>
      <FormField
        id="gift-price"
        label="실제 가격 (목표 금액)"
        required
        error={allErrors.price || null}
        hint={priceLocked ? "후원 또는 이월 금액이 있는 선물은 가격(목표 금액)을 변경할 수 없어요." : "판매처에서 확인한 실제 가격을 입력해 주세요. 이 금액이 선물의 목표 금액이 돼요."}
      >
        {(p) => (
          <div className="relative">
            <Input
              {...p}
              inputMode="numeric"
              placeholder="0"
              disabled={priceLocked}
              value={priceText}
              onChange={(e) => {
                const amount = parseAmountInput(e.target.value);
                setPriceText(amount === null ? "" : formatNumber(amount));
                set("price", amount ?? 0);
              }}
              className="pr-10 text-right tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
              원
            </span>
          </div>
        )}
      </FormField>
      <FormField id="gift-imageUrl" label="선물 이미지" required error={allErrors.imageUrl || null} hint="JPG, PNG, WEBP, GIF · 5MB 이하">
        {(p) => (
          <GiftImageUploader id={p.id} value={gift.imageUrl} onChange={(v) => set("imageUrl", v)} invalid={p["aria-invalid"]} describedBy={p["aria-describedby"]} />
        )}
      </FormField>
      <FormField id="gift-productUrl" label="상품 구매 URL" required error={allErrors.productUrl || null}>
        {(p) => (
          <Input {...p} type="url" inputMode="url" autoCapitalize="off" placeholder="https://" value={gift.productUrl} onChange={(e) => set("productUrl", e.target.value)} />
        )}
      </FormField>
      <FormField id="gift-description" label="설명 (선택)" error={allErrors.description || null}>
        {(p) => (
          <Textarea {...p} maxLength={TEXT_LIMITS.giftDescription} placeholder="친구들에게 전하고 싶은 한마디" value={gift.description} onChange={(e) => set("description", e.target.value)} />
        )}
      </FormField>
      <div className="mt-2 flex flex-col gap-2">
        <Button type="submit" block loading={submitting} loadingText="저장 중...">
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" block size="md" onClick={onCancel} disabled={submitting}>
          취소
        </Button>
      </div>
    </form>
  );
}
