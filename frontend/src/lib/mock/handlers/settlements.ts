/**
 * Mock 서버 — 목표 미달 처리 · 정산 (API_SPEC 3.5, F-11 · F-12)
 *
 * ⚠️ 실제 결제 · 송금 없이 동작하는 "모의 정산"이다. (화면에도 반드시 표시)
 * 이월 흐름 (DATA_MODEL 6.9 D-S1-3)
 *  1) 미달 처리에서 "다음 생일로 이월" → 이월 기록을 pending 으로 저장
 *  2) 다음 생일 펀딩을 만들 때 "이월 선물 불러오기" → handlers/fundings.ts createFunding 이 다시 연다
 */
import { ApiError } from "@/lib/api/client";
import { getFundingStatus } from "@/lib/format";
import { validateAccount } from "@/lib/validation";
import type { SettlementOverview, SettlementRequest, ShortfallAction } from "@/types";
import { assertOwner, findUser, getFundingOrThrow, giftsOf, raisedForGift } from "../access";
import { createId, getDb, saveDb, type DbFunding, type DbSettlement, type MockDatabase } from "../db";
import { bodyOf, requireUser, route, type MockContext } from "./context";

function getEndedOwnedFunding(db: MockDatabase, fundingId: string, userId: string): DbFunding {
  const funding = getFundingOrThrow(db, fundingId);
  assertOwner(funding, userId);
  if (getFundingStatus(funding.startDate, funding.endDate) !== "ended") throw new ApiError("FUNDING_NOT_ACTIVE", "펀딩이 종료된 후에 처리할 수 있어요.");
  return funding;
}

/** S1 목표 미달 선물 처리: 다음 생일로 이월 또는 현재 모금액 인출 (둘 중 하나만, 한 번만) */
function applyShortfall(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const { action } = bodyOf<{ action: ShortfallAction }>(ctx);
  if (action !== "carryover" && action !== "withdraw") throw new ApiError("VALIDATION", "처리 방식을 선택해 주세요.");
  const gift = db.gifts.find((g) => g.id === ctx.params.giftId);
  if (!gift) throw new ApiError("NOT_FOUND", "선물을 찾을 수 없어요.");
  const funding = getEndedOwnedFunding(db, gift.fundingId, userId);
  const raised = raisedForGift(db, gift.id);
  if (raised >= gift.price) throw new ApiError("VALIDATION", "목표를 달성한 선물은 정상 정산 대상이에요.");
  if (raised <= 0) throw new ApiError("VALIDATION", "모금액이 없어 처리할 금액이 없어요.");
  if (gift.shortfallAction) throw new ApiError("CONFLICT", "이미 처리한 선물이에요. 같은 금액을 다시 처리할 수 없어요.");

  gift.shortfallAction = action;
  if (action === "carryover") {
    db.carryovers.push({
      id: createId("co"),
      ownerId: userId,
      fundingId: funding.id,
      giftId: gift.id,
      amount: raised,
      createdAt: new Date().toISOString(),
      status: "pending",
      reopenedFundingId: null,
      reopenedGiftId: null,
      reopenedAt: null,
    });
  }
  saveDb();
  return undefined;
}

/*
 * ───────── 모의 정산 진행 (Mock 임시 규칙 — 실제로는 백엔드가 송금 결과로 상태를 바꾼다) ─────────
 * 상태는 사람이 바꾸지 않고 프로그램이 자동으로 바꾼다. (FEATURE_SPEC F-12, 2026-10-16 확정)
 * 송금이 없으므로 시간이 지나면 다음 단계로 넘어가게 흉내 낸다. 넘어가는 시점은 백엔드에서 확정한다.
 *   요청 즉시 처리 중, 1분 뒤 → 완료 (2026-10-19 확정, Q11-1 ①)
 * 실패 화면 확인용: 계좌번호 끝이 0000 → 계좌 정보 오류, 9999 → 은행 오류
 * 실패하면 그 선물은 다시 정산 대상이 된다 (계좌를 다시 입력해 재요청).
 */
const MOCK_PROCESSING_AFTER_MS = 0;
const MOCK_DONE_AFTER_MS = 60_000;

function mockFailureOf(accountNumber: string): DbSettlement["failureReason"] {
  if (accountNumber.endsWith("0000")) return "ACCOUNT_INVALID";
  if (accountNumber.endsWith("9999")) return "BANK_ERROR";
  return null;
}

