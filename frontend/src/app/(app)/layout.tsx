/**
 * 로그인 필요 화면 그룹 레이아웃
 * - AuthGuard: 비로그인 사용자를 /login?redirect=... 로 이동
 * - Suspense: 경로 파라미터 · 쿼리 문자열을 읽는 클라이언트 화면을 위한 경계
 */
import { Suspense } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { LoadingState } from "@/components/common/StateViews";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingState fullScreen />}>
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}
