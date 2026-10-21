"use client";

/**
 * UI-06 그룹 (/group) — 하단 탭 화면
 * - 내가 만든 그룹 / 참여 중인 그룹 목록 (이름 · 설명 · 참여자 수 · 연결된 펀딩)
 * - "그룹 만들기" → UI-14, 그룹 카드 → UI-15
 * - 다른 사람 펀딩은 이름 · 상태만 표시 (모금액 비공개)
 */
import Link from "next/link";
import { ChevronRight, Crown, Plus, Users } from "lucide-react";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { FundingStatusBadge } from "@/components/funding/FundingStatusBadge";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GroupSummary } from "@/types";
import { useMyGroupsQuery } from "@/hooks/queries/groups";
import { withFreshState } from "@/lib/withFreshState";

function GroupCard({ group }: { group: GroupSummary }) {
  return (
    <Link
      href={`/group-detail/${group.id}`}
      className="group block rounded-xs border-2 border-line bg-surface shadow-window transition-shadow hover:shadow-window-hover"
      aria-label={`${group.name} 그룹 열기`}
    >
      <div className="flex items-center gap-2 border-b-2 border-line bg-sky px-3 py-1.5">
        <Users className="size-4 text-ink" aria-hidden />
        <span className="flex-1 truncate text-caption font-bold text-ink">{group.name}</span>
        {group.isAdmin && (
          <Badge tone="warning">
            <Crown className="size-3" aria-hidden /> 관리자
          </Badge>
        )}
      </div>
      <div className="flex items-start gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-body-sm text-body">{group.description || "그룹 설명이 없어요."}</p>
          <p className="mt-1 text-caption text-muted">참여자 {group.memberCount}명 · 연결된 펀딩 {group.fundings.length}개</p>
          {group.fundings.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {group.fundings.slice(0, 3).map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-body-sm">
                  <FundingStatusBadge status={f.status} />
                  <span className="truncate text-ink">{f.name}</span>
                  <span className="shrink-0 text-caption text-muted">{f.isMine ? "내 펀딩" : f.ownerName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted group-hover:text-ink" aria-hidden />
      </div>
    </Link>
  );
}

function GroupSection({ id, title, groups, empty }: { id: string; title: string; groups: GroupSummary[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-display-md text-ink">
        {title} <span className="text-body-sm font-normal text-muted">{groups.length}개</span>
      </h2>
      {groups.length === 0 ? (
        <EmptyState message={empty} />
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((g) => (
            <li key={g.id}>
              <GroupCard group={g} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GroupPage() {
  const state = useMyGroupsQuery();
  return (
    <Screen title="그룹" tabBar>
      <Button asChild block>
        <Link href="/create-group">
          <Plus aria-hidden /> 그룹 만들기
        </Link>
      </Button>
      <AsyncBoundary state={state}>
        {({ created, joined }) => (
          <>
            <GroupSection id="created-groups" title="내가 만든 그룹" groups={created} empty="아직 만든 그룹이 없어요." />
            <GroupSection id="joined-groups" title="참여 중인 그룹" groups={joined} empty="초대받아 참여한 그룹이 없어요." />
          </>
        )}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(GroupPage);
