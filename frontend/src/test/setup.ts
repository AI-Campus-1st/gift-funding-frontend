/** 테스트 공통 준비: DOM 검사용 matcher(toBeInTheDocument 등) 추가, 테스트마다 저장소 초기화 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
