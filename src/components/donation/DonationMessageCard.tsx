"use client";

/**
 * DonationMessageCard — 선택형 비공개 축하 메시지 카드 (F-14, UI-19 / SUB-07)
 *
 * - 추천 문구 버튼을 누르면 입력창 내용이 그 문구로 "교체"된다 (다른 문구를 누르면 다시 교체)
 * - 자동 입력된 문구는 자유롭게 수정 · 삭제할 수 있다
 * - 작성자는 계정 실명(authorName)으로 표시 — 익명/닉네임 없음
 * - 메시지는 생일자만 볼 수 있다는 안내를 항상 표시
 * - 미리보기에는 후원 금액을 표시하지 않는다
 */
import { Lock, X } from "lucide-react";
import { MESSAGE_MAX_LENGTH } from "@/lib/constants";
import { Textarea, Label } from "@/components/ui/input";

export const MESSAGE_TEMPLATES = ["생일 축하해! 🎂", "태어나줘서 고마워 💗", "오늘 하루 행복하게 보내! 🎉", "항상 좋은 일만 가득하길 ✨"];

interface DonationMessageCardProps {
  authorName: string;
  recipientName: string;
  message: string;
  onChange: (message: string) => void;
  disabled?: boolean;
}

export function DonationMessageCard({ authorName, recipientName, message, onChange, disabled }: DonationMessageCardProps) {
  return (
    <section aria-labelledby="message-card-title" className="rounded-md border-2 border-line bg-surface-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="message-card-title" className="text-title-sm text-ink">
          💌 축하 메시지 <span className="text-caption font-normal text-muted">(선택)</span>
        </h2>
        <span className="text-caption font-normal text-muted">보내는 사람: {authorName}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="추천 축하 문구">
        {MESSAGE_TEMPLATES.map((template) => (
          <button
            key={template}
            type="button"
            disabled={disabled}
            aria-pressed={message === template}
            onClick={() => onChange(template)}
            className="min-h-9 rounded-full border-2 border-line bg-surface px-3 text-body-sm text-ink hover:border-primary-active hover:bg-surface aria-pressed:border-primary-active aria-pressed:bg-primary-disabled disabled:opacity-50"
          >
            {template}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <Label htmlFor="donation-message" className="sr-only">
          축하 메시지 직접 입력
        </Label>
        <div className="relative">
          <Textarea
            id="donation-message"
            value={message}
            maxLength={MESSAGE_MAX_LENGTH}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`${recipientName}님에게 축하 메시지를 남겨보세요`}
            aria-describedby="donation-message-help"
            className="pr-10"
          />
          {message.length > 0 && (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-sm text-muted hover:bg-surface-strong hover:text-ink"
              aria-label="메시지 지우기"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <p id="donation-message-help" className="flex items-center justify-between text-caption font-normal text-muted">
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" aria-hidden /> 메시지는 {recipientName}님만 볼 수 있어요.
          </span>
          <span className="tabular-nums">
            {message.length}/{MESSAGE_MAX_LENGTH}
          </span>
        </p>
      </div>

      {message.trim().length > 0 && (
        <figure className="mt-3 rounded-xs border-2 border-line bg-surface p-3" aria-label="메시지 미리보기">
          <figcaption className="mb-1 text-caption text-primary-active">미리보기 · To. {recipientName}</figcaption>
          <blockquote className="whitespace-pre-wrap break-words text-body-sm text-ink">{message}</blockquote>
          <p className="mt-2 text-right text-caption font-normal text-muted">From. {authorName}</p>
        </figure>
      )}
    </section>
  );
}
