/**
 * 목표 미달 처리 · 이월 · 정산 API (API_SPEC 3.3 F13 · 3.5, F-11 · F-12)
 *
 * ⚠️ 실제 결제 · 송금 없이 동작하는 "모의 정산"이다. (화면에도 반드시 표시)
 * 사용 위치: 종료 결과(UI-22), 목표 미달 처리(UI-23), 정산 관리(UI-24), 펀딩 생성의 이월 선물 불러오기(UI-09)
 */
import type { PendingCarryover, SettlementOverview, SettlementRequest, ShortfallAction } from "@/types";
import type { IdDto, PendingCarryoverDto, SettlementOverviewDto } from "./dto";
import { http, path } from "./http";
import { fromDto, toDto } from "./mappers";

/**
 * S1 목표 미달 선물 처리: 다음 생일로 이월 또는 현재 모금액 인출 (한 번만)
 * fundingId 는 화면 캐시 갱신용으로 받는다 (서버는 선물로 펀딩을 찾는다)
 */
export async function applyShortfall(_fundingId: string, giftId: string, action: ShortfallAction): Promise<void> {
  await http.post<void>(path`/gifts/${giftId}/shortfall`, { action });
}

/** F13 다음 생일 펀딩에서 불러올 수 있는 내 이월 선물 */
export async function listPendingCarryovers(): Promise<PendingCarryover[]> {
  return fromDto<PendingCarryover[]>(await http.get<PendingCarryoverDto[]>("/me/carryovers", { status: "pending" }));
}

/** S2 정산 현황 */
export async function getSettlementOverview(fundingId: string): Promise<SettlementOverview> {
  return fromDto<SettlementOverview>(await http.get<SettlementOverviewDto>(path`/fundings/${fundingId}/settlement`));
}

/** S3 정산 요청 — 금액은 서버가 계산한다 */
export async function requestSettlement(fundingId: string, request: SettlementRequest): Promise<void> {
  await http.post<IdDto>(path`/fundings/${fundingId}/settlements`, toDto(request));
}
