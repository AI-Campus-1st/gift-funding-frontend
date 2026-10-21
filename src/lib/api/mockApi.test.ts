/**
 * 모의 API(서버 역할) 비즈니스 규칙 테스트
 * - 권한별 응답(후원자에게 모금액 비공개) · 초과/중복/종료 후원 방지 · 메시지 저장 · 목표 미달/정산
 * 시드 데이터: src/lib/mock/seed.ts (김서연 계정으로 로그인한 상태에서 실행)
 */
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/lib/mock/db";
import { createMockToken } from "@/lib/mock/token";
import { ApiError, saveToken } from "./client";
import { donate, listMyDonations, listReceivedMessages } from "./donations";
import { getDb } from "@/lib/mock/db";
import { advanceMockSettlements } from "@/lib/mock/handlers/settlements";
import { addGift, createFunding, deleteFunding, deleteGift, getFriendFunding, getMyFunding, listMyFundings, updateFundingName, updateGift } from "./fundings";
import { createGroup, createInvite, getGroupDetail, joinByInvite, listInvites, listMyGroups, previewInvite, updateGroup } from "./groups";
import { http } from "./http";
import { createBirthdayEvent, deleteBirthdayEvent, listBirthdayEvents, listNotifications } from "./schedule";
import { applyShortfall, getSettlementOverview, listPendingCarryovers, requestSettlement } from "./settlements";

function loginAs(userId: string) {
  saveToken(createMockToken(userId), true);
}

async function expectApiError(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
  return error as ApiError;
}

beforeEach(() => {
  resetDb();
  loginAs("u_seoyeon");
});

describe("권한별 응답 (F-13)", () => {
  it("후원자용 친구 펀딩 응답에는 모금액 · 남은 금액 필드가 없다", async () => {
    const funding = await getFriendFunding("f_jihoon");
    for (const gift of funding.gifts) {
      expect(gift).not.toHaveProperty("raisedAmount");
      expect(gift).not.toHaveProperty("remainingAmount");
      expect(gift.achievementRate).toBeGreaterThanOrEqual(0);
    }
  });
  it("생일자용 응답에는 모금액 · 남은 금액이 있다", async () => {
    const funding = await getMyFunding("f_my24");
    const headphone = funding.gifts.find((g) => g.id === "gift_headphone")!;
    expect(headphone.raisedAmount).toBe(210000);
    expect(headphone.remainingAmount).toBe(149000);
  });
  it("다른 사람의 펀딩을 생일자용으로 조회할 수 없다", async () => {
    await expectApiError(getMyFunding("f_jihoon"), "FORBIDDEN");
  });
  it("참여하지 않은 그룹의 펀딩은 볼 수 없다", async () => {
    await expectApiError(getFriendFunding("f_mina"), "FORBIDDEN");
  });
});

