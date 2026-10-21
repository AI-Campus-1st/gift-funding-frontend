/**
 * Mock 서버 — 펀딩 · 선물 (API_SPEC 3.3, F-04 · F-07 · F-09 · F-13)
 *
 * - 생일자 조회(OwnerFundingView)에는 모금액 · 남은 금액을 넣는다.
 * - 후원자 조회(FriendFundingView)에서는 모금액 · 남은 금액을 응답에서 뺀다. (화면에서 숨기는 방식 아님)
 */
import { ApiError } from "@/lib/api/client";
import { TEXT_LIMITS, tooLongMessage } from "@/lib/constants";
import { validateFundingInput, validateGiftInput } from "@/lib/validation";
import type { FriendFundingView, FundingInput, GiftEditView, GiftInput, OwnerFundingView, PendingCarryover, SupporterDonation } from "@/types";
import {
  assertOwner,
  assertSupporter,
  canViewFunding,
  carriedOverForGift,
  getFundingOrThrow,
  giftsOf,
  raisedForGift,
  toFundingBase,
  toOwnerGift,
  toSupporterGift,
  userName,
} from "../access";
import { createId, getDb, saveDb, type DbFunding, type DbGift, type MockDatabase } from "../db";
import { bodyOf, requireUser, route, type MockContext } from "./context";
import { advanceMockSettlements } from "./settlements";

function toOwnerFunding(db: MockDatabase, f: DbFunding): OwnerFundingView {
  advanceMockSettlements(db); // 정산 상태(정산됨 표시)를 최신으로 맞춘다
  const gifts = giftsOf(db, f.id).map((g) => toOwnerGift(db, g));
  return { ...toFundingBase(db, f), gifts, totalRaised: gifts.reduce((s, g) => s + g.raisedAmount, 0) };
}

function toFriendFunding(db: MockDatabase, f: DbFunding): FriendFundingView {
  return { ...toFundingBase(db, f), gifts: giftsOf(db, f.id).map((g) => toSupporterGift(db, g)) };
}

const byNewest = (a: DbFunding, b: DbFunding) => b.startDate.localeCompare(a.startDate);

function assertGiftInput(input: GiftInput): void {
  const fieldErrors = validateGiftInput(input);
  if (Object.keys(fieldErrors).length > 0) throw new ApiError("VALIDATION", "선물 정보를 확인해 주세요.", { fieldErrors });
}

function trimGift(gift: GiftInput): GiftInput {
  return { name: gift.name.trim(), price: gift.price, imageUrl: gift.imageUrl, productUrl: gift.productUrl.trim(), description: (gift.description ?? "").trim() };
}

function getGiftOrThrow(db: MockDatabase, giftId: string): DbGift {
  const gift = db.gifts.find((g) => g.id === giftId);
  if (!gift) throw new ApiError("NOT_FOUND", "선물을 찾을 수 없어요.");
  return gift;
}

/* ───────── 내 펀딩 (생일자) ───────── */

