/**
 * 도메인 타입 정의
 *
 * - 서버(추후 FastAPI)와 주고받을 데이터의 형태를 한곳에서 관리한다.
 * - 권한별 공개 정책(F-13)을 "타입"으로도 지키기 위해 생일자용 뷰와 후원자용 뷰를 분리했다.
 *   예) SupporterGiftView 에는 raisedAmount(현재 모금액) / remainingAmount(남은 금액) 필드가 아예 없다.
 *       → 후원자 화면 코드에서 실수로 모금액을 렌더링하려 하면 타입 오류가 난다.
 * - 금액은 모두 원화 정수(number)이고, 날짜는 ISO 문자열(YYYY-MM-DD 또는 전체 ISO)이다.
 */

export type Id = string;

/* ───────── 사용자 ───────── */

export interface User {
  id: Id;
  name: string; // 회원가입 시 등록한 실명 (축하 메시지 작성자 이름으로 사용)
  email: string;
  birthday: string; // YYYY-MM-DD
  profileImage: string | null; // data URL 또는 null
}

export interface GiftPreference {
  keywords: string[];
  categories: string[];
  priceRange: PriceRangeKey | null;
}

export type PriceRangeKey = "under30k" | "30k-100k" | "100k-300k" | "300k-500k" | "over500k";

/** 회원가입 입력 (UI-02) */
export interface SignupInput {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  birthday: string;
}

/** 프로필 수정 입력 (UI-25) */
export interface ProfileInput {
  name: string;
  birthday: string;
  profileImage: string | null;
}

/* ───────── 그룹 · 초대 ───────── */

export interface GroupSummary {
  id: Id;
  name: string;
  description: string;
  memberCount: number;
  isAdmin: boolean; // 현재 사용자가 그룹 관리자인지
  fundings: GroupFundingSummary[]; // 접근 가능한 연결 펀딩
}

export interface GroupFundingSummary {
  id: Id;
  name: string;
  ownerName: string;
  isMine: boolean;
  status: FundingStatus;
}

export interface GroupDetail extends GroupSummary {
  members: { id: Id; name: string; isAdmin: boolean }[];
}

export interface InviteLink {
  token: string;
  groupId: Id;
  groupName: string;
  fundingId: Id | null; // 특정 펀딩으로 바로 연결되는 초대인 경우
  fundingName: string | null;
  isActive: boolean;
  isExpired: boolean; // 연결된 펀딩이 종료되어 만료됨 (D-S1-4)
  createdAt: string;
}

/** 초대 링크 검증 결과 (UI-17 에서 참여 전 보여줄 정보) */
export interface InvitePreview {
  token: string;
  groupName: string;
  fundingName: string | null;
  ownerName: string | null; // 생일자 이름
  alreadyJoined: boolean;
  targetFundingId: Id | null; // 참여 후 이동할 펀딩
}

/* ───────── 펀딩 · 선물 ───────── */

export type FundingStatus = "scheduled" | "active" | "ended"; // 예정 / 진행 중 / 종료

/** 후원자(친구 펀딩)에게 공개되는 선물 정보 — 모금액·남은 금액 없음 */
export interface SupporterGiftView {
  id: Id;
  name: string;
  price: number; // 실제 가격 = 목표 금액
  imageUrl: string;
  productUrl: string;
  description: string;
  achievementRate: number; // 0~100 정수
  isClosed: boolean; // 목표 달성(100%)으로 후원 마감
}

/** 생일자(본인 펀딩)에게 공개되는 선물 정보 */
export interface OwnerGiftView extends SupporterGiftView {
  raisedAmount: number; // 현재 전체 모금액
  remainingAmount: number; // 남은 모금액
  donationCount: number;
  shortfallAction: ShortfallAction | null; // 목표 미달 처리 결과
  settled: boolean; // 정산 요청에 포함되었는지
  settlementStatus: SettlementStatus | null; // 이 선물이 포함된 정산의 상태 (정산 전 · 실패 후 재요청 전이면 null)
  carriedOverAmount: number; // 지난 펀딩에서 이월되어 시작 모금액으로 들어간 금액 (없으면 0, 모금액에 포함)
}

export interface FundingBase {
  id: Id;
  name: string;
  groupId: Id;
  groupName: string;
  ownerName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: FundingStatus;
}

export interface OwnerFundingView extends FundingBase {
  gifts: OwnerGiftView[];
  totalRaised: number;
}

export interface FriendFundingView extends FundingBase {
  gifts: SupporterGiftView[];
}

/** 펀딩 생성 시 입력하는 선물 (아직 서버에 저장 전) */
export interface GiftInput {
  name: string;
  price: number;
  imageUrl: string;
  productUrl: string;
  description: string;
}

