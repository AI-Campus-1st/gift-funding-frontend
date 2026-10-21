/**
 * 그룹 · 초대 링크 API (API_SPEC 3.2, F-05 · F-06)
 * 사용 위치: 그룹(UI-06, 14, 15, 16), 초대 확인 및 참여(UI-17), 펀딩 생성(UI-09 그룹 선택)
 * 그룹 삭제 API 는 제공하지 않는다. 그룹 이름 · 설명 수정(G9)은 그룹을 만든 사람만.
 */
import type { GroupDetail, GroupSummary, InviteLink, InvitePreview, JoinResult } from "@/types";
import type { GroupDetailDto, GroupListDto, IdDto, InviteDto, InvitePreviewDto, JoinResultDto } from "./dto";
import { http, path } from "./http";
import { fromDto, toJoinResult } from "./mappers";

/** G1 내가 만든 그룹 + 참여 중인 그룹 */
export async function listMyGroups(): Promise<{ created: GroupSummary[]; joined: GroupSummary[] }> {
  return fromDto<{ created: GroupSummary[]; joined: GroupSummary[] }>(await http.get<GroupListDto>("/groups"));
}

/** G3 그룹 상세 (참여자만) */
export async function getGroupDetail(groupId: string): Promise<GroupDetail> {
  return fromDto<GroupDetail>(await http.get<GroupDetailDto>(path`/groups/${groupId}`));
}

/** G2 그룹 생성 — 만든 사람이 관리자 */
export async function createGroup(input: { name: string; description: string }): Promise<{ id: string }> {
  return http.post<IdDto>("/groups", input);
}

/** G9 그룹 이름 · 설명 수정 — 그룹을 만든 사람(관리자)만 (2026-10-19 확정) */
export async function updateGroup(groupId: string, input: { name: string; description: string }): Promise<GroupDetail> {
  return fromDto<GroupDetail>(await http.patch<GroupDetailDto>(path`/groups/${groupId}`, input));
}

/** G4 초대 링크 목록 — 펀딩 생일자는 fundingId 로 본인 펀딩 링크만 */
export async function listInvites(groupId: string, fundingId: string | null = null): Promise<InviteLink[]> {
  return fromDto<InviteLink[]>(await http.get<InviteDto[]>(path`/groups/${groupId}/invites`, { funding_id: fundingId }));
}

/** G5 초대 링크 생성 — fundingId 를 지정하면 참여 후 해당 펀딩 상세로 바로 이동 */
export async function createInvite(groupId: string, fundingId: string | null): Promise<InviteLink> {
  return fromDto<InviteLink>(await http.post<InviteDto>(path`/groups/${groupId}/invites`, { funding_id: fundingId }));
}

/** G6 초대 링크 비활성화 */
export async function deactivateInvite(token: string): Promise<void> {
  await http.patch<void>(path`/invites/${token}`, { is_active: false });
}

/** G7 초대 링크 검증 + 참여 전 대상 정보 (UI-17) */
export async function previewInvite(token: string): Promise<InvitePreview> {
  return fromDto<InvitePreview>(await http.get<InvitePreviewDto>(path`/invites/${token}`));
}

/** G8 초대 링크로 참여 — 이미 참여했으면 같은 결과. redirectPath 는 매퍼가 만든다 */
export async function joinByInvite(token: string): Promise<JoinResult> {
  return toJoinResult(await http.post<JoinResultDto>(path`/invites/${token}/join`));
}
