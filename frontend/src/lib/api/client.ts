/**
 * API 공통 모듈 — 오류 타입 · 인증 토큰 보관
 *
 * - 서버 오류 응답({ code, message, field_errors, max_available })은 http.ts 가 ApiError 로 바꾼다.
 * - 화면은 ApiError 의 code 로 분기하고, 문구는 getErrorMessage() 로 보여준다. (rules.md 9.4)
 */

/** 화면에서 분기 처리할 오류 코드 */
export type ApiErrorCode =
  | "UNAUTHORIZED" // 로그인 필요 / 인증 만료
  | "FORBIDDEN" // 접근 권한 없음
  | "NOT_FOUND"
  | "VALIDATION" // 입력값 오류
  | "DUPLICATE_EMAIL"
  | "INVALID_CREDENTIALS"
  | "INVITE_INVALID" // 존재하지 않는 초대 링크
  | "INVITE_INACTIVE" // 비활성화된 초대 링크
  | "INVITE_EXPIRED" // 펀딩이 끝나 만료된 초대 링크
  | "EXCEEDS_REMAINING" // 남은 모금액 초과 → details.maxAvailable 제공
  | "GOAL_REACHED" // 목표 달성으로 후원 마감
  | "FUNDING_NOT_ACTIVE" // 종료되었거나 시작 전인 펀딩
  | "GIFT_LOCKED" // 후원이 발생한 선물 수정/삭제 제한
  | "CONFLICT" // 이미 처리된 요청 (이월·인출·정산 중복 등)
  | "RATE_LIMITED" // 요청이 너무 잦음 (AI 추천 1인당 1분 5회)
  | "AI_UNAVAILABLE" // AI 추천 실패 (시간 초과 · 형식 오류)
  | "NETWORK" // 서버에 닿지 못함 (프론트 전용)
  | "INTERNAL"; // 알 수 없는 서버 오류

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** 필드별 오류 문구 (VALIDATION) */
  readonly fieldErrors?: Record<string, string>;
  /** 초과 후원 시 최대 후원 가능 금액 */
  readonly maxAvailable?: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    extra: { fieldErrors?: Record<string, string>; maxAvailable?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fieldErrors = extra.fieldErrors;
    this.maxAvailable = extra.maxAvailable;
  }
}

/** 알 수 없는 오류를 사용자에게 보여줄 문구로 변환 */
export function getErrorMessage(error: unknown, fallback = "잠시 후 다시 시도해 주세요."): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

/* ───────── 인증 토큰 보관 ─────────
 * "로그인 상태 유지"를 선택하면 localStorage(브라우저를 닫아도 유지),
 * 아니면 sessionStorage(탭을 닫으면 삭제)에 저장한다.
 * 실제 서버 연동 시 JWT 를 이 위치에 보관한다. (비밀번호 원문은 절대 저장하지 않는다)
 */
const TOKEN_KEY = "gift-funding:token";

export function saveToken(token: string, remember: boolean): void {
  try {
    clearToken();
    (remember ? window.localStorage : window.sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    // 저장소 접근이 막힌 환경: 메모리에만 유지
    memoryToken = token;
  }
}

let memoryToken: string | null = null;

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // 무시
  }
}
