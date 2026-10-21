/**
 * 화면 경로 만들기 — 서버는 화면 경로를 주지 않으므로(rules.md 9.3) 프론트가 여기서 만든다.
 * 사용 위치: 초대 참여 결과 · 알림 매퍼(lib/api/mappers.ts), 생일 캘린더(UI-28)
 */
import type { BirthdayEvent } from "@/types";

/** 펀딩 상세 경로: 내 펀딩이면 관리 화면, 아니면 친구 펀딩 상세 */
export function fundingDetailPath(fundingId: string, isMine: boolean): string {
  return isMine ? `/my-funding-detail/${fundingId}` : `/friend-funding-detail/${fundingId}`;
}

/** 생일 일정 → 연결 펀딩 상세 경로 (연결이 없거나 열람 권한이 없으면 null) */
export function fundingPathOf(event: Pick<BirthdayEvent, "linkedFundingId" | "canOpenLinkedFunding" | "linkedFundingIsMine">): string | null {
  if (!event.linkedFundingId || !event.canOpenLinkedFunding) return null;
  return fundingDetailPath(event.linkedFundingId, event.linkedFundingIsMine);
}