/** F3 펀딩 생성 (+ 이월 선물 다시 열기, DATA_MODEL 6.9 D-S1-3) */
function createFunding(ctx: MockContext) {
  const input = bodyOf<FundingInput>(ctx);
  const db = getDb();
  const userId = requireUser(ctx);
  const gifts = input.gifts ?? [];
  const carryoverIds = Array.from(new Set(input.carryoverIds ?? []));
  const fieldErrors = validateFundingInput({ ...input, giftCount: gifts.length + carryoverIds.length });
  if (Object.keys(fieldErrors).length > 0) throw new ApiError("VALIDATION", "입력값을 확인해 주세요.", { fieldErrors });
  // 펀딩은 그 그룹을 만든 사람(관리자)만 열 수 있다 (2026-10-19 확정) — 이월 선물 다시 열기도 같다
  if (!db.groups.some((g) => g.id === input.groupId && g.adminId === userId)) throw new ApiError("FORBIDDEN", "내가 만든 그룹에만 펀딩을 열 수 있어요.");
  gifts.forEach(assertGiftInput);
  // 이월 기록은 본인 것 · 아직 다시 열지 않은 것만 (그룹은 새로 고를 수 있다)
  const carryovers = carryoverIds.map((id) => {
    const carryover = db.carryovers.find((c) => c.id === id && c.ownerId === userId);
    if (!carryover) throw new ApiError("NOT_FOUND", "이월 기록을 찾을 수 없어요.");
    if (carryover.status !== "pending") throw new ApiError("CONFLICT", "이미 다시 연 이월 선물이에요. 목록을 새로 고친 뒤 다시 선택해 주세요.");
    return carryover;
  });

  const funding: DbFunding = {
    id: createId("f"),
    ownerId: userId, // 펀딩을 만든 사용자가 생일자
    groupId: input.groupId,
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: new Date().toISOString(),
  };
  db.fundings.push(funding);
  for (const gift of gifts) {
    db.gifts.push({ id: createId("gift"), fundingId: funding.id, ...trimGift(gift), shortfallAction: null, settlementId: null });
  }
  // 이월 선물 다시 열기: 지난 선물 정보를 그대로 복사하고, 이월 금액은 carriedOverForGift 로 모금액에 합산된다
  const now = new Date().toISOString();
  for (const carryover of carryovers) {
    const source = getGiftOrThrow(db, carryover.giftId);
    const giftId = createId("gift");
    const { name, price, imageUrl, productUrl, description } = source;
    db.gifts.push({ id: giftId, fundingId: funding.id, name, price, imageUrl, productUrl, description, shortfallAction: null, settlementId: null });
    Object.assign(carryover, { status: "reopened", reopenedFundingId: funding.id, reopenedGiftId: giftId, reopenedAt: now });
  }
  saveDb();
  return { id: funding.id };
}

/** F5 기존 펀딩에 선물 추가 — 펀딩이 끝나기 전(예정 · 진행 중)에만 가능 (FEATURE_SPEC F-04, 2026-10-16 확정) */
function addGift(ctx: MockContext) {
  const db = getDb();
  const funding = getFundingOrThrow(db, ctx.params.fundingId);
  assertOwner(funding, requireUser(ctx));
  if (toFundingBase(db, funding).status === "ended") throw new ApiError("FUNDING_NOT_ACTIVE", "종료된 펀딩에는 선물을 추가할 수 없어요.");
  const input = bodyOf<GiftInput>(ctx);
  assertGiftInput(input);
  const id = createId("gift");
  db.gifts.push({ id, fundingId: funding.id, ...trimGift(input), shortfallAction: null, settlementId: null });
  saveDb();
  return { id };
}

/** F6 선물 수정용 조회 — hasDonations: 후원 또는 이월 금액이 있어 가격 · 삭제가 잠김 */
function getGiftForEdit(ctx: MockContext): GiftEditView {
  const db = getDb();
  const gift = getGiftOrThrow(db, ctx.params.giftId);
  assertOwner(getFundingOrThrow(db, gift.fundingId), requireUser(ctx));
  const { name, price, imageUrl, productUrl, description, fundingId } = gift;
  return { name, price, imageUrl, productUrl, description, fundingId, hasDonations: raisedForGift(db, gift.id) > 0 };
}

/** F7 선물 수정 — 후원 · 이월 금액이 있으면 가격(목표 금액)은 바꿀 수 없다 */
function updateGift(ctx: MockContext) {
  const db = getDb();
  const gift = getGiftOrThrow(db, ctx.params.giftId);
  assertOwner(getFundingOrThrow(db, gift.fundingId), requireUser(ctx));
  const input = bodyOf<GiftInput>(ctx);
  assertGiftInput(input);
  if (input.price !== gift.price && raisedForGift(db, gift.id) > 0) {
    throw new ApiError("GIFT_LOCKED", "후원 또는 이월 금액이 있는 선물은 가격(목표 금액)을 변경할 수 없어요.");
  }
  Object.assign(gift, trimGift(input));
  saveDb();
  return undefined;
}

