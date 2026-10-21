"use client";

/**
 * Dialog — 모달 창 (Radix Dialog + 레트로 창 스타일)
 * - Esc 키로 닫기, 포커스 가두기(focus trap), 배경 스크롤 잠금은 Radix 가 처리한다.
 * - 작은 화면에서도 내용이 길면 창 내부에서 스크롤된다. (base.md 4.5)
 */
import { Dialog as RadixDialog } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

interface DialogContentProps extends ComponentProps<typeof RadixDialog.Content> {
  title: string;
  description?: ReactNode;
  /** 제목 표시줄 색상 */
  tone?: "sky" | "pink" | "lavender" | "yellow";
}

const toneClass = { sky: "bg-sky", pink: "bg-primary-disabled", lavender: "bg-lavender", yellow: "bg-memo" };

export function DialogContent({ title, description, tone = "sky", className, children, ...props }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xs border-2 border-line-strong bg-surface shadow-window focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className={cn("flex items-center justify-between border-b-2 border-line-strong px-3 py-1.5", toneClass[tone])}>
          <RadixDialog.Title className="text-title-sm text-ink">{title}</RadixDialog.Title>
          <RadixDialog.Close className="grid size-9 place-items-center rounded-xs hover:bg-white/60" aria-label="닫기">
            <X className="size-4" aria-hidden />
          </RadixDialog.Close>
        </div>
        <div className="overflow-y-auto p-4">
          {description ? (
            <RadixDialog.Description className="mb-4 text-body-sm text-body">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          {children}
        </div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
