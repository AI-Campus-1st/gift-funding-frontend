/**
 * 생일 캘린더 · 알림 데이터 훅 (F-15 · F-16)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBirthdayEvent,
  deleteBirthdayEvent,
  hasUnreadNotifications,
  listBirthdayEvents,
  listLinkableFundings,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateBirthdayEvent,
} from "@/lib/api/schedule";
import type { BirthdayEventInput } from "@/types";
import { queryKeys } from "../queryKeys";

export function useBirthdayEventsQuery() {
  return useQuery({ queryKey: queryKeys.birthdayEvents.all, queryFn: listBirthdayEvents });
}

export function useLinkableFundingsQuery() {
  return useQuery({ queryKey: queryKeys.birthdayEvents.linkable, queryFn: listLinkableFundings });
}

/** 일정 등록 · 수정 · 삭제 공통 무효화 — 알림은 일정으로 만들어지므로 함께 갱신 */
function useScheduleMutation<V>(fn: (vars: V) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.birthdayEvents.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useSaveBirthdayEventMutation() {
  return useScheduleMutation(({ eventId, input }: { eventId: string | null; input: BirthdayEventInput }) =>
    eventId ? updateBirthdayEvent(eventId, input) : createBirthdayEvent(input),
  );
}

export function useDeleteBirthdayEventMutation() {
  return useScheduleMutation((eventId: string) => deleteBirthdayEvent(eventId));
}

export function useNotificationsQuery() {
  return useQuery({ queryKey: queryKeys.notifications.all, queryFn: listNotifications });
}

export function useHasUnreadNotificationsQuery(enabled = true) {
  return useQuery({ queryKey: queryKeys.notifications.unread, queryFn: hasUnreadNotifications, enabled, staleTime: 0 });
}

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
