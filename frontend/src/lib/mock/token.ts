/**
 * Mock 인증 토큰 — 실제 서버의 JWT 발급 · 검증 역할
 * 토큰 형식: "mock-token:<userId>" (Mock 전용, 연동 후 삭제)
 */
const MOCK_TOKEN_PREFIX = "mock-token:";

export function createMockToken(userId: string): string {
  return `${MOCK_TOKEN_PREFIX}${userId}`;
}

/** 토큰 → 사용자 ID (형식이 다르면 null) */
export function parseMockToken(token: string | null): string | null {
  if (!token?.startsWith(MOCK_TOKEN_PREFIX)) return null;
  return token.slice(MOCK_TOKEN_PREFIX.length) || null;
}
