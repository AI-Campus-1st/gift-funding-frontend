/** 종료된 선물 처리 상태 배지 — 모금액 0원 미달 선물은 "종료됨" (FEATURE_SPEC F-11, 2026-10-16 확정) */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OwnerGiftView } from "@/types";
import { ShortfallBadge } from "./ShortfallBadge";

const gift: OwnerGiftView = {
  id: "g", name: "텀블러", price: 25000, imageUrl: "data:,", productUrl: "https://example.com", description: "",
  achievementRate: 0, isClosed: false, raisedAmount: 0, remainingAmount: 25000, donationCount: 0,
  shortfallAction: null, settled: false, settlementStatus: null, carriedOverAmount: 0,
};

describe("ShortfallBadge", () => {
  it("모금액 0원이면 '종료됨'", () => {
    render(<ShortfallBadge gift={gift} />);
    expect(screen.getByText("종료됨")).toBeInTheDocument();
  });
  it("모금액이 있고 처리하지 않았으면 '처리 필요'", () => {
    render(<ShortfallBadge gift={{ ...gift, raisedAmount: 5000, achievementRate: 20 }} />);
    expect(screen.getByText("목표 미달 · 처리 필요")).toBeInTheDocument();
  });
  it("정산이 완료되면 '정산됨', 진행 중이면 '정산 진행 중'", () => {
    const achieved = { ...gift, raisedAmount: 25000, achievementRate: 100, settled: true };
    const { rerender } = render(<ShortfallBadge gift={{ ...achieved, settlementStatus: "completed" }} />);
    expect(screen.getByText("정산됨")).toBeInTheDocument();
    rerender(<ShortfallBadge gift={{ ...achieved, settlementStatus: "processing" }} />);
    expect(screen.getByText("정산 진행 중")).toBeInTheDocument();
  });
});
