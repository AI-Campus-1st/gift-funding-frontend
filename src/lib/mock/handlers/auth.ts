/**
 * Mock 서버 — 인증 · 사용자 관리 (API_SPEC 3.1, F-01 · F-02)
 * 사용 위치: lib/api/auth.ts → http → router
 */
import { ApiError } from "@/lib/api/client";
import { MAX_KEYWORDS } from "@/lib/constants";
import { validateBirthday, validateEmail, validateName, validatePassword, validatePasswordConfirm } from "@/lib/validation";
import type { GiftPreference, SignupInput } from "@/types";
import { findUser } from "../access";
import { createId, getDb, mockHash, saveDb, type MockDatabase } from "../db";
import { createMockToken } from "../token";
import { bodyOf, requireUser, route, type MockContext } from "./context";

const DAY = 60 * 60 * 24;
/** 로그인 토큰 유효기간 30일 (2026-10-19 확정, Q16). "로그인 상태 유지"는 브라우저를 닫아도 토큰을 남길지만 정한다 (lib/api/client.ts saveToken) */
const TOKEN_EXPIRE_DAYS = 30;

function toUser(db: MockDatabase, userId: string) {
  const u = findUser(db, userId);
  return { id: u.id, name: u.name, email: u.email, birthday: u.birthday, profileImageUrl: u.profileImage };
}

/** A1 회원가입: 모든 필수값을 다시 검증하고 이메일 중복을 막는다 */
function signup(ctx: MockContext) {
  const input = bodyOf<SignupInput>(ctx);
  const fieldErrors: Record<string, string> = {};
  const checks: [keyof SignupInput, string | null][] = [
    ["name", validateName(input.name ?? "")],
    ["email", validateEmail(input.email ?? "")],
    ["password", validatePassword(input.password ?? "")],
    ["passwordConfirm", validatePasswordConfirm(input.password ?? "", input.passwordConfirm ?? "")],
    ["birthday", validateBirthday(input.birthday ?? "")],
  ];
  for (const [field, error] of checks) if (error) fieldErrors[field] = error;
  if (Object.keys(fieldErrors).length > 0) throw new ApiError("VALIDATION", "입력값을 확인해 주세요.", { fieldErrors });

  const db = getDb();
  const email = input.email.trim().toLowerCase();
  if (db.users.some((u) => u.email === email)) {
    throw new ApiError("DUPLICATE_EMAIL", "이미 사용 중인 이메일입니다.", { fieldErrors: { email: "이미 사용 중인 이메일입니다." } });
  }
  const id = createId("u");
  db.users.push({
    id,
    name: input.name.trim(),
    email,
    passwordHash: mockHash(input.password), // 비밀번호 확인값은 저장하지 않는다
    birthday: input.birthday,
    profileImage: null,
    preference: { keywords: [], categories: [], priceRange: null },
  });
  saveDb();
  return { id };
}

/** A2 로그인: 실패 문구는 이메일 가입 여부를 드러내지 않도록 하나로 통일 */
function login(ctx: MockContext) {
  const { email = "", password = "" } = bodyOf<{ email: string; password: string; rememberMe: boolean }>(ctx);
  const db = getDb();
  const user = db.users.find((u) => u.email === email.trim().toLowerCase());
  if (!user || user.passwordHash !== mockHash(password)) throw new ApiError("INVALID_CREDENTIALS", "이메일 또는 비밀번호를 확인해 주세요.");
  return { accessToken: createMockToken(user.id), tokenType: "bearer", expiresIn: TOKEN_EXPIRE_DAYS * DAY, user: toUser(db, user.id) };
}

/** A5 프로필 수정 */
function updateProfile(ctx: MockContext) {
  const input = bodyOf<{ name: string; birthday: string; profileImageUrl: string | null }>(ctx);
  const fieldErrors: Record<string, string> = {};
  const nameError = validateName(input.name ?? "");
  const birthdayError = validateBirthday(input.birthday ?? "");
  if (nameError) fieldErrors.name = nameError;
  if (birthdayError) fieldErrors.birthday = birthdayError;
  if (Object.keys(fieldErrors).length > 0) throw new ApiError("VALIDATION", "입력값을 확인해 주세요.", { fieldErrors });

  const db = getDb();
  const user = findUser(db, requireUser(ctx));
  user.name = input.name.trim();
  user.birthday = input.birthday;
  user.profileImage = input.profileImageUrl ?? null;
  saveDb();
  return toUser(db, user.id);
}

/** A8 비밀번호 변경: 현재 비밀번호 확인 → 현재와 같은 비밀번호 거절 → 저장 (로그인 유지) */
function changePassword(ctx: MockContext) {
  const input = bodyOf<{ currentPassword: string; newPassword: string; newPasswordConfirm: string }>(ctx);
  const db = getDb();
  const user = findUser(db, requireUser(ctx));
  const values = { currentPassword: input.currentPassword ?? "", newPassword: input.newPassword ?? "", newPasswordConfirm: input.newPasswordConfirm ?? "" };
  // 백엔드와 같은 순서: 입력 검사 → 현재 비밀번호 확인 → 현재와 같은 비밀번호 거절 (같은지는 저장된 해시로 확인)
  const fieldErrors: Record<string, string> = {};
  if (values.currentPassword.length === 0) fieldErrors.currentPassword = "현재 비밀번호를 입력해 주세요.";
  const newError = validatePassword(values.newPassword);
  if (newError) fieldErrors.newPassword = newError;
  const confirmError = validatePasswordConfirm(values.newPassword, values.newPasswordConfirm);
  if (confirmError) fieldErrors.newPasswordConfirm = confirmError;
  if (Object.keys(fieldErrors).length > 0) throw new ApiError("VALIDATION", "입력값을 확인해 주세요.", { fieldErrors });
  if (user.passwordHash !== mockHash(values.currentPassword)) {
    throw new ApiError("VALIDATION", "현재 비밀번호가 일치하지 않습니다.", { fieldErrors: { currentPassword: "현재 비밀번호가 일치하지 않습니다." } });
  }
  if (user.passwordHash === mockHash(values.newPassword)) {
    const message = "현재 비밀번호와 다른 비밀번호를 입력해 주세요.";
    throw new ApiError("VALIDATION", message, { fieldErrors: { newPassword: message } });
  }
  user.passwordHash = mockHash(values.newPassword);
  saveDb();
  return undefined;
}

/** A7 취향 저장: 키워드는 공백 제거 · 중복 제거 · 최대 10개 */
function updatePreference(ctx: MockContext) {
  const input = bodyOf<GiftPreference>(ctx);
  const db = getDb();
  const user = findUser(db, requireUser(ctx));
  user.preference = {
    keywords: Array.from(new Set((input.keywords ?? []).map((k) => k.trim()).filter(Boolean))).slice(0, MAX_KEYWORDS),
    categories: input.categories ?? [],
    priceRange: input.priceRange ?? null,
  };
  saveDb();
  return user.preference;
}

export const authRoutes = [
  route("POST", "/auth/signup", signup, { status: 201, delay: 500 }),
  route("POST", "/auth/login", login, { delay: 400 }),
  route("POST", "/auth/logout", () => undefined, { delay: 100 }),
  route("GET", "/me", (ctx) => toUser(getDb(), requireUser(ctx)), { delay: 100 }),
  route("PATCH", "/me", updateProfile),
  route("PATCH", "/me/password", changePassword, { delay: 400 }),
  route("GET", "/me/preferences", (ctx) => findUser(getDb(), requireUser(ctx)).preference),
  route("PUT", "/me/preferences", updatePreference),
];