describe("후원 처리 (F-08, F-10)", () => {
  const base = { giftId: "gift_keyboard", message: "" };

  it("남은 금액(9,000원)을 넘으면 거절하고 정확한 최대 후원 가능 금액을 알려준다", async () => {
    const error = await expectApiError(donate({ ...base, amount: 30000, idempotencyKey: "k1" }), "EXCEEDS_REMAINING");
    expect(error.maxAvailable).toBe(9000);
    expect(error.message).toBe("현재 이 선물에는 최대 9,000원까지 후원할 수 있습니다. 후원 금액을 수정해 주세요.");
  });

  it("같은 요청 키로 두 번 보내도 한 번만 처리된다", async () => {
    const first = await donate({ ...base, amount: 5000, idempotencyKey: "same" });
    const second = await donate({ ...base, amount: 5000, idempotencyKey: "same" });
    expect(second.donationId).toBe(first.donationId);
    const mine = await listMyDonations("f_jihoon");
    expect(mine.filter((d) => d.giftId === "gift_keyboard")).toHaveLength(1);
  });

  it("새 요청으로 같은 선물에 다시 후원하는 것은 허용된다", async () => {
    await donate({ ...base, amount: 3000, idempotencyKey: "a" });
    await donate({ ...base, amount: 3000, idempotencyKey: "b" });
    const mine = await listMyDonations("f_jihoon");
    expect(mine.filter((d) => d.giftId === "gift_keyboard")).toHaveLength(2);
  });

  it("목표 금액을 채우면 후원이 마감된다", async () => {
    await donate({ ...base, amount: 9000, idempotencyKey: "fill" });
    await expectApiError(donate({ ...base, amount: 1000, idempotencyKey: "more" }), "GOAL_REACHED");
    const funding = await getFriendFunding("f_jihoon");
    expect(funding.gifts.find((g) => g.id === "gift_keyboard")!.isClosed).toBe(true);
  });

  it("종료된 펀딩에는 후원할 수 없다", async () => {
    await expectApiError(donate({ giftId: "gift_shoes", amount: 1000, message: "", idempotencyKey: "x" }), "FUNDING_NOT_ACTIVE");
  });

  it("본인 펀딩에는 후원할 수 없다", async () => {
    await expectApiError(donate({ giftId: "gift_headphone", amount: 1000, message: "", idempotencyKey: "y" }), "FORBIDDEN");
  });

  it("0원 이하 금액은 거절", async () => {
    await expectApiError(donate({ ...base, amount: 0, idempotencyKey: "z" }), "VALIDATION");
  });

  it("메시지는 입력했을 때만 저장되고, 생일자 편지함에서만 보인다", async () => {
    await donate({ ...base, amount: 1000, message: "  ", idempotencyKey: "m0" });
    await donate({ ...base, amount: 1000, message: "생일 축하해! 🎂", idempotencyKey: "m1" });
    loginAs("u_jihoon");
    const inbox = await listReceivedMessages();
    const fromSeoyeon = inbox.filter((m) => m.authorName === "김서연" && m.giftName === "기계식 키보드");
    expect(fromSeoyeon).toHaveLength(1);
    expect(fromSeoyeon[0].content).toBe("생일 축하해! 🎂");
  });
});

describe("선물 수정 제한 (F-04)", () => {
  it("후원이 발생한 선물은 가격을 바꿀 수 없다", async () => {
    await expectApiError(
      updateGift("gift_headphone", { name: "헤드폰", price: 999000, imageUrl: "data:,", productUrl: "https://example.com", description: "" }),
      "GIFT_LOCKED",
    );
  });
});

describe("초대 링크 (F-06)", () => {
  it("유효한 링크로 참여하면 해당 펀딩 상세로 이동하고, 다시 참여해도 중복 등록되지 않는다", async () => {
    const preview = await previewInvite("INVITE-MINA-2026");
    expect(preview).toMatchObject({ groupName: "민아네 생일 모임", ownerName: "박민아", alreadyJoined: false });
    const first = await joinByInvite("INVITE-MINA-2026");
    expect(first).toEqual({ redirectPath: "/friend-funding-detail/f_mina", alreadyJoined: false });
    const second = await joinByInvite("INVITE-MINA-2026");
    expect(second.alreadyJoined).toBe(true);
    await expect(getFriendFunding("f_mina")).resolves.toBeTruthy();
  });
  it("펀딩이 끝나면 그 펀딩의 초대 링크는 만료된다 (그룹 링크는 유효)", async () => {
    const ended = await createInvite("g_college", "f_mylast");
    const groupLink = await createInvite("g_college", null);
    expect((await listInvites("g_college")).find((i) => i.token === ended.token)?.isExpired).toBe(true);
    loginAs("u_doyoon");
    await expectApiError(previewInvite(ended.token), "INVITE_EXPIRED");
    await expectApiError(joinByInvite(ended.token), "INVITE_EXPIRED");
    await expect(previewInvite(groupLink.token)).resolves.toMatchObject({ groupName: "대학 친구들" });
  });
  it("그룹 링크로 참여하면 진행 중인 펀딩으로, 없으면 그룹 상세로 이동한다", async () => {
    const withActive = await createInvite("g_college", null); // 서연의 진행 중 펀딩 f_my24 가 있는 그룹
    const { id: emptyGroupId } = await createGroup({ name: "펀딩 없는 그룹", description: "" });
    const empty = await createInvite(emptyGroupId, null);
    loginAs("u_doyoon");
    expect((await joinByInvite(withActive.token)).redirectPath).toBe("/friend-funding-detail/f_my24");
    expect((await previewInvite(empty.token)).fundingName).toBeNull();
    expect((await joinByInvite(empty.token)).redirectPath).toBe(`/group-detail/${emptyGroupId}`);
  });
  it("비활성화된 링크 / 없는 링크는 오류", async () => {
    await expectApiError(previewInvite("INVITE-OLD-0000"), "INVITE_INACTIVE");
    await expectApiError(previewInvite("NOPE"), "INVITE_INVALID");
  });
});

