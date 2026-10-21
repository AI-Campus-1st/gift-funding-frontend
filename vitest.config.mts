/**
 * Vitest 설정 — 단위 테스트(Vitest) + 컴포넌트 테스트(React Testing Library)
 * 실행: npm test
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true }, // "@/..." 경로 별칭을 tsconfig 에서 읽음
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
