"use client";

/**
 * AuthGuard — 로그인이 필요한 화면 보호
 *
 * - 로그인하지 않은 사용자는 /login?redirect=원래경로 로 보낸다.
 *   (초대 링크 /join-invite?token=... 로 들어온 경우에도 로그인 후 그대로 돌아온다)
 * - 사용 위치: src/app/(app)/layout.tsx
 * - 화면 보호는 사용성을 위한 것이고, 실제 권한 검사는 서버(mock API)에서 다시 한다.
 */
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LoadingState } from "@/components/common/StateViews";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status !== "unauthenticated") return;
    const query = searchParams.toString();
    const current = query ? `${pathname}?${query}` : pathname;
    router.replace(`/login?redirect=${encodeURIComponent(current)}`);
  }, [status, pathname, searchParams, router]);

  // 로그인 확인 중(loading)에도 화면 틀은 그대로 그린다.
  // - 서버 미리 그리기(prerender) 단계에서 화면이 빠지지 않게 하기 위함 (Next.js 16 instant navigation 검증)
  // - 데이터 요청은 브라우저에서 화면이 뜬 뒤(useEffect)에만 일어나므로 미리 그려도 안전하다.
  if (status === "unauthenticated") return <LoadingState label="로그인 화면으로 이동하고 있어요" fullScreen />;
  return <>{children}</>;
}

/** 이미 로그인한 사용자가 로그인 · 회원가입 화면에 오면 홈(또는 redirect 경로)으로 보낸다 */
export function GuestOnly({ children, redirectTo = "/home" }: { children: ReactNode; redirectTo?: string }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace(redirectTo);
  }, [status, redirectTo, router]);

  if (status !== "unauthenticated") return <LoadingState label="잠시만 기다려 주세요" fullScreen />;
  return <>{children}</>;
}
