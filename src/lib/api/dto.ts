/**
 * 서버와 주고받는 JSON 형식 (snake_case) — docs/API_SPEC.md 2장과 1:1 대응
 *
 * - 대부분은 프론트 타입(types/index.ts)의 키를 snake_case 로 바꾼 것과 같아서 Snake<T> 로 만든다.
 * - 이름 · 구조가 다른 응답(로그인 토큰, 초대 참여 결과, 알림 등)만 따로 적는다.
 * - 화면 · 컴포넌트는 이 타입을 쓰지 않는다. lib/api 안에서만 사용한다. (rules.md 9.3)
 */
import type {
  AiRecommendation,
  AiRecommendationRequest,
  AppNotification,
  BirthdayEvent,
  BirthdayEventInput,
  DonationRequest,
  FriendFundingView,
  FundingBase,
  FundingInput,
  GiftEditView,
  GiftInput,
  GiftPreference,
  GroupDetail,
  GroupSummary,
  InviteLink,
  InvitePreview,
  MyDonation,
  OwnerFundingView,
  PendingCarryover,
  ReceivedMessage,
  SettlementOverview,
  SettlementRequest,
  SignupInput,
  SupporterDonation,
  SupporterGiftView,
  User,
} from "@/types";
import type { Snake } from "./case";

/* ───────── 공통 ───────── */

export interface IdDto {
  id: string;
}

export interface ErrorDto {
  code: string;
  message: string;
  field_errors?: Record<string, string>;
  max_available?: number;
}

/* ───────── 사용자 ───────── */

export type UserDto = Omit<Snake<User>, "profile_image"> & { profile_image_url: string | null };
export type PreferenceDto = Snake<GiftPreference>;
export interface AuthTokenDto {
  access_token: string;
  token_type: "bearer";
  expires_in: number; // 초
  user: UserDto;
}
export type SignupRequestDto = Snake<SignupInput>;
export interface LoginRequestDto {
  email: string;
  password: string;
  remember_me: boolean;
}
export interface ProfileRequestDto {
  name: string;
  birthday: string;
  profile_image_url: string | null;
}

/* ───────── 그룹 · 초대 ───────── */

export type GroupSummaryDto = Snake<GroupSummary>;
export type GroupListDto = { created: GroupSummaryDto[]; joined: GroupSummaryDto[] };
export type GroupDetailDto = Snake<GroupDetail>;
export type InviteDto = Snake<InviteLink>;
export type InvitePreviewDto = Snake<InvitePreview>;
/** 초대 참여 결과 — 서버는 화면 경로를 주지 않는다 */
export interface JoinResultDto {
  group_id: string;
  target_funding_id: string | null;
  target_is_mine: boolean;
  already_joined: boolean;
}

/* ───────── 펀딩 · 선물 ───────── */

export type FundingBaseDto = Snake<FundingBase>;
export type SupporterGiftDto = Snake<SupporterGiftView>;
export type OwnerFundingDto = Snake<OwnerFundingView>;
export type FriendFundingDto = Snake<FriendFundingView>;
export type GiftEditDto = Snake<GiftEditView>;
export type SupporterDonationDto = Snake<SupporterDonation>;
export type GiftForDonationDto = { funding: FundingBaseDto; gift: SupporterGiftDto };
export type FundingRequestDto = Snake<FundingInput>;
export type GiftRequestDto = Snake<GiftInput>;

/* ───────── 후원 · 메시지 ───────── */

export type DonationRequestDto = Snake<DonationRequest>;
export interface DonationCreatedDto {
  donation_id: string;
}
export type MyDonationDto = Snake<MyDonation>;
export type ReceivedMessageDto = Snake<ReceivedMessage>;

/* ───────── 이월 · 정산 ───────── */

export type PendingCarryoverDto = Snake<PendingCarryover>;
export type SettlementOverviewDto = Snake<SettlementOverview>;
export type SettlementRequestDto = Snake<SettlementRequest>;

/* ───────── 캘린더 · 알림 · AI ───────── */

export type BirthdayEventDto = Snake<BirthdayEvent>;
export type BirthdayEventRequestDto = Snake<BirthdayEventInput>;
export interface LinkableFundingDto {
  id: string;
  name: string;
}
/** 알림 — 화면 경로(href) 대신 이동 대상 정보를 준다 */
export type NotificationDto = Omit<Snake<AppNotification>, "href"> & {
  event_id: string | null;
  funding_id: string | null;
  can_open_funding: boolean;
  funding_is_mine: boolean;
};
export interface UnreadCountDto {
  count: number;
}
export type AiRecommendationRequestDto = Snake<AiRecommendationRequest> & { exclude_ids: string[] };
export type AiRecommendationListDto = { items: Snake<AiRecommendation>[] };
