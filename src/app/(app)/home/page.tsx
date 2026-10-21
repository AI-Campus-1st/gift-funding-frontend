"use client";

/**
 * UI-04 홈 (/home) — 로그인 후 기본 화면, 하단 탭 화면
 *
 * - 상단: 알림 버튼 (읽지 않은 알림이 있으면 숫자 없는 빨간 점) → UI-29
 * - 환영 카드: 이름 · 내 생일 · D-day
 * - 내 펀딩 요약(실제 모금액 + 달성률) / 친구 펀딩 요약(달성률만) / 생일 캘린더 미리보기
 * - 그룹 요약 · 최근 알림 목록은 홈에 표시하지 않는다. (02_home.md 1.1)
 * 각 영역은 따로 불러오므로 한 영역이 실패해도 나머지는 표시된다.
 */
import Link from "next/link";
import { CalendarHeart, Plus } from "lucide-react";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { FriendFundingCard, MyFundingCard } from "@/components/funding/FundingCards";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { daysUntilNextBirthday, formatDday, formatMonthDay } from "@/lib/format";
import { useFriendFundingsQuery, useMyFundingsQuery } from "@/hooks/queries/fundings";
import { useBirthdayEventsQuery, useHasUnreadNotificationsQuery } from "@/hooks/queries/schedule";
import { withFreshState } from "@/lib/withFreshState";

const PREVIEW_COUNT = 2;
const CALENDAR_PREVIEW_COUNT = 3;

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="shrink-0 rounded-xs px-1.5 py-0.5 text-caption font-bold text-ink underline underline-offset-2 hover:bg-white/60" aria-label={`${label} 전체 보기`}>
      전체 보기
    </Link>
  );
}

function HomePage() {
  const { user } = useAuth();
  const unread = useHasUnreadNotificationsQuery();
  const myFundings = useMyFundingsQuery();
  const friendFundings = useFriendFundingsQuery();
  const events = useBirthdayEventsQuery();

  const dday = user ? daysUntilNextBirthday(user.birthday) : null;

  return (
    <Screen title="홈" showBell hasUnread={unread.data === true} tabBar>
      {user && (
        <RetroWindow title="welcome.exe" tone="pink" bodyClassName="bg-holo p-5">
          <p className="text-display-md text-ink">{user.name}님, 반가워요! 🎂</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-body-sm text-body">내 생일: {formatMonthDay(user.birthday)}</p>
            <p className="rounded-sm border-2 border-line-strong bg-surface px-3 py-1 text-title-md tabular-nums text-primary-active shadow-button">
              {dday === 0 ? "오늘은 내 생일! 🎉" : `생일까지 ${formatDday(dday ?? 0)}`}
            </p>
          </div>
        </RetroWindow>
      )}

      <RetroWindow title="내 펀딩" tone="lavender" titleId="home-my" action={<ViewAll href="/my-funding" label="내 펀딩" />} bodyClassName="flex flex-col gap-3 p-3">
        <AsyncBoundary state={myFundings}>
          {(list) => {
            const active = list.filter((f) => f.status !== "ended").slice(0, PREVIEW_COUNT);
            return active.length === 0 ? (
              <p className="py-2 text-center text-body-sm text-muted">아직 진행 중인 펀딩이 없어요.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {active.map((f) => (
                  <li key={f.id}>
                    <MyFundingCard funding={f} compact />
                  </li>
                ))}
              </ul>
            );
          }}
        </AsyncBoundary>
        <Button asChild variant="secondary" size="md" block>
          <Link href="/create-funding">
            <Plus aria-hidden /> 펀딩 만들기
          </Link>
        </Button>
      </RetroWindow>

      <RetroWindow title="친구 펀딩" tone="sky" titleId="home-friend" action={<ViewAll href="/friend-funding" label="친구 펀딩" />} bodyClassName="flex flex-col gap-3 p-3">
        <AsyncBoundary state={friendFundings}>
          {(list) => {
            const active = list.filter((f) => f.status !== "ended").slice(0, PREVIEW_COUNT);
            return active.length === 0 ? (
              <p className="py-2 text-center text-body-sm text-muted">아직 참여한 친구 펀딩이 없어요.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {active.map((f) => (
                  <li key={f.id}>
                    <FriendFundingCard funding={f} />
                  </li>
                ))}
              </ul>
            );
          }}
        </AsyncBoundary>
        <Button asChild variant="secondary" size="md" block>
          <Link href="/join-invite">+ 친구 펀딩 참여하기</Link>
        </Button>
      </RetroWindow>

      <RetroWindow title="생일 캘린더" tone="yellow" titleId="home-calendar" action={<ViewAll href="/birthday-calendar" label="생일 캘린더" />} bodyClassName="p-3">
        <AsyncBoundary state={events} skeleton={false}>
          {(list) => {
            const upcoming = [...list]
              .map((e) => ({ ...e, days: daysUntilNextBirthday(e.birthday) }))
              .sort((a, b) => a.days - b.days)
              .slice(0, CALENDAR_PREVIEW_COUNT);
            if (upcoming.length === 0) return <EmptyState message="등록된 생일 일정이 없어요." className="py-5" />;
            return (
              <ul className="flex flex-col gap-2">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-sm bg-surface-soft px-3 py-2">
                    <CalendarHeart className="size-5 shrink-0 text-primary-active" aria-hidden />
                    <span className="flex-1 truncate text-body-sm text-ink">
                      <strong>{e.friendName}</strong> · {formatMonthDay(e.birthday)}
                    </span>
                    <span className="text-caption tabular-nums text-primary-active">{formatDday(e.days)}</span>
                  </li>
                ))}
              </ul>
            );
          }}
        </AsyncBoundary>
      </RetroWindow>
    </Screen>
  );
}

export default withFreshState(HomePage);
