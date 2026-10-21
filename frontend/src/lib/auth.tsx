"use client";

/**
 * 로그인 상태 관리 (React Context)
 *
 * - 앱 전체에서 현재 사용자(user)와 로그인 상태(status)를 공유한다.
 * - 사용 위치: src/app/layout.tsx 에서 <AuthProvider> 로 감싸고,
 *   각 화면에서는 useAuth() 로 user / login / logout 을 사용한다.
 * - 보호된 화면 접근 제어는 src/components/layout/AuthGuard.tsx 가 담당한다.
 */
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMe, login as loginApi, logout as logoutApi } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/client";
import type { User } from "@/types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  logout: () => Promise<void>;
  /** 프로필 수정 후 최신 사용자 정보로 갱신 */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const queryClient = useQueryClient();

  // 첫 진입 시 저장된 토큰으로 사용자 정보 복원 (토큰이 없거나 만료되면 getMe 가 실패한다)
  useEffect(() => {
    getMe()
      .then((me) => {
        setUserState(me);
        setStatus("authenticated");
      })
      .catch(() => {
        clearToken(); // 만료되었거나 잘못된 토큰
        setStatus("unauthenticated");
      });
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const me = await loginApi(email, password, remember);
    queryClient.clear(); // 이전 계정의 캐시가 남지 않게
    setUserState(me);
    setStatus("authenticated");
    return me;
  }, [queryClient]);

  const logout = useCallback(async () => {
    await logoutApi();
    queryClient.clear(); // 다른 계정 데이터가 남지 않게
    setUserState(null);
    setStatus("unauthenticated");
  }, [queryClient]);

  const setUser = useCallback((next: User) => setUserState(next), []);

  const value = useMemo(() => ({ user, status, login, logout, setUser }), [user, status, login, logout, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}

/**
 * 로그인 후 돌아갈 경로가 안전한지 확인 (외부 사이트로 이동하는 오픈 리다이렉트 방지)
 * "/home" ✅  "//evil.com" ❌  "https://evil.com" ❌
 */
export function getSafeRedirect(value: string | null, fallback = "/home"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
