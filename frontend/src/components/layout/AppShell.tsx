/**
 * AppShell — 브라우저 가운데 배치되는 모바일 앱 형태의 컨테이너 (base.md 4.2 필수 규칙)
 *
 * - 600px 미만: 화면 전체 너비, 외곽 테두리 · 그림자 없음
 * - 600px 이상: 최대 430px 앱 영역을 중앙 배치 + 바깥은 연보라 Y2K 배경과 장식 스티커
 * - 장식은 클릭 · 스크롤을 방해하지 않도록 pointer-events-none + aria-hidden
 * 사용 위치: src/app/layout.tsx (모든 화면 공통)
 */
import type { ReactNode } from "react";

const STICKERS = [
  { char: "♥", className: "left-[8%] top-[12%] text-5xl text-primary rotate-[-12deg]" },
  { char: "★", className: "left-[14%] bottom-[18%] text-6xl text-lavender rotate-[10deg]" },
  { char: "✉", className: "right-[10%] top-[18%] text-5xl text-sky rotate-[8deg]" },
  { char: "💿", className: "right-[12%] bottom-[14%] text-6xl rotate-[-8deg]" },
  { char: "🦋", className: "left-[22%] top-[48%] text-4xl" },
  { char: "✦", className: "right-[22%] top-[52%] text-4xl text-primary-hover" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 hidden select-none overflow-hidden min-[600px]:block">
        {STICKERS.map((s) => (
          <span key={s.char} className={`absolute opacity-70 ${s.className}`}>
            {s.char}
          </span>
        ))}
      </div>
      <div className="relative mx-auto min-h-dvh w-full max-w-[var(--app-max-width)] bg-canvas min-[600px]:border-x-2 min-[600px]:border-line min-[600px]:shadow-[6px_0_0_rgba(119,113,138,0.25)]">
        {children}
      </div>
    </>
  );
}
