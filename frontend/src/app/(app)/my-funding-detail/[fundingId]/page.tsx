"use client";

/**
 * UI-12 내 펀딩 상세 및 관리 (/my-funding-detail/[fundingId]) — 생일자 전용
 * - 선물별 목표 금액 · 현재 모금액 · 남은 모금액 · 달성률
 * - 관리 버튼: 선물 추가/수정(UI-10) · 후원자 내역(UI-13) · 초대 관리(UI-16) · 종료 결과(UI-22) · 축하 편지함(UI-27)
 * - 축하 편지함은 이 펀딩에 후원한 사람이 남긴 메시지만 보이도록 ?fundingId 를 넘긴다.
 * - 펀딩 삭제: 후원이 한 건도 없고 이월 금액도 없을 때만 가능. 공통 삭제 확인 모달 → "삭제되었습니다." → 내 펀딩 목록
 * - 펀딩 이름 수정: 종료 전까지 가능 (기간 · 연결 그룹은 수정 불가, FEATURE_SPEC F-07)
 * - 이월 선물을 다시 연 경우 선물 카드에 "이월" 배지와 이월 금액 포함 안내가 보인다.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteSection } from "@/components/common/DeleteSection";
import { Flag, Mail, Pencil, Plus, Share2, Users } from "lucide-react";
import { AsyncBoundary } from "@/components/common/StateViews";
import { FundingInfo } from "@/components/funding/FundingInfo";
import { SettlementStateBadge } from "@/components/funding/SettlementStateBadge";
import { FundingNameDialog } from "@/components/funding/FundingNameDialog";
import { OwnerGiftCard } from "@/components/funding/GiftCard";
import { Screen } from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { useDeleteFundingMutation, useMyFundingQuery, useUpdateFundingNameMutation } from "@/hooks/queries/fundings";
import { formatWon } from "@/lib/format";
import { withFreshState } from "@/lib/withFreshState";

function MyFundingDetailPage() {
  const { fundingId } = useParams<{ fundingId: string }>();
  const router = useRouter();
  const state = useMyFundingQuery(fundingId);
  const deleteMutation = useDeleteFundingMutation();
  const renameMutation = useUpdateFundingNameMutation(fundingId);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameKey, setRenameKey] = useState(0);

  return (
    <Screen title="내 펀딩 관리" backHref="/my-funding">
      <AsyncBoundary state={state} deniedBackHref="/my-funding">
        {(funding) => {
          const ended = funding.status === "ended";
          return (
            <>
              <FundingInfo funding={funding} tone="lavender" />
              {!ended && (
                <Button
                  variant="tertiary"
                  size="sm"
                  className="-mt-2 self-start"
                  onClick={() => {
                    setRenameKey((k) => k + 1);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil aria-hidden /> 펀딩 이름 수정
                </Button>
              )}
              <FundingNameDialog key={renameKey} open={renameOpen} onOpenChange={setRenameOpen} initialName={funding.name} onSave={(name) => renameMutation.mutateAsync(name)} />

              <div className="rounded-sm border-2 border-line bg-surface-soft px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-caption text-muted">전체 모금액 (생일자에게만 보여요)</p>
                  <SettlementStateBadge funding={funding} />
                </div>
                <p className="text-display-md tabular-nums text-ink">{formatWon(funding.totalRaised)}</p>
              </div>

              <nav aria-label="펀딩 관리" className="grid grid-cols-2 gap-2">
                <Button asChild variant="secondary" size="md">
                  <Link href={`/my-funding-detail/${funding.id}/supporter-list`}>
                    <Users aria-hidden /> 후원자 내역
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="md">
                  <Link href={`/group-detail/${funding.groupId}/invite-management?fundingId=${funding.id}`}>
                    <Share2 aria-hidden /> 초대 관리
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="md">
                  <Link href={`/message-inbox?fundingId=${funding.id}`}>
                    <Mail aria-hidden /> 축하 편지함
                  </Link>
                </Button>
                {ended ? (
                  <Button asChild size="md">
                    <Link href={`/my-funding-detail/${funding.id}/funding-result`}>
                      <Flag aria-hidden /> 종료 결과
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="secondary" size="md">
                    <Link href={`/add-gift?fundingId=${funding.id}`}>
                      <Plus aria-hidden /> 선물 추가
                    </Link>
                  </Button>
                )}
              </nav>

              <section aria-labelledby="owner-gifts" className="flex flex-col gap-3">
                <h2 id="owner-gifts" className="text-display-md text-ink">
                  선물별 모금 현황 <span className="text-body-sm font-normal text-muted">{funding.gifts.length}개</span>
                </h2>
                <ul className="flex flex-col gap-4">
                  {funding.gifts.map((gift) => (
                    <li key={gift.id}>
                      <OwnerGiftCard
                        gift={gift}
                        footer={
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-caption text-muted">후원 {gift.donationCount}건</span>
                            {!ended && (
                              <Button asChild variant="tertiary" size="sm">
                                <Link href={`/add-gift?fundingId=${funding.id}&giftId=${gift.id}`} aria-label={`${gift.name} 선물 관리`}>
                                  <Pencil aria-hidden /> 선물 관리
                                </Link>
                              </Button>
                            )}
                          </div>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>

              <DeleteSection
                buttonLabel="펀딩 삭제"
                disabledReason={
                  funding.gifts.some((g) => g.donationCount > 0)
                    ? "후원이 들어온 펀딩은 삭제할 수 없어요."
                    : funding.gifts.some((g) => g.carriedOverAmount > 0)
                      ? "이월 금액이 포함된 펀딩은 삭제할 수 없어요."
                      : null
                }
                onConfirm={() => deleteMutation.mutateAsync(funding.id)}
                onDeleted={() => router.replace("/my-funding")}
              />
            </>
          );
        }}
      </AsyncBoundary>
    </Screen>
  );
}

export default withFreshState(MyFundingDetailPage);
