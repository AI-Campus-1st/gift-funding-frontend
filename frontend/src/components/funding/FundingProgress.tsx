/**
 * FundingProgress — 목표 달성률 진행률 바 (0~100%)
 * - 숫자 텍스트와 role="progressbar" 접근성 속성을 함께 제공한다 (base.md 8.1)
 * - 100% 달성 시 성공 색상 + "100% 달성" 문구 (base.md 2.4)
 */
import { cn } from "@/lib/utils";

interface FundingProgressProps {
  rate: number;
  label: string; // 스크린리더용 이름 (예: "헤드폰 목표 달성률")
  size?: "sm" | "md";
  showText?: boolean;
}

export function FundingProgress({ rate, label, size = "md", showText = true }: FundingProgressProps) {
  const value = Math.min(100, Math.max(0, Math.round(rate)));
  const achieved = value >= 100;
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={achieved ? "100% 달성" : `${value}%`}
        className={cn("flex-1 overflow-hidden rounded-full border border-line bg-surface-strong", size === "sm" ? "h-2" : "h-3")}
      >
        <div className={cn("h-full rounded-full transition-[width]", achieved ? "bg-success" : "bg-primary")} style={{ width: `${value}%` }} />
      </div>
      {showText && (
        <span className={cn("min-w-[4.5rem] text-right text-body-sm font-bold tabular-nums", achieved ? "text-success" : "text-ink")}>
          {achieved ? "100% 달성" : `${value}%`}
        </span>
      )}
    </div>
  );
}
