"use client";

/**
 * GiftImageUploader — 선물 이미지 선택 · 미리보기 · 변경 · 삭제 (base.md 6.3 gift-image-uploader)
 * - 허용 형식(JPG/PNG/WEBP/GIF) · 크기(5MB) 안내를 항상 표시
 * - 선택한 이미지는 브라우저에서 축소 후 data URL 로 전달 (lib/image.ts)
 */
import { useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileToResizedDataUrl, validateImageFile } from "@/lib/image";

interface GiftImageUploaderProps {
  id: string;
  value: string;
  onChange: (dataUrl: string) => void;
  invalid?: boolean;
  describedBy?: string;
  label?: string;
}

export function GiftImageUploader({ id, value, onChange, invalid, describedBy, label = "선물 이미지" }: GiftImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorId = useId();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const message = validateImageFile(file);
    if (message) {
      setError(message);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      onChange(await fileToResizedDataUrl(file));
    } catch {
      setError("이미지 업로드에 실패했어요. 다른 이미지를 선택해 주세요.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-invalid={invalid || !!error}
        aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="flex items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={`${label} 미리보기`} className="size-28 rounded-md border-2 border-line object-cover" />
          <div className="flex flex-col gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={loading}>
              <ImagePlus aria-hidden /> 변경
            </Button>
            <Button type="button" variant="tertiary" size="sm" onClick={() => onChange("")}>
              <Trash2 aria-hidden /> 삭제
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line bg-surface-soft text-body-sm text-muted hover:border-line-strong hover:text-ink data-[invalid=true]:border-error"
          data-invalid={invalid || undefined}
          aria-label={`${label} 선택`}
        >
          <ImagePlus className="size-7" aria-hidden />
          {loading ? "이미지 처리 중..." : "이미지 선택하기"}
        </button>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
