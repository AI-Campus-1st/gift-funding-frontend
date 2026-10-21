/** 권한별 선물 카드 — 후원자 카드에는 모금액이 보이지 않아야 한다 (F-13) */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OwnerGiftView, SupporterGiftView } from "@/types";
import { OwnerGiftCard, SupporterGiftCard } from "./GiftCard";

const supporterGift: SupporterGiftView = {
  id: "g1",
  name: "기계식 키보드",
  price: 159000,
  imageUrl: "data:,",
  productUrl: "https://example.com/keyboard",
  description: "",
  achievementRate: 94,
  isClosed: false,
};

describe("GiftCard", () => {
  it("후원자 카드: 목표 금액 · 구매 링크 · 달성률은 보이고 현재/남은 모금액은 없다", () => {
    render(<SupporterGiftCard gift={supporterGift} />);
    expect(screen.getByText("159,000원")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /상품 구매 링크/ })).toHaveAttribute("href", "https://example.com/keyboard");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "94");
    expect(screen.queryByText("현재 모금액")).not.toBeInTheDocument();
    expect(screen.queryByText("남은 모금액")).not.toBeInTheDocument();
  });

  it("생일자 카드: 현재 모금액과 남은 모금액을 보여준다", () => {
    const ownerGift: OwnerGiftView = { ...supporterGift, raisedAmount: 150000, remainingAmount: 9000, donationCount: 1, shortfallAction: null, settled: false, settlementStatus: null, carriedOverAmount: 0 };
    render(<OwnerGiftCard gift={ownerGift} />);
    expect(screen.getByText("현재 모금액")).toBeInTheDocument();
    expect(screen.getByText("150,000원")).toBeInTheDocument();
    expect(screen.getByText("9,000원")).toBeInTheDocument();
    expect(screen.queryByText(/이월 금액/)).not.toBeInTheDocument();
  });

  it("생일자 카드: 이월 금액이 있으면 모금액에 포함됐다고 알려준다", () => {
    const ownerGift: OwnerGiftView = { ...supporterGift, raisedAmount: 60000, remainingAmount: 99000, donationCount: 0, shortfallAction: null, settled: false, settlementStatus: null, carriedOverAmount: 60000 };
    render(<OwnerGiftCard gift={ownerGift} />);
    expect(screen.getByText("이월")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "P" && el.textContent === "지난 펀딩에서 이월한 60,000원이 현재 모금액에 포함돼 있어요.")).toBeInTheDocument();
  });

  it("목표 달성 선물은 '100% 달성'과 '목표 달성 완료'를 함께 표시한다", () => {
    render(<SupporterGiftCard gift={{ ...supporterGift, achievementRate: 100, isClosed: true }} />);
    expect(screen.getByText("100% 달성")).toBeInTheDocument();
    expect(screen.getByText("목표 달성 완료")).toBeInTheDocument();
  });
});
