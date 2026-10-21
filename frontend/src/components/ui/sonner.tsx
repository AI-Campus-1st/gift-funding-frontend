"use client";

/** Toaster — 성공 · 오류 토스트 알림 (sonner). 사용: import { toast } from "sonner"; toast.success("저장했어요") */
import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!rounded-xs !border-2 !border-line-strong !bg-surface !text-ink !shadow-window !font-sans",
          title: "!text-body-sm !font-semibold",
        },
      }}
    />
  );
}
