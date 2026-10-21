/**
 * Mock 핸들러 공통 타입 · 도우미
 *
 * 핸들러 = 실제 서버의 엔드포인트 함수. 권한 확인 · 검증 · 계산 · 저장을 여기서 한다.
 * - ctx.body 는 camelCase 로 바뀐 요청 본문, 반환값은 router 가 snake_case 로 바꿔 응답한다.
 * - undefined 를 반환하면 204 (본문 없음).
 */
import { ApiError } from "@/lib/api/client";
import type { HttpMethod } from "@/lib/api/http";

export interface MockContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  userId: string | null;
}

export interface MockRoute {
  method: HttpMethod;
  path: string; // "/fundings/:fundingId"
  handler: (ctx: MockContext) => unknown;
  status?: number; // 성공 상태 코드 (기본 200, 본문 없으면 204)
  delay?: number; // 모의 지연(ms, 기본 250)
}

export function route(method: HttpMethod, path: string, handler: MockRoute["handler"], options: { status?: number; delay?: number } = {}): MockRoute {
  return { method, path, handler, ...options };
}

/** 로그인이 필요한 API: 사용자 ID 또는 401 */
export function requireUser(ctx: MockContext): string {
  if (!ctx.userId) throw new ApiError("UNAUTHORIZED", "로그인이 만료되었습니다. 다시 로그인해 주세요.");
  return ctx.userId;
}

/** 요청 본문 (타입은 각 핸들러가 지정, 형식 검증은 핸들러가 한다) */
export function bodyOf<T>(ctx: MockContext): T {
  return (ctx.body ?? {}) as T;
}
