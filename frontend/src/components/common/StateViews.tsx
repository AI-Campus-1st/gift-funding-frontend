/**
 * 공통 화면 상태 (base.md 6.9)
 * - LoadingState : 로딩 표시 (스켈레톤 or 스피너)
 * - EmptyState   : 데이터 없음 + 다음 행동 버튼
 * - ErrorState   : 오류 내용 + 재시도 버튼
 * - AccessDeniedState : 권한 없음 안내
 * - AsyncBoundary : 조회 결과(TanStack Query useQuery)에 따라 위 상태를 자동으로 골라 보여주는 도우미
 */
import Link from "next/link";
import { AlertTriangle, Inbox, Loader2, Lock, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "불러오는 중이에요", fullScreen, skeleton }: { label?: string; fullScreen?: boolean; skeleton?: boolean }) {
  if (skeleton) {
    return (
      <div role="status" aria-label={label} className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-3 py-12 text-body-sm text-muted", fullScreen && "min-h-dvh")}>
      <Loader2 className="size-7 animate-spin text-primary-active" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ message, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-sm border-2 border-dashed border-hairline bg-surface-soft px-4 py-8 text-center", className)}>
      <Inbox className="size-8 text-lavender" aria-hidden />
      <p className="text-title-sm text-ink">{message}</p>
      {description && <p className="text-body-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-sm border-2 border-error bg-surface px-4 py-8 text-center">
      <AlertTriangle className="size-8 text-error" aria-hidden />
      <p className="text-body-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden /> 다시 시도
        </Button>
      )}
    </div>
  );
}

export function AccessDeniedState({ message = "이 화면에 접근할 권한이 없어요.", backHref = "/home", backLabel = "홈으로 가기" }: { message?: string; backHref?: string; backLabel?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-sm border-2 border-line bg-surface px-4 py-10 text-center">
      <Lock className="size-8 text-muted" aria-hidden />
      <p className="text-title-sm text-ink">{message}</p>
      <p className="text-body-sm text-muted">초대받은 그룹과 펀딩만 확인할 수 있어요.</p>
      <Button asChild variant="secondary" size="sm">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}

/** 여러 조회를 합친 화면처럼 useQuery 결과를 직접 넘기기 어려울 때 쓰는 상태 모양 */
export interface BoundaryState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/** useQuery 결과 · BoundaryState 를 같은 모양으로 맞춘다 */
function normalize<T>(state: BoundaryState<T> | UseQueryResult<T>): BoundaryState<T> {
  if ("refetch" in state) {
    return { data: state.data ?? null, error: state.error, loading: state.isPending, reload: () => void state.refetch() };
  }
  return state;
}

/**
 * 조회 상태 → 화면 상태 자동 선택
 * 사용 예) <AsyncBoundary state={useMyFundingQuery(id)}>{(funding) => <Detail funding={funding} />}</AsyncBoundary>
 * - FORBIDDEN · NOT_FOUND → 접근 권한 없음, 그 밖의 오류 → 다시 시도, 처음 불러오는 중 → 스켈레톤
 */
export function AsyncBoundary<T>({
  state: rawState,
  children,
  skeleton = true,
  deniedBackHref,
}: {
  state: BoundaryState<T> | UseQueryResult<T>;
  children: (data: T) => ReactNode;
  skeleton?: boolean;
  deniedBackHref?: string;
}) {
  const state = normalize(rawState);
  if (state.error && state.data === null) {
    if (state.error instanceof ApiError && (state.error.code === "FORBIDDEN" || state.error.code === "NOT_FOUND")) {
      return <AccessDeniedState message={state.error.message} backHref={deniedBackHref} />;
    }
    return <ErrorState message={getErrorMessage(state.error, "정보를 불러오지 못했어요.")} onRetry={state.reload} />;
  }
  if (state.loading && state.data === null) return <LoadingState skeleton={skeleton} />;
  if (state.data === null) return null;
  return <>{children(state.data)}</>;
}
