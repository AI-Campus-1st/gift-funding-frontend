/**
 * 생일 캘린더 · 알림 API (API_SPEC 3.6, F-15 · F-16)
 * 사용 위치: 홈(빨간 점, 캘린더 미리보기), 생일 캘린더(UI-28), 알림(UI-29)
 * 알림 생성(하루 전 · 당일)과 중복 방지는 서버가 한다. 알림 클릭 경로는 매퍼가 만든다.
 */
import type { AppNotification, BirthdayEvent, BirthdayEventInput } from "@/types";
import type { BirthdayEventDto, IdDto, LinkableFundingDto, NotificationDto, UnreadCountDto } from "./dto";
import { http, path } from "./http";
import { fromDto, toDto, toNotification } from "./mappers";

export { fundingPathOf } from "@/lib/paths";

/** C1 내 생일 일정 */
export async function listBirthdayEvents(): Promise<BirthdayEvent[]> {
  return fromDto<BirthdayEvent[]>(await http.get<BirthdayEventDto[]>("/birthday-events"));
}

/** C2 생일 일정에 연결할 수 있는 펀딩 (내가 열람 가능한 펀딩만) */
export async function listLinkableFundings(): Promise<{ id: string; name: string }[]> {
  return http.get<LinkableFundingDto[]>("/birthday-events/linkable-fundings");
}

/** C3 일정 등록 */
export async function createBirthdayEvent(input: BirthdayEventInput): Promise<void> {
  await http.post<IdDto>("/birthday-events", toDto(input));
}

/** C4 일정 수정 */
export async function updateBirthdayEvent(eventId: string, input: BirthdayEventInput): Promise<void> {
  await http.put<void>(path`/birthday-events/${eventId}`, toDto(input));
}

/** C5 일정 삭제 — 이 일정의 알림도 서버가 함께 삭제 */
export async function deleteBirthdayEvent(eventId: string): Promise<void> {
  await http.delete(path`/birthday-events/${eventId}`);
}

/** N1 알림 목록 (최신순) */
export async function listNotifications(): Promise<AppNotification[]> {
  return (await http.get<NotificationDto[]>("/notifications")).map(toNotification);
}

/** N2 읽지 않은 알림 존재 여부 (홈 상단 빨간 점) */
export async function hasUnreadNotifications(): Promise<boolean> {
  return (await http.get<UnreadCountDto>("/notifications/unread-count")).count > 0;
}

/** N3 알림 읽음 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await http.patch<void>(path`/notifications/${notificationId}`, { is_read: true });
}

/** N4 모두 읽음 */
export async function markAllNotificationsRead(): Promise<void> {
  await http.post<void>("/notifications/read-all");
}
