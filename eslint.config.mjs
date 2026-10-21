import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // UI · API 분리 규칙 (rules.md 9.2) — 화면 · 컴포넌트는 데이터 훅만 쓰고, API · Mock 을 직접 부르지 않는다
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/mock", "@/lib/mock/*"], message: "화면은 Mock 서버를 직접 쓰지 않아요. hooks/queries 의 훅을 사용하세요." },
            { group: ["@/lib/api/*", "!@/lib/api/client"], message: "화면은 hooks/queries 의 훅으로 데이터를 다뤄요. (ApiError · getErrorMessage 는 @/lib/api/client 허용)" },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["src/components/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/lib/mock", "@/lib/mock/*"], message: "컴포넌트는 Mock 서버를 직접 쓰지 않아요." },
            { group: ["@/lib/api/*", "!@/lib/api/client"], message: "컴포넌트는 props 로 받은 데이터만 표시해요. 상수는 @/lib/constants, 검증은 @/lib/validation 을 쓰세요." },
            { group: ["@/hooks/queries/*"], message: "컴포넌트는 데이터를 조회하지 않아요. 화면(page)에서 훅을 호출하고 props 로 넘기세요." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
