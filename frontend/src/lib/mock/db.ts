/**
 * 모의(mock) 데이터베이스
 *
 * 백엔드(FastAPI + PostgreSQL)가 준비되기 전까지 브라우저 메모리에 데이터를 보관한다.
 * - 새로고침해도 데이터가 유지되도록 localStorage 에 저장한다. (저장이 막힌 환경에서도 메모리로 동작)
 * - 이 파일의 레코드(Db*)는 "서버 내부 데이터"에 해당한다. 화면은 이 데이터를 직접 읽지 않고
 *   반드시 src/lib/api/* 함수를 거쳐 권한에 맞게 가공된 데이터만 받는다.
 * - 백엔드 연동 시 이 폴더(src/lib/mock)는 삭제하고 api 함수 내부만 fetch 로 바꾸면 된다.
 */
import type { CarryoverStatus, NotificationType, PriceRangeKey, SettlementFailureReason, SettlementStatus, ShortfallAction } from "@/types";
import { createSeedData } from "./seed";

export interface DbUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // 모의 해시 (실제 서버에서는 Argon2 사용)
  birthday: string;
  profileImage: string | null;
  preference: { keywords: string[]; categories: string[]; priceRange: PriceRangeKey | null };
}

export interface DbGroup {
  id: string;
  name: string;
  description: string;
  adminId: string;
  memberIds: string[];
  createdAt: string;
}

