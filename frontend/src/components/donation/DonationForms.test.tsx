/** 후원 금액 선택 · 축하 메시지 카드 컴포넌트 테스트 (UI-19) */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DonationAmountForm } from "./DonationAmountForm";
import { DonationMessageCard } from "./DonationMessageCard";

function AmountHarness({ limitMessage }: { limitMessage?: string }) {
  const [amount, setAmount] = useState<number | null>(null);
  return (
    <>
      <DonationAmountForm amount={amount} onChange={setAmount} limitMessage={limitMessage} />
      <output data-testid="amount">{String(amount)}</output>
    </>
  );
}

describe("DonationAmountForm", () => {
  it("추천 금액 버튼(5,000 / 10,000 / 30,000원)을 누르면 해당 금액이 선택된다", async () => {
    render(<AmountHarness />);
    for (const label of ["5,000원", "10,000원", "30,000원"]) expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "10,000원" }));
    expect(screen.getByTestId("amount")).toHaveTextContent("10000");
    expect(screen.getByRole("button", { name: "10,000원" })).toHaveAttribute("aria-pressed", "true");
  });

  it("직접 입력은 숫자만 받아 천 단위 구분 기호로 표시한다", async () => {
    render(<AmountHarness />);
    const input = screen.getByPlaceholderText("직접 입력하기");
    await userEvent.type(input, "2만0000");
    expect(screen.getByTestId("amount")).toHaveTextContent("20000");
    expect(input).toHaveValue("20,000");
  });

  it("추천 금액과 같은 숫자를 지나가도 이어서 입력할 수 있다 (1,000 → 10,000 → 100,000)", async () => {
    render(<AmountHarness />);
    const input = screen.getByPlaceholderText("직접 입력하기");
    await userEvent.type(input, "100000");
    expect(input).toHaveValue("100,000");
    expect(screen.getByTestId("amount")).toHaveTextContent("100000");
  });

  it("추천 금액 버튼을 누르면 직접 입력창은 비워지고, 다시 입력하면 버튼 선택이 풀린다", async () => {
    render(<AmountHarness />);
    const input = screen.getByPlaceholderText("직접 입력하기");
    await userEvent.type(input, "7000");
    await userEvent.click(screen.getByRole("button", { name: "30,000원" }));
    expect(input).toHaveValue("");
    expect(screen.getByTestId("amount")).toHaveTextContent("30000");
    await userEvent.type(input, "5000");
    expect(input).toHaveValue("5,000");
    expect(screen.getByRole("button", { name: "5,000원" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.clear(input);
    expect(screen.getByTestId("amount")).toHaveTextContent("null");
  });

  it("초과 후원 안내 문구를 입력창 아래에 보여준다", () => {
    render(<AmountHarness limitMessage="현재 이 선물에는 최대 10,000원까지 후원할 수 있습니다. 후원 금액을 수정해 주세요." />);
    expect(screen.getByRole("alert")).toHaveTextContent("최대 10,000원까지");
  });
});

function MessageHarness() {
  const [message, setMessage] = useState("");
  return <DonationMessageCard authorName="김서연" recipientName="이지훈" message={message} onChange={setMessage} />;
}

describe("DonationMessageCard", () => {
  it("추천 문구를 누르면 입력창에 채워지고, 다른 문구를 누르면 교체된다", async () => {
    render(<MessageHarness />);
    const textarea = screen.getByLabelText("축하 메시지 직접 입력");
    await userEvent.click(screen.getByRole("button", { name: "생일 축하해! 🎂" }));
    expect(textarea).toHaveValue("생일 축하해! 🎂");
    await userEvent.click(screen.getByRole("button", { name: "태어나줘서 고마워 💗" }));
    expect(textarea).toHaveValue("태어나줘서 고마워 💗");
  });

  it("자동 입력된 문구를 수정 · 삭제할 수 있고, 미리보기에 실명이 표시된다", async () => {
    render(<MessageHarness />);
    const textarea = screen.getByLabelText("축하 메시지 직접 입력");
    await userEvent.click(screen.getByRole("button", { name: "생일 축하해! 🎂" }));
    await userEvent.type(textarea, " 최고!");
    expect(textarea).toHaveValue("생일 축하해! 🎂 최고!");
    expect(screen.getByText("From. 김서연")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "메시지 지우기" }));
    expect(textarea).toHaveValue("");
    expect(screen.queryByText("From. 김서연")).not.toBeInTheDocument();
  });

  it("메시지는 생일자만 볼 수 있다는 안내를 보여준다", () => {
    render(<MessageHarness />);
    expect(screen.getByText(/메시지는 이지훈님만 볼 수 있어요/)).toBeInTheDocument();
  });
});
