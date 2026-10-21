/** 관심사 키워드 입력 — Backspace 로 기존 키워드가 지워지지 않아야 한다 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { KeywordInput } from "./KeywordInput";

function Harness() {
  const [keywords, setKeywords] = useState<string[]>(["음악", "캠핑"]);
  return <KeywordInput id="kw" value={keywords} onChange={setKeywords} />;
}

describe("KeywordInput", () => {
  it("Enter 로 키워드를 추가한다", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("textbox"), "향수{Enter}");
    expect(screen.getByText("#향수")).toBeInTheDocument();
  });

  it("입력 글자를 모두 지운 뒤 Backspace 를 더 눌러도 기존 키워드는 남아 있다", async () => {
    render(<Harness />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "독서{Backspace}{Backspace}{Backspace}{Backspace}");
    expect(input).toHaveValue("");
    expect(screen.getByText("#음악")).toBeInTheDocument();
    expect(screen.getByText("#캠핑")).toBeInTheDocument();
  });

  it("× 버튼으로만 키워드를 삭제한다", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "캠핑 삭제" }));
    expect(screen.queryByText("#캠핑")).not.toBeInTheDocument();
    expect(screen.getByText("#음악")).toBeInTheDocument();
  });
});
