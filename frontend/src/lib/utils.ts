import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 조건부 className 을 합치고, 충돌하는 Tailwind 클래스는 뒤의 값으로 정리한다.
 * shadcn/ui 컴포넌트에서 공통으로 사용하는 헬퍼.
 * 예) cn("px-2", isActive && "bg-primary", "px-4") → "bg-primary px-4"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
