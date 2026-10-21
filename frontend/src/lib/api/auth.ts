/**
 * 회원 · 인증 · 프로필 API (API_SPEC 3.1, F-01 · F-02)
 * 사용 위치: AuthProvider, 회원가입(UI-02), 로그인(UI-03), 마이페이지(UI-08, 25, 26)
 */
import type { GiftPreference, ProfileInput, SignupInput, User } from "@/types";
import { clearToken, saveToken } from "./client";
import type { AuthTokenDto, IdDto, PreferenceDto, UserDto } from "./dto";
import { http } from "./http";
import { fromDto, toDto, toProfileRequest, toUser } from "./mappers";

/** A1 회원가입 — 서버가 모든 값을 다시 검증하고 이메일 중복을 막는다 */
export async function signup(input: SignupInput): Promise<void> {
  await http.post<IdDto>("/auth/signup", toDto(input));
}

/** A2 로그인 — 받은 토큰을 "로그인 상태 유지" 여부에 따라 보관한다 */
export async function login(email: string, password: string, remember: boolean): Promise<User> {
  const res = await http.post<AuthTokenDto>("/auth/login", { email, password, remember_me: remember });
  saveToken(res.access_token, remember);
  return toUser(res.user);
}

/** A3 로그아웃 — 서버 응답과 관계없이 토큰을 지운다 */
export async function logout(): Promise<void> {
  try {
    await http.post<void>("/auth/logout");
  } finally {
    clearToken();
  }
}

/** A4 현재 로그인 사용자 */
export async function getMe(): Promise<User> {
  return toUser(await http.get<UserDto>("/me"));
}

/** A5 프로필 수정 */
export async function updateProfile(input: ProfileInput): Promise<User> {
  return toUser(await http.patch<UserDto>("/me", toProfileRequest(input)));
}

/** A8 비밀번호 변경 — 현재 비밀번호 확인 후 변경, 로그인은 유지된다 (docs/features/password-change.md) */
export async function changePassword(input: { currentPassword: string; newPassword: string; newPasswordConfirm: string }): Promise<void> {
  await http.patch<void>("/me/password", toDto(input));
}

/** A6 선물 취향 조회 */
export async function getPreference(): Promise<GiftPreference> {
  return fromDto<GiftPreference>(await http.get<PreferenceDto>("/me/preferences"));
}

/** A7 선물 취향 저장 (서버가 키워드 정리 · 최대 10개 적용) */
export async function updatePreference(input: GiftPreference): Promise<GiftPreference> {
  return fromDto<GiftPreference>(await http.put<PreferenceDto>("/me/preferences", toDto(input)));
}
