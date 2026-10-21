/**
 * 펀딩 · 선물 데이터 훅 (F-04 · F-07 · F-09 · F-13)
 * 변경 후 무효화 규칙: docs/ARCHITECTURE.md 5.3
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addGift,
  createFunding,
  updateFundingName,
  deleteFunding,
  deleteGift,
  getFriendFunding,
  getGiftForDonation,
  getGiftForEdit,
  getMyFunding,
  listFriendFundings,
  listMyFundings,
  listSupporterDonations,
  updateGift,
} from "@/lib/api/fundings";
import { listPendingCarryovers } from "@/lib/api/settlements";
import type { FundingInput, GiftInput } from "@/types";
import { queryKeys } from "../queryKeys";

/* ───────── 조회 ───────── */

export function useMyFundingsQuery() {
  return useQuery({ queryKey: queryKeys.fundings.mine, queryFn: listMyFundings });
}

export function useMyFundingQuery(fundingId: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.fundings.myDetail(fundingId), queryFn: () => getMyFunding(fundingId), enabled });
}

export function useSupporterDonationsQuery(fundingId: string) {
  return useQuery({ queryKey: queryKeys.fundings.supporters(fundingId), queryFn: () => listSupporterDonations(fundingId) });
}

export function useFriendFundingsQuery() {
  return useQuery({ queryKey: queryKeys.fundings.friends, queryFn: listFriendFundings });
}

export function useFriendFundingQuery(fundingId: string) {
  return useQuery({ queryKey: queryKeys.fundings.friendDetail(fundingId), queryFn: () => getFriendFunding(fundingId) });
}

/** 선물 수정 화면용 — giftId 가 없으면(새 선물 등록) 조회하지 않는다 */
export function useGiftForEditQuery(giftId: string | null) {
  return useQuery({ queryKey: queryKeys.gifts.edit(giftId ?? ""), queryFn: () => getGiftForEdit(giftId!), enabled: !!giftId });
}

export function useGiftForDonationQuery(giftId: string) {
  return useQuery({ queryKey: queryKeys.gifts.donation(giftId), queryFn: () => getGiftForDonation(giftId) });
}

export function usePendingCarryoversQuery() {
  return useQuery({ queryKey: queryKeys.carryovers.pending, queryFn: listPendingCarryovers });
}

/* ───────── 변경 ───────── */

export function useCreateFundingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FundingInput) => createFunding(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fundings.mine });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
      qc.invalidateQueries({ queryKey: queryKeys.carryovers.all });
      qc.invalidateQueries({ queryKey: queryKeys.birthdayEvents.linkable });
    },
    // 이미 다시 연 이월 선물을 고른 경우 목록을 새로 고친다
    onError: () => qc.invalidateQueries({ queryKey: queryKeys.carryovers.all }),
  });
}

/** 펀딩 이름 수정 — 결과로 상세 캐시를 바꾸고 목록 · 그룹 · 친구 화면을 갱신 */
export function useUpdateFundingNameMutation(fundingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => updateFundingName(fundingId, name),
    onSuccess: (funding) => {
      qc.setQueryData(queryKeys.fundings.myDetail(fundingId), funding);
      qc.invalidateQueries({ queryKey: queryKeys.fundings.mine, exact: true });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
      qc.invalidateQueries({ queryKey: queryKeys.birthdayEvents.all });
    },
  });
}

/** 펀딩 삭제 — 연결된 목록 · 알림 · 일정까지 갱신하고 삭제한 상세 캐시는 지운다 */
export function useDeleteFundingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fundingId: string) => deleteFunding(fundingId),
    onSuccess: (_, fundingId) => {
      qc.removeQueries({ queryKey: queryKeys.fundings.myDetail(fundingId) });
      qc.invalidateQueries({ queryKey: queryKeys.fundings.all });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
      qc.invalidateQueries({ queryKey: queryKeys.birthdayEvents.all });
    },
  });
}

function invalidateFundingGifts(qc: ReturnType<typeof useQueryClient>, fundingId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.fundings.myDetail(fundingId) });
  qc.invalidateQueries({ queryKey: queryKeys.fundings.mine, exact: true });
}

export function useAddGiftMutation(fundingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GiftInput) => addGift(fundingId, input),
    onSuccess: () => invalidateFundingGifts(qc, fundingId),
  });
}

export function useUpdateGiftMutation(fundingId: string, giftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GiftInput) => updateGift(giftId, input),
    onSuccess: () => {
      invalidateFundingGifts(qc, fundingId);
      qc.invalidateQueries({ queryKey: queryKeys.gifts.edit(giftId) });
    },
  });
}

export function useDeleteGiftMutation(fundingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (giftId: string) => deleteGift(giftId),
    onSuccess: (_, giftId) => {
      qc.removeQueries({ queryKey: queryKeys.gifts.edit(giftId) });
      invalidateFundingGifts(qc, fundingId);
    },
  });
}