describe("목표 미달 · 정산 (F-11, F-12)", () => {
  it("이월과 인출은 둘 중 하나만, 한 번만 처리된다", async () => {
    await applyShortfall("f_mylast", "gift_chair", "carryover");
    await expectApiError(applyShortfall("f_mylast", "gift_chair", "withdraw"), "CONFLICT");
    const overview = await getSettlementOverview("f_mylast");
    expect(overview.eligibleGifts.map((g) => g.id)).toEqual(["gift_books"]); // 이월한 의자는 정산 대상 제외
    expect(overview.carryoverGifts.map((g) => g.id)).toEqual(["gift_chair"]);
  });
  it("진행 중인 펀딩은 미달 처리할 수 없다", async () => {
    await expectApiError(applyShortfall("f_my24", "gift_headphone", "withdraw"), "FUNDING_NOT_ACTIVE");
  });
  it("본인 명의가 아닌 계좌로는 정산할 수 없고, 같은 선물을 두 번 정산할 수 없다", async () => {
    const request = { giftIds: ["gift_books"], bank: "국민은행", accountNumber: "1234567890", accountHolder: "홍길동" };
    const error = await expectApiError(requestSettlement("f_mylast", request), "VALIDATION");
    expect(error.fieldErrors?.accountHolder).toBe("본인 명의 계좌만 등록할 수 있어요.");
    await requestSettlement("f_mylast", { ...request, accountHolder: "김서연" });
    await expectApiError(requestSettlement("f_mylast", { ...request, accountHolder: "김서연" }), "CONFLICT");
  });
});

