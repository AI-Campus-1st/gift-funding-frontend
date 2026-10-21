/**
 * 화면 · 검증에서 함께 쓰는 고정 값
 *
 * 서버도 같은 값으로 다시 검증한다. (docs/API_SPEC.md 4장)
 * 사용 위치: 선물 취향(UI-26), AI 추천(UI-11), 후원 메시지(UI-19), 정산(UI-24)
 */
import type { PriceRangeKey, SettlementFailureReason } from "@/types";

/** 선호 선물 카테고리 · AI 추천 카테고리 */
export const GIFT_CATEGORIES = ["전자기기", "패션·잡화", "뷰티", "취미", "리빙", "도서", "식품", "스포츠·아웃도어"];

/** 선호 가격대 (min/max 는 AI 추천 예산으로 사용, null = 제한 없음) */
export const PRICE_RANGES: { key: PriceRangeKey; label: string; min: number | null; max: number | null }[] = [
  { key: "under30k", label: "3만 원 미만", min: null, max: 30000 },
  { key: "30k-100k", label: "3만~10만 원", min: 30000, max: 100000 },
  { key: "100k-300k", label: "10만~30만 원", min: 100000, max: 300000 },
  { key: "300k-500k", label: "30만~50만 원", min: 300000, max: 500000 },
  { key: "over500k", label: "50만 원 이상", min: 500000, max: null },
];

/** 관심사 키워드 최대 개수 */
export const MAX_KEYWORDS = 10;

/** 축하 메시지 최대 글자 수 */
export const MESSAGE_MAX_LENGTH = 200;

/** 선물 가격(= 목표 금액) 최대 5,000만 원 (2026-10-19 확정) — 서버도 같은 값으로 검증 */
export const GIFT_PRICE_MAX = 50_000_000;

/**
 * 입력값 최대 글자 수 (2026-10-19 확정, 기능명세 Q1 · Q4)
 * 화면 입력 제한 = 서버 검증 = DB 컬럼 길이 (docs/backend/ERD.md)
 */
export const TEXT_LIMITS = {
  userName: 50,
  email: 255,
  groupName: 30,
  groupDescription: 100,
  fundingName: 40,
  giftName: 100,
  giftDescription: 100,
  friendName: 20,
  message: MESSAGE_MAX_LENGTH,
} as const;

/** "OO은(는) N자 이내로 입력해 주세요." */
export function tooLongMessage(label: string, max: number): string {
  return `${label} ${max}자 이내로 입력해 주세요.`;
}

/** 정산 은행 목록 */
export const BANKS = ["국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", "카카오뱅크", "토스뱅크", "케이뱅크"];

/** 목표 미달 선물의 이월 / 인출 선택 기한 — 펀딩 종료 후 7일 (지나면 생일자에게 알림 한 번) */
export const SHORTFALL_DEADLINE_DAYS = 7;

/** 정산 실패 이유별 안내 문구 — 실패하면 계좌 정보를 다시 입력해 재요청할 수 있다 (FEATURE_SPEC F-12) */
export const SETTLEMENT_FAILURE_MESSAGE: Record<SettlementFailureReason, string> = {
  ACCOUNT_INVALID: "계좌 정보가 올바르지 않습니다. 계좌 정보를 다시 입력해 주세요.",
  BANK_ERROR: "은행 오류입니다. 다시 입력해 주세요.",
};
