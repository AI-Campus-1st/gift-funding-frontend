/**
 * 루트 레이아웃 — 모든 화면에 공통으로 적용
 * - Pretendard 폰트(로컬 npm 패키지) · 전역 디자인 토큰(globals.css)
 * - QueryProvider: 서버 데이터 캐시 (TanStack Query)
 * - AuthProvider: 로그인 상태 공유
 * - AppShell: 데스크톱에서도 430px 모바일 앱 형태로 표시
 */
import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Birthday Funding — 생일선물 공동 펀딩",
  description: "갖고 싶은 선물을 등록하고 친구들과 함께 마음을 모아보세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 모바일 안전 영역(safe-area) 사용
  themeColor: "#FFF1F9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
