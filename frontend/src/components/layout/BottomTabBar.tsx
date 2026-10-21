"use client";

/**
 * BottomTabBar — 하단 5개 탭 (홈 / 내 펀딩 / 그룹 / 친구 펀딩 / 마이페이지)
 * - 앱 너비(최대 430px)에 맞춰 화면 하단에 고정, 모바일 안전 영역(safe-area) 고려
 * - 활성 탭은 핑크색 + aria-current="page"
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Home, User, Users, HeartHandshake } from "lucide-react";
import { cn } from "@/lib/utils";

export const TABS = [
  { href: "/home", label: "홈", icon: Home, match: ["/home"] },
  { href: "/my-funding", label: "내 펀딩", icon: Gift, match: ["/my-funding", "/create-funding", "/add-gift", "/ai-recommend"] },
  { href: "/group", label: "그룹", icon: Users, match: ["/group", "/create-group"] },
  { href: "/friend-funding", label: "친구 펀딩", icon: HeartHandshake, match: ["/friend-funding", "/join-invite", "/donation", "/my-donations"] },
  { href: "/mypage", label: "마이페이지", icon: User, match: ["/mypage", "/edit-profile", "/gift-preferences", "/message-inbox"] },
];

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-[var(--app-max-width)] -translate-x-1/2 grid-cols-5 border-t-2 border-line-strong bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match.some((m) => pathname === m || pathname.startsWith(`${m}/`) || pathname.startsWith(`${m}-`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold max-[374px]:text-[10px]",
              active ? "text-primary-active" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-6" strokeWidth={active ? 2.5 : 2} aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
