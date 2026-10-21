/** ProfileAvatar — 프로필 사진 (없으면 이름 첫 글자). 사용 위치: 마이페이지(UI-08), 프로필 수정(UI-25) */
export function ProfileAvatar({ name, image, size = 72 }: { name: string; image: string | null; size?: number }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={`${name} 프로필 사진`} width={size} height={size} className="rounded-full border-2 border-line-strong object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full border-2 border-line-strong bg-surface-soft text-display-md text-primary-active"
      style={{ width: size, height: size }}
      aria-label={`${name} 기본 프로필`}
      role="img"
    >
      {name.slice(0, 1)}
    </span>
  );
}
