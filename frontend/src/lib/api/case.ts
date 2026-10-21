/**
 * snake_case ↔ camelCase 변환 (서버 JSON ↔ 프론트 타입)
 *
 * - 서버(FastAPI · Mock 라우터)는 snake_case, 프론트 타입은 camelCase 를 쓴다. (rules.md 9.3)
 * - 변환은 lib/api 계층(http · mappers)에서만 한다. 화면 · 컴포넌트에서 직접 쓰지 않는다.
 * - 객체 "키"만 바꾸고 값(문자열 · 숫자)은 그대로 둔다.
 */

/** "imageUrl" → "image_url" (타입 수준) */
type SnakeKey<S extends string> = S extends `${infer Head}${infer Rest}`
  ? `${Head extends Lowercase<Head> ? Head : `_${Lowercase<Head>}`}${SnakeKey<Rest>}`
  : S;

/** 객체 · 배열 안쪽까지 키를 snake_case 로 바꾼 타입 */
export type Snake<T> = T extends (infer U)[]
  ? Snake<U>[]
  : T extends object
    ? { [K in keyof T as K extends string ? SnakeKey<K> : K]: Snake<T[K]> }
    : T;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function convertKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => convertKeys(v, convert));
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [convert(k), convertKeys(v, convert)]));
}

export const snakeKey = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const camelKey = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** 서버로 보낼 때: camelCase → snake_case */
export function toSnakeDeep<T>(value: T): Snake<T> {
  return convertKeys(value, snakeKey) as Snake<T>;
}

/** 서버에서 받을 때: snake_case → camelCase */
export function toCamelDeep<T>(value: Snake<T> | unknown): T {
  return convertKeys(value, camelKey) as T;
}
