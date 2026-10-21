/**
 * Badge — 상태 배지 (base.md typography.badge)
 * 상태는 색상만으로 구분하지 않고 항상 문구를 함께 표시한다.
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-badge whitespace-nowrap", {
  variants: {
    tone: {
      pink: "border-primary-active bg-surface-soft text-primary-active",
      success: "border-success bg-[#e7f4ef] text-success",
      warning: "border-warning bg-memo text-warning",
      error: "border-error bg-[#fdecef] text-error",
      info: "border-info bg-[#e8f0fb] text-info",
      neutral: "border-line bg-surface-strong text-body",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
