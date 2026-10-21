"use client";

/**
 * CarryoverPickerDialog — 이월 선물 불러오기 모달 (UI-09 펀딩 생성)
 *
 * 지난 펀딩에서 "다음 생일로 이월"한 선물 중 다시 열 선물을 고른다.
 * - 선물 정보(이름 · 가격 · 이미지 · 링크)는 지난 펀딩 그대로 복사되고, 이월 금액이 시작 모금액이 된다.
 * - 데이터 조회는 화면(page)이 하고, 이 컴포넌트는 받은 목록을 보여주고 선택 결과만 돌려준다. (UI · API 분리)
 * - 열 때마다 새로 그려지도록 부모에서 key 를 바꿔 넘긴다. (선택 초기값 = 이미 불러온 목록)
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatWon } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PendingCarryover } from "@/types";

interface CarryoverPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carryovers: PendingCarryover[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
}

export function CarryoverPickerDialog({ open, onOpenChange, carryovers, selectedIds, onConfirm }: CarryoverPickerDialogProps) {
  const [checked, setChecked] = useState<string[]>(selectedIds);

  function toggle(id: string, on: boolean) {
    setChecked((prev) => (on ? [...prev, id] : prev.filter((v) => v !== id)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="이월 선물 불러오기" tone="yellow" description="다시 열 선물을 골라 주세요. 이월한 금액이 시작 모금액으로 들어가요.">
        <ul className="flex flex-col gap-2">
          {carryovers.map((c) => {
            const isChecked = checked.includes(c.id);
            const inputId = `carryover-${c.id}`;
            return (
              <li key={c.id}>
                <label
                  htmlFor={inputId}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-sm border-2 p-2.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-info",
                    isChecked ? "border-line-strong bg-surface-soft" : "border-line bg-surface",
                  )}
                >
                  <Checkbox id={inputId} checked={isChecked} onCheckedChange={(v) => toggle(c.id, v === true)} />
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL 이미지 */}
                  <img src={c.imageUrl} alt="" className="size-12 shrink-0 rounded-md border border-hairline object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-title-sm text-ink">{c.giftName}</span>
                    <span className="block truncate text-caption text-muted">{c.fundingName}</span>
                    <span className="block text-caption tabular-nums text-body">
                      이월 {formatWon(c.amount)} · 목표 {formatWon(c.price)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-col gap-2">
          <Button block onClick={() => onConfirm(checked)}>
            {checked.length > 0 ? `${checked.length}개 불러오기` : "선택 완료"}
          </Button>
          <Button variant="secondary" block onClick={() => onOpenChange(false)}>
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
