"use client";

/**
 * UI-08 마이페이지 (/mypage) — 하단 탭 화면
 * - 프로필(사진 · 이름 · 이메일 · 생일) 표시
 * - 메뉴: 프로필 수정(UI-25) · 선물 취향 설정(UI-26) · 축하 편지함(UI-27) · 생일 캘린더(UI-28) · 로그아웃(→ UI-01)
 */
import Link from "next/link";
import { useState } from "react";
import { CalendarHeart, ChevronRight, Heart, KeyRound, LogOut, Mail, UserPen } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { ProfileAvatar } from "@/components/common/ProfileAvatar";
import { withFreshState } from "@/lib/withFreshState";

const MENU = [
  { href: "/edit-profile", label: "프로필 수정", icon: UserPen },
  { href: "/change-password", label: "비밀번호 변경", icon: KeyRound },
  { href: "/gift-preferences", label: "선물 취향 설정", icon: Heart },
  { href: "/message-inbox", label: "축하 편지함", icon: Mail },
  { href: "/birthday-calendar", label: "생일 캘린더", icon: CalendarHeart },
];

function MyPage() {
  const { user, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    // 전체 새로고침으로 이동: 숨겨 보관 중인 이전 화면(Activity)의 개인 데이터까지 모두 비운다
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 로그아웃은 의도적으로 전체 새로고침 (Next.js 문서 권장)
    window.location.assign("/");
  }

  return (
    <Screen title="마이페이지" tabBar>
      {user && (
        <RetroWindow title="my_profile.exe" tone="pink">
          <div className="flex items-center gap-4">
            <ProfileAvatar name={user.name} image={user.profileImage} />
            <div className="min-w-0">
              <p className="text-display-md text-ink">{user.name}</p>
              <p className="truncate text-body-sm text-muted">{user.email}</p>
              <p className="mt-1 text-body-sm text-body">🎂 {formatDate(user.birthday)}</p>
            </div>
          </div>
        </RetroWindow>
      )}

      <nav aria-label="마이페이지 메뉴">
        <ul className="divide-y-2 divide-hairline rounded-xs border-2 border-line bg-surface shadow-window">
          {MENU.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-surface-soft">
                <Icon className="size-5 text-primary-active" aria-hidden />
                <span className="flex-1 text-body-md text-ink">{label}</span>
                <ChevronRight className="size-4 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setLogoutOpen(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-surface-soft">
              <LogOut className="size-5 text-muted" aria-hidden />
              <span className="flex-1 text-body-md text-body">로그아웃</span>
            </button>
          </li>
        </ul>
      </nav>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="로그아웃"
        description="로그아웃할까요?"
        confirmLabel="로그아웃"
        loading={loggingOut}
        onConfirm={handleLogout}
      />
    </Screen>
  );
}

export default withFreshState(MyPage);
