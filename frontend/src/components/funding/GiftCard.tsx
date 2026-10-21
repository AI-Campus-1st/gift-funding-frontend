/**
 * GiftCard — 선물 카드 (base.md 6.3)
 *
 * 공통 표시: 이미지 · 이름 · 실제 가격(목표 금액) · 상품 구매 링크 · 달성률 · 진행률 바
 * - SupporterGiftCard : 후원자용. 모금액/남은 금액 필드가 타입에 없으므로 표시할 수 없다.
 * - OwnerGiftCard     : 생일자용. 현재 모금액 · 남은 모금액을 추가로 표시한다.
 *                       이월 선물을 다시 연 경우 "이월" 배지와 이월 금액 포함 안내를 보여준다.
 *                       정산이 끝난 선물은 "정산됨" 배지를 보여준다.
 */
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { formatWon } from "@/lib/format";
import type { OwnerGiftView, SupporterGiftView } from "@/types";
import { Badge } from "@/components/ui/badge";
import { FundingProgress } from "./FundingProgress";

function GiftCardFrame({ gift, children, footer, badge }: { gift: SupporterGiftView; children?: ReactNode; footer?: ReactNode; badge?: ReactNode }) {
  return (
    <article className="overflow-hidden rounded-xs border-2 border-line bg-surface shadow-window">
      <div className="flex gap-3 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL 이미지는 next/image 최적화 대상이 아니다 */}
        <img src={gift.imageUrl} alt={gift.name} className="size-24 shrink-0 rounded-md border border-hairline object-cover" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-2 flex-1 text-title-sm text-ink">{gift.name}</h3>
            {badge}
            {gift.isClosed && <Badge tone="success">목표 달성 완료</Badge>}
          </div>
          <p className="text-body-sm text-body">
            목표 금액 <strong className="text-title-sm tabular-nums text-ink">{formatWon(gift.price)}</strong>
          </p>
          <a
            href={gift.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-caption text-info underline underline-offset-2"
          >
            상품 구매 링크 <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">(새 창)</span>
          </a>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-hairline px-3 py-3">
        <FundingProgress rate={gift.achievementRate} label={`${gift.name} 목표 달성률`} />
        {children}
      </div>
      {footer && <div className="border-t border-hairline bg-surface-soft px-3 py-3">{footer}</div>}
    </article>
  );
}

export function SupporterGiftCard({ gift, footer }: { gift: SupporterGiftView; footer?: ReactNode }) {
  return <GiftCardFrame gift={gift} footer={footer} />;
}

export function OwnerGiftCard({ gift, footer }: { gift: OwnerGiftView; footer?: ReactNode }) {
  return (
    <GiftCardFrame
      gift={gift}
      footer={footer}
      badge={
        gift.carriedOverAmount > 0 || gift.settlementStatus === "completed" ? (
          <>
            {gift.carriedOverAmount > 0 && <Badge tone="info">이월</Badge>}
            {gift.settlementStatus === "completed" && <Badge tone="success">정산됨</Badge>}
          </>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-2 gap-2 text-body-sm">
        <div className="rounded-sm bg-surface-soft px-2.5 py-2">
          <dt className="text-caption text-muted">현재 모금액</dt>
          <dd className="font-bold tabular-nums text-ink">{formatWon(gift.raisedAmount)}</dd>
        </div>
        <div className="rounded-sm bg-surface-soft px-2.5 py-2">
          <dt className="text-caption text-muted">남은 모금액</dt>
          <dd className="font-bold tabular-nums text-ink">{formatWon(gift.remainingAmount)}</dd>
        </div>
      </dl>
      {gift.carriedOverAmount > 0 && (
        <p className="rounded-sm bg-memo px-2.5 py-2 text-caption text-body">
          지난 펀딩에서 이월한 <strong className="tabular-nums text-ink">{formatWon(gift.carriedOverAmount)}</strong>이 현재 모금액에 포함돼 있어요.
        </p>
      )}
    </GiftCardFrame>
  );
}
