/** 종료된 펀딩의 정산 상태 배지 — 정산 완료 시 "정산됨" */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OwnerFundingView, OwnerGiftView } from "@/types";
import { getFundingSettlementState, SettlementStateBadge } from "./SettlementStateBadge";

const gift = (over: Partial<OwnerGiftView>): OwnerGiftView => ({
  id: "g", name: "선물", price: 10000, imageUrl: "data:,", productUrl: "https://example.com", description: "",
  achievementRate: 100, isClosed: true, raisedAmount: 10000, remainingAmount: 0, donationCount: 1,
  shortfallAction: null, settled: false, settlementStatus: null, carriedOverAmount: 0, ...over,
});

const funding = (gifts: OwnerGiftView[], status: OwnerFundingView["status"] = "ended"): OwnerFundingView => ({
  id: "f", name: "펀딩", groupId: "gr", groupName: "그룹", ownerName: "나", startDate: "2026-09-01", endDate: "2026-09-10",
  status, gifts, totalRaised: gifts.reduce((s, g) => s + g.raisedAmount, 0),
});

describe("getFundingSettlementState", () => {
  it("정산 대상이 모두 완료되면 settled (이월 선물은 제외)", () => {
    const f = funding([gift({ id: "a", settled: true, settlementStatus: "completed" }), gift({ id: "b", achievementRate: 40, shortfallAction: "carryover" })]);
    expect(getFundingSettlementState(f)).toBe("settled");
  });
  it("요청·처리 중이 있으면 in-progress", () => {
    expect(getFundingSettlementState(funding([gift({ settlementStatus: "processing" })]))).toBe("in-progress");
  });
  it("일부만 완료면 partial", () => {
    expect(getFundingSettlementState(funding([gift({ id: "a", settlementStatus: "completed" }), gift({ id: "b" })]))).toBe("partial");
  });
  it("정산 전이거나 진행 중인 펀딩이면 null", () => {
    expect(getFundingSettlementState(funding([gift({})]))).toBeNull();
    expect(getFundingSettlementState(funding([gift({ settlementStatus: "completed" })], "active"))).toBeNull();
  });
});

describe("SettlementStateBadge", () => {
  it("정산 완료 시 '정산됨' 표시", () => {
    render(<SettlementStateBadge funding={funding([gift({ settlementStatus: "completed" })])} />);
    expect(screen.getByText("정산됨")).toBeInTheDocument();
  });
});
