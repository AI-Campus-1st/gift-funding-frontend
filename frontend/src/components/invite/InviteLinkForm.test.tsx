/** 초대 링크 입력 — 전체 링크 / 코드만 입력해도 토큰을 꺼내 전달한다 (UI-17) */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InviteLinkForm } from "./InviteLinkForm";

describe("InviteLinkForm", () => {
  it("전체 링크를 붙여넣으면 token 값만 전달한다", async () => {
    const onSubmit = vi.fn();
    render(<InviteLinkForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/초대 링크/), "https://birthday.app/join-invite?token=INVITE-MINA-2026");
    await userEvent.click(screen.getByRole("button", { name: "초대 링크 확인" }));
    expect(onSubmit).toHaveBeenCalledWith("INVITE-MINA-2026");
  });

  it("코드만 입력해도 동작하고, 비어 있으면 오류를 보여준다", async () => {
    const onSubmit = vi.fn();
    render(<InviteLinkForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "초대 링크 확인" }));
    expect(screen.getByRole("alert")).toHaveTextContent("초대 링크를 입력해 주세요.");
    await userEvent.type(screen.getByLabelText(/초대 링크/), "INVITE-OLD-0000");
    await userEvent.click(screen.getByRole("button", { name: "초대 링크 확인" }));
    expect(onSubmit).toHaveBeenCalledWith("INVITE-OLD-0000");
  });
});
