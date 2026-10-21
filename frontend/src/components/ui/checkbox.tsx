"use client";

import { Checkbox as RadixCheckbox } from "radix-ui";
import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Checkbox — 동의 · 선택 상태 (Radix Checkbox) */
export function Checkbox({ className, ...props }: ComponentProps<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-xs border-2 border-line-strong bg-surface data-[state=checked]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator>
        <Check className="size-3.5 text-on-primary" strokeWidth={3.5} aria-hidden />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}
