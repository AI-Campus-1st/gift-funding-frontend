/**
 * HTTP 클라이언트 — 모든 API 요청이 지나가는 곳 (docs/ARCHITECTURE.md 1장 ④)
 *
 * - 인증 토큰을 Authorization 헤더로 붙이고, 오류 응답을 ApiError 로 바꾼다.
 * - NEXT_PUBLIC_API_MODE
 *     "mock"(기본) → lib/mock/router.ts 가 서버 역할 (네트워크 없음, localStorage DB)
 *     "http"       → fetch(`${NEXT_PUBLIC_API_BASE_URL}/api/v1${path}`) 로 FastAPI 호출
 *   두 모드 모두 같은 경로 · 상태 코드 · snake_case JSON 을 주고받으므로, 이 파일 위쪽 계층은 모드를 몰라도 된다.
 * - 요청 · 응답 본문은 snake_case 그대로 다룬다. camelCase 변환은 각 도메인 API 가 mappers 로 한다.
 */
import { camelKey } from "./case";
import { ApiError, readToken, type ApiErrorCode } from "./client";
import type { ErrorDto } from "./dto";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRequest {
  method: HttpMethod;
  path: string; // 예: "/fundings/f_1"  (/api/v1 은 붙이지 않는다)
  query?: Record<string, string | null | undefined>;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  body: unknown; // 204 면 null
}

const API_MODE = process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

/** 값이 있는 쿼리만 남긴다 */
function cleanQuery(query: HttpRequest["query"]): Record<string, string> {
  return Object.fromEntries(Object.entries(query ?? {}).filter((entry): entry is [string, string] => entry[1] != null && entry[1] !== ""));
}

async function sendHttp(req: HttpRequest, token: string | null): Promise<HttpResponse> {
  const qs = new URLSearchParams(cleanQuery(req.query)).toString();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (req.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${req.path}${qs ? `?${qs}` : ""}`, {
      method: req.method,
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    });
  } catch {
    throw new ApiError("NETWORK", "서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.");
  }
  const text = res.status === 204 ? "" : await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null };
}

async function send(req: HttpRequest): Promise<HttpResponse> {
  const token = readToken();
  if (API_MODE === "http") return sendHttp(req, token);
  const { handleMockRequest } = await import("@/lib/mock/router");
  return handleMockRequest({ ...req, query: cleanQuery(req.query), token });
}

/** 서버 오류 본문 → ApiError (field_errors 의 필드 이름은 camelCase 로) */
function toApiError(status: number, body: unknown): ApiError {
  const dto = (body ?? {}) as Partial<ErrorDto>;
  const fieldErrors = dto.field_errors
    ? Object.fromEntries(Object.entries(dto.field_errors).map(([k, v]) => [camelKey(k), v]))
    : undefined;
  const code = (dto.code ?? (status === 401 ? "UNAUTHORIZED" : "INTERNAL")) as ApiErrorCode;
  return new ApiError(code, dto.message ?? "잠시 후 다시 시도해 주세요.", { fieldErrors, maxAvailable: dto.max_available });
}

async function request<T>(req: HttpRequest): Promise<T> {
  const res = await send(req);
  if (res.status >= 400) throw toApiError(res.status, res.body);
  return res.body as T;
}

/** 경로 조각을 안전하게 넣는다 (예: path`/fundings/${id}`) */
export function path(strings: TemplateStringsArray, ...values: string[]): string {
  return strings.reduce((acc, s, i) => acc + s + (i < values.length ? encodeURIComponent(values[i]) : ""), "");
}

export const http = {
  get: <T>(p: string, query?: HttpRequest["query"]) => request<T>({ method: "GET", path: p, query }),
  post: <T>(p: string, body?: unknown) => request<T>({ method: "POST", path: p, body }),
  put: <T>(p: string, body?: unknown) => request<T>({ method: "PUT", path: p, body }),
  patch: <T>(p: string, body?: unknown) => request<T>({ method: "PATCH", path: p, body }),
  delete: <T = void>(p: string) => request<T>({ method: "DELETE", path: p }),
};
