/**
 * 모의 DB 초기(시드) 데이터
 *
 * 화면을 바로 확인할 수 있도록 "오늘 날짜 기준"으로 상대적인 날짜를 만들어 넣는다.
 * 체험용 계정 (비밀번호는 모두 password123)
 * - seoyeon@example.com  김서연 : 기본 체험 계정 (내 펀딩 5개, 친구 펀딩 2개, 다시 열 수 있는 이월 선물 1개)
 *                                  · "후원 없이 끝난 펀딩" 은 종료된 펀딩 삭제 확인용 (후원 0건이라 삭제 가능)
 *                                  · "100% 달성한 펀딩" 은 모든 선물이 목표 달성 후 종료 (후원이 있어 삭제 불가)
 * - jihoon@example.com   이지훈 : 서연의 친구 (생일자 시점 확인용)
 * - mina@example.com     박민아 : 서연이 아직 참여하지 않은 펀딩의 생일자 → 초대 링크 체험용
 * - doyoon@example.com   최도윤
 *
 * 초대 링크 체험용 토큰
 * - INVITE-MINA-2026 : 활성 링크 (민아 생일 펀딩)
 * - INVITE-OLD-0000  : 비활성화된 링크 (오류 안내 확인용)
 */
import { toDateString } from "@/lib/format";
import type { MockDatabase } from "./db";
import { mockHash } from "./db";

type SeedData = Omit<MockDatabase, "version">;

/** 오늘 기준 n일 뒤 날짜 "YYYY-MM-DD" */
function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDateString(d);
}

