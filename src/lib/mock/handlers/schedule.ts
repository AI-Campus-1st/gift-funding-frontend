/**
 * Mock 서버 — 생일 캘린더 · 알림 (API_SPEC 3.6, F-15 · F-16)
 *
 * 알림 생성: 실제 서버는 APScheduler 가 매일 만들지만, Mock 은 알림을 조회할 때
 * "오늘 기준 하루 전 / 당일" 생일 일정을 확인해 만든다. dedupeKey(일정 + 유형 + 날짜)로 중복을 막는다.
 * 알림 응답에는 화면 경로 대신 이동 대상 정보(fundingId · 열람 가능 여부)를 준다. 경로는 프론트 매퍼가 만든다.
 */
import { ApiError } from "@/lib/api/client";
import { SHORTFALL_DEADLINE_DAYS, TEXT_LIMITS, tooLongMessage } from "@/lib/constants";
import { daysUntilNextBirthday, parseLocalDate, toDateString, todayString } from "@/lib/format";
import type { BirthdayEvent, BirthdayEventInput } from "@/types";
import { canViewFunding, findUser, giftsOf, raisedForGift, toFundingBase } from "../access";
import { createId, getDb, saveDb, type DbBirthdayEvent, type DbNotification, type MockDatabase } from "../db";
import { bodyOf, requireUser, route, type MockContext } from "./context";

function toEvent(db: MockDatabase, e: DbBirthdayEvent, userId: string): BirthdayEvent {
  const funding = e.linkedFundingId ? db.fundings.find((f) => f.id === e.linkedFundingId) : undefined;
  const canOpen = !!funding && canViewFunding(db, funding, userId);
  return {
    id: e.id,
    friendName: e.friendName,
    birthday: e.birthday,
    linkedFundingId: e.linkedFundingId,
    linkedFundingName: canOpen ? funding!.name : null, // 접근 권한이 없는 펀딩은 이름도 공개하지 않는다
    canOpenLinkedFunding: canOpen,
    linkedFundingIsMine: canOpen && funding!.ownerId === userId,
  };
}

function validateEventInput(db: MockDatabase, input: BirthdayEventInput, userId: string): void {
  const fieldErrors: Record<string, string> = {};
  if (!input.friendName || input.friendName.trim().length === 0) fieldErrors.friendName = "친구 이름을 입력해 주세요.";
  else if (input.friendName.trim().length > TEXT_LIMITS.friendName) fieldErrors.friendName = tooLongMessage("친구 이름은", TEXT_LIMITS.friendName);
  if (!parseLocalDate(input.birthday ?? "")) fieldErrors.birthday = "올바른 생일을 선택해 주세요.";
  if (input.linkedFundingId) {
    const funding = db.fundings.find((f) => f.id === input.linkedFundingId);
    if (!funding || !canViewFunding(db, funding, userId)) fieldErrors.linkedFundingId = "접근 가능한 펀딩만 연결할 수 있어요.";
  }
  if (Object.keys(fieldErrors).length > 0) throw new ApiError("VALIDATION", "입력값을 확인해 주세요.", { fieldErrors });
}

function getOwnEvent(db: MockDatabase, eventId: string, userId: string): DbBirthdayEvent {
  const event = db.birthdayEvents.find((e) => e.id === eventId);
  if (!event) throw new ApiError("NOT_FOUND", "존재하지 않는 일정이에요.");
  if (event.ownerId !== userId) throw new ApiError("FORBIDDEN", "본인이 등록한 일정만 관리할 수 있어요.");
  return event;
}

/** C3 일정 등록 */
function createBirthdayEvent(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const input = bodyOf<BirthdayEventInput>(ctx);
  validateEventInput(db, input, userId);
  const id = createId("be");
  db.birthdayEvents.push({ id, ownerId: userId, friendName: input.friendName.trim(), birthday: input.birthday, linkedFundingId: input.linkedFundingId ?? null });
  saveDb();
  return { id };
}

/** C4 일정 수정 */
function updateBirthdayEvent(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const event = getOwnEvent(db, ctx.params.eventId, userId);
  const input = bodyOf<BirthdayEventInput>(ctx);
  validateEventInput(db, input, userId);
  event.friendName = input.friendName.trim();
  event.birthday = input.birthday;
  event.linkedFundingId = input.linkedFundingId ?? null;
  saveDb();
  return undefined;
}

/** C5 일정 삭제 — 이 일정으로 만든 알림도 함께 삭제 (D-S1-1) */
function deleteBirthdayEvent(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const event = getOwnEvent(db, ctx.params.eventId, userId);
  db.birthdayEvents = db.birthdayEvents.filter((e) => e.id !== event.id);
  db.notifications = db.notifications.filter((n) => n.eventId !== event.id);
  saveDb();
  return undefined;
}

/* ───────── 알림 ───────── */

