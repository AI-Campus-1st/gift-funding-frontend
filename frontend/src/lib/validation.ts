/**
 * 입력값 검증 함수 모음
 *
 * - 각 함수는 "오류 문구(string)" 또는 "문제 없음(null)"을 반환한다.
 * - 오류 문구는 화면명세서(01_auth.md 5.2 등)와 기능명세서의 문구를 그대로 사용한다.
 * - 프론트엔드 검증은 사용자 편의를 위한 1차 검증이며, 최종 검증은 서버(mock API)에서 다시 한다.
 */
import type { FundingInput, GiftInput, SettlementRequest } from "@/types";
import { BANKS, GIFT_PRICE_MAX, TEXT_LIMITS, tooLongMessage } from "./constants";
import { parseLocalDate, toDateString, todayString } from "./format";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN_LENGTH = 8;

export function validateName(value: string): string | null {
  if (value.length === 0) return "이름을 입력해 주세요.";
  if (value.trim().length === 0) return "올바른 이름을 입력해 주세요.";
  if (value.trim().length > TEXT_LIMITS.userName) return tooLongMessage("이름은", TEXT_LIMITS.userName);
  return null;
}

export function validateEmail(value: string): string | null {
  if (value.trim().length === 0) return "이메일을 입력해 주세요.";
  if (!EMAIL_PATTERN.test(value.trim())) return "올바른 이메일 형식으로 입력해 주세요.";
  if (value.trim().length > TEXT_LIMITS.email) return tooLongMessage("이메일은", TEXT_LIMITS.email);
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length === 0) return "비밀번호를 입력해 주세요.";
  if (value.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (confirm.length === 0) return "비밀번호를 다시 입력해 주세요.";
  if (password !== confirm) return "비밀번호가 일치하지 않습니다.";
  return null;
}

/**
 * 비밀번호 변경 입력 검사 (docs/features/password-change.md)
 * 현재 비밀번호가 맞는지 · 현재와 같은지는 서버가 확인한다 (화면은 원문을 모르기 때문)
 */
export function validatePasswordChange(input: { currentPassword: string; newPassword: string; newPasswordConfirm: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.currentPassword.length === 0) errors.currentPassword = "현재 비밀번호를 입력해 주세요.";
  const newError = validatePassword(input.newPassword);
  if (newError) errors.newPassword = newError;
  else if (input.newPassword === input.currentPassword) errors.newPassword = "현재 비밀번호와 다른 비밀번호를 입력해 주세요.";
  const confirmError = validatePasswordConfirm(input.newPassword, input.newPasswordConfirm);
  if (confirmError) errors.newPasswordConfirm = confirmError;
  return errors;
}

/** 생년월일: 필수 / 존재하는 날짜 / 미래 날짜 불가 */
export function validateBirthday(value: string): string | null {
  if (!value) return "생년월일을 선택해 주세요.";
  if (!parseLocalDate(value)) return "올바른 생년월일을 선택해 주세요.";
  if (value > todayString()) return "오늘 이후 날짜는 선택할 수 없습니다.";
  return null;
}

/** 원화 정수 금액 (선물 가격 · 후원 금액 공통) */
export function validatePositiveAmount(value: number | null, emptyMessage: string): string | null {
  if (value === null || Number.isNaN(value)) return emptyMessage;
  if (!Number.isInteger(value)) return "금액은 원 단위 정수로 입력해 주세요.";
  if (value <= 0) return "0원보다 큰 금액을 입력해 주세요.";
  return null;
}

/** http(s) URL 형식 확인 */
export function validateUrl(value: string): string | null {
  if (value.trim().length === 0) return "상품 구매 URL을 입력해 주세요.";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
    return null;
  } catch {
    return "올바른 URL 형식으로 입력해 주세요. (예: https://...)";
  }
}

/** 숫자 문자열(콤마 포함 가능) → 정수. 비어 있으면 null */
export function parseAmountInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 0) return null;
  return Number(digits);
}

/* ───────── 선물 · 펀딩 · 정산 · 초대 입력 검증 (화면 안내용, 서버도 같은 규칙으로 다시 검증) ───────── */

