"use client";

/**
 * GroupEditDialog — 그룹 이름 · 설명 수정 모달 (UI-15, API G9)
 * - 그룹을 만든 사람(관리자)에게만 보인다. (2026-10-19 확정)
 * - 저장 요청은 화면(page)이 넘긴 onSave 가 한다. 실패하면 모달 안에 오류를 보여주고 입력값은 유지한다.
 * - 열 때마다 새로 그려지도록 부모에서 key 를 바꿔 넘긴다.
 */
import { useState, type FormEvent } from "react";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { TEXT_LIMITS, tooLongMessage } from "@/lib/constants";

interface GroupEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  initialDescription: string;
  onSave: (input: { name: string; description: string }) => Promise<unknown>;
}

export function GroupEditDialog({ open, onOpenChange, initialName, initialDescription, onSave }: GroupEditDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const next: Record<string, string> = {};
    if (name.trim().length === 0) next.name = "그룹 이름을 입력해 주세요.";
    else if (name.trim().length > TEXT_LIMITS.groupName) next.name = tooLongMessage("그룹 이름은", TEXT_LIMITS.groupName);
    if (description.trim().length > TEXT_LIMITS.groupDescription) next.description = tooLongMessage("그룹 설명은", TEXT_LIMITS.groupDescription);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    setFormError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim() });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      else setFormError(getErrorMessage(err, "저장하지 못했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent title="그룹 정보 수정" tone="sky" description="그룹을 만든 사람만 이름과 설명을 바꿀 수 있어요.">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <InlineAlert>{formError}</InlineAlert>}
          <FormField id="group-name-edit" label="그룹 이름" required error={errors.name}>
            {(p) => <Input {...p} maxLength={TEXT_LIMITS.groupName} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField id="group-description-edit" label="그룹 설명 (선택)" error={errors.description}>
            {(p) => <Textarea {...p} maxLength={TEXT_LIMITS.groupDescription} value={description} onChange={(e) => setDescription(e.target.value)} />}
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
