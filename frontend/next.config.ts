import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 용: 실행에 필요한 파일만 .next/standalone 에 모은다 (npm run dev 에는 영향 없음)
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