describe("이월 펀딩 다시 열기 (F-11, DATA_MODEL 6.9 D-S1-3)", () => {
  const today = new Date().toISOString().slice(0, 10);
  const base = { name: "올해 생일 펀딩", startDate: today, endDate: today, gifts: [] };

  it("이월 선물을 다른 그룹으로 다시 열면 이월 금액이 시작 모금액이 된다", async () => {
    const pending = await listPendingCarryovers();
    expect(pending.map((c) => c.id)).toEqual(["co_camera"]);
    expect(pending[0]).toMatchObject({ giftName: "필름 카메라", amount: 60000, price: 150000 });

    // 지난 펀딩은 대학 친구들 그룹 → 이번에는 내가 새로 만든 그룹으로 연다
    const { id: newGroupId } = await createGroup({ name: "올해 생일 모임", description: "" });
    const { id } = await createFunding({ ...base, groupId: newGroupId, carryoverIds: ["co_camera"] });
    const funding = await getMyFunding(id);
    expect(funding.groupId).toBe(newGroupId);
    expect(funding.gifts).toHaveLength(1);
    expect(funding.gifts[0]).toMatchObject({ name: "필름 카메라", price: 150000, raisedAmount: 60000, remainingAmount: 90000, carriedOverAmount: 60000, donationCount: 0, achievementRate: 40 });
    expect(await listPendingCarryovers()).toEqual([]);
  });
  it("같은 이월 기록으로 두 번 열 수 없다", async () => {
    await createFunding({ ...base, groupId: "g_college", carryoverIds: ["co_camera"] });
    await expectApiError(createFunding({ ...base, groupId: "g_college", carryoverIds: ["co_camera"] }), "CONFLICT");
  });
  it("다른 사람의 이월 기록은 쓸 수 없다", async () => {
    loginAs("u_jihoon");
    await expectApiError(createFunding({ ...base, groupId: "g_office", carryoverIds: ["co_camera"] }), "NOT_FOUND");
  });
  it("후원은 이월 금액을 뺀 남은 금액까지만, 후원자에게는 달성률만 보인다", async () => {
    const { id } = await createFunding({ ...base, groupId: "g_college", carryoverIds: ["co_camera"] });
    const giftId = (await getMyFunding(id)).gifts[0].id;
    loginAs("u_jihoon");
    const friendView = await getFriendFunding(id);
    expect(friendView.gifts[0]).not.toHaveProperty("raisedAmount");
    expect(friendView.gifts[0].achievementRate).toBe(40);
    const error = await expectApiError(donate({ giftId, amount: 100000, message: "", idempotencyKey: "co-1" }), "EXCEEDS_REMAINING");
    expect(error.maxAvailable).toBe(90000);
  });
  it("이월 금액이 들어간 펀딩 · 선물은 삭제할 수 없다", async () => {
    const { id } = await createFunding({ ...base, groupId: "g_college", carryoverIds: ["co_camera"] });
    const giftId = (await getMyFunding(id)).gifts[0].id;
    await expectApiError(deleteGift(giftId), "GIFT_LOCKED");
    await expectApiError(deleteFunding(id), "CONFLICT");
  });
  it("목표 미달 처리에서 이월하면 불러올 수 있는 목록에 추가된다", async () => {
    await applyShortfall("f_mylast", "gift_chair", "carryover");
    const pending = await listPendingCarryovers();
    expect(pending.map((c) => c.giftName)).toEqual(["필름 카메라", "캠핑 릴렉스 의자"]);
  });
});

describe("축하 편지함 펀딩별 조회", () => {
  it("fundingId 를 주면 그 펀딩에 남긴 메시지만, 없으면 내 모든 펀딩의 메시지", async () => {
    const all = await listReceivedMessages();
    const only = await listReceivedMessages("f_mylast");
    expect(all.length).toBeGreaterThan(only.length);
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((m) => m.fundingName === "작년 생일 펀딩")).toBe(true);
  });
  it("다른 사람 펀딩의 편지함은 볼 수 없다", async () => {
    await expectApiError(listReceivedMessages("f_jihoon"), "FORBIDDEN");
  });
});

