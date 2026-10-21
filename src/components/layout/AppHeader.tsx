"use client";

/**
 * AppHeader — 상단 공통 헤더 (base.md 6.1 app-header, 약 56px)
 *
 * - 왼쪽: 뒤로 가기(backHref 또는 onBack) 또는 서비스 로고
 * - 가운데: 화면 제목
 * - 오른쪽: 알림 버튼(showBell) — 읽지 않은 알림이 있으면 숫자 없는 빨간 점 (02_home.md 2.1)
 */
import Link from "next/link";
import { Bell, ChevronLeft, Gift } from "lucide-react";
import type { ReactNode } from "react";
import { WindowControls } from "./RetroWindow";

interface AppHeaderProps {
  title: string;
  backHref?: string;
  onBack?: () => void;
  showBell?: boolean;
  hasUnread?: boolean;
  right?: ReactNode;
}

export function AppHeader({ title, backHref, onBack, showBell, hasUnread, right }: AppHeaderProps) {
  const backClass = "grid size-11 place-items-center rounded-sm text-ink hover:bg-white/70";
  return (
    <header className="sticky top-0 z-30 border-b-2 border-line-strong bg-surface-soft">
      <div className="relative flex h-14 items-center gap-1 px-2">
        <div className="flex min-w-11 items-center">
          {onBack ? (
            <button type="button" onClick={onBack} className={backClass} aria-label="뒤로 가기">
              <ChevronLeft aria-hidden />
            </button>
          ) : backHref ? (
            <Link href={backHref} className={backClass} aria-label="뒤로 가기">
              <ChevronLeft aria-hidden />
            </Link>
          ) : (
            <span className="grid size-11 place-items-center text-primary-active" aria-hidden>
              <Gift />
            </span>
          )}
        </div>
        <h1 className="min-w-0 flex-1 truncate text-center text-title-md text-ink">{title}</h1>
        <div className="flex min-w-11 items-center justify-end">
          {right}
          {showBell && (
            <Link
              href="/notifications"
              className="relative grid size-11 place-items-center rounded-sm text-ink hover:bg-white/70"
              aria-label={hasUnread ? "알림, 읽지 않은 알림 있음" : "알림"}
            >
              <Bell aria-hidden />
              {hasUnread && <span aria-hidden className="absolute right-2.5 top-2.5 size-2.5 rounded-full border border-surface bg-error" />}
            </Link>
          )}
          {!right && !showBell && (
            <span className="pr-1">
              <WindowControls />
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
