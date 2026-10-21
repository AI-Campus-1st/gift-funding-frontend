"use client";

/**
 * UI-15 그룹 상세 및 관리 (/group-detail/[groupId])
 * - 그룹 이름 · 설명 · 참여자 목록 · 연결된 펀딩
 * - 그룹 관리자(만든 사람)에게만 "초대 링크 관리" · "펀딩 만들기" · "그룹 정보 수정" 버튼 표시 (권한 없는 관리 버튼은 렌더링하지 않음)
 *   펀딩은 그 그룹을 만든 사람만 열 수 있고, 그룹 이름 · 설명도 만든 사람만 바꾼다. (2026-10-19 확정)
 * - 연결된 펀딩: 내 펀딩 → 내 펀딩 상세, 다른 사람 펀딩 → 친구 펀딩 상세
 * - 그룹 삭제 기능은 제공하지 않는다. (FEATURE_SPEC F-05)
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Crown, Link2, Pencil, Plus } from "lucide-react";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { FundingStatusBadge } from "@/components/funding/FundingStatusBadge";
import { GroupEditDialog } from "@/components/group/GroupEditDialog";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGroupDetailQuery, useUpdateGroupMutation } from "@/hooks/queries/groups";
import { withFreshState } from "@/lib/withFreshState";

function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const state = useGroupDetailQuery(groupId);
  const updateMutation = useUpdateGroupMutation(groupId);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);

  return (
    <Screen title="그룹 상세" backHref="/group">
      <AsyncBoundary state={state} deniedBackHref="/group">
        {(group) => (
          <>
            <RetroWindow title="group_info.exe" tone="sky">
              <div className="flex items-start gap-2">
                <h2 className="flex-1 text-display-md text-ink">{group.name}</h2>
                {group.isAdmin && (
                  <Badge tone="warning">
                    <Crown className="size-3" aria-hidden /> 관리자
                  </Badge>
                )}
              </div>
              {group.description && <p className="mt-1 text-body-sm text-body">{group.description}</p>}
              <p className="mt-2 text-caption text-muted">참여자 {group.memberCount}명</p>
              {group.isAdmin && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button asChild variant="secondary" size="md">
                    <Link href={`/group-detail/${group.id}/invite-management`}>
                      <Link2 aria-hidden /> 초대 링크 관리
                    </Link>
                  </Button>
                  <Button asChild size="md">
                    <Link href={`/create-funding?groupId=${group.id}`}>
                      <Plus aria-hidden /> 펀딩 만들기
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="md"
                    className="col-span-2"
                    onClick={() => {
                      setEditKey((k) => k + 1);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil aria-hidden /> 그룹 정보 수정
                  </Button>
                </div>
              )}
              {group.isAdmin && (
                <GroupEditDialog
                  key={editKey}
                  open={editOpen}
                  onOpenChange={setEditOpen}
                  initialName={group.name}
                  initialDescription={group.description}
                  onSave={async (input) => {
                    await updateMutation.mutateAsync(input);
                    toast.success("그룹 정보를 수정했어요.");
                  }}
                />
              )}
            </RetroWindow>

            <section aria-labelledby="group-fundings" className="flex flex-col gap-3">
              <h2 id="group-fundings" className="text-display-md text-ink">
                연결된 펀딩 <span className="text-body-sm font-normal text-muted">{group.fundings.length}개</span>
              </h2>
              {group.fundings.length === 0 ? (
                <EmptyState
                  message="아직 연결된 펀딩이 없어요."
                  action={
                    group.isAdmin ? (
                      <Button asChild size="md">
                        <Link href={`/create-funding?groupId=${group.id}`}>이 그룹으로 펀딩 만들기</Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {group.fundings.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={f.isMine ? `/my-funding-detail/${f.id}` : `/friend-funding-detail/${f.id}`}
                        className="flex items-center gap-3 rounded-xs border-2 border-line bg-surface p-3 shadow-window hover:shadow-window-hover"
                      >
                        <FundingStatusBadge status={f.status} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-title-sm text-ink">{f.name}</p>
                          <p className="text-caption text-muted">{f.isMine ? "내 펀딩" : `생일자 ${f.ownerName}`}</p>
                        </div>
                        <ChevronRight className="size-4 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="group-members" className="flex flex-col gap-3">
              <h2 id="group-members" className="text-display-md text-ink">
                참여자 <span className="text-body-sm font-normal text-muted">{group.members.length}명</span>
              </h2>
              <ul className="divide-y-2 divide-hairline rounded-xs border-2 border-line bg-surface">
                {group.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="grid size-9 place-items-center rounded-full border-2 border-line bg-surface-soft text-title-sm text-primary-active" aria-hidden>
                      {m.name.slice(0, 1)}
                    </span>
                    <span className="flex-1 text-body-md text-ink">{m.name}</span>
                    {m.isAdmin && <Badge tone="warning">관리자</Badge>}
                  </li>
                ))}
              </ul>
            </section>

          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(GroupDetailPage);
