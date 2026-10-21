import { describe, expect, it } from "vitest";
import { calcAchievementRate, daysUntilNextBirthday, formatDday, formatWon, getFundingStatus, parseLocalDate } from "./format";

describe("formatWon", () => {
  it("천 단위 구분 기호와 '원'을 붙인다", () => {
    expect(formatWon(300000)).toBe("300,000원");
    expect(formatWon(0)).toBe("0원");
  });
});

describe("calcAchievementRate (목표 달성률)", () => {
  it("모금액 / 목표 금액을 0~100 정수로 계산한다", () => {
    expect(calcAchievementRate(150000, 300000)).toBe(50);
  });
  it("99.x% 를 100% 로 반올림하지 않는다 (목표 달성 오해 방지)", () => {
    expect(calcAchievementRate(290000 + 9999, 300000)).toBe(99);
  });
  it("100% 를 넘지 않는다", () => {
    expect(calcAchievementRate(400000, 300000)).toBe(100);
  });
  it("목표 금액이 0 이하이면 0", () => {
    expect(calcAchievementRate(1000, 0)).toBe(0);
  });
});

describe("parseLocalDate", () => {
  it("존재하지 않는 날짜(2월 30일)는 null", () => {
    expect(parseLocalDate("2026-02-30")).toBeNull();
    expect(parseLocalDate("2026-02-28")).not.toBeNull();
  });
});

describe("daysUntilNextBirthday / formatDday", () => {
  const today = new Date(2026, 9, 15); // 2026-10-15
  it("생일 당일은 0 → D-day", () => {
    expect(daysUntilNextBirthday("2000-10-15", today)).toBe(0);
    expect(formatDday(0)).toBe("D-day");
  });
  it("올해 생일이 남았으면 올해 기준", () => {
    expect(daysUntilNextBirthday("2002-11-12", today)).toBe(28);
  });
  it("올해 생일이 지났으면 내년 기준", () => {
    expect(daysUntilNextBirthday("2000-10-14", today)).toBe(364);
  });
  it("2월 29일생은 평년에 2월 28일로 계산", () => {
    expect(daysUntilNextBirthday("2000-02-29", new Date(2027, 1, 27))).toBe(1);
  });
});

describe("getFundingStatus", () => {
  it("시작 전 / 진행 중(종료일 당일 포함) / 종료", () => {
    expect(getFundingStatus("2026-10-20", "2026-10-30", "2026-10-15")).toBe("scheduled");
    expect(getFundingStatus("2026-10-01", "2026-10-15", "2026-10-15")).toBe("active");
    expect(getFundingStatus("2026-10-01", "2026-10-14", "2026-10-15")).toBe("ended");
  });
});
