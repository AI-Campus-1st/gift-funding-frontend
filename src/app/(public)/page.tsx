/**
 * UI-01 랜딩 페이지 (/)
 * 서비스 소개 + 회원가입 · 로그인 버튼. 하단 탭 없음.
 * 명세: docs/design/pages/01_auth.md (UI-01)
 */
import Link from "next/link";
import { Gift, HandCoins, Share2 } from "lucide-react";
import { RetroWindow, WindowControls } from "@/components/layout/RetroWindow";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Gift, title: "원하는 선물 등록하기", desc: "갖고 싶은 선물을 1개 이상 자유롭게 등록해요." },
  { icon: Share2, title: "친구에게 초대 링크 공유하기", desc: "초대받은 사람만 볼 수 있는 비공개 펀딩이에요." },
  { icon: HandCoins, title: "원하는 금액으로 함께 후원하기", desc: "부담 없는 금액으로 마음을 모아요." },
];

export default function LandingPage() {
  return (
    <>
      <header className="flex h-14 items-center gap-2 border-b-2 border-line-strong bg-surface-soft px-4">
        <Gift className="size-5 text-primary-active" aria-hidden />
        <span className="flex-1 text-title-sm font-bold text-ink">Birthday Funding</span>
        <WindowControls />
      </header>
      <main className="flex flex-col gap-6 px-4 pb-10 pt-6">
        <RetroWindow title="birthday_funding.exe" tone="lavender" bodyClassName="bg-holo p-6 text-center">
          <div className="text-6xl" aria-hidden>🎁</div>
          <h1 className="mt-3 text-display-lg text-ink">생일선물, 함께 준비해요!</h1>
          <p className="mt-2 text-body-sm text-body">갖고 싶은 선물을 등록하고 친구들과 함께 마음을 모아보세요.</p>
        </RetroWindow>

        <section aria-labelledby="features-title" className="rounded-xs border-2 border-line bg-surface p-4">
          <h2 id="features-title" className="sr-only">서비스 기능 소개</h2>
          <ol className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <li key={title} className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-sm border-2 border-line-strong bg-surface-soft text-primary-active">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-title-sm text-ink">
                    {i + 1}. {title}
                  </p>
                  <p className="text-body-sm text-muted">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-3">
          <Button asChild block>
            <Link href="/signup">회원가입</Link>
          </Button>
          <Button asChild variant="secondary" block className="border-line">
            <Link href="/login">로그인</Link>
          </Button>
        </div>
        <p className="text-center text-caption font-normal text-muted">소중한 사람들과 만드는 특별한 생일 🎂</p>
      </main>
    </>
  );
}
