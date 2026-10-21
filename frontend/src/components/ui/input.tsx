/**
 * 입력 컨트롤 — Input / Textarea / NativeSelect / Label
 * - 모바일 확대를 막기 위해 글씨 크기 16px 이상 (base.md 3.3)
 * - aria-invalid 가 true 이면 빨간 테두리로 오류 상태 표시
 */
import { Label as RadixLabel } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-sm border-2 border-line bg-surface px-3 text-body-md text-ink placeholder:text-muted-soft transition-colors focus-visible:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender disabled:cursor-not-allowed disabled:bg-surface-strong disabled:text-muted aria-[invalid=true]:border-error";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(fieldBase, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 resize-y py-2.5", className)} {...props} />;
}

/** 브라우저 기본 select (모바일에서 OS 선택 UI 를 그대로 사용해 접근성이 좋다) */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-12 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2330283C%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<typeof RadixLabel.Root>) {
  return <RadixLabel.Root className={cn("text-title-sm text-ink", className)} {...props} />;
}