describe("펀딩 삭제 · 연결 데이터 처리", () => {
  const today = new Date().toISOString().slice(0, 10);
  const gift = { name: "새 선물", price: 10000, imageUrl: "data:,", productUrl: "https://example.com", description: "" };

  it("후원이 들어온 펀딩은 삭제할 수 없고, 후원이 없는 펀딩은 삭제된다", async () => {
    await expectApiError(deleteFunding("f_my24"), "CONFLICT");
    const { id } = await createFunding({ name: "삭제 테스트", groupId: "g_college", startDate: today, endDate: today, gifts: [gift] });
    await deleteFunding(id);
    expect((await listMyFundings()).some((f) => f.id === id)).toBe(false);
  });
  it("다른 사람 펀딩은 삭제할 수 없다", async () => {
    await expectApiError(deleteFunding("f_jihoon"), "FORBIDDEN");
  });
  it("펀딩을 삭제해도 생일 알림은 남고(펀딩 연결만 해제), 일정의 펀딩 연결도 해제된다", async () => {
    const { id } = await createFunding({ name: "알림 테스트", groupId: "g_college", startDate: today, endDate: today, gifts: [gift] });
    const tomorrow = new Date(Date.now() + 86400000);
    const birthday = `2000-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    await createBirthdayEvent({ friendName: "테스트 친구", birthday, linkedFundingId: id });
    const before = await listNotifications();
    const linked = before.find((n) => n.href === `/my-funding-detail/${id}`);
    expect(linked).toBeTruthy();
    await deleteFunding(id);
    const kept = (await listNotifications()).find((n) => n.id === linked!.id);
    expect(kept?.href).toBe("/birthday-calendar"); // 알림은 남고, 누르면 생일 캘린더로 이동
    const event = (await listBirthdayEvents()).find((e) => e.friendName === "테스트 친구");
    expect(event?.linkedFundingId).toBeNull();
  });
  it("생일 일정을 삭제하면 그 일정의 알림도 삭제된다", async () => {
    const before = await listNotifications(); // 시드: 지훈(내일) · 민아(오늘) 알림 생성
    const jihoonEvent = (await listBirthdayEvents()).find((e) => e.friendName === "이지훈")!;
    expect(before.some((n) => n.title.includes("이지훈"))).toBe(true);
    await deleteBirthdayEvent(jihoonEvent.id);
    expect((await listNotifications()).some((n) => n.title.includes("이지훈"))).toBe(false);
  });
  it("그룹 삭제 API 는 없다", async () => {
    await expectApiError(http.delete("/groups/g_college"), "NOT_FOUND");
  });
});

describe("2026-10-16 확정 정책", () => {
  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const gift = { name: "새 선물", price: 10000, imageUrl: "data:,", productUrl: "https://example.com", description: "" };
  const base = { name: "정책 테스트", groupId: "g_college", gifts: [gift] };

  it("Q6 시작일은 오늘 이전 불가, 기간은 시작일 포함 최대 21일", async () => {
    const past = await expectApiError(createFunding({ ...base, startDate: day(-1), endDate: day(3) }), "VALIDATION");
    expect(past.fieldErrors?.startDate).toBe("시작일은 오늘 이전으로 선택할 수 없어요.");
    const long = await expectApiError(createFunding({ ...base, startDate: day(0), endDate: day(21) }), "VALIDATION");
    expect(long.fieldErrors?.endDate).toContain("최대 3주");
    await expect(createFunding({ ...base, startDate: day(0), endDate: day(20) })).resolves.toHaveProperty("id");
    await expect(createFunding({ ...base, startDate: day(5), endDate: day(25) })).resolves.toHaveProperty("id");
  });

  it("Q8 선물 추가는 예정 · 진행 중에는 가능, 종료된 펀딩에는 불가", async () => {
    const { id } = await createFunding({ ...base, startDate: day(3), endDate: day(10) }); // 예정
    await expect(addGift(id, gift)).resolves.toBeUndefined();
    await expectApiError(addGift("f_mylast", gift), "FUNDING_NOT_ACTIVE");
  });

  it("Q7 펀딩 이름은 종료 전까지 수정, 종료 후 · 기간 · 그룹 수정은 불가", async () => {
    const updated = await updateFundingName("f_my24", "새 이름");
    expect(updated.name).toBe("새 이름");
    await expectApiError(updateFundingName("f_mylast", "x"), "FUNDING_NOT_ACTIVE");
    await expectApiError(updateFundingName("f_my24", "  "), "VALIDATION");
    await expectApiError(updateFundingName("f_my24", "가".repeat(41)), "VALIDATION");
    await expectApiError(http.patch("/fundings/f_my24", { name: "a", group_id: "g_office" }), "VALIDATION");
    await expectApiError(updateFundingName("f_jihoon", "남의 펀딩"), "FORBIDDEN");
  });

  it("Q11 정산 상태는 자동으로 바뀌고, 실패하면 이유와 함께 선물이 다시 정산 대상이 된다", async () => {
    const account = { bank: "국민은행", accountHolder: "김서연" };
    await requestSettlement("f_mylast", { giftIds: ["gift_books"], ...account, accountNumber: "1234560000" }); // 계좌 정보 오류(모의)
    expect((await getSettlementOverview("f_mylast")).eligibleGifts.map((g) => g.id)).not.toContain("gift_books");
    advanceMockSettlements(getDb(), Date.now() + 61_000);
    const failed = await getSettlementOverview("f_mylast");
    expect(failed.history[0]).toMatchObject({ status: "failed", failureReason: "ACCOUNT_INVALID" });
    expect(failed.eligibleGifts.map((g) => g.id)).toContain("gift_books");
    // 계좌를 다시 입력해 재요청 → 완료
    await requestSettlement("f_mylast", { giftIds: ["gift_books"], ...account, accountNumber: "1234567890" });
    advanceMockSettlements(getDb(), Date.now() + 1_000);
    expect((await getSettlementOverview("f_mylast")).history[0].status).toBe("processing");
    advanceMockSettlements(getDb(), Date.now() + 61_000);
    expect((await getSettlementOverview("f_mylast")).history[0]).toMatchObject({ status: "completed", failureReason: null });
  });

  it("Q12 종료 후 7일이 지난 미처리 미달 선물이 있으면 미달 처리 알림을 한 번만 보낸다", async () => {
    const first = (await listNotifications()).filter((n) => n.type === "shortfall-reminder");
    expect(first.map((n) => n.href)).toEqual(["/my-funding-detail/f_mylast/unmet-goal"]);
    const again = (await listNotifications()).filter((n) => n.type === "shortfall-reminder");
    expect(again).toHaveLength(1);
  });

  it("Q15 생일자는 자기 펀딩에 후원할 수 없다", async () => {
    await expectApiError(donate({ giftId: "gift_headphone", amount: 1000, message: "", idempotencyKey: "self" }), "FORBIDDEN");
  });
});

describe("서버 글자 수 검증 (2026-10-19 확정, Q1)", () => {
  it("그룹 이름 30자 · 설명 100자, 친구 이름 20자를 넘으면 거절", async () => {
    const group = await expectApiError(createGroup({ name: "가".repeat(31), description: "나".repeat(101) }), "VALIDATION");
    expect(group.fieldErrors).toMatchObject({ name: "그룹 이름은 30자 이내로 입력해 주세요.", description: "그룹 설명은 100자 이내로 입력해 주세요." });
    const event = await expectApiError(createBirthdayEvent({ friendName: "가".repeat(21), birthday: "2000-01-01", linkedFundingId: null }), "VALIDATION");
    expect(event.fieldErrors?.friendName).toBe("친구 이름은 20자 이내로 입력해 주세요.");
  });
});

describe("로그인 토큰 유효기간 (2026-10-19 확정, Q16)", () => {
  it("로그인 상태 유지 여부와 상관없이 30일", async () => {
    for (const remember of [true, false]) {
      const res = await http.post<{ expires_in: number }>("/auth/login", { email: "seoyeon@example.com", password: "password123", remember_me: remember });
      expect(res.expires_in).toBe(30 * 24 * 60 * 60);
    }
  });
});

describe("선물 가격 최대 5,000만 원 (2026-10-19 확정)", () => {
  it("50,000,000원은 되고 50,000,001원은 거절", async () => {
    const gift = { name: "비싼 선물", price: 50_000_000, imageUrl: "data:,", productUrl: "https://example.com", description: "" };
    await expect(addGift("f_my24", gift)).resolves.toBeUndefined();
    const error = await expectApiError(addGift("f_my24", { ...gift, price: 50_000_001 }), "VALIDATION");
    expect(error.fieldErrors?.price).toBe("선물 가격은 50,000,000원 이하로 입력해 주세요.");
  });
});

describe("그룹을 만든 사람의 권한 (2026-10-19 확정)", () => {
  const today = new Date().toISOString().slice(0, 10);
  const gift = { name: "새 선물", price: 10000, imageUrl: "data:,", productUrl: "https://example.com", description: "" };
  const base = { name: "내 생일 펀딩", startDate: today, endDate: today, gifts: [gift] };

  it("펀딩은 내가 만든 그룹에만 열 수 있다 (참여만 한 그룹 · 이월 다시 열기도 불가)", async () => {
    await expect(createFunding({ ...base, groupId: "g_college" })).resolves.toHaveProperty("id");
    for (const groupId of ["g_office", "g_doyoon", "g_family", "g_nothing"]) {
      const error = await expectApiError(createFunding({ ...base, groupId }), "FORBIDDEN");
      expect(error.message).toBe("내가 만든 그룹에만 펀딩을 열 수 있어요.");
    }
    await expectApiError(createFunding({ ...base, gifts: [], groupId: "g_office", carryoverIds: ["co_camera"] }), "FORBIDDEN");
  });

  it("시드 펀딩은 모두 생일자가 만든 그룹에 연결되어 있다", async () => {
    const db = getDb();
    for (const f of db.fundings) expect(db.groups.find((g) => g.id === f.groupId)?.adminId).toBe(f.ownerId);
    const { created, joined } = await listMyGroups();
    expect(created.map((g) => g.name)).toEqual(["대학 친구들"]);
    expect(created[0].fundings.map((f) => f.name)).toEqual(["나의 24번째 생일선물", "후원 없이 끝난 펀딩", "100% 달성한 펀딩", "작년 생일 펀딩", "재작년 생일 펀딩"]);
    expect(joined.map((g) => g.name).sort()).toEqual(["도윤 생일 모임", "회사 동료"]);
  });

  it("그룹 이름 · 설명은 만든 사람만 수정한다", async () => {
    const updated = await updateGroup("g_college", { name: " 대학 동기 ", description: " 새 설명 " });
    expect(updated).toMatchObject({ name: "대학 동기", description: "새 설명", isAdmin: true });
    expect((await getGroupDetail("g_college")).name).toBe("대학 동기");
    await expectApiError(updateGroup("g_college", { name: "", description: "" }), "VALIDATION");
    const tooLong = await expectApiError(updateGroup("g_college", { name: "가".repeat(31), description: "" }), "VALIDATION");
    expect(tooLong.fieldErrors?.name).toBe("그룹 이름은 30자 이내로 입력해 주세요.");
    loginAs("u_jihoon"); // 대학 친구들 참여자
    const forbidden = await expectApiError(updateGroup("g_college", { name: "바꿈", description: "" }), "FORBIDDEN");
    expect(forbidden.message).toBe("그룹 관리자만 수정할 수 있어요.");
  });
});

describe("비밀번호 변경 A8 (docs/features/password-change.md)", () => {
  it("현재 비밀번호 확인 후 변경, 새 비밀번호로만 로그인", async () => {
    const { changePassword, login } = await import("./auth");
    const wrong = await expectApiError(changePassword({ currentPassword: "wrong-pass", newPassword: "newpass1234", newPasswordConfirm: "newpass1234" }), "VALIDATION");
    expect(wrong.fieldErrors).toEqual({ currentPassword: "현재 비밀번호가 일치하지 않습니다." });
    const same = await expectApiError(changePassword({ currentPassword: "password123", newPassword: "password123", newPasswordConfirm: "password123" }), "VALIDATION");
    expect(same.fieldErrors).toEqual({ newPassword: "현재 비밀번호와 다른 비밀번호를 입력해 주세요." });
    await changePassword({ currentPassword: "password123", newPassword: "newpass1234", newPasswordConfirm: "newpass1234" });
    await expectApiError(login("seoyeon@example.com", "password123", false), "INVALID_CREDENTIALS");
    expect((await login("seoyeon@example.com", "newpass1234", false)).name).toBe("김서연");
  });
});