/** 선물 입력값 검증 (필수 4항목 + 가격 1원 ~ 5,000만 원 + URL 형식) */
export function validateGiftInput(input: GiftInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.name.trim().length === 0) errors.name = "선물 이름을 입력해 주세요.";
  else if (input.name.trim().length > TEXT_LIMITS.giftName) errors.name = tooLongMessage("선물 이름은", TEXT_LIMITS.giftName);
  if ((input.description ?? "").trim().length > TEXT_LIMITS.giftDescription) errors.description = tooLongMessage("선물 설명은", TEXT_LIMITS.giftDescription);
  const priceError = validatePositiveAmount(input.price, "선물 가격을 입력해 주세요.");
  if (priceError) errors.price = priceError;
  else if (input.price > GIFT_PRICE_MAX) errors.price = `선물 가격은 ${GIFT_PRICE_MAX.toLocaleString("ko-KR")}원 이하로 입력해 주세요.`; // 2026-10-19 확정
  if (!input.imageUrl) errors.imageUrl = "선물 이미지를 등록해 주세요.";
  const urlError = validateUrl(input.productUrl);
  if (urlError) errors.productUrl = urlError;
  return errors;
}

/** 펀딩 최대 기간: 시작일 포함 21일 (3주) */
export const FUNDING_MAX_DAYS = 21;

/** 시작일 기준으로 고를 수 있는 마지막 종료일 "YYYY-MM-DD" */
export function maxFundingEndDate(startDate: string): string {
  const start = parseLocalDate(startDate);
  if (!start) return "";
  const last = new Date(start.getFullYear(), start.getMonth(), start.getDate() + FUNDING_MAX_DAYS - 1);
  return toDateString(last);
}

/** 펀딩 입력값 검증 (giftCount = 직접 등록한 선물 + 불러온 이월 선물) */
export function validateFundingInput(input: Omit<FundingInput, "gifts" | "carryoverIds"> & { giftCount: number }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.name.trim().length === 0) errors.name = "펀딩 이름을 입력해 주세요.";
  else if (input.name.trim().length > TEXT_LIMITS.fundingName) errors.name = tooLongMessage("펀딩 이름은", TEXT_LIMITS.fundingName);
  if (!input.groupId) errors.groupId = "그룹을 선택해 주세요.";
  const start = parseLocalDate(input.startDate);
  const end = parseLocalDate(input.endDate);
  if (!start) errors.startDate = "시작일을 선택해 주세요.";
  else if (input.startDate < todayString()) errors.startDate = "시작일은 오늘 이전으로 선택할 수 없어요."; // 오늘 포함 가능, 과거 불가 (FEATURE_SPEC F-07, 2026-10-16 확정)
  if (!end) errors.endDate = "종료일을 선택해 주세요.";
  else if (input.startDate && input.endDate < input.startDate) errors.endDate = "종료일은 시작일보다 빠를 수 없어요.";
  else if (start && input.endDate > maxFundingEndDate(input.startDate)) errors.endDate = `펀딩 기간은 최대 3주(${FUNDING_MAX_DAYS}일)까지 설정할 수 있어요.`;
  if (input.giftCount < 1) errors.gifts = "선물을 최소 1개 이상 등록해 주세요.";
  return errors;
}

/** 정산 계좌 검증 (본인 명의만 허용) */
export function validateAccount(input: Omit<SettlementRequest, "giftIds">, ownerName: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!BANKS.includes(input.bank)) errors.bank = "은행을 선택해 주세요.";
  const digits = input.accountNumber.replace(/-/g, "");
  if (digits.length === 0) errors.accountNumber = "계좌번호를 입력해 주세요.";
  else if (!/^\d{10,14}$/.test(digits)) errors.accountNumber = "계좌번호는 숫자 10~14자리로 입력해 주세요.";
  if (input.accountHolder.trim().length === 0) errors.accountHolder = "예금주를 입력해 주세요.";
  else if (input.accountHolder.trim() !== ownerName) errors.accountHolder = "본인 명의 계좌만 등록할 수 있어요.";
  return errors;
}

/**
 * 사용자가 입력한 값에서 초대 토큰을 꺼낸다.
 * - 전체 링크(https://.../join-invite?token=XXX) 또는 토큰만 입력해도 동작한다.
 */
export function extractInviteToken(input: string): string {
  const value = input.trim();
  try {
    const url = new URL(value);
    return url.searchParams.get("token")?.trim() ?? "";
  } catch {
    return value;
  }
}
