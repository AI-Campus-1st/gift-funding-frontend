"use client";

/**
 * DonationAmountForm — 후원 금액 선택 (base.md 6.6, UI-19)
 *
 * - 추천 금액 버튼: 5,000원 / 10,000원 / 30,000원
 * - 직접 입력창: 연한 회색 placeholder "직접 입력하기", 숫자 키패드, 천 단위 구분 기호 자동 표시
 * - limitMessage: 서버가 초과 후원을 거절했을 때 입력창 바로 아래에 최대 후원 가능 금액 안내
 * 상태(amount)는 부모(후원 화면)가 가진다 → 실패해도 입력값이 유지된다.
 *
 * 직접 입력 모드는 입력창의 글자(customText)로 따로 관리한다.
 * (금액만 보고 판단하면 1,000 → 10,000 처럼 추천 금액과 같아지는 순간 입력창이 비워져서
 *  100,000원 같은 금액을 이어서 입력할 수 없던 문제가 있었다)
 */
import { useState } from "react";
import { formatNumber, formatWon } from "@/lib/format";
import { parseAmountInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { Input, Label } from "@/components/ui/input";

export const PRESET_AMOUNTS = [5000, 10000, 30000];

interface DonationAmountFormProps {
  amount: number | null;
  onChange: (amount: number | null) => void;
  limitMessage?: string | null;
  disabled?: boolean;
}

export function DonationAmountForm({ amount, onChange, limitMessage, disabled }: DonationAmountFormProps) {
  // 직접 입력 중인 글자. 비어 있으면 추천 금액 버튼 모드
  const [customText, setCustomText] = useState(() => (amount !== null && !PRESET_AMOUNTS.includes(amount) ? formatNumber(amount) : ""));
  const isCustom = customText !== "";

  function selectPreset(preset: number) {
    setCustomText("");
    onChange(preset);
  }

  function typeCustom(raw: string) {
    const parsed = parseAmountInput(raw);
    setCustomText(parsed === null ? "" : formatNumber(parsed));
    onChange(parsed);
  }
  const inputError = amount !== null && amount <= 0 ? "0원보다 큰 금액을 입력해 주세요." : null;
  const message = limitMessage ?? inputError;

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-3 text-title-sm text-ink">후원 금액</legend>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="추천 후원 금액">
        {PRESET_AMOUNTS.map((preset) => {
          const selected = !isCustom && amount === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => selectPreset(preset)}
              className={cn(
                "min-h-12 rounded-sm border-2 text-button tabular-nums transition-colors disabled:opacity-50",
                selected ? "border-line-strong bg-primary text-on-primary shadow-button" : "border-line bg-surface text-ink hover:bg-surface-soft",
              )}
            >
              {formatWon(preset)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="donation-custom-amount" className="sr-only">
          후원 금액 직접 입력
        </Label>
        <div className="relative">
          <Input
            id="donation-custom-amount"
            inputMode="numeric"
            autoComplete="off"
            placeholder="직접 입력하기"
            value={customText}
            onChange={(e) => typeCustom(e.target.value)}
            aria-invalid={!!message}
            aria-describedby={message ? "donation-amount-error" : undefined}
            className="pr-10 text-right tabular-nums"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body-md text-muted" aria-hidden>
            원
          </span>
        </div>
        {message && (
          <p id="donation-amount-error" role="alert" className="text-body-sm font-medium text-error">
            {message}
          </p>
        )}
      </div>
      <p className="text-body-sm text-body" aria-live="polite">
        선택한 금액{" "}
        <strong className="text-title-md tabular-nums text-ink">{amount && amount > 0 ? formatWon(amount) : "-"}</strong>
      </p>
    </fieldset>
  );
}
