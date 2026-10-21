/**
 * 후원 · 축하 메시지 데이터 훅 (F-08 · F-10 · F-14)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { donate, getMyDonation, listMyDonations, listReceivedMessages } from "@/lib/api/donations";
import type { DonationRequest } from "@/types";
import { queryKeys } from "../queryKeys";

/** 후원 — 서버가 멱등 키로 중복을 막고, 자동 재시도는 하지 않는다 */
export function useDonateMutation(fundingId: string, giftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: DonationRequest) => donate(request),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fundings.friendDetail(fundingId) });
      qc.invalidateQueries({ queryKey: queryKeys.fundings.friends });
      qc.invalidateQueries({ queryKey: queryKeys.gifts.donation(giftId) });
      qc.invalidateQueries({ queryKey: queryKeys.donations.mine });
    },
  });
}

export function useMyDonationQuery(donationId: string) {
  return useQuery({ queryKey: queryKeys.donations.detail(donationId), queryFn: () => getMyDonation(donationId) });
}

export function useMyDonationsQuery(fundingId?: string) {
  return useQuery({ queryKey: queryKeys.donations.mineByFunding(fundingId), queryFn: () => listMyDonations(fundingId) });
}

export function useReceivedMessagesQuery(fundingId?: string) {
  return useQuery({ queryKey: queryKeys.messages.byFunding(fundingId), queryFn: () => listReceivedMessages(fundingId) });
}
