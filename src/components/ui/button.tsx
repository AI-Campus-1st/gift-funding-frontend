/**
 * Button — 공통 버튼 (shadcn/ui 방식 + base.md 6.2 레트로 스타일)
 *
 * variant
 * - primary   : 핑크 배경 · 진한 2px 테두리 · 입체 그림자 (주요 CTA)
 * - secondary : 흰 배경 · 진한 테두리
 * - tertiary  : 배경 없는 텍스트 버튼
 * - danger    : 비활성화 · 삭제 등 되돌리기 어려운 행동
 * 상태: hover / active(눌림: 그림자 제거 + 2px 이동) / disabled / loading
 * asChild: <Button asChild><Link href="/">..</Link></Button> 처럼 링크에 버튼 스타일 적용
 */
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm text-button transition-[background-color,box-shadow,transform] disabled:cursor-not-allowed [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-2 border-line-strong bg-primary text-on-primary shadow-button hover:bg-primary-hover active:translate-x-[2px] active:translate-y-[2px] active:bg-primary-active active:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:border-line disabled:bg-primary-disabled disabled:text-muted disabled:shadow-none",
        secondary:
          "border-2 border-line-strong bg-surface text-line-strong shadow-button hover:bg-surface-strong active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:border-hairline disabled:text-muted-soft disabled:shadow-none",
        tertiary: "text-body underline-offset-4 hover:bg-surface-strong hover:underline disabled:text-muted-soft",
        danger:
          "border-2 border-error bg-surface text-error hover:bg-[#fdecef] active:translate-x-[1px] active:translate-y-[1px] disabled:border-hairline disabled:text-muted-soft",
      },
      size: {
        lg: "min-h-12 px-4 py-3",
        md: "min-h-11 px-3.5 py-2.5",
        sm: "min-h-9 px-3 py-1.5 text-body-sm font-bold",
        icon: "size-11 p-0",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** 처리 중: 스피너를 표시하고 클릭을 막는다 (중복 요청 방지) */
  loading?: boolean;
  loadingText?: string;
}

export function Button({ className, variant, size, block, asChild, loading, loadingText, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
