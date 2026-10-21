"use client";

/**
 * UI-03 로그인 (/login?redirect=...)
 *
 * - 성공 시 홈으로 이동. redirect 값이 있으면(예: 초대 링크 /join-invite?token=...) 그 화면으로 돌아간다.
 *   → 실제 이동은 GuestOnly 가 로그인 상태 변화를 감지해 처리한다.
 * - 실패 문구는 이메일 가입 여부를 드러내지 않도록 하나로 통일한다.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Gift } from "lucide-react";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { MockNotice } from "@/components/common/MockNotice";
import { GuestOnly } from "@/components/layout/AuthGuard";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { getSafeRedirect, useAuth } from "@/lib/auth";
import { validateEmail } from "@/lib/validation";
import { withFreshState } from "@/lib/withFreshState";

function LoginPage() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const redirectTo = getSafeRedirect(redirectParam);
  const fromInvite = redirectTo.startsWith("/join-invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const next = {
      email: validateEmail(email) ?? undefined,
      password: password.length === 0 ? "비밀번호를 입력해 주세요." : undefined,
    };
    setErrors(next);
    if (next.email || next.password) {
      document.getElementById(next.email ? "login-email" : "login-password")?.focus();
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await login(email, password, remember);
      // 이동은 GuestOnly 가 처리 (로그인 상태가 authenticated 로 바뀌면 redirectTo 로 이동)
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.code === "INVALID_CREDENTIALS"
          ? "이메일 또는 비밀번호를 확인해 주세요."
          : "네트워크 연결을 확인한 후 다시 시도해 주세요.",
      );
      setSubmitting(false);
    }
  }

  const signupHref = redirectParam ? `/signup?redirect=${encodeURIComponent(redirectParam)}` : "/signup";

  return (
    <GuestOnly redirectTo={redirectTo}>
      <Screen title="로그인" backHref="/">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="grid size-14 place-items-center rounded-sm border-2 border-line-strong bg-surface-soft text-primary-active shadow-button">
            <Gift className="size-7" aria-hidden />
          </span>
          <p className="mt-2 text-title-md text-ink">Birthday Funding</p>
          <p className="text-body-sm text-body">다시 만나서 반가워요! 🎂</p>
        </div>

        {fromInvite && <InlineAlert tone="info">로그인하면 초대받은 펀딩 참여를 이어서 진행해요.</InlineAlert>}

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="login-email" label="이메일" required error={errors.email}>
            {(p) => (
              <Input {...p} type="email" inputMode="email" autoComplete="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </FormField>
          <FormField id="login-password" label="비밀번호" required error={errors.password}>
            {(p) => (
              <div className="relative">
                <Input
                  {...p}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력해 주세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-sm text-muted hover:text-ink"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                </button>
              </div>
            )}
          </FormField>
          <div className="flex items-center gap-2">
            <Checkbox id="login-remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
            <Label htmlFor="login-remember" className="text-body-sm font-normal text-body">
              로그인 상태 유지
            </Label>
          </div>

          {formError && <InlineAlert>{formError}</InlineAlert>}

          <Button type="submit" block loading={submitting} loadingText="로그인 중...">
            로그인
          </Button>
          <p className="text-center text-body-sm text-muted">
            아직 계정이 없으신가요?{" "}
            <Link href={signupHref} className="font-bold text-primary-active underline underline-offset-2">
              회원가입
            </Link>
          </p>
        </form>

        {/* 테스트 계정 안내는 개발 중(npm run dev)에만 보인다. 배포 화면에는 나오지 않는다 (2026-10-19 확정) */}
        {process.env.NODE_ENV === "development" && (
          <MockNotice>테스트 계정: seoyeon@example.com / password123 (다른 계정: jihoon@, mina@, doyoon@example.com)</MockNotice>
        )}
      </Screen>
    </GuestOnly>
  );
}

export default withFreshState(LoginPage);
