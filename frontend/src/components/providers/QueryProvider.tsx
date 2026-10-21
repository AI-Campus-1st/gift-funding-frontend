"use client";

/**
 * QueryProvider — TanStack Query 전역 설정 (docs/ARCHITECTURE.md 5.1)
 *
 * - staleTime 30초: 탭을 오갈 때마다 다시 부르지 않되 모금 현황은 금방 갱신
 * - 조회 재시도 1회 (권한 · 입력 · 없음 오류는 재시도하지 않음), 변경 요청은 재시도하지 않음 (후원 · 정산 중복 방지)
 * - 창 포커스 때 자동 조회하지 않음 (입력 중 화면이 바뀌지 않게)
 * 사용 위치: src/app/layout.tsx (AuthProvider 바깥)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";

const NO_RETRY_CODES = new Set(["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "VALIDATION", "INVITE_INVALID", "INVITE_INACTIVE", "INVITE_EXPIRED"]);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !(error instanceof ApiError && NO_RETRY_CODES.has(error.code)) && failureCount < 1,
      },
      mutations: { retry: 0 },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
