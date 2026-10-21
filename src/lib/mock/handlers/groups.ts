/**
 * Mock 서버 — 그룹 · 초대 링크 (API_SPEC 3.2, F-05 · F-06)
 * 그룹 삭제 API 는 제공하지 않는다. (plan.md 7.1 D8)
 * 그룹 이름 · 설명 수정(G9)은 그룹을 만든 사람(관리자)만 할 수 있다. (2026-10-19 확정)
 */
import { ApiError } from "@/lib/api/client";
import { TEXT_LIMITS, tooLongMessage } from "@/lib/constants";
import type { GroupDetail, GroupFundingSummary, GroupSummary, InviteLink, InvitePreview } from "@/types";
import { canViewFunding, findUser, getFundingOrThrow, isGroupMember, toFundingBase, userName } from "../access";
import { createId, getDb, saveDb, type DbFunding, type DbGroup, type DbInvite, type MockDatabase } from "../db";
import { bodyOf, requireUser, route, type MockContext } from "./context";

function toGroupFunding(db: MockDatabase, f: DbFunding, userId: string): GroupFundingSummary {
  const base = toFundingBase(db, f);
  return { id: f.id, name: f.name, ownerName: base.ownerName, isMine: f.ownerId === userId, status: base.status };
}

function toSummary(db: MockDatabase, group: DbGroup, userId: string): GroupSummary {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    memberCount: group.memberIds.length,
    isAdmin: group.adminId === userId,
    // 연결 펀딩은 최신순 (시작일 최신 → 먼저, 같으면 나중에 만든 것 먼저) — 2026-10-19 확정
    fundings: db.fundings
      .filter((f) => f.groupId === group.id && canViewFunding(db, f, userId))
      .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt))
      .map((f) => toGroupFunding(db, f, userId)),
  };
}

function getGroupForMember(db: MockDatabase, groupId: string, userId: string): DbGroup {
  const group = db.groups.find((g) => g.id === groupId);
  if (!group) throw new ApiError("NOT_FOUND", "존재하지 않는 그룹이에요.");
  if (!group.memberIds.includes(userId)) throw new ApiError("FORBIDDEN", "이 그룹에 접근할 권한이 없어요.");
  return group;
}

/** G1 내가 만든 그룹 + 참여 중인 그룹 */
function listMyGroups(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const mine = db.groups.filter((g) => g.memberIds.includes(userId));
  return {
    created: mine.filter((g) => g.adminId === userId).map((g) => toSummary(db, g, userId)),
    joined: mine.filter((g) => g.adminId !== userId).map((g) => toSummary(db, g, userId)),
  };
}

/** G3 그룹 상세 (참여자만) */
function getGroupDetail(ctx: MockContext): GroupDetail {
  const db = getDb();
  const userId = requireUser(ctx);
  const group = getGroupForMember(db, ctx.params.groupId, userId);
  return { ...toSummary(db, group, userId), members: group.memberIds.map((id) => ({ id, name: userName(db, id), isAdmin: id === group.adminId })) };
}

/** 그룹 이름 · 설명 검증 (G2 · G9 공통) */
function validateGroupInput(input: { name?: string; description?: string }): { name: string; description: string } {
  const name = (input.name ?? "").trim();
  const description = (input.description ?? "").trim();
  if (name.length === 0) {
    throw new ApiError("VALIDATION", "그룹 이름을 입력해 주세요.", { fieldErrors: { name: "그룹 이름을 입력해 주세요." } });
  }
  const fieldErrors: Record<string, string> = {};
  if (name.length > TEXT_LIMITS.groupName) fieldErrors.name = tooLongMessage("그룹 이름은", TEXT_LIMITS.groupName);
  if (description.length > TEXT_LIMITS.groupDescription) fieldErrors.description = tooLongMessage("그룹 설명은", TEXT_LIMITS.groupDescription);
  if (Object.keys(fieldErrors).length > 0) throw new ApiError("VALIDATION", "입력값을 확인해 주세요.", { fieldErrors });
  return { name, description };
}

