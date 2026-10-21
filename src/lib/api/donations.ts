/**
 * 후원 · 축하 메시지 API (API_SPEC 3.4, F-08 · F-10 · F-14)
 * 사용 위치: 후원(UI-19), 후원 완료(UI-20), 내 후원 내역(UI-21), 축하 편지함(UI-27)
 * 중복 처리 방지 · 초과 검증 · 후원과 메시지 동시 저장은 서버가 한다.
 */
import type { DonationRequest, MyDonation, ReceivedMessage } from "@/types";
import type { DonationCreatedDto, MyDonationDto, ReceivedMessageDto } from "./dto";
import { http, path } from "./http";
import { fromDto, toDto } from "./mappers";

/** D1 후원하기 — 같은 idempotencyKey 로 다시 보내면 서버가 이전 결과를 돌려준다 */
export async function donate(request: DonationRequest): Promise<{ donationId: string }> {
  const res = await http.post<DonationCreatedDto>("/donations", toDto(request));
  return { donationId: res.donation_id };
}

/** D3 본인 후원 1건 (후원 완료 화면) */
export async function getMyDonation(donationId: string): Promise<MyDonation> {
  return fromDto<MyDonation>(await http.get<MyDonationDto>(path`/me/donations/${donationId}`));
}

/** D2 본인 후원 내역 */
export async function listMyDonations(fundingId?: string): Promise<MyDonation[]> {
  return fromDto<MyDonation[]>(await http.get<MyDonationDto[]>("/me/donations", { funding_id: fundingId }));
}

/**
 * D4 생일자 전용 축하 편지함
 * @param fundingId 지정하면 그 펀딩에 남긴 메시지만, 없으면 내 모든 펀딩의 메시지
 */
export async function listReceivedMessages(fundingId?: string): Promise<ReceivedMessage[]> {
  return fromDto<ReceivedMessage[]>(await http.get<ReceivedMessageDto[]>("/me/messages", { funding_id: fundingId }));
}
