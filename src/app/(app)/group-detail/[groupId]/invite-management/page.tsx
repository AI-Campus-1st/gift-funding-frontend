"use client";

/**
 * UI-16 초대 링크 관리 (/group-detail/[groupId]/invite-management, ?fundingId=..) 
 * - 그룹 관리자는 그룹 전체 링크를, 펀딩 생일자는 본인 펀딩 링크를 관리한다.
 * - 링크 생성: 연결할 펀딩을 고르면 참여 후 그 펀딩 상세로 바로 이동 (선택 안 하면 그룹 초대)
 * - 링크 복사 · 활성 여부 표시 · 비활성화(확인 모달). 비활성화된 링크로는 새로 참여할 수 없다.
 * - 연결된 펀딩이 종료된 링크는 "만료됨"으로 표시하고 복사 · 비활성화 버튼을 숨긴다.
 */
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { InlineAlert } from "@/components/common/FormField";
import { AsyncBoundary, type BoundaryState, EmptyState } from "@/components/common/StateViews";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, NativeSelect } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/client";
import { useCreateInviteMutation, useDeactivateInviteMutation, useGroupDetailQuery, useInvitesQuery } from "@/hooks/queries/groups";
import { formatDateTime } from "@/lib/format";
import type { GroupDetail, InviteLink } from "@/types";
import { withFreshState } from "@/lib/withFreshState";

/** 초대 토큰 → 공유용 전체 링크 */
function toInviteUrl(token: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/join-invite?token=${encodeURIComponent(token)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function InviteManagementPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const presetFundingId = useSearchParams().get("fundingId") ?? "";
  const groupQuery = useGroupDetailQuery(groupId);
  // 그룹 관리자가 아니면 본인 펀딩의 초대 링크만 관리할 수 있다
  const scopeFundingId = groupQuery.data?.isAdmin ? null : presetFundingId || null;
  const invitesQuery = useInvitesQuery(groupId, scopeFundingId, !!groupQuery.data);
  const state: BoundaryState<{ group: GroupDetail; invites: InviteLink[] }> = {
    data: groupQuery.data && invitesQuery.data ? { group: groupQuery.data, invites: invitesQuery.data } : null,
    error: groupQuery.error ?? invitesQuery.error,
    loading: groupQuery.isPending || invitesQuery.isPending,
    reload: () => {
      void groupQuery.refetch();
      void invitesQuery.refetch();
    },
  };
  const createMutation = useCreateInviteMutation(groupId);
  const deactivateMutation = useDeactivateInviteMutation(groupId);

  const [fundingId, setFundingId] = useState(presetFundingId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const invite = await createMutation.mutateAsync(fundingId || null);
      const copied = await copyText(toInviteUrl(invite.token));
      toast.success(copied ? "초대 링크를 만들고 복사했어요." : "초대 링크를 만들었어요.");
    } catch (err) {
      setError(getErrorMessage(err, "초대 링크를 만들지 못했어요."));
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy(token: string) {
    if (await copyText(toInviteUrl(token))) toast.success("초대 링크를 복사했어요.");
    else toast.error("복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.");
  }

  async function handleDeactivate() {
    if (!target) return;
    setDeactivating(true);
    try {
      await deactivateMutation.mutateAsync(target);
      toast.success("초대 링크를 비활성화했어요.");
      setTarget(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setTarget(null);
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <Screen title="초대 링크 관리" backHref={presetFundingId ? `/my-funding-detail/${presetFundingId}` : `/group-detail/${groupId}`}>
      <AsyncBoundary state={state} deniedBackHref={`/group-detail/${groupId}`}>
        {({ group, invites }) => (
          <>
            <RetroWindow title={`${group.name} 초대`} tone="lavender">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-funding">연결할 펀딩 (선택)</Label>
                <NativeSelect id="invite-funding" value={fundingId} onChange={(e) => setFundingId(e.target.value)}>
                  {group.isAdmin && <option value="">그룹 전체 초대</option>}
                  {group.fundings.filter((f) => group.isAdmin || f.isMine).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-caption font-normal text-muted">펀딩을 고르면 친구가 참여한 뒤 그 펀딩 화면으로 바로 이동해요.</p>
              </div>
              <Button block className="mt-4" onClick={handleCreate} loading={creating} loadingText="링크 만드는 중...">
                <Plus aria-hidden /> 링크 생성
              </Button>
            </RetroWindow>

            {error && <InlineAlert>{error}</InlineAlert>}

            <section aria-labelledby="invite-list" className="flex flex-col gap-3">
              <h2 id="invite-list" className="text-display-md text-ink">
                초대 링크 <span className="text-body-sm font-normal text-muted">{invites.length}개</span>
              </h2>
              {invites.length === 0 ? (
                <EmptyState message="아직 만든 초대 링크가 없어요." />
              ) : (
                <ul className="flex flex-col gap-3">
                  {invites.map((invite) => (
                    <li key={invite.token} className="rounded-xs border-2 border-line bg-surface p-3.5 shadow-window">
                      <div className="flex items-center gap-2">
                        <Link2 className="size-4 text-muted" aria-hidden />
                        <Badge tone={invite.isExpired ? "warning" : invite.isActive ? "success" : "neutral"}>{invite.isExpired ? "만료됨" : invite.isActive ? "활성" : "비활성"}</Badge>
                        <span className="ml-auto text-caption font-normal text-muted">{formatDateTime(invite.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-caption text-muted">연결: {invite.fundingName ?? `${invite.groupName} (그룹 전체)`}</p>
                      <p className="mt-1 break-all rounded-sm bg-surface-strong px-2.5 py-1.5 font-mono text-caption text-ink">{toInviteUrl(invite.token)}</p>
                      {invite.isExpired && <p className="mt-2 text-caption text-muted">펀딩이 종료되어 이 링크로는 참여할 수 없어요.</p>}
                      {invite.isActive && !invite.isExpired && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handleCopy(invite.token)}>
                            <Copy aria-hidden /> 링크 복사
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setTarget(invite.token)}>
                            비활성화
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <ConfirmDialog
              open={target !== null}
              onOpenChange={(open) => !open && setTarget(null)}
              title="초대 링크 비활성화"
              description="비활성화하면 이 링크로는 더 이상 새로 참여할 수 없어요. 이미 참여한 사람은 그대로 유지돼요."
              confirmLabel="비활성화하기"
              danger
              loading={deactivating}
              onConfirm={handleDeactivate}
            />
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(InviteManagementPage);