/** 저장된 정산의 상태를 시간에 맞춰 진행시킨다 (조회할 때 호출) */
export function advanceMockSettlements(db: MockDatabase, now = Date.now()): void {
  let changed = false;
  for (const s of db.settlements) {
    if (s.status === "completed" || s.status === "failed") continue;
    const elapsed = now - new Date(s.requestedAt).getTime();
    if (elapsed >= MOCK_DONE_AFTER_MS) {
      const failure = mockFailureOf(s.accountNumber);
      s.status = failure ? "failed" : "completed";
      s.failureReason = failure;
      s.processedAt = new Date(now).toISOString();
      if (failure) {
        // 실패한 정산의 선물은 다시 정산 대상으로 돌려놓는다
        for (const gift of db.gifts) if (gift.settlementId === s.id) gift.settlementId = null;
      }
      changed = true;
    } else if (elapsed >= MOCK_PROCESSING_AFTER_MS && s.status === "requested") {
      s.status = "processing";
      changed = true;
    }
  }
  if (changed) saveDb();
}

function maskAccount(accountNumber: string): string {
  return accountNumber.length <= 4 ? accountNumber : `${"*".repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`;
}

/** S2 정산 현황: 정산 가능 선물 · 이월 선물 · 이력 */
function getSettlementOverview(ctx: MockContext): SettlementOverview {
  const db = getDb();
  const funding = getFundingOrThrow(db, ctx.params.fundingId);
  assertOwner(funding, requireUser(ctx));
  advanceMockSettlements(db);
  const ended = getFundingStatus(funding.startDate, funding.endDate) === "ended";

  const eligibleGifts: SettlementOverview["eligibleGifts"] = [];
  const carryoverGifts: SettlementOverview["carryoverGifts"] = [];
  for (const gift of giftsOf(db, funding.id)) {
    const raised = raisedForGift(db, gift.id);
    if (gift.shortfallAction === "carryover") carryoverGifts.push({ id: gift.id, name: gift.name, amount: raised });
    if (!ended || gift.settlementId || raised <= 0) continue;
    if (raised >= gift.price) eligibleGifts.push({ id: gift.id, name: gift.name, amount: raised, reason: "achieved" });
    else if (gift.shortfallAction === "withdraw") eligibleGifts.push({ id: gift.id, name: gift.name, amount: raised, reason: "withdraw" });
  }

  const history = db.settlements
    .filter((s) => s.fundingId === funding.id)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map((s) => ({
      id: s.id,
      fundingId: s.fundingId,
      giftNames: s.giftIds.map((id) => db.gifts.find((g) => g.id === id)?.name ?? ""),
      amount: s.amount,
      bank: s.bank,
      accountNumberMasked: maskAccount(s.accountNumber),
      accountHolder: s.accountHolder,
      status: s.status,
      requestedAt: s.requestedAt,
      failureReason: s.failureReason ?? null,
    }));

  return { fundingId: funding.id, fundingName: funding.name, eligibleGifts, eligibleAmount: eligibleGifts.reduce((sum, g) => sum + g.amount, 0), carryoverGifts, history };
}

/** S3 정산 요청 — 금액은 서버가 선물별 모금액으로 계산 */
function requestSettlement(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const funding = getEndedOwnedFunding(db, ctx.params.fundingId, userId);
  const request = bodyOf<SettlementRequest>(ctx);
  const owner = findUser(db, userId);
  const fieldErrors = validateAccount(request, owner.name);
  if (Object.keys(fieldErrors).length > 0) throw new ApiError("VALIDATION", "계좌 정보를 확인해 주세요.", { fieldErrors });
  const giftIds = request.giftIds ?? [];
  if (giftIds.length === 0) throw new ApiError("VALIDATION", "정산할 선물을 선택해 주세요.");

  let amount = 0;
  for (const giftId of giftIds) {
    const gift = giftsOf(db, funding.id).find((g) => g.id === giftId);
    if (!gift) throw new ApiError("NOT_FOUND", "선물을 찾을 수 없어요.");
    if (gift.settlementId) throw new ApiError("CONFLICT", "이미 정산 요청한 선물이 포함되어 있어요.");
    const raised = raisedForGift(db, gift.id);
    const eligible = raised >= gift.price || gift.shortfallAction === "withdraw";
    if (!eligible || raised <= 0) throw new ApiError("VALIDATION", "정산할 수 없는 선물이 포함되어 있어요.");
    amount += raised;
  }

  const settlementId = createId("st");
  db.settlements.push({
    id: settlementId,
    ownerId: userId,
    fundingId: funding.id,
    giftIds,
    amount,
    bank: request.bank,
    accountNumber: request.accountNumber.replace(/-/g, ""),
    accountHolder: request.accountHolder.trim(),
    status: "requested",
    requestedAt: new Date().toISOString(),
    processedAt: null,
    failureReason: null,
  });
  for (const gift of db.gifts) if (giftIds.includes(gift.id)) gift.settlementId = settlementId;
  saveDb();
  return { id: settlementId };
}

export const settlementRoutes = [
  route("POST", "/gifts/:giftId/shortfall", applyShortfall, { delay: 400 }),
  route("GET", "/fundings/:fundingId/settlement", getSettlementOverview),
  route("POST", "/fundings/:fundingId/settlements", requestSettlement, { status: 201, delay: 500 }),
];