/** 오늘 기준 n일 뒤의 특정 시각 ISO 문자열 */
function at(offset: number, hour = 12, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** 오늘 기준 n일 뒤의 월·일을 가진 생년월일 */
function birthdayIn(offset: number, year: number): string {
  return `${year}${day(offset).slice(4)}`;
}

/** 외부 이미지 없이 쓸 수 있는 SVG 썸네일 (data URL) */
function giftImage(emoji: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/><text x="160" y="150" font-size="96" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createSeedData(): SeedData {
  const password = mockHash("password123");
  const emptyPreference = { keywords: [], categories: [], priceRange: null };

  return {
    users: [
      {
        id: "u_seoyeon",
        name: "김서연",
        email: "seoyeon@example.com",
        passwordHash: password,
        birthday: birthdayIn(28, 2002),
        profileImage: null,
        preference: { keywords: ["음악", "캠핑", "향수"], categories: ["전자기기", "취미"], priceRange: "100k-300k" },
      },
      { id: "u_jihoon", name: "이지훈", email: "jihoon@example.com", passwordHash: password, birthday: birthdayIn(1, 1999), profileImage: null, preference: emptyPreference },
      { id: "u_mina", name: "박민아", email: "mina@example.com", passwordHash: password, birthday: birthdayIn(0, 2001), profileImage: null, preference: emptyPreference },
      { id: "u_doyoon", name: "최도윤", email: "doyoon@example.com", passwordHash: password, birthday: birthdayIn(-40, 2000), profileImage: null, preference: emptyPreference },
    ],
    groups: [
      { id: "g_college", name: "대학 친구들", description: "새내기 때부터 함께한 동기 모임", adminId: "u_seoyeon", memberIds: ["u_seoyeon", "u_jihoon", "u_mina"], createdAt: at(-400) },
      { id: "g_office", name: "회사 동료", description: "디자인팀 점심 메이트", adminId: "u_jihoon", memberIds: ["u_jihoon", "u_seoyeon", "u_doyoon"], createdAt: at(-120) },
      { id: "g_family", name: "민아네 생일 모임", description: "", adminId: "u_mina", memberIds: ["u_mina", "u_jihoon"], createdAt: at(-20) },
      // 펀딩은 그 그룹을 만든 사람만 열 수 있다 (2026-10-19 확정) → 도윤이는 자기 생일용 그룹을 따로 만든다
      { id: "g_doyoon", name: "도윤 생일 모임", description: "", adminId: "u_doyoon", memberIds: ["u_doyoon", "u_jihoon", "u_seoyeon"], createdAt: at(-70) },
    ],
    invites: [
      { token: "INVITE-COLLEGE-24", groupId: "g_college", fundingId: "f_my24", isActive: true, createdAt: at(-10) },
      { token: "INVITE-MINA-2026", groupId: "g_family", fundingId: "f_mina", isActive: true, createdAt: at(-3) },
      { token: "INVITE-OLD-0000", groupId: "g_family", fundingId: null, isActive: false, createdAt: at(-30) },
    ],
    fundings: [
      { id: "f_my24", ownerId: "u_seoyeon", groupId: "g_college", name: "나의 24번째 생일선물", startDate: day(-10), endDate: day(28), createdAt: at(-10) },
      { id: "f_mylast", ownerId: "u_seoyeon", groupId: "g_college", name: "작년 생일 펀딩", startDate: day(-380), endDate: day(-340), createdAt: at(-380) },
      { id: "f_done", ownerId: "u_seoyeon", groupId: "g_college", name: "100% 달성한 펀딩", startDate: day(-90), endDate: day(-75), createdAt: at(-90) },
      { id: "f_noone", ownerId: "u_seoyeon", groupId: "g_college", name: "후원 없이 끝난 펀딩", startDate: day(-60), endDate: day(-30), createdAt: at(-60) },
      { id: "f_my22", ownerId: "u_seoyeon", groupId: "g_college", name: "재작년 생일 펀딩", startDate: day(-745), endDate: day(-705), createdAt: at(-745) },
      { id: "f_jihoon", ownerId: "u_jihoon", groupId: "g_office", name: "지훈이의 27번째 생일", startDate: day(-5), endDate: day(1), createdAt: at(-5) },
      { id: "f_doyoon", ownerId: "u_doyoon", groupId: "g_doyoon", name: "도윤 생일 러닝 펀딩", startDate: day(-60), endDate: day(-30), createdAt: at(-60) },
      { id: "f_mina", ownerId: "u_mina", groupId: "g_family", name: "민아 생일 축하 펀딩", startDate: day(-3), endDate: day(10), createdAt: at(-3) },
    ],
    gifts: [
      { id: "gift_headphone", fundingId: "f_my24", name: "노이즈캔슬링 무선 헤드폰", price: 359000, imageUrl: giftImage("🎧", "#F7C4E8", "#C8DDF7"), productUrl: "https://example.com/products/headphone", description: "출퇴근길에 쓰고 싶어요!", shortfallAction: null, settlementId: null },
      { id: "gift_moodlight", fundingId: "f_my24", name: "레트로 무드등", price: 39000, imageUrl: giftImage("💡", "#FFF1B8", "#F7C4E8"), productUrl: "https://example.com/products/mood-light", description: "", shortfallAction: null, settlementId: null },
      { id: "gift_chair", fundingId: "f_mylast", name: "캠핑 릴렉스 의자", price: 120000, imageUrl: giftImage("🏕️", "#C8DDF7", "#DCC5F3"), productUrl: "https://example.com/products/camping-chair", description: "", shortfallAction: null, settlementId: null },
      { id: "gift_books", fundingId: "f_mylast", name: "에세이 책 세트", price: 30000, imageUrl: giftImage("📚", "#DCC5F3", "#FFF1B8"), productUrl: "https://example.com/products/essay-set", description: "", shortfallAction: null, settlementId: null },
      { id: "gift_speaker", fundingId: "f_done", name: "블루투스 스피커", price: 89000, imageUrl: giftImage("🔊", "#DCC5F3", "#C8DDF7"), productUrl: "https://example.com/products/speaker", description: "", shortfallAction: null, settlementId: null },
      { id: "gift_tumbler", fundingId: "f_noone", name: "스테인리스 텀블러", price: 25000, imageUrl: giftImage("🥤", "#C8DDF7", "#FFF1F9"), productUrl: "https://example.com/products/tumbler", description: "", shortfallAction: null, settlementId: null },
      { id: "gift_camera", fundingId: "f_my22", name: "필름 카메라", price: 150000, imageUrl: giftImage("📷", "#FFF1B8", "#DCC5F3"), productUrl: "https://example.com/products/film-camera", description: "여행 사진 찍고 싶어요", shortfallAction: "carryover", settlementId: null },
      { id: "gift_console", fundingId: "f_jihoon", name: "휴대용 게임기", price: 398000, imageUrl: giftImage("🎮", "#C8DDF7", "#F7C4E8"), productUrl: "https://example.com/products/game-console", description: "같이 게임해요 🙌", shortfallAction: null, settlementId: null },
      { id: "gift_keyboard", fundingId: "f_jihoon", name: "기계식 키보드", price: 159000, imageUrl: giftImage("⌨️", "#F3E7F5", "#C8DDF7"), productUrl: "https://example.com/products/keyboard", description: "", shortfallAction: null, settlementId: null },
      { id: "gift_shoes", fundingId: "f_doyoon", name: "러닝화", price: 129000, imageUrl: giftImage("👟", "#FFF1B8", "#C8DDF7"), productUrl: "https://example.com/products/running-shoes", description: "", shortfallAction: null, settlementId: null },
      { id: "gift_perfume", fundingId: "f_mina", name: "플로럴 향수 50ml", price: 150000, imageUrl: giftImage("🌸", "#F7C4E8", "#FFF1F9"), productUrl: "https://example.com/products/perfume", description: "", shortfallAction: null, settlementId: null },
    ],
    donations: [
      { id: "d_1", fundingId: "f_my24", giftId: "gift_headphone", supporterId: "u_jihoon", amount: 100000, idempotencyKey: "seed-1", createdAt: at(-8, 10) },
      { id: "d_2", fundingId: "f_my24", giftId: "gift_headphone", supporterId: "u_mina", amount: 80000, idempotencyKey: "seed-2", createdAt: at(-6, 21) },
      { id: "d_3", fundingId: "f_my24", giftId: "gift_headphone", supporterId: "u_jihoon", amount: 30000, idempotencyKey: "seed-3", createdAt: at(-2, 9) },
      { id: "d_4", fundingId: "f_my24", giftId: "gift_moodlight", supporterId: "u_mina", amount: 39000, idempotencyKey: "seed-4", createdAt: at(-5, 18) },
      { id: "d_5", fundingId: "f_mylast", giftId: "gift_chair", supporterId: "u_jihoon", amount: 50000, idempotencyKey: "seed-5", createdAt: at(-370) },
      { id: "d_6", fundingId: "f_mylast", giftId: "gift_chair", supporterId: "u_mina", amount: 30000, idempotencyKey: "seed-6", createdAt: at(-360) },
      { id: "d_7", fundingId: "f_mylast", giftId: "gift_books", supporterId: "u_mina", amount: 30000, idempotencyKey: "seed-7", createdAt: at(-355) },
      { id: "d_8", fundingId: "f_jihoon", giftId: "gift_console", supporterId: "u_doyoon", amount: 200000, idempotencyKey: "seed-8", createdAt: at(-4) },
      { id: "d_9", fundingId: "f_jihoon", giftId: "gift_console", supporterId: "u_seoyeon", amount: 50000, idempotencyKey: "seed-9", createdAt: at(-3, 20) },
      { id: "d_10", fundingId: "f_jihoon", giftId: "gift_keyboard", supporterId: "u_doyoon", amount: 150000, idempotencyKey: "seed-10", createdAt: at(-2) },
      { id: "d_11", fundingId: "f_doyoon", giftId: "gift_shoes", supporterId: "u_jihoon", amount: 100000, idempotencyKey: "seed-11", createdAt: at(-50) },
      { id: "d_12", fundingId: "f_doyoon", giftId: "gift_shoes", supporterId: "u_seoyeon", amount: 29000, idempotencyKey: "seed-12", createdAt: at(-45) },
      { id: "d_15", fundingId: "f_done", giftId: "gift_speaker", supporterId: "u_jihoon", amount: 50000, idempotencyKey: "seed-15", createdAt: at(-85) },
      { id: "d_16", fundingId: "f_done", giftId: "gift_speaker", supporterId: "u_mina", amount: 39000, idempotencyKey: "seed-16", createdAt: at(-80) },
      { id: "d_14", fundingId: "f_my22", giftId: "gift_camera", supporterId: "u_jihoon", amount: 60000, idempotencyKey: "seed-14", createdAt: at(-730) },
      { id: "d_13", fundingId: "f_mina", giftId: "gift_perfume", supporterId: "u_jihoon", amount: 60000, idempotencyKey: "seed-13", createdAt: at(-1) },
    ],
    messages: [
      { id: "m_1", donationId: "d_1", fundingId: "f_my24", giftId: "gift_headphone", authorId: "u_jihoon", content: "생일 축하해! 🎂 좋은 노래 많이 들어!", createdAt: at(-8, 10) },
      { id: "m_2", donationId: "d_2", fundingId: "f_my24", giftId: "gift_headphone", authorId: "u_mina", content: "태어나줘서 고마워 💗 올해도 잘 부탁해~", createdAt: at(-6, 21) },
      { id: "m_3", donationId: "d_9", fundingId: "f_jihoon", giftId: "gift_console", authorId: "u_seoyeon", content: "오늘 하루 행복하게 보내! 🎉", createdAt: at(-3, 20) },
      { id: "m_4", donationId: "d_6", fundingId: "f_mylast", giftId: "gift_chair", authorId: "u_mina", content: "항상 좋은 일만 가득하길 ✨", createdAt: at(-360) },
    ],
    // 재작년 펀딩의 필름 카메라(60,000원 모금)를 다음 생일로 이월 → 펀딩 만들기에서 "이월 선물 불러오기"로 다시 열 수 있다
    carryovers: [
      { id: "co_camera", ownerId: "u_seoyeon", fundingId: "f_my22", giftId: "gift_camera", amount: 60000, createdAt: at(-700), status: "pending", reopenedFundingId: null, reopenedGiftId: null, reopenedAt: null },
    ],
    settlements: [],
    birthdayEvents: [
      { id: "be_1", ownerId: "u_seoyeon", friendName: "이지훈", birthday: birthdayIn(1, 1999), linkedFundingId: "f_jihoon" },
      { id: "be_2", ownerId: "u_seoyeon", friendName: "박민아", birthday: birthdayIn(0, 2001), linkedFundingId: "f_mina" },
      { id: "be_3", ownerId: "u_seoyeon", friendName: "최도윤", birthday: birthdayIn(-40, 2000), linkedFundingId: "f_doyoon" },
      { id: "be_4", ownerId: "u_seoyeon", friendName: "엄마", birthday: birthdayIn(45, 1972), linkedFundingId: null },
    ],
    notifications: [],
  };
}
