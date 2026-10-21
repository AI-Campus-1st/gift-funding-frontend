"use client";

/**
 * UI-27 축하 편지함 (/message-inbox, /message-inbox?fundingId=...) — 생일자 전용
 * - 마이페이지에서 들어오면: 내가 만든 모든 펀딩의 메시지 (전체)
 * - 펀딩 상세에서 들어오면(?fundingId): 그 펀딩에 후원한 사람이 남긴 메시지만
 * - 메시지를 쓰지 않은 후원은 표시하지 않는다.
 * - 목록: 보낸 사람 실명 · 미리보기 · 관련 선물 · 작성일 → "메시지 열기"로 전체 내용 확인
 * - 메시지에는 후원 금액을 표시하지 않는다.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Mail } from "lucide-react";
import { AsyncBoundary, EmptyState } from "@/components/common/StateViews";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useReceivedMessagesQuery } from "@/hooks/queries/donations";
import { useMyFundingQuery } from "@/hooks/queries/fundings";
import { formatDateTime } from "@/lib/format";
import type { ReceivedMessage } from "@/types";
import { withFreshState } from "@/lib/withFreshState";

function MessageInboxPage() {
  const fundingId = useSearchParams().get("fundingId") ?? undefined;
  const state = useReceivedMessagesQuery(fundingId);
  // 펀딩별 편지함이면 제목 안내에 쓸 펀딩 이름 (권한 확인도 함께)
  const funding = useMyFundingQuery(fundingId ?? "", !!fundingId);
  const backHref = fundingId ? `/my-funding-detail/${fundingId}` : "/mypage";
  const [opened, setOpened] = useState<ReceivedMessage | null>(null);

  return (
    <Screen title="축하 편지함" backHref={backHref}>
      <p className="text-body-sm text-body">
        {fundingId ? (
          <>
            <strong className="text-ink">{funding.data?.name ?? "이 펀딩"}</strong>에 후원한 친구들이 남긴 메시지예요. 나만 볼 수 있어요 💌
          </>
        ) : (
          "내 모든 펀딩에 친구들이 남긴 메시지예요. 나만 볼 수 있어요 💌"
        )}
      </p>
      <AsyncBoundary state={state} deniedBackHref="/my-funding">
        {(messages) =>
          messages.length === 0 ? (
            <EmptyState
              message={fundingId ? "이 펀딩에 아직 받은 축하 메시지가 없어요." : "아직 받은 축하 메시지가 없어요."}
              action={
                <Button asChild size="md" variant="secondary">
                  <Link href={backHref}>{fundingId ? "펀딩으로 돌아가기" : "마이페이지로"}</Link>
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {messages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setOpened(m)}
                    className="flex w-full items-start gap-3 rounded-xs border-2 border-line bg-surface p-3.5 text-left shadow-window hover:shadow-window-hover"
                    aria-label={`${m.authorName}님의 메시지 열기`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-sm border-2 border-line-strong bg-memo" aria-hidden>
                      <Mail className="size-5 text-primary-active" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-title-sm text-ink">{m.authorName}</span>
                        <span className="shrink-0 text-caption font-normal text-muted">{formatDateTime(m.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-body-sm text-body">{m.content}</span>
                      <span className="mt-1 block truncate text-caption text-muted">🎁 {m.giftName} · {m.fundingName}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncBoundary>

      <Dialog open={opened !== null} onOpenChange={(open) => !open && setOpened(null)}>
        {opened && (
          <DialogContent title="you've got mail! 💌" tone="pink">
            <p className="text-caption text-muted">From.</p>
            <p className="text-title-md text-ink">{opened.authorName}</p>
            <blockquote className="mt-3 whitespace-pre-wrap break-words rounded-sm border-2 border-line bg-surface-soft p-4 text-body-md text-ink">{opened.content}</blockquote>
            <p className="mt-3 text-caption text-muted">
              🎁 {opened.giftName} · {formatDateTime(opened.createdAt)}
            </p>
            <Button variant="secondary" block size="md" className="mt-4" onClick={() => setOpened(null)}>
              닫기
            </Button>
          </DialogContent>
        )}
      </Dialog>
    </Screen>
  );
}

export default withFreshState(MessageInboxPage);
