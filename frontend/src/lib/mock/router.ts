/**
 * Mock 서버 라우터 — FastAPI 대신 요청을 받아 처리한다 (NEXT_PUBLIC_API_MODE=mock)
 *
 * - docs/API_SPEC.md 의 경로 · 상태 코드 · 오류 형식을 그대로 흉내 낸다.
 * - 요청 본문(snake_case)을 camelCase 로 바꿔 핸들러에 넘기고, 결과는 snake_case 로 돌려준다.
 *   (핸들러 안쪽은 기존 Mock 로직을 그대로 쓰기 위해 camelCase 로 동작)
 * - 응답은 깊은 복사본이라, 화면이 받은 객체를 고쳐도 Mock DB 가 바뀌지 않는다.
 * - 백엔드 연동이 끝나면 lib/mock 폴더째 삭제한다.
 */
import { camelKey, snakeKey, toCamelDeep, toSnakeDeep } from "@/lib/api/case";
import { ApiError, type ApiErrorCode } from "@/lib/api/client";
import type { HttpMethod, HttpRequest, HttpResponse } from "@/lib/api/http";
import type { MockContext, MockRoute } from "./handlers/context";
import { aiRoutes } from "./handlers/ai";
import { authRoutes } from "./handlers/auth";
import { donationRoutes } from "./handlers/donations";
import { fundingRoutes } from "./handlers/fundings";
import { groupRoutes } from "./handlers/groups";
import { scheduleRoutes } from "./handlers/schedule";
import { settlementRoutes } from "./handlers/settlements";
import { parseMockToken } from "./token";

const routes: MockRoute[] = [...authRoutes, ...groupRoutes, ...fundingRoutes, ...donationRoutes, ...settlementRoutes, ...scheduleRoutes, ...aiRoutes];

/** 오류 코드 → HTTP 상태 (docs/API_SPEC.md 1.2) */
const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVITE_INVALID: 404,
  DUPLICATE_EMAIL: 409,
  CONFLICT: 409,
  GIFT_LOCKED: 409,
  GOAL_REACHED: 409,
  EXCEEDS_REMAINING: 409,
  FUNDING_NOT_ACTIVE: 409,
  INVITE_INACTIVE: 410,
  INVITE_EXPIRED: 410,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 502,
  NETWORK: 503,
  INTERNAL: 500,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** "/fundings/:fundingId" 와 "/fundings/f_1" 비교 → { fundingId: "f_1" } */
function matchPath(pattern: string, actual: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const a = actual.split("/").filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

function findRoute(method: HttpMethod, path: string): { route: MockRoute; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPath(route.path, path);
    if (params) return { route, params };
  }
  return null;
}

function errorResponse(error: ApiError): HttpResponse {
  return {
    status: STATUS_BY_CODE[error.code] ?? 500,
    body: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors && { field_errors: Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [snakeKey(k), v])) }),
      ...(error.maxAvailable !== undefined && { max_available: error.maxAvailable }),
    },
  };
}

export async function handleMockRequest(req: HttpRequest & { query: Record<string, string>; token: string | null }): Promise<HttpResponse> {
  const found = findRoute(req.method, req.path);
  await sleep(process.env.NODE_ENV === "test" ? 0 : (found?.route.delay ?? 250));
  if (!found) return errorResponse(new ApiError("NOT_FOUND", "요청한 API를 찾을 수 없어요."));

  const ctx: MockContext = {
    params: found.params,
    query: Object.fromEntries(Object.entries(req.query).map(([k, v]) => [camelKey(k), v])),
    body: req.body === undefined ? undefined : toCamelDeep(structuredClone(req.body)),
    userId: parseMockToken(req.token),
  };
  try {
    const result = found.route.handler(ctx);
    if (result === undefined) return { status: 204, body: null };
    return { status: found.route.status ?? 200, body: toSnakeDeep(structuredClone(result)) };
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error);
    console.error("[mock] 처리 중 오류", error);
    return errorResponse(new ApiError("INTERNAL", "잠시 후 다시 시도해 주세요."));
  }
}
