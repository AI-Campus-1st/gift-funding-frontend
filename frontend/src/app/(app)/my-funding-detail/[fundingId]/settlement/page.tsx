"use client";

/**
 * UI-24 후원금 정산 관리 (/my-funding-detail/[fundingId]/settlement) — 생일자 전용, "모의 정산"
 *
 * - 정산 대상: 목표 달성 선물 + "현재 모금액 인출"을 선택한 미달 선물 (이월한 금액은 제외)
 * - 본인 명의 계좌(은행 · 계좌번호 · 예금주) 입력 → 정산 요청 → 상태 · 이력 표시
 * - 이미 정산 요청한 선물은 다시 요청할 수 없다. 정산 후 선물은 생일자가 직접 구매한다.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { MockBadge, MockNotice } from "@/components/common/MockNotice";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { useRequestSettlementMutation, useSettlementQuery } from "@/hooks/queries/settlements";
import { BANKS, SETTLEMENT_FAILURE_MESSAGE } from "@/lib/constants";
import { validateAccount } from "@/lib/validation";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatWon } from "@/lib/format";
import type { SettlementStatus } from "@/types";
import { withFreshState } from "@/lib/withFreshState";

const STATUS_LABEL: Record<SettlementStatus, { label: string; tone: "info" | "warning" | "success" | "error" }> = {
  requested: { label: "요청", tone: "info" },
  processing: { label: "처리 중", tone: "warning" },
  completed: { label: "완료", tone: "success" },
  failed: { label: "실패", tone: "error" },
};

function SettlementPage() {
  const { fundingId } = useParams<{ fundingId: string }>();
  const { user } = useAuth();
  const state = useSettlementQuery(fundingId);
  const requestMutation = useRequestSettlementMutation(fundingId);

  // null = 아직 고르지 않음 → 정산 가능한 선물 전체를 기본 선택으로 본다
  const [selectedState, setSelected] = useState<string[] | null>(null);
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  // null = 아직 입력하지 않음 → 본인 이름을 기본값으로 사용
  const [holderState, setAccountHolder] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = selectedState ?? state.data?.eligibleGifts.map((g) => g.id) ?? [];
  const accountHolder = holderState ?? user?.name ?? "";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !user) return;
    const next = validateAccount({ bank, accountNumber, accountHolder }, user.name);
    if (selected.length === 0) next.gifts = "정산할 선물을 선택해 주세요.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await requestMutation.mutateAsync({ giftIds: selected, bank, accountNumber, accountHolder });
      toast.success("정산을 요청했어요. (모의 정산)");
      setAccountNumber("");
      setSelected(null);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setFormError(getErrorMessage(error, "정산 요청에 실패했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="정산 관리" backHref={`/my-funding-detail/${fundingId}/funding-result`}>
      <AsyncBoundary state={state} deniedBackHref="/my-funding">
        {(overview) => {
          const amount = overview.eligibleGifts.filter((g) => selected.includes(g.id)).reduce((s, g) => s + g.amount, 0);
          return (
            <>
              <MockNotice>실제 은행 송금은 아직 연결되지 않았어요. 요청 내역만 기록되는 모의 정산이에요.</MockNotice>
              {/* 가장 최근 정산이 실패했으면 이유를 알려주고 계좌를 다시 입력하게 한다 (FEATURE_SPEC F-12) */}
              {overview.history[0]?.status === "failed" && overview.history[0].failureReason && (
                <InlineAlert>{SETTLEMENT_FAILURE_MESSAGE[overview.history[0].failureReason]}</InlineAlert>
              )}

              <RetroWindow title={overview.fundingName} tone="lavender" action={<MockBadge label="모의 정산" />}>
                <p className="text-caption text-muted">정산 가능 금액</p>
                <p className="text-display-lg tabular-nums text-ink">{formatWon(overview.eligibleAmount)}</p>
                {overview.carryoverGifts.length > 0 && (
                  <p className="mt-2 text-body-sm text-body">
                    다음 생일로 이월: {overview.carryoverGifts.map((g) => `${g.name} ${formatWon(g.amount)}`).join(", ")} (정산 대상 제외)
                  </p>
                )}
              </RetroWindow>

              {overview.eligibleGifts.length === 0 ? (
                <EmptyState
                  message="지금 정산할 수 있는 금액이 없어요."
                  description="펀딩이 끝난 뒤, 목표를 달성했거나 '현재 모금액 인출'을 선택한 선물이 정산 대상이 돼요."
                  action={
                    <Button asChild variant="secondary" size="md">
                      <Link href={`/my-funding-detail/${fundingId}/funding-result`}>종료 결과 보기</Link>
                    </Button>
                  }
                />
              ) : (
                <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-title-sm text-ink">정산 대상 선물</legend>
                    {overview.eligibleGifts.map((g) => (
                      <div key={g.id} className="flex items-center gap-3 rounded-sm border-2 border-line bg-surface px-3 py-2.5">
                        <Checkbox
                          id={`settle-${g.id}`}
                          checked={selected.includes(g.id)}
                          onCheckedChange={(v) => setSelected(v === true ? [...selected, g.id] : selected.filter((id) => id !== g.id))}
                        />
                        <Label htmlFor={`settle-${g.id}`} className="flex-1 font-normal">
                          <span className="block text-title-sm text-ink">{g.name}</span>
                          <span className="text-caption text-muted">{g.reason === "achieved" ? "목표 달성" : "현재 모금액 인출"}</span>
                        </Label>
                        <span className="text-title-sm tabular-nums text-ink">{formatWon(g.amount)}</span>
                      </div>
                    ))}
                    {errors.gifts && <p role="alert" className="text-body-sm text-error">{errors.gifts}</p>}
                  </fieldset>

                  <RetroWindow title="본인 명의 계좌" tone="sky" bodyClassName="flex flex-col gap-4 p-4">
                    <FormField id="settle-bank" label="은행" required error={errors.bank}>
                      {(p) => (
                        <NativeSelect {...p} value={bank} onChange={(e) => setBank(e.target.value)}>
                          <option value="">은행을 선택해 주세요</option>
                          {BANKS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                    <FormField id="settle-account" label="계좌번호" required error={errors.accountNumber} hint="숫자만 입력해 주세요.">
                      {(p) => <Input {...p} inputMode="numeric" autoComplete="off" placeholder="예) 1234567890123" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d-]/g, ""))} />}
                    </FormField>
                    <FormField id="settle-holder" label="예금주" required error={errors.accountHolder} hint="본인 명의 계좌만 등록할 수 있어요.">
                      {(p) => <Input {...p} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />}
                    </FormField>
                  </RetroWindow>

                  {formError && <InlineAlert>{formError}</InlineAlert>}
                  <Button type="submit" block loading={submitting} loadingText="정산 요청 중..." disabled={selected.length === 0}>
                    {formatWon(amount)} 정산 신청
                  </Button>
                </form>
              )}

              <p className="flex items-start gap-2 rounded-sm bg-memo px-3 py-2.5 text-body-sm text-warning">
                <ShoppingBag className="mt-0.5 size-4 shrink-0" aria-hidden />
                정산받은 금액으로 원하는 판매처에서 선물을 직접 구매해 주세요. 플랫폼은 구매 · 배송을 대신하지 않아요.
              </p>

              <section aria-labelledby="settlement-history" className="flex flex-col gap-3">
                <h2 id="settlement-history" className="text-display-md text-ink">
                  정산 이력
                </h2>
                {overview.history.length === 0 ? (
                  <EmptyState message="아직 정산 요청 내역이 없어요." />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {overview.history.map((h) => (
                      <li key={h.id} className="rounded-xs border-2 border-line bg-surface p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-title-sm tabular-nums text-ink">{formatWon(h.amount)}</span>
                          <Badge tone={STATUS_LABEL[h.status].tone}>{STATUS_LABEL[h.status].label}</Badge>
                        </div>
                        <p className="mt-1 text-body-sm text-body">{h.giftNames.join(", ")}</p>
                        <p className="mt-1 text-caption font-normal text-muted">
                          {h.bank} {h.accountNumberMasked} ({h.accountHolder}) · {formatDateTime(h.requestedAt)}
                        </p>
                        {h.status === "failed" && h.failureReason && (
                          <p className="mt-1 text-caption font-medium text-error">{SETTLEMENT_FAILURE_MESSAGE[h.failureReason]}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(SettlementPage);
