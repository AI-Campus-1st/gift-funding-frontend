/**
 * 비로그인 화면 그룹 레이아웃 — 랜딩(/) · 회원가입(/signup) · 로그인(/login)
 * 하단 탭 메뉴를 표시하지 않는다.
 * Suspense: 쿼리 문자열(useSearchParams)을 읽는 화면을 위한 경계 (Next.js 16 cacheComponents 요구사항)
 */
import { Suspense } from "react";
import { LoadingState } from "@/components/common/StateViews";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState fullScreen />}>{children}</Suspense>;
}
