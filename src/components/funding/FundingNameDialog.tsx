"use client";

/**
 * FundingNameDialog — 펀딩 이름 수정 모달 (UI-12)
 * - 펀딩 이름만 종료 전까지 바꿀 수 있다. 기간 · 연결 그룹은 수정할 수 없다. (FEATURE_SPEC F-07, 2026-10-16 확정)
 * - 저장 요청은 화면(page)이 넘긴 onSave 가 한다. 실패하면 모달 안에 오류를 보여주고 입력값은 유지한다.
 * - 열 때마다 새로 그려지도록 부모에서 key 를 바꿔 넘긴다.
 */
import { TEXT_LIMITS } from "@/lib/constants";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/client";

interface FundingNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onSave: (name: string) => Promise<unknown>;
}

export function FundingNameDialog({ open, onOpenChange, initialName, onSave }: FundingNameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (name.trim().length === 0) {
      setError("펀딩 이름을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim());
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "저장하지 못했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent title="펀딩 이름 수정" tone="lavender" description="펀딩 기간과 연결 그룹은 바꿀 수 없어요.">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="funding-name-edit" label="펀딩 이름" required error={error ?? undefined}>
            {(p) => <Input {...p} maxLength={TEXT_LIMITS.fundingName} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <div className="flex flex-col gap-2">
            <Button type="submit" block loading={saving} loadingText="저장 중...">
              저장
            </Button>
            <Button type="button" variant="secondary" block onClick={() => onOpenChange(false)} disabled={saving}>
              취소
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