function ensureBirthdayNotifications(db: MockDatabase, userId: string): void {
  const today = todayString();
  let changed = false;
  for (const event of db.birthdayEvents.filter((e) => e.ownerId === userId)) {
    const days = daysUntilNextBirthday(event.birthday);
    if (days > 1) continue;
    const type = days === 0 ? "birthday-today" : "birthday-before";
    const dedupeKey = `${event.id}:${type}:${today}`;
    if (db.notifications.some((n) => n.userId === userId && n.dedupeKey === dedupeKey)) continue;
    db.notifications.push({
      id: createId("n"),
      userId,
      type,
      title: days === 0 ? `오늘은 ${event.friendName}님의 생일이에요 🎂` : `내일은 ${event.friendName}님의 생일이에요 🎁`,
      body: days === 0 ? "축하 메시지와 함께 마음을 전해 보세요." : "미리 생일 펀딩을 확인해 보세요.",
      eventId: event.id,
      fundingId: null, // 생일 알림은 펀딩을 저장하지 않는다. 볼 때 일정의 현재 연결 펀딩으로 판단 (2026-10-19 확정)
      dedupeKey,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  if (ensureShortfallReminders(db, userId)) changed = true;
  if (changed) saveDb();
}


/**
 * 미달 처리 알림: 종료 후 7일이 지났는데 이월 / 인출을 고르지 않은 선물(모금액 > 0)이 있는 펀딩마다 한 번만
 * (실제 서버에서는 매일 도는 알림 작업이 만든다)
 */
function ensureShortfallReminders(db: MockDatabase, userId: string): boolean {
  const today = todayString();
  let changed = false;
  for (const funding of db.fundings.filter((f) => f.ownerId === userId)) {
    if (toFundingBase(db, funding).status !== "ended") continue;
    const end = parseLocalDate(funding.endDate);
    if (!end) continue;
    const deadline = toDateString(new Date(end.getFullYear(), end.getMonth(), end.getDate() + SHORTFALL_DEADLINE_DAYS));
    if (today <= deadline) continue;
    const pending = giftsOf(db, funding.id).filter((g) => !g.shortfallAction && raisedForGift(db, g.id) > 0 && raisedForGift(db, g.id) < g.price);
    if (pending.length === 0) continue;
    const dedupeKey = `${funding.id}:shortfall-reminder`;
    if (db.notifications.some((n) => n.userId === userId && n.dedupeKey === dedupeKey)) continue;
    db.notifications.push({
      id: createId("n"),
      userId,
      type: "shortfall-reminder",
      title: `'${funding.name}' 목표 미달 선물을 처리해 주세요`,
      body: `펀딩이 끝난 지 ${SHORTFALL_DEADLINE_DAYS}일이 지났어요. 선물 ${pending.length}개의 이월 또는 인출을 선택해 주세요.`,
      eventId: null,
      fundingId: funding.id,
      dedupeKey,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  return changed;
}

/** 알림 응답: 연결 일정의 현재 펀딩 연결 · 열람 권한을 함께 준다 (미달 처리 알림은 본인 펀딩) */
function toNotificationResponse(db: MockDatabase, n: DbNotification, userId: string) {
  if (n.type === "shortfall-reminder") {
    return { id: n.id, type: n.type, title: n.title, body: n.body, createdAt: n.createdAt, isRead: n.isRead, eventId: null, fundingId: n.fundingId, canOpenFunding: true, fundingIsMine: true };
  }
  const event = db.birthdayEvents.find((e) => e.id === n.eventId);
  const view = event ? toEvent(db, event, userId) : null;
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    isRead: n.isRead,
    eventId: n.eventId,
    fundingId: view?.linkedFundingId ?? null,
    canOpenFunding: view?.canOpenLinkedFunding ?? false,
    fundingIsMine: view?.linkedFundingIsMine ?? false,
  };
}

function listNotifications(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  findUser(db, userId);
  ensureBirthdayNotifications(db, userId);
  return db.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((n) => toNotificationResponse(db, n, userId));
}

function unreadCount(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  ensureBirthdayNotifications(db, userId);
  return { count: db.notifications.filter((n) => n.userId === userId && !n.isRead).length };
}

function markRead(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const n = db.notifications.find((x) => x.id === ctx.params.notificationId && x.userId === userId);
  if (!n) throw new ApiError("NOT_FOUND", "알림을 찾을 수 없어요.");
  if (bodyOf<{ isRead?: boolean }>(ctx).isRead !== false) n.isRead = true;
  saveDb();
  return undefined;
}

function markAllRead(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  db.notifications.forEach((n) => {
    if (n.userId === userId) n.isRead = true;
  });
  saveDb();
  return undefined;
}

export const scheduleRoutes = [
  route("GET", "/birthday-events", (ctx) => {
    const db = getDb();
    const userId = requireUser(ctx);
    return db.birthdayEvents.filter((e) => e.ownerId === userId).map((e) => toEvent(db, e, userId));
  }),
  route("GET", "/birthday-events/linkable-fundings", (ctx) => {
    const db = getDb();
    const userId = requireUser(ctx);
    return db.fundings.filter((f) => canViewFunding(db, f, userId)).map((f) => ({ id: f.id, name: f.name }));
  }),
  route("POST", "/birthday-events", createBirthdayEvent, { status: 201 }),
  route("PUT", "/birthday-events/:eventId", updateBirthdayEvent),
  route("DELETE", "/birthday-events/:eventId", deleteBirthdayEvent),
  route("GET", "/notifications", listNotifications),
  route("GET", "/notifications/unread-count", unreadCount, { delay: 100 }),
  route("POST", "/notifications/read-all", markAllRead, { delay: 150 }),
  route("PATCH", "/notifications/:notificationId", markRead, { delay: 100 }),
];
