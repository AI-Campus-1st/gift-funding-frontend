/**
 * MockBadge / MockNotice — 모의 처리 안내 (base.md 1.2 정책 16)
 * 실제 결제 · 송금이 구현되지 않았으므로 후원 · 정산 화면에 반드시 "모의 후원 / 모의 정산"을 표시한다.
 */
import { FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function MockBadge({ label }: { label: "모의 후원" | "모의 정산" }) {
  return (
    <Badge tone="info">
      <FlaskConical className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}

export function MockNotice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-sm border-2 border-dashed border-info bg-[#f1f5fc] px-3 py-2 text-caption font-medium text-info">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
