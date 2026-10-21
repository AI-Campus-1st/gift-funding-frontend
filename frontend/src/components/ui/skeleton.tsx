import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Skeleton — 로딩 중 임시 형태 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-surface-strong", className)} {...props} />;
}
