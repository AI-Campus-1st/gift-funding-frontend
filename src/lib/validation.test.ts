import { describe, expect, it } from "vitest";
import { parseAmountInput, validateBirthday, validateEmail, validateFundingInput, validateGiftInput, validateName, validatePassword, validatePasswordChange, validatePasswordConfirm, validateUrl } from "./validation";

describe("회원가입 입력값 검증 (01_auth.md 5.2 문구)", () => {
  it("이름", () => {
    expect(validateName("")).toBe("이름을 입력해 주세요.");
    expect(validateName("   ")).toBe("올바른 이름을 입력해 주세요.");
    expect(validateName("김서연")).toBeNull();
  });
  it("이메일", () => {
    expect(validateEmail("")).toBe("이메일을 입력해 주세요.");
    expect(validateEmail("abc@")).toBe("올바른 이메일 형식으로 입력해 주세요.");
    expect(validateEmail("a@b.com")).toBeNull();
  });
  it("비밀번호 8자 이상 · 확인값 일치", () => {
    expect(validatePassword("1234567")).toBe("비밀번호는 8자 이상 입력해 주세요.");
    expect(validatePasswordConfirm("password1", "password2")).toBe("비밀번호가 일치하지 않습니다.");
    expect(validatePasswordConfirm("password1", "password1")).toBeNull();
  });
  it("생년월일: 미선택 / 존재하지 않는 날짜 / 미래 날짜", () => {
    expect(validateBirthday("")).toBe("생년월일을 선택해 주세요.");
    expect(validateBirthday("2001-02-30")).toBe("올바른 생년월일을 선택해 주세요.");
    expect(validateBirthday("2999-01-01")).toBe("오늘 이후 날짜는 선택할 수 없습니다.");
    expect(validateBirthday("2001-02-28")).toBeNull();
  });
});

describe("금액 · URL", () => {
  it("숫자 외 문자를 제거해 정수로 변환", () => {
    expect(parseAmountInput("20,000원")).toBe(20000);
    expect(parseAmountInput("")).toBeNull();
  });
  it("http(s) URL 만 허용", () => {
    expect(validateUrl("https://example.com/item")).toBeNull();
    expect(validateUrl("example.com")).not.toBeNull();
    expect(validateUrl("javascript:alert(1)")).not.toBeNull();
  });
});

describe("글자 수 제한 (2026-10-19 확정, Q1)", () => {
  it("이름 50자 · 이메일 255자", () => {
    expect(validateName("가".repeat(50))).toBeNull();
    expect(validateName("가".repeat(51))).toBe("이름은 50자 이내로 입력해 주세요.");
    expect(validateEmail(`${"a".repeat(250)}@a.com`)).toBe("이메일은 255자 이내로 입력해 주세요.");
  });
  it("선물 이름 · 설명 100자", () => {
    const gift = { name: "가".repeat(101), price: 1000, imageUrl: "data:,", productUrl: "https://example.com", description: "나".repeat(101) };
    const errors = validateGiftInput(gift);
    expect(errors.name).toBe("선물 이름은 100자 이내로 입력해 주세요.");
    expect(errors.description).toBe("선물 설명은 100자 이내로 입력해 주세요.");
  });
  it("펀딩 이름 40자", () => {
    const today = new Date().toISOString().slice(0, 10);
    const errors = validateFundingInput({ name: "가".repeat(41), groupId: "g", startDate: today, endDate: today, giftCount: 1 });
    expect(errors.name).toBe("펀딩 이름은 40자 이내로 입력해 주세요.");
  });
});

describe("비밀번호 변경 입력 검사 (docs/features/password-change.md)", () => {
  it("빈 칸 · 8자 미만 · 확인 불일치 · 현재와 같음", () => {
    expect(validatePasswordChange({ currentPassword: "", newPassword: "", newPasswordConfirm: "" })).toEqual({
      currentPassword: "현재 비밀번호를 입력해 주세요.",
      newPassword: "비밀번호를 입력해 주세요.",
      newPasswordConfirm: "비밀번호를 다시 입력해 주세요.",
    });
    expect(validatePasswordChange({ currentPassword: "password123", newPassword: "short", newPasswordConfirm: "x" })).toEqual({
      newPassword: "비밀번호는 8자 이상 입력해 주세요.",
      newPasswordConfirm: "비밀번호가 일치하지 않습니다.",
    });
    expect(validatePasswordChange({ currentPassword: "password123", newPassword: "password123", newPasswordConfirm: "password123" })).toEqual({
      newPassword: "현재 비밀번호와 다른 비밀번호를 입력해 주세요.",
    });
    expect(validatePasswordChange({ currentPassword: "password123", newPassword: "newpass1234", newPasswordConfirm: "newpass1234" })).toEqual({});
  });
});
