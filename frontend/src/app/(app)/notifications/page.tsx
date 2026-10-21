"use client";

/**
 * UI-29 알림 목록 (/notifications)
 * - 생일 하루 전 · 당일 알림 (종류 · 제목 · 내용 · 발생 시각 · 읽음 여부)
 * - 알림 선택 → 읽음 처리 후 관련 펀딩(권한 있을 때) 또는 생일 캘린더로 이동
 * - 모두 읽으면 홈 상단 종 아이콘의 빨간 점이 사라진다.
 */
import { useRouter } from "next/navigation";
import { AlertTriangle, BellRing, CheckCheck, Gift } from "lucide-react";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api/client";
import { useMarkAllNotificationsReadMutation, useMarkNotificationReadMutation, useNotificationsQuery } from "@/hooks/queries/schedule";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types";
import { toast } from "sonner";
import { withFreshState } from "@/lib/withFreshState";

/** 알림 종류별 배지 (생일 하루 전 · 당일 · 미달 처리) */
const NOTIFICATION_BADGE: Record<NotificationType, { label: string; tone: "pink" | "info" | "warning" }> = {
  "birthday-today": { label: "생일 당일", tone: "pink" },
  "birthday-before": { label: "생일 하루 전", tone: "info" },
  "shortfall-reminder": { label: "미달 처리", tone: "warning" },
};

function NotificationsPage() {
  const router = useRouter();
  const state = useNotificationsQuery();
  const markRead = useMarkNotificationReadMutation();
  const markAllMutation = useMarkAllNotificationsReadMutation();
  const markingAll = markAllMutation.isPending;

  async function open(n: AppNotification) {
    try {
      if (!n.isRead) await markRead.mutateAsync(n.id);
    } catch {
      // 읽음 처리 실패해도 이동은 진행
    }
    router.push(n.href);
  }

  async function markAll() {
    try {
      await markAllMutation.mutateAsync();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Screen title="알림" backHref="/home">
      <AsyncBoundary state={state}>
        {(list) => {
          if (list.length === 0) return <EmptyState message="아직 받은 알림이 없어요." description="친구 생일을 캘린더에 등록하면 하루 전과 당일에 알려드려요." />;
          const unread = list.filter((n) => !n.isRead).length;
          return (
            <>
              <div className="flex items-center justify-between">
                <p className="text-body-sm text-body">
                  읽지 않은 알림 <strong className="text-primary-active">{unread}</strong>개
                </p>
                <Button variant="tertiary" size="sm" onClick={markAll} disabled={unread === 0} loading={markingAll}>
                  <CheckCheck aria-hidden /> 모두 읽음
                </Button>
              </div>
              <ul className="flex flex-col gap-2">
                {list.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => open(n)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xs border-2 p-3.5 text-left",
                        n.isRead ? "border-hairline bg-surface" : "border-line bg-surface-soft shadow-window",
                      )}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-sm border-2 border-line-strong bg-surface" aria-hidden>
                        {n.type === "shortfall-reminder" ? (
                          <AlertTriangle className="size-5 text-warning" />
                        ) : n.type === "birthday-today" ? (
                          <Gift className="size-5 text-primary-active" />
                        ) : (
                          <BellRing className="size-5 text-info" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <Badge tone={NOTIFICATION_BADGE[n.type].tone}>{NOTIFICATION_BADGE[n.type].label}</Badge>
                          {!n.isRead && (
                            <span className="text-caption text-error">
                              <span aria-hidden>●</span> 안 읽음
                            </span>
                          )}
                        </span>
                        <span className={cn("mt-1 block text-title-sm", n.isRead ? "text-body" : "text-ink")}>{n.title}</span>
                        <span className="block text-body-sm text-muted">{n.body}</span>
                        <span className="mt-1 block text-caption font-normal text-muted-soft">{formatDateTime(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(NotificationsPage);
