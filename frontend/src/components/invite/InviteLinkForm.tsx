"use client";

/**
 * InviteLinkForm — 초대 링크 직접 입력 (UI-17, base.md invite-link-input)
 * - 전체 링크 또는 초대 코드만 붙여넣어도 된다 (extractInviteToken 이 토큰을 꺼냄)
 * - 긴 URL 도 입력할 수 있도록 입력창은 전체 너비, 버튼은 아래쪽에 세로 배치 (base.md 4.4)
 */
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/common/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractInviteToken } from "@/lib/validation";

interface InviteLinkFormProps {
  onSubmit: (token: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function InviteLinkForm({ onSubmit, loading, error }: InviteLinkFormProps) {
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = extractInviteToken(value);
    if (!token) {
      setLocalError("초대 링크를 입력해 주세요.");
      return;
    }
    setLocalError(null);
    onSubmit(token);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
      <FormField id="invite-link" label="초대 링크" required error={localError ?? error} hint="친구에게 받은 링크나 초대 코드를 붙여넣어 주세요.">
        {(p) => (
          <Input
            {...p}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://.../join-invite?token=..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </FormField>
      <Button type="submit" block loading={loading} loadingText="링크 확인 중...">
        초대 링크 확인
      </Button>
    </form>
  );
}
