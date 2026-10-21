"use client";

/**
 * UI-17 초대 확인 및 참여 (/join-invite, /join-invite?token=...)
 *
 * 두 가지 진입 방법을 한 화면에서 처리한다.
 * 1) 친구 펀딩에서 "+ 친구 펀딩 참여하기" → 링크 직접 입력 → "초대 링크 확인"
 * 2) 공유받은 링크 접속 (?token=...) → 바로 확인 단계
 *    (로그인하지 않았다면 AuthGuard 가 로그인 화면으로 보냈다가 이 주소로 다시 돌려보낸다)
 * 확인 단계: 그룹 이름 · 펀딩 이름 · 생일자 이름 표시 → "참여하기" → 펀딩 상세로 자동 이동
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Link2Off } from "lucide-react";
import { InlineAlert } from "@/components/common/FormField";
import { LoadingState } from "@/components/common/StateViews";
import { InviteLinkForm } from "@/components/invite/InviteLinkForm";
import { RetroWindow } from "@/components/layout/RetroWindow";
import { Screen } from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api/client";
import { useInvitePreviewQuery, useJoinByInviteMutation } from "@/hooks/queries/groups";
import { withFreshState } from "@/lib/withFreshState";

function JoinInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  // 확인할 토큰: 공유 링크로 들어오면 그 토큰으로 바로 확인, 직접 입력하면 입력한 토큰
  const [token, setToken] = useState<string | null>(tokenFromUrl);
  const previewQuery = useInvitePreviewQuery(token);
  const preview = previewQuery.data ?? null;
  const checking = !!token && previewQuery.isFetching;
  const checkError = previewQuery.error ? getErrorMessage(previewQuery.error, "초대 링크를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.") : null;
  const joinMutation = useJoinByInviteMutation();
  const [joining, setJoining] = useState(false); // 성공 후 화면 이동이 끝날 때까지 잠근다
  const [joinError, setJoinError] = useState<string | null>(null);

  function check(next: string) {
    if (next === token) void previewQuery.refetch();
    else setToken(next);
  }

  async function handleJoin() {
    if (!preview || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinMutation.mutateAsync(preview.token);
      toast.success(result.alreadyJoined ? "이미 참여 중인 펀딩이에요." : "친구 펀딩에 참여했어요! 🎉");
      router.replace(result.redirectPath);
    } catch (error) {
      setJoinError(getErrorMessage(error, "참여 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요."));
      setJoining(false);
    }
  }

  return (
    <Screen title="초대 확인 및 참여" backHref="/friend-funding">
      {!preview && (
        <RetroWindow title="invite.exe" tone="lavender">
          <p className="mb-4 text-body-sm text-body">친구에게 받은 초대 링크로 생일 펀딩에 참여할 수 있어요.</p>
          {checking && tokenFromUrl ? (
            <LoadingState label="초대 링크를 확인하고 있어요" />
          ) : (
            <InviteLinkForm onSubmit={check} loading={checking} error={checkError} />
          )}
          {checkError && tokenFromUrl && !checking && (
            <div className="mt-3 flex items-start gap-2 text-body-sm text-error" role="alert">
              <Link2Off className="mt-0.5 size-4 shrink-0" aria-hidden /> 공유받은 링크를 사용할 수 없어요. 다른 링크를 입력해 주세요.
            </div>
          )}
        </RetroWindow>
      )}

      {preview && (
        <RetroWindow title="참여 확인" tone="pink">
          <div className="flex items-center gap-2">
            <Badge tone={preview.alreadyJoined ? "info" : "success"}>
              <CheckCircle2 className="size-3" aria-hidden />
              {preview.alreadyJoined ? "이미 참여 중" : "유효한 초대 링크"}
            </Badge>
          </div>
          <dl className="mt-3 flex flex-col gap-2.5">
            <div className="rounded-sm bg-surface-soft px-3 py-2">
              <dt className="text-caption text-muted">펀딩 이름</dt>
              <dd className="text-title-md text-ink">{preview.fundingName ?? "참여 후 그룹 화면으로 이동해요"}</dd>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-sm bg-surface-soft px-3 py-2">
                <dt className="text-caption text-muted">생일자</dt>
                <dd className="text-title-sm text-ink">{preview.ownerName ?? "-"}</dd>
              </div>
              <div className="rounded-sm bg-surface-soft px-3 py-2">
                <dt className="text-caption text-muted">그룹</dt>
                <dd className="text-title-sm text-ink">{preview.groupName}</dd>
              </div>
            </div>
          </dl>
          {preview.alreadyJoined && (
            <p className="mt-3 text-body-sm text-body">이미 참여한 펀딩이라 다시 등록하지 않고 펀딩 화면으로 이동해요.</p>
          )}
          {joinError && (
            <div className="mt-3">
              <InlineAlert>{joinError}</InlineAlert>
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button block onClick={handleJoin} loading={joining} loadingText="참여 처리 중...">
              {preview.alreadyJoined ? "펀딩 보러 가기" : "참여하기"}
            </Button>
            <Button variant="secondary" block size="md" onClick={() => setToken(null)} disabled={joining}>
              다른 링크 입력하기
            </Button>
          </div>
        </RetroWindow>
      )}

      <p className="text-center text-caption font-normal text-muted">
        초대받은 펀딩만 볼 수 있어요. 참여한 펀딩은{" "}
        <Link href="/friend-funding" className="underline underline-offset-2">
          친구 펀딩
        </Link>
        에서 확인할 수 있어요.
      </p>
    </Screen>
  );
}

export default withFreshState(JoinInvitePage);
