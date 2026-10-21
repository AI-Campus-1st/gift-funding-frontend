/**
 * 모의 서버의 권한 검사 · 응답 가공(뷰 변환) 로직
 *
 * 실제 백엔드의 "권한별 API 응답"(TechStack 3.4)에 해당한다.
 * - 생일자용 뷰(toOwnerGift)는 모금액·남은 금액을 포함한다.
 * - 후원자용 뷰(toSupporterGift)는 모금액·남은 금액을 "응답에서 제외"한다. (화면에서 숨기기만 하지 않음)
 */
import { ApiError } from "@/lib/api/client";
import { calcAchievementRate, getFundingStatus } from "@/lib/format";
import type { FundingBase, OwnerGiftView, SupporterGiftView } from "@/types";
import type { DbFunding, DbGift, MockDatabase } from "./db";

export function findUser(db: MockDatabase, userId: string) {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new ApiError("UNAUTHORIZED", "로그인이 만료되었습니다. 다시 로그인해 주세요.");
  return user;
}

export function userName(db: MockDatabase, userId: string): string {
  return db.users.find((u) => u.id === userId)?.name ?? "알 수 없음";
}

/** 지난 펀딩에서 이월되어 이 선물의 시작 모금액이 된 금액 */
export function carriedOverForGift(db: MockDatabase, giftId: string): number {
  return db.carryovers.filter((c) => c.reopenedGiftId === giftId).reduce((sum, c) => sum + c.amount, 0);
}

/** 선물별 전체 모금액 = 정상 처리된 후원 금액의 합 + 다시 연 이월 금액 */
export function raisedForGift(db: MockDatabase, giftId: string): number {
  return db.donations.filter((d) => d.giftId === giftId).reduce((sum, d) => sum + d.amount, 0) + carriedOverForGift(db, giftId);
}

export function isGroupMember(db: MockDatabase, groupId: string, userId: string): boolean {
  return db.groups.some((g) => g.id === groupId && g.memberIds.includes(userId));
}

/** 펀딩 열람 권한: 생일자 본인이거나, 펀딩이 연결된 그룹의 참여자 */
export function canViewFunding(db: MockDatabase, funding: DbFunding, userId: string): boolean {
  return funding.ownerId === userId || isGroupMember(db, funding.groupId, userId);
}

export function getFundingOrThrow(db: MockDatabase, fundingId: string): DbFunding {
  const funding = db.fundings.find((f) => f.id === fundingId);
  if (!funding) throw new ApiError("NOT_FOUND", "펀딩을 찾을 수 없어요.");
  return funding;
}

/** 생일자 전용 기능 접근 확인 */
export function assertOwner(funding: DbFunding, userId: string): void {
  if (funding.ownerId !== userId) throw new ApiError("FORBIDDEN", "이 펀딩을 관리할 권한이 없어요.");
}

/** 친구 펀딩(후원자) 접근 확인: 본인 펀딩이 아니고 그룹 참여자여야 한다 */
export function assertSupporter(db: MockDatabase, funding: DbFunding, userId: string): void {
  if (funding.ownerId === userId) throw new ApiError("FORBIDDEN", "본인 펀딩은 내 펀딩 메뉴에서 관리해 주세요.");
  if (!isGroupMember(db, funding.groupId, userId)) throw new ApiError("FORBIDDEN", "이 펀딩에 접근할 권한이 없어요.");
}

export function toFundingBase(db: MockDatabase, funding: DbFunding): FundingBase {
  return {
    id: funding.id,
    name: funding.name,
    groupId: funding.groupId,
    groupName: db.groups.find((g) => g.id === funding.groupId)?.name ?? "",
    ownerName: userName(db, funding.ownerId),
    startDate: funding.startDate,
    endDate: funding.endDate,
    status: getFundingStatus(funding.startDate, funding.endDate),
  };
}

export function toSupporterGift(db: MockDatabase, gift: DbGift): SupporterGiftView {
  const rate = calcAchievementRate(raisedForGift(db, gift.id), gift.price);
  return {
    id: gift.id,
    name: gift.name,
    price: gift.price,
    imageUrl: gift.imageUrl,
    productUrl: gift.productUrl,
    description: gift.description,
    achievementRate: rate,
    isClosed: raisedForGift(db, gift.id) >= gift.price,
  };
}

export function toOwnerGift(db: MockDatabase, gift: DbGift): OwnerGiftView {
  const raised = raisedForGift(db, gift.id);
  return {
    ...toSupporterGift(db, gift),
    raisedAmount: raised,
    remainingAmount: Math.max(0, gift.price - raised),
    donationCount: db.donations.filter((d) => d.giftId === gift.id).length,
    shortfallAction: gift.shortfallAction,
    settled: gift.settlementId !== null,
    settlementStatus: db.settlements.find((s) => s.id === gift.settlementId)?.status ?? null,
    carriedOverAmount: carriedOverForGift(db, gift.id),
  };
}

export function giftsOf(db: MockDatabase, fundingId: string): DbGift[] {
  return db.gifts.filter((g) => g.fundingId === fundingId);
}
