/**
 * 펀딩 생성 임시 저장(draft)
 *
 * 펀딩 생성(UI-09) → 선물 등록(UI-10) → AI 추천(UI-11) 화면을 오가는 동안
 * 입력한 펀딩 정보와 선물 목록이 사라지지 않도록 sessionStorage 에 보관한다.
 * (펀딩에는 선물이 최소 1개 있어야 하므로, 선물은 펀딩 생성 전까지 이곳에 임시로 쌓인다)
 * - 탭을 닫으면 사라진다. 펀딩 생성이 완료되면 clearFundingDraft() 로 비운다.
 */
import type { GiftInput } from "@/types";

export interface FundingDraft {
  name: string;
  groupId: string;
  startDate: string;
  endDate: string;
  gifts: GiftInput[];
  carryoverIds: string[]; // 불러온 이월 기록 (선물 정보는 서버가 복사)
}

const KEY = "gift-funding:funding-draft";

export const EMPTY_DRAFT: FundingDraft = { name: "", groupId: "", startDate: "", endDate: "", gifts: [], carryoverIds: [] };

export function loadFundingDraft(): FundingDraft {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as FundingDraft) } : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveFundingDraft(draft: FundingDraft): boolean {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false; // 이미지 용량이 커서 저장 공간이 부족한 경우 등
  }
}

export function clearFundingDraft(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

/** 임시 목록에 선물 추가(index 없음) 또는 수정(index 지정) */
export function upsertDraftGift(gift: GiftInput, index: number | null): boolean {
  const draft = loadFundingDraft();
  const gifts = [...draft.gifts];
  if (index === null || index < 0 || index >= gifts.length) gifts.push(gift);
  else gifts[index] = gift;
  return saveFundingDraft({ ...draft, gifts });
}
