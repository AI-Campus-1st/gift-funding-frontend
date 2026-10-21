"use client";

/**
 * DeleteSection — 화면 맨 아래의 삭제 영역 (삭제 버튼 + 공통 삭제 확인 모달)
 * - disabledReason 이 있으면 버튼을 비활성화하고 이유를 안내한다. (예: 후원이 들어온 펀딩)
 * - 버튼을 누르면 DeleteConfirmDialog 를 연다. 삭제 성공 · 실패 안내는 모달이 맡는다.
 * 사용 위치: 내 펀딩 상세(UI-12) 펀딩 삭제, 선물 수정(UI-10) 선물 삭제
 */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog, type DeleteConfirmDialogProps } from "./DeleteConfirmDialog";

interface DeleteSectionProps extends Pick<DeleteConfirmDialogProps, "onConfirm" | "onDeleted" | "title" | "description" | "successMessage"> {
  buttonLabel: string;
  disabledReason?: string | null;
}

export function DeleteSection({ buttonLabel, disabledReason, ...dialogProps }: DeleteSectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={buttonLabel} className="mt-2 flex flex-col gap-2 border-t-2 border-dashed border-hairline pt-5">
      <Button variant="danger" block size="md" disabled={!!disabledReason} onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> {buttonLabel}
      </Button>
      {disabledReason && <p className="text-center text-caption text-muted">{disabledReason}</p>}
      <DeleteConfirmDialog open={open} onOpenChange={setOpen} {...dialogProps} />
    </section>
  );
}