/** 선물 수정 화면(UI-10)용 기존 선물 정보 — hasDonations: 후원 또는 이월 금액이 있어 가격 · 삭제가 잠김 */
export interface GiftEditView extends GiftInput {
  fundingId: Id;
  hasDonations: boolean;
}

export interface FundingInput {
  name: string;
  groupId: Id;
  startDate: string;
  endDate: string;
  gifts: GiftInput[];
  /** 다시 열 이월 기록 ID — 서버가 이월된 선물을 복사하고 이월 금액을 시작 모금액으로 넣는다 */
  carryoverIds?: Id[];
}

/* ───────── 후원 · 메시지 ───────── */

export interface DonationRequest {
  giftId: Id;
  amount: number;
  message: string; // 빈 문자열이면 메시지 없음
  idempotencyKey: string; // 동일 요청 중복 처리 방지용 식별자
}

/** 본인 후원 내역 (UI-20, UI-21) */
export interface MyDonation {
  id: Id;
  fundingId: Id;
  fundingName: string;
  ownerName: string;
  giftId: Id;
  giftName: string;
  amount: number;
  hasMessage: boolean;
  createdAt: string;
  status: "completed";
}

/** 생일자 전용 후원자 내역 (UI-13) */
export interface SupporterDonation {
  id: Id;
  supporterName: string;
  giftId: Id;
  giftName: string;
  amount: number;
  createdAt: string;
}

/** 생일자 전용 축하 메시지 (UI-27) */
export interface ReceivedMessage {
  id: Id;
  authorName: string;
  content: string;
  fundingName: string;
  giftName: string;
  createdAt: string;
}

/* ───────── 종료 · 정산 ───────── */

export type ShortfallAction = "carryover" | "withdraw"; // 다음 생일로 이월 / 현재 모금액 인출

export type CarryoverStatus = "pending" | "reopened"; // 다음 생일 대기 / 다시 연 펀딩에 반영됨

/** 다음 생일 펀딩에서 불러올 수 있는 이월 선물 (생일자 본인 전용, UI-09) */
export interface PendingCarryover {
  id: Id;
  fundingName: string; // 이월한 지난 펀딩
  giftName: string;
  price: number; // 목표 금액 (다시 열어도 그대로)
  imageUrl: string;
  productUrl: string;
  description: string;
  amount: number; // 이월 금액 = 다시 연 선물의 시작 모금액
  createdAt: string;
}

export type SettlementStatus = "requested" | "processing" | "completed" | "failed";

/** 정산 실패 이유 — 계좌 정보 오류 / 은행 오류 (실패하면 계좌를 다시 입력해 재요청) */
export type SettlementFailureReason = "ACCOUNT_INVALID" | "BANK_ERROR";

export interface SettlementRecord {
  id: Id;
  fundingId: Id;
  giftNames: string[];
  amount: number;
  bank: string;
  accountNumberMasked: string;
  accountHolder: string;
  status: SettlementStatus;
  requestedAt: string;
  failureReason: SettlementFailureReason | null;
}

export interface SettlementOverview {
  fundingId: Id;
  fundingName: string;
  eligibleGifts: { id: Id; name: string; amount: number; reason: "achieved" | "withdraw" }[];
  eligibleAmount: number;
  carryoverGifts: { id: Id; name: string; amount: number }[];
  history: SettlementRecord[];
}

export interface SettlementRequest {
  giftIds: Id[];
  bank: string;
  accountNumber: string;
  accountHolder: string;
}

/* ───────── 캘린더 · 알림 ───────── */

export interface BirthdayEvent {
  id: Id;
  friendName: string;
  birthday: string; // YYYY-MM-DD (연도는 태어난 해, 매년 반복 표시)
  linkedFundingId: Id | null;
  linkedFundingName: string | null;
  canOpenLinkedFunding: boolean; // 연결 펀딩 열람 권한
  linkedFundingIsMine: boolean;
}

export interface BirthdayEventInput {
  friendName: string;
  birthday: string;
  linkedFundingId: Id | null;
}

export type NotificationType = "birthday-before" | "birthday-today" | "shortfall-reminder"; // 생일 하루 전 / 당일 / 미달 처리 알림(종료 후 7일)

export interface AppNotification {
  id: Id;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  /** 클릭 시 이동할 경로 (권한이 없는 펀딩은 캘린더로 대체) */
  href: string;
}

/* ───────── AI 추천 ───────── */

export interface AiRecommendationRequest {
  keywords: string[];
  categories: string[];
  budgetMin: number | null;
  budgetMax: number | null;
}

/** 초대 링크로 참여한 결과 (UI-17) — redirectPath 는 프론트가 서버 응답으로 만든 화면 경로 */
export interface JoinResult {
  redirectPath: string;
  alreadyJoined: boolean;
}

export interface AiRecommendation {
  id: Id;
  name: string;
  reason: string;
  category: string;
  priceMin: number;
  priceMax: number;
}
