/**
 * Screen — 각 화면의 공통 뼈대: 헤더 + 본문(screen-content) + (선택) 하단 탭
 *
 * - tabBar: 하단 5개 탭을 보여줄 화면(홈 · 내 펀딩 · 그룹 · 친구 펀딩 · 마이페이지)에만 true
 * - 본문 아래쪽에 하단 탭 높이만큼 여백을 확보해 마지막 카드가 가려지지 않게 한다. (base.md 4.5)
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppHeader } from "./AppHeader";
import { BottomTabBar } from "./BottomTabBar";

interface ScreenProps {
  title: string;
  backHref?: string;
  onBack?: () => void;
  showBell?: boolean;
  hasUnread?: boolean;
  headerRight?: ReactNode;
  tabBar?: boolean;
  className?: string;
  children: ReactNode;
}

export function Screen({ title, backHref, onBack, showBell, hasUnread, headerRight, tabBar, className, children }: ScreenProps) {
  return (
    <>
      <AppHeader title={title} backHref={backHref} onBack={onBack} showBell={showBell} hasUnread={hasUnread} right={headerRight} />
      <main
        id="main-content"
        className={cn(
          "flex flex-col gap-6 px-4 pt-5 max-[374px]:px-3",
          tabBar ? "pb-[calc(var(--bottom-tab-height)+env(safe-area-inset-bottom)+24px)]" : "pb-10",
          className,
        )}
      >
        {children}
      </main>
      {tabBar && <BottomTabBar />}
    </>
  );
}
