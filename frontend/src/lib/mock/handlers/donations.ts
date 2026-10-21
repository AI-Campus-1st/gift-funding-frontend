/**
 * Mock 서버 — 후원 · 축하 메시지 (API_SPEC 3.4, F-08 · F-10 · F-14)
 *
 * D1 후원은 실제 서버의 "트랜잭션" 처리를 흉내 낸다.
 *  1) 같은 (후원자, idempotencyKey) 요청이면 새로 저장하지 않고 이전 결과 반환 (중복 처리 방지)
 *  2) 최신 모금 상태로 남은 금액 계산 → 초과 시 EXCEEDS_REMAINING + maxAvailable
 *  3) 후원 + (메시지가 있으면) 메시지를 한 번에 저장 → 후원 실패 시 메시지만 저장되는 일 없음
 */
import { ApiError } from "@/lib/api/client";
import { MESSAGE_MAX_LENGTH } from "@/lib/constants";
import { formatWon, getFundingStatus } from "@/lib/format";
import type { DonationRequest, MyDonation, ReceivedMessage } from "@/types";
import { assertOwner, assertSupporter, findUser, getFundingOrThrow, raisedForGift, userName } from "../access";
import { createId, getDb, saveDb, type DbDonation, type MockDatabase } from "../db";
import { bodyOf, requireUser, route, type MockContext } from "./context";

function toMyDonation(db: MockDatabase, d: DbDonation): MyDonation {
  const funding = db.fundings.find((f) => f.id === d.fundingId);
  return {
    id: d.id,
    fundingId: d.fundingId,
    fundingName: funding?.name ?? "",
    ownerName: funding ? userName(db, funding.ownerId) : "",
    giftId: d.giftId,
    giftName: db.gifts.find((g) => g.id === d.giftId)?.name ?? "",
    amount: d.amount,
    hasMessage: db.messages.some((m) => m.donationId === d.id),
    createdAt: d.createdAt,
    status: "completed",
  };
}

/** D1 후원하기 */
function donate(ctx: MockContext) {
  const request = bodyOf<DonationRequest>(ctx);
  const db = getDb();
  const userId = requireUser(ctx);
  findUser(db, userId);

  // 1) 동일 요청 재전송 → 이전 결과 그대로 반환
  const duplicated = db.donations.find((d) => d.idempotencyKey === request.idempotencyKey && d.supporterId === userId);
  if (duplicated) return { donationId: duplicated.id };

  const gift = db.gifts.find((g) => g.id === request.giftId);
  if (!gift) throw new ApiError("NOT_FOUND", "선물을 찾을 수 없어요.");
  const funding = getFundingOrThrow(db, gift.fundingId);
  assertSupporter(db, funding, userId);

  if (!Number.isInteger(request.amount) || request.amount <= 0) throw new ApiError("VALIDATION", "0원보다 큰 금액을 입력해 주세요.");
  if (getFundingStatus(funding.startDate, funding.endDate) !== "active") throw new ApiError("FUNDING_NOT_ACTIVE", "진행 중인 펀딩이 아니라 후원할 수 없어요.");
  const message = (request.message ?? "").trim();
  if (message.length > MESSAGE_MAX_LENGTH) throw new ApiError("VALIDATION", `축하 메시지는 ${MESSAGE_MAX_LENGTH}자 이내로 작성해 주세요.`);

  // 2) 최신 모금 상태 기준 검증
  const remaining = gift.price - raisedForGift(db, gift.id);
  if (remaining <= 0) throw new ApiError("GOAL_REACHED", "후원이 마감된 선물입니다.");
  if (request.amount > remaining) {
    throw new ApiError("EXCEEDS_REMAINING", `현재 이 선물에는 최대 ${formatWon(remaining)}까지 후원할 수 있습니다. 후원 금액을 수정해 주세요.`, { maxAvailable: remaining });
  }

  // 3) 후원 + 메시지 저장
  const now = new Date().toISOString();
  const donation: DbDonation = { id: createId("d"), fundingId: funding.id, giftId: gift.id, supporterId: userId, amount: request.amount, idempotencyKey: request.idempotencyKey, createdAt: now };
  db.donations.push(donation);
  if (message.length > 0) {
    // 작성자 이름은 클라이언트가 보낸 값이 아니라 인증된 계정 정보(authorId)로 기록
    db.messages.push({ id: createId("m"), donationId: donation.id, fundingId: funding.id, giftId: gift.id, authorId: userId, content: message, createdAt: now });
  }
  saveDb();
  return { donationId: donation.id };
}

/** D3 본인 후원 1건 — 다른 사람의 후원 ID 는 조회 불가 */
function getMyDonation(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const donation = db.donations.find((d) => d.id === ctx.params.donationId);
  if (!donation) throw new ApiError("NOT_FOUND", "후원 내역을 찾을 수 없어요.");
  if (donation.supporterId !== userId) throw new ApiError("FORBIDDEN", "본인의 후원 내역만 확인할 수 있어요.");
  return toMyDonation(db, donation);
}

/** D2 본인 후원 내역 (같은 선물에 여러 번 후원하면 각각 표시) */
function listMyDonations(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const fundingId = ctx.query.fundingId;
  return db.donations
    .filter((d) => d.supporterId === userId && (!fundingId || d.fundingId === fundingId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((d) => toMyDonation(db, d));
}

/** D4 생일자 전용 축하 편지함 — fundingId 가 있으면 그 펀딩, 없으면 내 모든 펀딩의 메시지 */
function listReceivedMessages(ctx: MockContext): ReceivedMessage[] {
  const db = getDb();
  const userId = requireUser(ctx);
  const fundingId = ctx.query.fundingId;
  if (fundingId) assertOwner(getFundingOrThrow(db, fundingId), userId);
  const myFundingIds = new Set(db.fundings.filter((f) => f.ownerId === userId && (!fundingId || f.id === fundingId)).map((f) => f.id));
  return db.messages
    .filter((m) => myFundingIds.has(m.fundingId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((m) => ({
      id: m.id,
      authorName: userName(db, m.authorId),
      content: m.content,
      fundingName: db.fundings.find((f) => f.id === m.fundingId)?.name ?? "",
      giftName: db.gifts.find((g) => g.id === m.giftId)?.name ?? "",
      createdAt: m.createdAt,
    }));
}

export const donationRoutes = [
  route("POST", "/donations", donate, { status: 201, delay: 500 }),
  route("GET", "/me/donations", listMyDonations),
  route("GET", "/me/donations/:donationId", getMyDonation),
  route("GET", "/me/messages", listReceivedMessages),
];
