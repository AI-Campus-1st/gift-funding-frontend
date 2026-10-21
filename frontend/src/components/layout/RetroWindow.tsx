/**
 * RetroWindow — Windows 98 스타일 창 형태의 카드 (base.md 4.3 retro-window)
 *
 * - 제목 표시줄(title) + 콘텐츠 영역으로 구성된다.
 * - 오른쪽의 _ □ × 는 기능 없는 장식이므로 버튼처럼 보이지 않게 하고 접근성 트리에서 제외(aria-hidden)한다.
 * 사용 위치: 거의 모든 화면의 섹션 카드
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const titleTone = {
  sky: "bg-sky",
  pink: "bg-primary-disabled",
  lavender: "bg-lavender",
  yellow: "bg-memo",
};

interface RetroWindowProps {
  title?: ReactNode;
  /** 제목 표시줄 오른쪽에 둘 실제 동작 요소 (예: 전체 보기 링크) */
  action?: ReactNode;
  tone?: keyof typeof titleTone;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  /** 섹션 제목을 heading 으로 제공할 때의 태그 */
  as?: "section" | "div" | "article";
  titleId?: string;
}

export function RetroWindow({ title, action, tone = "sky", className, bodyClassName, children, as: Tag = "section", titleId }: RetroWindowProps) {
  return (
    <Tag
      className={cn("rounded-xs border-2 border-line bg-surface shadow-window", className)}
      aria-labelledby={title && titleId ? titleId : undefined}
    >
      {title !== undefined && (
        <div className={cn("flex min-h-9 items-center gap-2 border-b-2 border-line px-2.5 py-1", titleTone[tone])}>
          <span aria-hidden className="text-caption text-primary-active">♥</span>
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-caption font-bold text-ink">
            {title}
          </h2>
          {action}
          {!action && <WindowControls />}
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Tag>
  );
}

/** 장식용 창 제어 아이콘 (클릭 불가 · 스크린리더 제외) */
export function WindowControls() {
  return (
    <span aria-hidden className="pointer-events-none flex gap-0.5">
      {["_", "□", "×"].map((c) => (
        <span key={c} className="grid size-4 place-items-center rounded-[1px] border border-line bg-surface text-[10px] leading-none text-muted">
          {c}
        </span>
      ))}
    </span>
  );
}
