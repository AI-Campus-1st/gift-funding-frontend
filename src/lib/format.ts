/**
 * 화면 표시용 포맷 · 날짜 계산 유틸리티
 *
 * - 금액: 천 단위 구분 기호 + "원" (base.md 6.2 입력 규칙)
 * - 날짜: 사용자의 로컬 시간대 기준 "YYYY-MM-DD" 문자열을 사용한다.
 *   (new Date("2026-10-15") 는 UTC 로 해석되어 하루가 밀릴 수 있으므로 parseLocalDate 를 사용)
 * - 사용 위치: 거의 모든 화면 / mock API(달성률·상태 계산)
 */
import type { FundingStatus } from "@/types";

const numberFormatter = new Intl.NumberFormat("ko-KR");

/** 12000 → "12,000" */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** 12000 → "12,000원" */
export function formatWon(value: number): string {
  return `${formatNumber(value)}원`;
}

/** Date → "YYYY-MM-DD" (로컬 기준) */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 오늘 날짜 "YYYY-MM-DD" */
export function todayString(): string {
  return toDateString(new Date());
}

/** "YYYY-MM-DD" → 로컬 자정 Date. 형식이 틀리거나 존재하지 않는 날짜면 null */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  // 2월 30일처럼 존재하지 않는 날짜는 다른 달로 넘어가므로 다시 비교해 걸러낸다.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** 두 날짜 사이의 일 수 (b - a) */
export function diffDays(a: Date, b: Date): number {
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86_400_000);
}

/** "2026-11-12" → "2026년 11월 12일" */
export function formatDate(value: string): string {
  const date = parseLocalDate(value.slice(0, 10));
  if (!date) return value;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** "2000-11-12" → "11월 12일" (생일 표시용) */
export function formatMonthDay(value: string): string {
  const date = parseLocalDate(value.slice(0, 10));
  if (!date) return value;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/** ISO 시각 → "2026.10.15 14:05" */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** 펀딩 기간 표시: "10월 1일 ~ 10월 31일" */
export function formatPeriod(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
}

/**
 * 다음 생일까지 남은 일 수. 오늘이 생일이면 0.
 * 2월 29일생은 평년에 2월 28일로 계산한다.
 */
export function daysUntilNextBirthday(birthday: string, today: Date = new Date()): number {
  const birth = parseLocalDate(birthday);
  if (!birth) return 0;
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const nextIn = (year: number) => {
    const month = birth.getMonth();
    let day = birth.getDate();
    const lastDay = new Date(year, month + 1, 0).getDate();
    if (day > lastDay) day = lastDay;
    return new Date(year, month, day);
  };
  let next = nextIn(base.getFullYear());
  if (next < base) next = nextIn(base.getFullYear() + 1);
  return diffDays(base, next);
}

/** 0 → "D-day", 28 → "D-28" */
export function formatDday(days: number): string {
  return days === 0 ? "D-day" : `D-${days}`;
}

/**
 * 목표 달성률(%) — 모금액 / 목표 금액, 0~100 정수.
 * 내림 처리: 99.6% 를 100% 로 반올림하면 '목표 달성'으로 오해할 수 있기 때문.
 */
export function calcAchievementRate(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((raised / target) * 100)));
}

/** 시작일·종료일과 오늘 날짜로 펀딩 상태 계산 (종료일 당일까지 진행 중) */
export function getFundingStatus(startDate: string, endDate: string, today: string = todayString()): FundingStatus {
  if (today < startDate) return "scheduled";
  if (today > endDate) return "ended";
  return "active";
}

/** 종료일까지 남은 기간 문구 */
export function formatRemainingPeriod(endDate: string, today: Date = new Date()): string {
  const end = parseLocalDate(endDate);
  if (!end) return "";
  const days = diffDays(today, end);
  if (days < 0) return "종료됨";
  if (days === 0) return "오늘 마감";
  return `${days}일 남음`;
}

export const FUNDING_STATUS_LABEL: Record<FundingStatus, string> = {
  scheduled: "예정",
  active: "진행 중",
  ended: "종료",
};
