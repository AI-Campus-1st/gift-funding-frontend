/** 공통 삭제 확인 모달 — 문구 · 취소 · 성공 · 실패 동작 (rules.md 10.3) */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function setup(onConfirm: () => Promise<unknown>) {
  const onOpenChange = vi.fn();
  const onDeleted = vi.fn();
  render(<DeleteConfirmDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} onDeleted={onDeleted} />);
  return { onOpenChange, onDeleted };
}

describe("DeleteConfirmDialog", () => {
  it("기본 문구와 취소 · 삭제 버튼을 보여주고, 취소하면 삭제하지 않는다", async () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const { onOpenChange } = setup(onConfirm);
    expect(screen.getByText("정말 삭제하시겠습니까?")).toBeInTheDocument();
    expect(screen.getByText("삭제한 데이터는 복구할 수 없습니다.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("삭제에 성공하면 모달을 닫고 '삭제되었습니다.'를 알린 뒤 onDeleted 를 부른다", async () => {
    const { toast } = await import("sonner");
    const { onOpenChange, onDeleted } = setup(() => Promise.resolve());
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast.success).toHaveBeenCalledWith("삭제되었습니다.");
    expect(onDeleted).toHaveBeenCalled();
  });

  it("삭제에 실패하면 모달 안에 오류를 보여주고 닫지 않는다", async () => {
    const { onOpenChange, onDeleted } = setup(() => Promise.reject(new ApiError("CONFLICT", "후원이 들어온 펀딩은 삭제할 수 없어요.")));
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("후원이 들어온 펀딩은 삭제할 수 없어요.");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