/** G9 그룹 이름 · 설명 수정 — 그룹을 만든 사람(관리자)만 */
function updateGroup(ctx: MockContext): GroupDetail {
  const db = getDb();
  const userId = requireUser(ctx);
  const group = getGroupForMember(db, ctx.params.groupId, userId);
  if (group.adminId !== userId) throw new ApiError("FORBIDDEN", "그룹 관리자만 수정할 수 있어요.");
  const { name, description } = validateGroupInput(bodyOf<{ name?: string; description?: string }>(ctx));
  group.name = name;
  group.description = description;
  saveDb();
  return getGroupDetail(ctx);
}

/** G2 그룹 생성 — 만든 사람이 관리자 */
function createGroup(ctx: MockContext) {
  const input = validateGroupInput(bodyOf<{ name: string; description: string }>(ctx));
  const db = getDb();
  const userId = requireUser(ctx);
  const group: DbGroup = {
    id: createId("g"),
    name: input.name,
    description: input.description,
    adminId: userId,
    memberIds: [userId],
    createdAt: new Date().toISOString(),
  };
  db.groups.push(group);
  saveDb();
  return { id: group.id };
}

/* ───────── 초대 링크 ───────── */

/** 펀딩 지정 링크는 그 펀딩이 종료되면 만료 (D-S1-4). 그룹 링크는 비활성화 전까지 유효 */
function isInviteExpired(db: MockDatabase, invite: DbInvite): boolean {
  if (!invite.fundingId) return false;
  const funding = db.fundings.find((f) => f.id === invite.fundingId);
  return !!funding && toFundingBase(db, funding).status === "ended";
}

function toInviteLink(db: MockDatabase, invite: DbInvite): InviteLink {
  return {
    token: invite.token,
    groupId: invite.groupId,
    groupName: db.groups.find((g) => g.id === invite.groupId)?.name ?? "",
    fundingId: invite.fundingId,
    fundingName: invite.fundingId ? (db.fundings.find((f) => f.id === invite.fundingId)?.name ?? null) : null,
    isActive: invite.isActive,
    isExpired: isInviteExpired(db, invite),
    createdAt: invite.createdAt,
  };
}

/** 링크 관리 권한: 그룹 관리자(모든 링크) · 펀딩 생일자(본인 펀딩 링크) — F-06 */
function canManageInvite(db: MockDatabase, group: DbGroup, userId: string, fundingId: string | null): boolean {
  if (group.adminId === userId) return true;
  return !!fundingId && db.fundings.some((f) => f.id === fundingId && f.groupId === group.id && f.ownerId === userId);
}

