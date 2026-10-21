"use client";

/**
 * DeleteConfirmDialog — 공통 삭제 확인 모달 (base.md 6.2 delete-confirm-dialog, rules.md 10.3)
 *
 * - 기본 문구: "정말 삭제하시겠습니까?" / "삭제한 데이터는 복구할 수 없습니다." · 버튼 "취소" · "삭제"
 * - "취소": 모달만 닫히고 데이터는 그대로
 * - "삭제": onConfirm(삭제 요청)을 기다린다. 진행 중에는 닫기 · 취소를 잠그고 두 번 눌리지 않게 한다.
 *   성공 → 모달 닫고 "삭제되었습니다." 토스트 → onDeleted (화면 이동 등)
 *   실패 → 모달 안에 오류 문구, 데이터 유지, 다시 시도 가능
 * - 목록 · 상세 갱신(캐시 무효화)은 onConfirm 에 넘긴 mutation 이 한다.
 * 사용 위치: 내 펀딩 상세(UI-12) 펀딩 삭제, 선물 수정(UI-10) 선물 삭제 — DeleteSection 을 통해 사용
 */
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 실제 삭제 요청 — 실패하면 throw 해야 오류가 표시된다 */
  onConfirm: () => Promise<unknown>;
  /** 삭제 성공 후 할 일 (예: 목록 화면으로 이동) */
  onDeleted?: () => void;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  successMessage?: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onDeleted,
  title = "정말 삭제하시겠습니까?",
  description = "삭제한 데이터는 복구할 수 없습니다.",
  confirmLabel = "삭제",
  successMessage = "삭제되었습니다.",
}: DeleteConfirmDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeOpen(next: boolean) {
    if (deleting) return; // 삭제 중에는 닫지 않는다
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      setDeleting(false);
      onOpenChange(false);
      toast.success(successMessage);
      onDeleted?.();
    } catch (err) {
      setError(getErrorMessage(err, "삭제하지 못했어요. 잠시 후 다시 시도해 주세요."));
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent title={title} description={description} tone="pink">
        {error && (
          <p role="alert" className="mb-3 rounded-sm border-2 border-error bg-surface px-3 py-2 text-body-sm font-medium text-error">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button variant="danger" block onClick={handleConfirm} loading={deleting} loadingText="삭제 중...">
            {confirmLabel}
          </Button>
          <Button variant="secondary" block onClick={() => changeOpen(false)} disabled={deleting}>
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