/** F8 선물 삭제 — 후원 · 이월 금액이 있거나 마지막 1개인 선물은 삭제할 수 없다 */
function deleteGift(ctx: MockContext) {
  const db = getDb();
  const gift = getGiftOrThrow(db, ctx.params.giftId);
  assertOwner(getFundingOrThrow(db, gift.fundingId), requireUser(ctx));
  if (carriedOverForGift(db, gift.id) > 0) throw new ApiError("GIFT_LOCKED", "이월 금액이 포함된 선물은 삭제할 수 없어요.");
  if (raisedForGift(db, gift.id) > 0) throw new ApiError("GIFT_LOCKED", "후원이 발생한 선물은 삭제할 수 없어요.");
  if (giftsOf(db, gift.fundingId).length <= 1) throw new ApiError("GIFT_LOCKED", "펀딩에는 선물이 최소 1개 있어야 해요.");
  db.gifts = db.gifts.filter((g) => g.id !== gift.id);
  saveDb();
  return undefined;
}

/** F9 생일자 전용: 후원자별 이름 · 금액 · 일시 (UI-13) */
function listSupporterDonations(ctx: MockContext): SupporterDonation[] {
  const db = getDb();
  const funding = getFundingOrThrow(db, ctx.params.fundingId);
  assertOwner(funding, requireUser(ctx));
  return db.donations
    .filter((d) => d.fundingId === funding.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((d) => ({
      id: d.id,
      supporterName: userName(db, d.supporterId),
      giftId: d.giftId,
      giftName: db.gifts.find((g) => g.id === d.giftId)?.name ?? "",
      amount: d.amount,
      createdAt: d.createdAt,
    }));
}

/**
 * F4 펀딩 삭제 — 생일자 전용 (DATA_MODEL 6.4)
 * - 후원이 한 건이라도 있거나 이월 금액이 들어간 펀딩은 삭제할 수 없다.
 * - 선물 · 이 펀딩 전용 초대 링크 · 이 펀딩의 미달 처리 알림을 함께 삭제하고, 생일 일정의 펀딩 연결은 해제한다.
 * - 생일 알림은 남는다 (일정 연결이 끊겨 누르면 생일 캘린더로 이동).
 */
function deleteFunding(ctx: MockContext) {
  const db = getDb();
  const funding = getFundingOrThrow(db, ctx.params.fundingId);
  assertOwner(funding, requireUser(ctx));
  if (db.donations.some((d) => d.fundingId === funding.id)) throw new ApiError("CONFLICT", "후원이 들어온 펀딩은 삭제할 수 없어요.");
  if (db.carryovers.some((c) => c.reopenedFundingId === funding.id)) throw new ApiError("CONFLICT", "이월 금액이 포함된 펀딩은 삭제할 수 없어요.");
  db.fundings = db.fundings.filter((f) => f.id !== funding.id);
  db.gifts = db.gifts.filter((g) => g.fundingId !== funding.id);
  db.invites = db.invites.filter((i) => i.fundingId !== funding.id);
  // 펀딩 알림(미달 처리 알림)만 삭제. 생일 알림은 남기고, 일정 연결 해제로 펀딩 정보가 빠진다 (2026-10-19 확정)
  db.notifications = db.notifications.filter((n) => !(n.type === "shortfall-reminder" && n.fundingId === funding.id));
  db.birthdayEvents.forEach((e) => {
    if (e.linkedFundingId === funding.id) e.linkedFundingId = null;
  });
  saveDb();
  return undefined;
}

/**
 * F14 펀딩 정보 수정 — 펀딩 이름만 종료 전까지 바꿀 수 있다 (FEATURE_SPEC F-07, 2026-10-16 확정)
 * 기간(시작일 · 종료일)과 연결 그룹은 만든 뒤 수정할 수 없다.
 */
function updateFunding(ctx: MockContext) {
  const db = getDb();
  const funding = getFundingOrThrow(db, ctx.params.fundingId);
  assertOwner(funding, requireUser(ctx));
  const input = bodyOf<{ name?: string; startDate?: string; endDate?: string; groupId?: string }>(ctx);
  if (input.startDate !== undefined || input.endDate !== undefined || input.groupId !== undefined) {
    throw new ApiError("VALIDATION", "펀딩 기간과 연결 그룹은 수정할 수 없어요.");
  }
  if (toFundingBase(db, funding).status === "ended") throw new ApiError("FUNDING_NOT_ACTIVE", "종료된 펀딩은 수정할 수 없어요.");
  const name = (input.name ?? "").trim();
  if (name.length === 0) throw new ApiError("VALIDATION", "펀딩 이름을 입력해 주세요.", { fieldErrors: { name: "펀딩 이름을 입력해 주세요." } });
  if (name.length > TEXT_LIMITS.fundingName) {
    const message = tooLongMessage("펀딩 이름은", TEXT_LIMITS.fundingName);
    throw new ApiError("VALIDATION", message, { fieldErrors: { name: message } });
  }
  funding.name = name;
  saveDb();
  return toOwnerFunding(db, funding);
}

/** F13 다음 생일 펀딩에서 불러올 수 있는 내 이월 선물 (아직 다시 열지 않은 것만, 오래된 순) */
function listPendingCarryovers(ctx: MockContext): PendingCarryover[] {
  const db = getDb();
  const userId = requireUser(ctx);
  return db.carryovers
    .filter((c) => c.ownerId === userId && c.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap((c) => {
      const gift = db.gifts.find((g) => g.id === c.giftId);
      if (!gift) return [];
      return [
        {
          id: c.id,
          fundingName: db.fundings.find((f) => f.id === c.fundingId)?.name ?? "",
          giftName: gift.name,
          price: gift.price,
          imageUrl: gift.imageUrl,
          productUrl: gift.productUrl,
          description: gift.description,
          amount: c.amount,
          createdAt: c.createdAt,
        },
      ];
    });
}

/* ───────── 친구 펀딩 (후원자) ───────── */

/** F12 후원 화면(UI-19)용 선물 정보 — 후원자용 뷰만 */
function getGiftForDonation(ctx: MockContext) {
  const db = getDb();
  const gift = getGiftOrThrow(db, ctx.params.giftId);
  const funding = getFundingOrThrow(db, gift.fundingId);
  assertSupporter(db, funding, requireUser(ctx));
  return { funding: toFundingBase(db, funding), gift: toSupporterGift(db, gift) };
}

export const fundingRoutes = [
  route("GET", "/me/fundings", (ctx) => {
    const db = getDb();
    const userId = requireUser(ctx);
    return db.fundings.filter((f) => f.ownerId === userId).sort(byNewest).map((f) => toOwnerFunding(db, f));
  }),
  route("GET", "/me/fundings/:fundingId", (ctx) => {
    const db = getDb();
    const funding = getFundingOrThrow(db, ctx.params.fundingId);
    assertOwner(funding, requireUser(ctx));
    return toOwnerFunding(db, funding);
  }),
  route("POST", "/fundings", createFunding, { status: 201, delay: 500 }),
  route("DELETE", "/fundings/:fundingId", deleteFunding, { delay: 400 }),
  route("PATCH", "/fundings/:fundingId", updateFunding),
  route("POST", "/fundings/:fundingId/gifts", addGift, { status: 201 }),
  route("GET", "/me/gifts/:giftId", getGiftForEdit),
  route("PUT", "/gifts/:giftId", updateGift),
  route("DELETE", "/gifts/:giftId", deleteGift),
  route("GET", "/fundings/:fundingId/donations", listSupporterDonations),
  route("GET", "/fundings/friends", (ctx) => {
    const db = getDb();
    const userId = requireUser(ctx);
    return db.fundings.filter((f) => f.ownerId !== userId && canViewFunding(db, f, userId)).sort(byNewest).map((f) => toFriendFunding(db, f));
  }),
  route("GET", "/fundings/:fundingId", (ctx) => {
    const db = getDb();
    const funding = getFundingOrThrow(db, ctx.params.fundingId);
    assertSupporter(db, funding, requireUser(ctx));
    return toFriendFunding(db, funding);
  }),
  route("GET", "/gifts/:giftId", getGiftForDonation),
  route("GET", "/me/carryovers", listPendingCarryovers),
];
