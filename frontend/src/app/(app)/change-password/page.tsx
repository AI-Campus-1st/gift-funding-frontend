"use client";

/**
 * 비밀번호 변경 (/change-password) — docs/features/password-change.md (2026-10-21 확정)
 * - 현재 비밀번호 · 새 비밀번호 · 새 비밀번호 확인 (모두 보기 / 숨기기)
 * - 현재 비밀번호와 같은 비밀번호로는 바꿀 수 없다 (서버가 최종 확인)
 * - 성공하면 로그인은 유지하고 마이페이지로 돌아간다
 */
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { PasswordInput } from "@/components/common/PasswordInput";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { useChangePasswordMutation } from "@/hooks/queries/auth";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { validatePasswordChange } from "@/lib/validation";
import { withFreshState } from "@/lib/withFreshState";

const FIELD_ORDER = ["currentPassword", "newPassword", "newPasswordConfirm"] as const;
const FIELD_ID = { currentPassword: "pw-current", newPassword: "pw-new", newPasswordConfirm: "pw-confirm" } as const;

function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useChangePasswordMutation();
  const saving = mutation.isPending;

  function focusFirst(next: Record<string, string>) {
    const first = FIELD_ORDER.find((k) => next[k]);
    if (first) document.getElementById(FIELD_ID[first])?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const input = { currentPassword, newPassword, newPasswordConfirm };
    const next = validatePasswordChange(input);
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return focusFirst(next);
    try {
      await mutation.mutateAsync(input);
      toast.success("비밀번호를 변경했어요.");
      router.replace("/mypage");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        setErrors(error.fieldErrors);
        focusFirst(error.fieldErrors);
      } else {
        setFormError(getErrorMessage(error, "비밀번호를 변경하지 못했어요. 잠시 후 다시 시도해 주세요."));
      }
    }
  }

  function clear(field: string) {
    setErrors((prev) => {
      const rest = { ...prev };
      delete rest[field];
      return rest;
    });
  }

  return (
    <Screen title="비밀번호 변경" backHref="/mypage">
      <RetroWindow title="change_password.exe" tone="sky">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <InlineAlert>{formError}</InlineAlert>}
          <FormField id={FIELD_ID.currentPassword} label="현재 비밀번호" required error={errors.currentPassword}>
            {(p) => (
              <PasswordInput
                {...p}
                autoComplete="current-password"
                placeholder="지금 쓰는 비밀번호"
                value={currentPassword}
                onChange={(e) => (setCurrentPassword(e.target.value), clear("currentPassword"))}
              />
            )}
          </FormField>
          <FormField id={FIELD_ID.newPassword} label="새 비밀번호" required error={errors.newPassword} hint="8자 이상, 지금 비밀번호와 다르게 정해 주세요.">
            {(p) => (
              <PasswordInput
                {...p}
                autoComplete="new-password"
                placeholder="새 비밀번호"
                value={newPassword}
                onChange={(e) => (setNewPassword(e.target.value), clear("newPassword"))}
              />
            )}
          </FormField>
          <FormField id={FIELD_ID.newPasswordConfirm} label="새 비밀번호 확인" required error={errors.newPasswordConfirm}>
            {(p) => (
              <PasswordInput
                {...p}
                autoComplete="new-password"
                placeholder="새 비밀번호를 한 번 더"
                value={newPasswordConfirm}
                onChange={(e) => (setNewPasswordConfirm(e.target.value), clear("newPasswordConfirm"))}
              />
            )}
          </FormField>
          <div className="flex flex-col gap-2">
            <Button type="submit" block loading={saving} loadingText="변경 중...">
              비밀번호 변경
            </Button>
            <Button type="button" variant="secondary" block size="md" onClick={() => router.push("/mypage")} disabled={saving}>
              취소
            </Button>
          </div>
        </form>
      </RetroWindow>
    </Screen>
  );
}

export default withFreshState(ChangePasswordPage);
