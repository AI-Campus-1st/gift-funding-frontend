/**
 * 그룹 · 초대 데이터 훅 (F-05 · F-06) — 그룹 삭제는 제공하지 않는다
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGroup, createInvite, deactivateInvite, getGroupDetail, joinByInvite, listInvites, listMyGroups, previewInvite, updateGroup } from "@/lib/api/groups";
import { queryKeys } from "../queryKeys";

export function useMyGroupsQuery() {
  return useQuery({ queryKey: queryKeys.groups.all, queryFn: listMyGroups });
}

export function useGroupDetailQuery(groupId: string) {
  return useQuery({ queryKey: queryKeys.groups.detail(groupId), queryFn: () => getGroupDetail(groupId) });
}

export function useCreateGroupMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description: string }) => createGroup(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
  });
}

/** G9 그룹 정보 수정 — 성공하면 그룹 목록 · 상세 · 펀딩 화면의 그룹 이름을 새로 불러온다 */
export function useUpdateGroupMutation(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description: string }) => updateGroup(groupId, input),
    onSuccess: (detail) => {
      qc.setQueryData(queryKeys.groups.detail(groupId), detail);
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
      qc.invalidateQueries({ queryKey: ["fundings"] });
      qc.invalidateQueries({ queryKey: ["invites"] });
    },
  });
}

/** 초대 링크 목록 — 그룹 관리자는 fundingId=null(전체), 펀딩 생일자는 본인 펀딩 ID */
export function useInvitesQuery(groupId: string, fundingId: string | null, enabled = true) {
  return useQuery({ queryKey: queryKeys.invites.list(groupId, fundingId), queryFn: () => listInvites(groupId, fundingId), enabled });
}

export function useCreateInviteMutation(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fundingId: string | null) => createInvite(groupId, fundingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.invites.group(groupId) }),
  });
}

export function useDeactivateInviteMutation(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => deactivateInvite(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.invites.group(groupId) }),
  });
}

/** 초대 링크 미리보기 — token 이 없으면 조회하지 않는다 */
export function useInvitePreviewQuery(token: string | null) {
  return useQuery({ queryKey: queryKeys.invites.preview(token ?? ""), queryFn: () => previewInvite(token!), enabled: !!token });
}

export function useJoinByInviteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => joinByInvite(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
      qc.invalidateQueries({ queryKey: queryKeys.fundings.friends });
      qc.invalidateQueries({ queryKey: ["invites", "preview"] });
    },
  });
}
