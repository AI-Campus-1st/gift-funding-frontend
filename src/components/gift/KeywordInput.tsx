"use client";

/**
 * KeywordInput — 관심사 키워드 칩 입력
 * - Enter 또는 쉼표로 추가, 칩의 × 버튼으로만 삭제 (최대 10개)
 * 사용 위치: AI 선물 추천(UI-11), 선물 취향 설정(UI-26)
 */
import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface KeywordInputProps {
  id: string;
  value: string[];
  onChange: (keywords: string[]) => void;
  max?: number;
  describedBy?: string;
}

export function KeywordInput({ id, value, onChange, max = 10, describedBy }: KeywordInputProps) {
  const [text, setText] = useState("");

  function add() {
    const keyword = text.replace(/,/g, "").trim();
    if (keyword && !value.includes(keyword) && value.length < max) onChange([...value, keyword]);
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter 무시
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
    // Backspace 는 입력창의 글자만 지운다. 이미 추가된 키워드는 칩의 × 버튼으로만 삭제한다.
    // (입력 중인 글자를 다 지운 뒤 한 번 더 누르면 기존 키워드까지 지워지던 문제 방지)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={text}
          placeholder={value.length >= max ? "더 추가할 수 없어요 (최대 개수 도달)" : "예) 음악, 캠핑"}
          disabled={value.length >= max}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={add}
          aria-describedby={describedBy}
        />
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="입력한 관심사">
          {value.map((k) => (
            <li key={k} className="inline-flex items-center gap-1 rounded-full border-2 border-primary-active bg-surface-soft py-0.5 pl-3 pr-1 text-body-sm text-ink">
              #{k}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== k))} className="grid size-7 place-items-center rounded-full hover:bg-primary-disabled" aria-label={`${k} 삭제`}>
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 여러 개 선택 가능한 토글 칩 (카테고리 등) */
export function ToggleChips({ options, value, onChange, label }: { options: string[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? value.filter((v) => v !== option) : [...value, option])}
            className={
              selected
                ? "min-h-9 rounded-full border-2 border-line-strong bg-lavender px-3 text-body-sm font-semibold text-ink"
                : "min-h-9 rounded-full border-2 border-line bg-surface px-3 text-body-sm text-body hover:bg-surface-soft"
            }
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
