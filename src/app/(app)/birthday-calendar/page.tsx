"use client";

/**
 * UI-28 생일 캘린더 (/birthday-calendar)
 * - 월별 달력(이전/다음 달 · 오늘) + 다가오는 생일 목록
 * - 생일 등록 · 수정 · 삭제 (친구 이름 필수, 생일 필수, 연결 펀딩 선택)
 * - 연결 펀딩은 열람 권한이 있을 때만 "펀딩 보기" 제공
 * - 직접 등록한 생일은 내 캘린더에만 저장되며, 다른 회원의 프로필 생일은 바꾸지 않는다.
 */
import { TEXT_LIMITS } from "@/lib/constants";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { BirthdayPicker } from "@/components/common/BirthdayPicker";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { AsyncBoundary, LoadingState } from "@/components/common/StateViews";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { useBirthdayEventsQuery, useDeleteBirthdayEventMutation, useLinkableFundingsQuery, useSaveBirthdayEventMutation } from "@/hooks/queries/schedule";
import { fundingPathOf } from "@/lib/paths";
import { daysUntilNextBirthday, formatDday, formatMonthDay } from "@/lib/format";
import type { BirthdayEvent, BirthdayEventInput } from "@/types";
import { withFreshState } from "@/lib/withFreshState";

const BirthdayCalendar = dynamic(() => import("@/components/calendar/BirthdayCalendar"), {
  ssr: false,
  loading: () => <LoadingState label="달력을 불러오는 중이에요" />,
});

function EventFormDialog({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; initial: BirthdayEvent | null; onSaved: () => void }) {
  const fundings = useLinkableFundingsQuery();
  const save = useSaveBirthdayEventMutation();
  const [form, setForm] = useState<BirthdayEventInput>({
    friendName: initial?.friendName ?? "",
    birthday: initial?.birthday ?? "",
    linkedFundingId: initial?.linkedFundingId ?? null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.friendName.trim()) next.friendName = "친구 이름을 입력해 주세요.";
    if (!form.birthday) next.birthday = "생일을 선택해 주세요.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    try {
      await save.mutateAsync({ eventId: initial?.id ?? null, input: form });
      toast.success(initial ? "생일 일정을 수정했어요." : "생일 일정을 등록했어요.");
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      else setErrors({ form: getErrorMessage(error) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? "생일 수정" : "생일 등록"} tone="pink">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="event-name" label="친구 이름" required error={errors.friendName}>
            {(p) => <Input {...p} maxLength={TEXT_LIMITS.friendName} value={form.friendName} onChange={(e) => setForm({ ...form, friendName: e.target.value })} />}
          </FormField>
          <FormField id="event-birthday" label="생일" required error={errors.birthday}>
            {(p) => <BirthdayPicker id={p.id} value={form.birthday} onChange={(birthday) => setForm({ ...form, birthday })} invalid={p["aria-invalid"]} describedBy={p["aria-describedby"]} />}
          </FormField>
          <FormField id="event-funding" label="연결할 펀딩 (선택)" error={errors.linkedFundingId} hint="접근 권한이 있는 펀딩만 연결할 수 있어요.">
            {(p) => (
              <NativeSelect {...p} value={form.linkedFundingId ?? ""} onChange={(e) => setForm({ ...form, linkedFundingId: e.target.value || null })}>
                <option value="">연결 안 함</option>
                {(fundings.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {errors.form && <InlineAlert>{errors.form}</InlineAlert>}
          <Button type="submit" block loading={save.isPending} loadingText="저장 중...">
            저장
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BirthdayCalendarPage() {
  const state = useBirthdayEventsQuery();
  const deleteMutation = useDeleteBirthdayEventMutation();
  const [selected, setSelected] = useState<BirthdayEvent | null>(null);
  const [formTarget, setFormTarget] = useState<BirthdayEvent | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BirthdayEvent | null>(null);

  return (
    <Screen title="생일 캘린더" backHref="/home">
      <Button block onClick={() => setFormTarget("new")}>
        <Plus aria-hidden /> 생일 등록
      </Button>

      <AsyncBoundary state={state}>
        {(events) => {
          const upcoming = [...events].map((e) => ({ ...e, days: daysUntilNextBirthday(e.birthday) })).sort((a, b) => a.days - b.days);
          return (
            <>
              <RetroWindow title="calendar.exe" tone="yellow" bodyClassName="p-2">
                <BirthdayCalendar events={events} onSelectEvent={setSelected} />
              </RetroWindow>

              <section aria-labelledby="upcoming-birthdays" className="flex flex-col gap-3">
                <h2 id="upcoming-birthdays" className="text-display-md text-ink">
                  다가오는 생일
                </h2>
                {upcoming.length === 0 ? (
                  <p className="text-body-sm text-muted">등록된 생일 일정이 없어요.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {upcoming.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(e)}
                          className="flex w-full items-center gap-3 rounded-xs border-2 border-line bg-surface px-3.5 py-3 text-left hover:bg-surface-soft"
                        >
                          <span className="text-2xl" aria-hidden>🎂</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-title-sm text-ink">{e.friendName}</span>
                            <span className="block text-caption text-muted">
                              {formatMonthDay(e.birthday)}
                              {e.linkedFundingName ? ` · ${e.linkedFundingName}` : ""}
                            </span>
                          </span>
                          <span className="text-title-sm tabular-nums text-primary-active">{formatDday(e.days)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          );
        }}
      </AsyncBoundary>

      {/* 일정 상세 */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent title="생일 일정" tone="yellow">
            <p className="text-display-md text-ink">🎂 {selected.friendName}</p>
            <p className="mt-1 text-body-sm text-body">
              {formatMonthDay(selected.birthday)} · {formatDday(daysUntilNextBirthday(selected.birthday))}
            </p>
            <div className="mt-4 rounded-sm bg-surface-soft p-3">
              <p className="text-caption text-muted">연결된 펀딩</p>
              {!selected.linkedFundingId ? (
                <p className="text-body-sm text-body">연결된 펀딩이 없어요.</p>
              ) : fundingPathOf(selected) ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-title-sm text-ink">{selected.linkedFundingName}</span>
                  <Button asChild size="sm">
                    <Link href={fundingPathOf(selected)!}>펀딩 보기</Link>
                  </Button>
                </div>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-body-sm text-muted">
                  <Lock className="size-4" aria-hidden /> 접근 권한이 없는 펀딩이에요. 초대 링크로 참여한 뒤 볼 수 있어요.
                </p>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" onClick={() => { setFormTarget(selected); setSelected(null); }}>
                <Pencil aria-hidden /> 수정
              </Button>
              <Button variant="danger" size="md" onClick={() => setDeleteTarget(selected)}>
                <Trash2 aria-hidden /> 삭제
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {formTarget !== null && (
        <EventFormDialog
          key={formTarget === "new" ? "new" : formTarget.id}
          open
          onOpenChange={(o) => !o && setFormTarget(null)}
          initial={formTarget === "new" ? null : formTarget}
          onSaved={() => setFormTarget(null)}
        />
      )}

      {/* 공통 삭제 확인 모달 — 일정을 지우면 그 일정의 알림도 서버가 함께 삭제한다 */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutateAsync(deleteTarget!.id)}
        onDeleted={() => setSelected(null)}
      />
    </Screen>
  );
}

export default withFreshState(BirthdayCalendarPage);
