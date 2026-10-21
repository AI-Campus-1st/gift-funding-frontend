/**
 * FormField — 라벨 + 입력 컨트롤 + 안내/오류 문구 묶음
 * - 필수 항목은 라벨 옆에 * 표시 (01_auth.md 2.2)
 * - 오류 문구는 입력창 바로 아래에 표시하고, aria-describedby 로 입력창과 연결한다.
 * children 에는 render-prop 으로 접근성 속성을 전달한다.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/input";

export interface FieldControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
}

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

export function FormField({ id, label, required, error, hint, className, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-error" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy, "aria-required": required || undefined })}
      {error && (
        <p id={errorId} className="text-body-sm text-error" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-caption font-normal text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** 입력 오류와 별개로 폼 전체에 대한 안내 (서버 오류 등) */
export function InlineAlert({ tone = "error", children }: { tone?: "error" | "info" | "warning" | "success"; children: ReactNode }) {
  const toneClass = {
    error: "border-error bg-[#fdecef] text-error",
    info: "border-info bg-[#e8f0fb] text-info",
    warning: "border-warning bg-memo text-warning",
    success: "border-success bg-[#e7f4ef] text-success",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-sm border-2 px-3 py-2.5 text-body-sm font-medium", toneClass)}>
      {children}
    </div>
  );
}
