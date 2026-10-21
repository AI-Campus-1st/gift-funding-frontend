"use client";

/**
 * ConfirmDialog — 중요한 행동의 최종 확인 모달 (base.md 6.2 confirmation-dialog)
 * 사용 예: 목표 미달 처리 선택, 초대 링크 비활성화, 입력 중 화면 이탈 등
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = "취소", onConfirm, loading, danger, children }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent title={title} description={description} tone={danger ? "pink" : "sky"}>
        {children}
        <div className="mt-4 flex flex-col gap-2">
          <Button variant={danger ? "danger" : "primary"} block onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
          <Button variant="secondary" block onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
