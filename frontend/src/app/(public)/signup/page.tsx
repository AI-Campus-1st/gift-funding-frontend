"use client";

/**
 * UI-02 회원가입 (/signup)
 *
 * 검증 시점 (01_auth.md 5.3)
 * - 입력 중: 이미 한 번 확인한(touched) 항목은 입력할 때마다 다시 검증
 * - 포커스 해제(blur): 필수 · 형식 검증 후 오류 표시
 * - 회원가입 클릭: 전체 검증 → 서버에서 이메일 중복 확인
 * 성공 시 로그인 화면으로 이동하며, 초대 링크로 들어온 경우 redirect 값을 유지한다.
 */
import { TEXT_LIMITS } from "@/lib/constants";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BirthdayPicker } from "@/components/common/BirthdayPicker";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FormField, InlineAlert } from "@/components/common/FormField";
import { GuestOnly } from "@/components/layout/AuthGuard";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSignupMutation } from "@/hooks/queries/auth";
import type { SignupInput } from "@/types";
import { ApiError } from "@/lib/api/client";
import { getSafeRedirect } from "@/lib/auth";
import {
  validateBirthday,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirm,
} from "@/lib/validation";
import { withFreshState } from "@/lib/withFreshState";

type Field = keyof SignupInput;
const EMPTY: SignupInput = { name: "", email: "", password: "", passwordConfirm: "", birthday: "" };

function validateField(field: Field, values: SignupInput): string | null {
  switch (field) {
    case "name":
      return validateName(values.name);
    case "email":
      return validateEmail(values.email);
    case "password":
      return validatePassword(values.password);
    case "passwordConfirm":
      return validatePasswordConfirm(values.password, values.passwordConfirm);
    case "birthday":
      return validateBirthday(values.birthday);
  }
}

function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [values, setValues] = useState<SignupInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitting, setSubmitting] = useState(false); // 성공 후 화면 이동이 끝날 때까지 잠근다
  const signupMutation = useSignupMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const loginHref = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login";

  function update(field: Field, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    // 이미 확인한 항목은 입력 중에도 즉시 다시 검증 (비밀번호를 바꾸면 확인값도 다시 검증)
    const recheck: Field[] = field === "password" ? ["password", "passwordConfirm"] : [field];
    setErrors((prev) => {
      const updated = { ...prev };
      for (const f of recheck) if (touched[f]) updated[f] = validateField(f, next) ?? undefined;
      return updated;
    });
  }

  function blur(field: Field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validateField(field, values) ?? undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const all: Field[] = ["name", "email", "password", "passwordConfirm", "birthday"];
    const nextErrors: Partial<Record<Field, string>> = {};
    for (const f of all) nextErrors[f] = validateField(f, values) ?? undefined;
    setErrors(nextErrors);
    setTouched({ name: true, email: true, password: true, passwordConfirm: true, birthday: true });
    const firstInvalid = all.find((f) => nextErrors[f]);
    if (firstInvalid) {
      document.getElementById(`signup-${firstInvalid}`)?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await signupMutation.mutateAsync(values);
      toast.success("회원가입이 완료되었습니다! 로그인해 주세요.");
      router.push(loginHref);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        setErrors((prev) => ({ ...prev, ...error.fieldErrors }));
      } else {
        setFormError("회원가입 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
      setSubmitting(false);
    }
  }

  const hasInput = Object.values(values).some((v) => v.length > 0);

  return (
    <GuestOnly redirectTo={getSafeRedirect(redirect)}>
      <Screen title="회원가입" onBack={() => (hasInput ? setLeaveOpen(true) : router.push("/"))}>
        <p className="text-center text-body-sm text-body">생일선물을 함께 준비할 계정을 만들어보세요! 🎂</p>

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="signup-name" label="이름" required error={errors.name}>
            {(p) => (
              <Input {...p} autoComplete="name" maxLength={TEXT_LIMITS.userName} placeholder="이름을 입력해 주세요" value={values.name} onChange={(e) => update("name", e.target.value)} onBlur={() => blur("name")} />
            )}
          </FormField>
          <FormField id="signup-email" label="이메일" required error={errors.email}>
            {(p) => (
              <Input {...p} type="email" inputMode="email" maxLength={TEXT_LIMITS.email} autoComplete="email" placeholder="example@email.com" value={values.email} onChange={(e) => update("email", e.target.value)} onBlur={() => blur("email")} />
            )}
          </FormField>
          <FormField id="signup-password" label="비밀번호" required error={errors.password} hint="8자 이상 입력해 주세요.">
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" placeholder="비밀번호를 입력해 주세요" value={values.password} onChange={(e) => update("password", e.target.value)} onBlur={() => blur("password")} />
            )}
          </FormField>
          <FormField id="signup-passwordConfirm" label="비밀번호 확인" required error={errors.passwordConfirm}>
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" placeholder="비밀번호를 다시 입력해 주세요" value={values.passwordConfirm} onChange={(e) => update("passwordConfirm", e.target.value)} onBlur={() => blur("passwordConfirm")} />
            )}
          </FormField>
          <FormField id="signup-birthday" label="생년월일" required error={errors.birthday} hint="생년월일을 선택해 주세요">
            {(p) => (
              <BirthdayPicker
                id={p.id}
                value={values.birthday}
                invalid={p["aria-invalid"]}
                describedBy={p["aria-describedby"]}
                onChange={(v) => update("birthday", v)}
                onBlur={() => blur("birthday")}
              />
            )}
          </FormField>

          {formError && <InlineAlert>{formError}</InlineAlert>}

          <Button type="submit" block loading={submitting} loadingText="가입 처리 중..." className="mt-2">
            회원가입
          </Button>
          <p className="text-center text-body-sm text-muted">
            이미 계정이 있으신가요?{" "}
            <Link href={loginHref} className="font-bold text-primary-active underline underline-offset-2">
              로그인
            </Link>
          </p>
        </form>

        <ConfirmDialog
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          title="회원가입 그만두기"
          description="입력 중인 정보가 사라져요. 처음 화면으로 이동할까요?"
          confirmLabel="이동하기"
          cancelLabel="계속 작성하기"
          onConfirm={() => router.push("/")}
        />
      </Screen>
    </GuestOnly>
  );
}

export default withFreshState(SignupPage);