export interface DbInvite {
  token: string;
  groupId: string;
  fundingId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DbFunding {
  id: string;
  ownerId: string;
  groupId: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface DbGift {
  id: string;
  fundingId: string;
  name: string;
  price: number;
  imageUrl: string;
  productUrl: string;
  description: string;
  shortfallAction: ShortfallAction | null;
  settlementId: string | null;
}

export interface DbDonation {
  id: string;
  fundingId: string;
  giftId: string;
  supporterId: string;
  amount: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface DbMessage {
  id: string;
  donationId: string;
  fundingId: string;
  giftId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface DbCarryover {
  id: string;
  ownerId: string;
  fundingId: string;
  giftId: string;
  amount: number;
  createdAt: string;
  status: CarryoverStatus;
  reopenedFundingId: string | null; // 다음 생일에 다시 연 펀딩
  reopenedGiftId: string | null; // 이월 금액이 시작 모금액으로 들어간 선물
  reopenedAt: string | null;
}

export interface DbSettlement {
  id: string;
  ownerId: string;
  fundingId: string;
  giftIds: string[];
  amount: number;
  bank: string;
  accountNumber: string;
  accountHolder: string;
  status: SettlementStatus;
  requestedAt: string;
  processedAt?: string | null; // 처리 중 → 완료 / 실패가 된 시각
  failureReason?: SettlementFailureReason | null;
}

export interface DbBirthdayEvent {
  id: string;
  ownerId: string;
  friendName: string;
  birthday: string;
  linkedFundingId: string | null;
}

export interface DbNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  eventId: string | null; // 생일 알림은 일정 ID, 미달 처리 알림은 null
  fundingId: string | null;
  dedupeKey: string; // 같은 일정 · 같은 날짜 · 같은 유형 알림 중복 생성 방지
  isRead: boolean;
  createdAt: string;
}

export interface MockDatabase {
  version: number;
  users: DbUser[];
  groups: DbGroup[];
  invites: DbInvite[];
  fundings: DbFunding[];
  gifts: DbGift[];
  donations: DbDonation[];
  messages: DbMessage[];
  carryovers: DbCarryover[];
  settlements: DbSettlement[];
  birthdayEvents: DbBirthdayEvent[];
  notifications: DbNotification[];
}

const STORAGE_KEY = "gift-funding:mock-db";
const DB_VERSION = 5;

/** 버전이 올라갈 때 기존 체험 데이터에도 넣어 줄 새 시드 레코드 (이미 있거나 지운 경우는 건드리지 않도록 ID 로 확인) */
const DEMO_ADDITIONS = {
  fundings: ["f_my22", "f_noone", "f_done"],
  gifts: ["gift_camera", "gift_tumbler", "gift_speaker"],
  donations: ["d_14", "d_15", "d_16"],
  carryovers: ["co_camera"],
} as const;

let cache: MockDatabase | null = null;

function loadFromStorage(): MockDatabase | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockDatabase;
    if (parsed.version === 1) return moveToOwnGroups(addDemoRecords(migrateV1(parsed)));
    if (parsed.version === 2 || parsed.version === 3) return moveToOwnGroups(addDemoRecords(parsed));
    if (parsed.version === 4) return moveToOwnGroups(parsed);
    return parsed.version === DB_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

/** v1 → v2: 이월 기록에 "다시 열기" 필드 추가 (기존에 저장된 체험 데이터는 그대로 유지) */
function migrateV1(db: MockDatabase): MockDatabase {
  return {
    ...db,
    version: DB_VERSION,
    carryovers: db.carryovers.map((c) => ({ ...c, status: c.status ?? "pending", reopenedFundingId: c.reopenedFundingId ?? null, reopenedGiftId: c.reopenedGiftId ?? null, reopenedAt: c.reopenedAt ?? null })),
  };
}

/** 시드에만 있는 레코드를 ID 기준으로 덧붙인다 (사용자가 지운 레코드가 아닌, 새로 추가된 시드만 대상) */
function mergeById<T extends { id: string }>(current: T[], seedRows: T[], ids: readonly string[]): T[] {
  const existing = new Set(current.map((r) => r.id));
  return [...current, ...seedRows.filter((r) => ids.includes(r.id) && !existing.has(r.id))];
}

/** v2 · v3 → v4: 기존 체험 데이터를 유지한 채 새 체험용 펀딩(이월 예시 · 후원 없이 끝난 펀딩 · 100% 달성한 펀딩)만 추가 */
function addDemoRecords(db: MockDatabase): MockDatabase {
  const next = { ...db, version: DB_VERSION };
  if (!db.users.some((u) => u.id === "u_seoyeon")) return next;
  const seed = createSeedData();
  next.fundings = mergeById(db.fundings, seed.fundings, DEMO_ADDITIONS.fundings);
  next.gifts = mergeById(db.gifts, seed.gifts, DEMO_ADDITIONS.gifts);
  next.donations = mergeById(db.donations, seed.donations, DEMO_ADDITIONS.donations);
  next.carryovers = mergeById(db.carryovers, seed.carryovers, DEMO_ADDITIONS.carryovers);
  return next;
}

/**
 * v4 → v5: "펀딩은 그 그룹을 만든 사람만 열 수 있다"(2026-10-19 확정)에 맞춰 체험 데이터를 옮긴다.
 * - 100% 달성한 펀딩(f_done): 회사 동료 → 대학 친구들 (후원자 도윤 → 민아)
 * - 도윤 펀딩(f_doyoon): 회사 동료 → 새 그룹 "도윤 생일 모임"
 */
function moveToOwnGroups(db: MockDatabase): MockDatabase {
  const next = { ...db, version: DB_VERSION };
  if (!db.users.some((u) => u.id === "u_doyoon")) return next;
  const seedGroup = createSeedData().groups.find((g) => g.id === "g_doyoon");
  if (seedGroup && !db.groups.some((g) => g.id === "g_doyoon")) next.groups = [...db.groups, seedGroup];
  next.fundings = db.fundings.map((f) => {
    if (f.id === "f_done" && f.groupId === "g_office") return { ...f, groupId: "g_college" };
    if (f.id === "f_doyoon" && f.groupId === "g_office") return { ...f, groupId: "g_doyoon" };
    return f;
  });
  next.donations = db.donations.map((d) => (d.id === "d_16" && d.supporterId === "u_doyoon" ? { ...d, supporterId: "u_mina" } : d));
  return next;
}

/** 현재 DB 를 반환한다. 처음 호출 시 localStorage → 없으면 시드 데이터로 초기화 */
export function getDb(): MockDatabase {
  if (cache) return cache;
  cache = (typeof window !== "undefined" && loadFromStorage()) || { version: DB_VERSION, ...createSeedData() };
  saveDb();
  return cache;
}

/** 변경 사항을 localStorage 에 저장 (용량 초과 등 실패 시 메모리에만 유지) */
export function saveDb(): void {
  if (!cache || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // 저장 실패는 무시: 현재 탭의 메모리 데이터로 계속 동작한다.
  }
}

/** 테스트용: DB 를 시드 상태로 되돌린다 */
export function resetDb(): void {
  cache = { version: DB_VERSION, ...createSeedData() };
  saveDb();
}

/** 예측하기 어려운 ID / 토큰 생성 */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${random.slice(0, 16)}`;
}

/**
 * 모의 비밀번호 해시.
 * 실제 서비스에서는 서버가 Argon2 로 해싱하므로, 여기서는 "원문을 그대로 저장하지 않는다"는 원칙만 지킨다.
 */
export function mockHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 33) ^ text.charCodeAt(i);
  return `mock$${(hash >>> 0).toString(16)}`;
}
