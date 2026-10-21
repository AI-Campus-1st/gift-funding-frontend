/**
 * 펀딩 · 선물 API (API_SPEC 3.3, F-04 · F-07 · F-09 · F-13)
 *
 * - 내 펀딩(생일자) 조회는 OwnerFundingView: 모금액 · 남은 금액 포함
 * - 친구 펀딩(후원자) 조회는 FriendFundingView: 서버가 모금액 · 남은 금액을 빼고 보낸다
 * 사용 위치: 홈, 내 펀딩(UI-05, 09, 10, 12, 13), 친구 펀딩(UI-07, 18), 후원(UI-19)
 */
import type { FriendFundingView, FundingBase, FundingInput, GiftEditView, GiftInput, OwnerFundingView, SupporterDonation, SupporterGiftView } from "@/types";
import type { FriendFundingDto, GiftEditDto, GiftForDonationDto, IdDto, OwnerFundingDto, SupporterDonationDto } from "./dto";
import { http, path } from "./http";
import { fromDto, toDto } from "./mappers";

/* ───────── 내 펀딩 (생일자) ───────── */

/** F1 내 펀딩 목록 */
export async function listMyFundings(): Promise<OwnerFundingView[]> {
  return fromDto<OwnerFundingView[]>(await http.get<OwnerFundingDto[]>("/me/fundings"));
}

/** F2 내 펀딩 상세 (생일자만) */
export async function getMyFunding(fundingId: string): Promise<OwnerFundingView> {
  return fromDto<OwnerFundingView>(await http.get<OwnerFundingDto>(path`/me/fundings/${fundingId}`));
}

/** F3 펀딩 생성 (+ carryoverIds 로 이월 선물 다시 열기) */
export async function createFunding(input: FundingInput): Promise<{ id: string }> {
  return http.post<IdDto>("/fundings", toDto({ ...input, carryoverIds: input.carryoverIds ?? [] }));
}

/** F14 펀딩 이름 수정 — 종료 전까지만. 기간 · 연결 그룹은 수정할 수 없다 */
export async function updateFundingName(fundingId: string, name: string): Promise<OwnerFundingView> {
  return fromDto<OwnerFundingView>(await http.patch<OwnerFundingDto>(path`/fundings/${fundingId}`, { name }));
}

/** F4 펀딩 삭제 — 후원 · 이월 금액이 있으면 서버가 CONFLICT 로 거절 */
export async function deleteFunding(fundingId: string): Promise<void> {
  await http.delete(path`/fundings/${fundingId}`);
}

/** F5 기존 펀딩에 선물 추가 */
export async function addGift(fundingId: string, input: GiftInput): Promise<void> {
  await http.post<IdDto>(path`/fundings/${fundingId}/gifts`, toDto(input));
}

/** F6 선물 수정용 조회 (+ 후원 · 이월 금액 여부) */
export async function getGiftForEdit(giftId: string): Promise<GiftEditView> {
  return fromDto<GiftEditView>(await http.get<GiftEditDto>(path`/me/gifts/${giftId}`));
}

/** F7 선물 수정 — 후원 · 이월 금액이 있는 선물은 가격을 바꿀 수 없다 */
export async function updateGift(giftId: string, input: GiftInput): Promise<void> {
  await http.put<void>(path`/gifts/${giftId}`, toDto(input));
}

/** F8 선물 삭제 — 후원 · 이월 금액이 있거나 마지막 1개면 서버가 거절 */
export async function deleteGift(giftId: string): Promise<void> {
  await http.delete(path`/gifts/${giftId}`);
}

/** F9 생일자 전용: 후원자별 이름 · 금액 · 일시 (UI-13) */
export async function listSupporterDonations(fundingId: string): Promise<SupporterDonation[]> {
  return fromDto<SupporterDonation[]>(await http.get<SupporterDonationDto[]>(path`/fundings/${fundingId}/donations`));
}

/* ───────── 친구 펀딩 (후원자) ───────── */

/** F10 참여 중인 그룹에 연결된 다른 사람의 펀딩 */
export async function listFriendFundings(): Promise<FriendFundingView[]> {
  return fromDto<FriendFundingView[]>(await http.get<FriendFundingDto[]>("/fundings/friends"));
}

/** F11 친구 펀딩 상세 */
export async function getFriendFunding(fundingId: string): Promise<FriendFundingView> {
  return fromDto<FriendFundingView>(await http.get<FriendFundingDto>(path`/fundings/${fundingId}`));
}

/** F12 후원 화면(UI-19)용 선물 정보 — 후원자용 뷰만 */
export async function getGiftForDonation(giftId: string): Promise<{ funding: FundingBase; gift: SupporterGiftView }> {
  return fromDto<{ funding: FundingBase; gift: SupporterGiftView }>(await http.get<GiftForDonationDto>(path`/gifts/${giftId}`));
}