/** G4 초대 링크 목록 */
function listInvites(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const fundingId = ctx.query.fundingId ?? null;
  const group = getGroupForMember(db, ctx.params.groupId, userId);
  const isAdmin = group.adminId === userId;
  if (!canManageInvite(db, group, userId, fundingId)) throw new ApiError("FORBIDDEN", "초대 링크는 그룹 관리자 또는 펀딩 생일자만 관리할 수 있어요.");
  return db.invites
    .filter((i) => i.groupId === group.id && (isAdmin || i.fundingId === fundingId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => toInviteLink(db, i));
}

/** G5 초대 링크 생성 — fundingId 를 지정하면 참여 후 해당 펀딩으로 바로 이동 */
function createInvite(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  const { fundingId = null } = bodyOf<{ fundingId: string | null }>(ctx);
  const group = getGroupForMember(db, ctx.params.groupId, userId);
  if (!canManageInvite(db, group, userId, fundingId)) throw new ApiError("FORBIDDEN", "초대 링크는 그룹 관리자 또는 펀딩 생일자만 만들 수 있어요.");
  if (fundingId && !db.fundings.some((f) => f.id === fundingId && f.groupId === group.id)) {
    throw new ApiError("VALIDATION", "이 그룹에 연결된 펀딩만 선택할 수 있어요.");
  }
  // 예측하기 어려운 토큰 (실제 서버에서는 Python secrets 사용)
  const invite: DbInvite = { token: createId("INV").toUpperCase(), groupId: group.id, fundingId, isActive: true, createdAt: new Date().toISOString() };
  db.invites.push(invite);
  saveDb();
  return toInviteLink(db, invite);
}

/** G6 초대 링크 비활성화 */
function deactivateInvite(ctx: MockContext) {
  const db = getDb();
  const invite = db.invites.find((i) => i.token === ctx.params.token);
  if (!invite) throw new ApiError("NOT_FOUND", "초대 링크를 찾을 수 없어요.");
  const userId = requireUser(ctx);
  const group = getGroupForMember(db, invite.groupId, userId);
  if (!canManageInvite(db, group, userId, invite.fundingId)) throw new ApiError("FORBIDDEN", "이 초대 링크를 관리할 권한이 없어요.");
  if (bodyOf<{ isActive?: boolean }>(ctx).isActive === false) invite.isActive = false;
  saveDb();
  return undefined;
}

function findValidInvite(db: MockDatabase, token: string): DbInvite {
  const invite = db.invites.find((i) => i.token === token);
  if (!invite) throw new ApiError("INVITE_INVALID", "유효하지 않거나 만료된 초대 링크입니다.");
  if (!invite.isActive) throw new ApiError("INVITE_INACTIVE", "비활성화된 초대 링크라 참여할 수 없어요. 친구에게 새 링크를 요청해 주세요.");
  if (isInviteExpired(db, invite)) throw new ApiError("INVITE_EXPIRED", "펀딩이 종료되어 만료된 초대 링크입니다.");
  return invite;
}

/**
 * 참여 후 이동할 펀딩 (2026-10-19 확정)
 * - 펀딩 지정 링크 → 그 펀딩
 * - 그룹 링크 → 그룹의 다른 사람 펀딩 중 "진행 중"인 것 (시작일이 가장 최근인 것)
 * - 진행 중인 펀딩이 없으면 null → 프론트가 그룹 상세로 보낸다 (예정 · 종료 펀딩은 그룹 상세 목록에서 고른다)
 */
function resolveTargetFunding(db: MockDatabase, invite: DbInvite, userId: string): DbFunding | null {
  if (invite.fundingId) return getFundingOrThrow(db, invite.fundingId);
  return (
    db.fundings
      .filter((f) => f.groupId === invite.groupId && f.ownerId !== userId && toFundingBase(db, f).status === "active")
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
  );
}

/** G7 초대 링크 검증 + 참여 전 대상 정보 (UI-17) */
function previewInvite(ctx: MockContext): InvitePreview {
  const db = getDb();
  const userId = requireUser(ctx);
  const invite = findValidInvite(db, ctx.params.token);
  const group = db.groups.find((g) => g.id === invite.groupId);
  if (!group) throw new ApiError("INVITE_INVALID", "유효하지 않거나 만료된 초대 링크입니다.");
  const funding = resolveTargetFunding(db, invite, userId);
  return {
    token: invite.token,
    groupName: group.name,
    fundingName: funding?.name ?? null,
    ownerName: funding ? userName(db, funding.ownerId) : null,
    alreadyJoined: group.memberIds.includes(userId),
    targetFundingId: funding?.id ?? null,
  };
}

/** G8 초대 링크로 참여 — 이미 참여했으면 중복 등록하지 않고 같은 결과. 참여 저장을 마친 뒤 응답한다 (바로 펀딩 상세로 가도 권한 있음) */
function joinByInvite(ctx: MockContext) {
  const db = getDb();
  const userId = requireUser(ctx);
  findUser(db, userId);
  const invite = findValidInvite(db, ctx.params.token);
  const group = db.groups.find((g) => g.id === invite.groupId);
  if (!group) throw new ApiError("INVITE_INVALID", "유효하지 않거나 만료된 초대 링크입니다.");
  const alreadyJoined = isGroupMember(db, group.id, userId);
  if (!alreadyJoined) {
    group.memberIds.push(userId);
    saveDb();
  }
  const funding = resolveTargetFunding(db, invite, userId);
  return { groupId: group.id, targetFundingId: funding?.id ?? null, targetIsMine: funding?.ownerId === userId, alreadyJoined };
}

export const groupRoutes = [
  route("GET", "/groups", listMyGroups),
  route("POST", "/groups", createGroup, { status: 201, delay: 400 }),
  route("GET", "/groups/:groupId", getGroupDetail),
  route("PATCH", "/groups/:groupId", updateGroup, { delay: 300 }),
  route("GET", "/groups/:groupId/invites", listInvites),
  route("POST", "/groups/:groupId/invites", createInvite, { status: 201 }),
  route("PATCH", "/invites/:token", deactivateInvite),
  route("GET", "/invites/:token", previewInvite, { delay: 350 }),
  route("POST", "/invites/:token/join", joinByInvite, { delay: 400 }),
];
