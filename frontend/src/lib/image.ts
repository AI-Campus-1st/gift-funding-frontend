/**
 * 이미지 파일 → 축소된 data URL 변환
 *
 * 백엔드 업로드 API 가 아직 없으므로 선택한 이미지를 브라우저에서 줄여(최대 640px, JPEG)
 * 문자열로 보관한다. 원본을 그대로 저장하면 브라우저 저장 공간(약 5MB)을 금방 초과하기 때문.
 * 사용 위치: GiftImageUploader(선물 이미지), 프로필 수정(UI-25)
 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "JPG, PNG, WEBP, GIF 형식의 이미지만 등록할 수 있어요.";
  if (file.size > MAX_IMAGE_BYTES) return "5MB 이하의 이미지만 등록할 수 있어요.";
  return null;
}

export function fileToResizedDataUrl(file: File, maxSize = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("이미지를 처리하지 못했어요."));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
